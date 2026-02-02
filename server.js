
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import puppeteer from 'puppeteer';
import webpush from 'web-push'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- INTELLIGENT PATH FINDER ---
const findRootDirectory = () => {
    const candidates = [
        "C:\\PaymentSystem", 
        __dirname,           
        process.cwd(),       
        path.resolve(__dirname, '..') 
    ];

    for (const dir of candidates) {
        if (fs.existsSync(path.join(dir, 'package.json'))) {
            return dir;
        }
    }
    return "C:\\PaymentSystem";
};

const ROOT_DIR = findRootDirectory();
const DB_FILE = path.join(ROOT_DIR, 'database.json');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const WAUTH_DIR = path.join(ROOT_DIR, 'wauth');
const LOG_FILE = path.join(ROOT_DIR, 'server_status.log');

// --- CRITICAL ERROR LOGGING ---
const logToFile = (message) => {
    const timestamp = new Date().toISOString();
    try {
        if (!fs.existsSync(ROOT_DIR)) fs.mkdirSync(ROOT_DIR, { recursive: true });
        fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
        console.log(message);
    } catch (e) {
        console.error("Logger failed:", e);
    }
};

// --- PREVENT CRASH ON UNCAUGHT ERRORS ---
process.on('uncaughtException', (err) => {
    logToFile(`!!! UNCAUGHT EXCEPTION: ${err.message}`);
    console.error(err);
});

process.on('unhandledRejection', (reason, promise) => {
    logToFile(`!!! UNHANDLED REJECTION: ${reason}`);
});

// Ensure critical directories exist
[UPLOADS_DIR, BACKUPS_DIR, WAUTH_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch(e) { logToFile(`Error creating dir ${dir}: ${e.message}`); }
    }
});

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_BUILD_ID = Date.now().toString();

// --- INTEGRATION IMPORTS (WRAPPED SAFE) ---
let integrations = {};
try {
    const telegram = await import('./backend/telegram.js');
    const whatsapp = await import('./backend/whatsapp.js');
    const bale = await import('./backend/bale.js');
    integrations = { ...telegram, ...whatsapp, ...bale };
} catch (e) {
    logToFile("Integration Import Warning: " + e.message);
}

app.use(cors()); 
app.use(compression()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(ROOT_DIR, 'dist')));
app.use('/uploads', express.static(UPLOADS_DIR));

// --- DEFAULT DB STRUCTURE (The Source of Truth) ---
// This structure ensures all menus exist even if restoring old backups
const DEFAULT_DB = { 
    settings: { 
        currentTrackingNumber: 1000, 
        currentExitPermitNumber: 1000, 
        companyNames: [], 
        companies: [], 
        fiscalYears: [],
        rolePermissions: {},
        customRoles: [],
        operatingBankNames: [],
        commodityGroups: [],
        warehouseSequences: {},
        companyNotifications: {},
        insuranceCompanies: [],
        printTemplates: [],
        dailySecurityMeta: {},
        savedContacts: [],
        bankNames: []
    }, 
    orders: [], 
    exitPermits: [], 
    warehouseItems: [], 
    warehouseTransactions: [], 
    users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin' }], 
    messages: [], 
    groups: [], 
    tasks: [], 
    tradeRecords: [], 
    securityLogs: [], 
    personnelDelays: [], 
    securityIncidents: []
};

// --- FAIL-SAFE DATABASE LOADER WITH SMART MERGE ---
const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) {
            logToFile("DB Missing. Creating new.");
            saveDb(DEFAULT_DB);
            return DEFAULT_DB;
        }
        
        const data = fs.readFileSync(DB_FILE, 'utf8');
        if (!data || data.trim() === '') {
             throw new Error("Empty DB File");
        }
        
        const parsed = JSON.parse(data);
        if (!parsed.users) throw new Error("Invalid DB Structure");
        
        // --- SMART MERGE: Preserve Defaults for Missing Keys ---
        // Ensure ALL root arrays exist (Prevents "undefined" errors in UI)
        const safeDB = { ...DEFAULT_DB, ...parsed };

        // Force ensure array types
        const arrayKeys = [
            'orders', 'exitPermits', 'warehouseItems', 'warehouseTransactions', 
            'users', 'messages', 'groups', 'tasks', 'tradeRecords', 
            'securityLogs', 'personnelDelays', 'securityIncidents'
        ];

        arrayKeys.forEach(key => {
            if (!Array.isArray(safeDB[key])) {
                safeDB[key] = []; 
            }
        });

        // Ensure Settings Object exists and merge deep settings
        if (!safeDB.settings) safeDB.settings = { ...DEFAULT_DB.settings };
        safeDB.settings = { ...DEFAULT_DB.settings, ...safeDB.settings };

        return safeDB;

    } catch (e) {
        logToFile(`!!! CRITICAL DB CORRUPTION: ${e.message}`);
        try {
            const corruptName = path.join(ROOT_DIR, `database_corrupt_${Date.now()}.json`);
            if (fs.existsSync(DB_FILE)) {
                fs.renameSync(DB_FILE, corruptName);
                logToFile(`>>> Moved corrupt DB to: ${corruptName}`);
            }
        } catch (renameErr) {
            logToFile(`Failed to rename corrupt DB: ${renameErr.message}`);
        }
        return DEFAULT_DB; 
    }
};

const saveDb = (data) => {
    try {
        const tempFile = `${DB_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
        fs.renameSync(tempFile, DB_FILE);
    } catch (e) {
        logToFile("!!! Error saving DB: " + e.message);
    }
};

// --- AUTOMATIC BACKUP SYSTEM (HOURLY) ---
const scheduleAutoBackup = () => {
    logToFile(">>> Initializing Auto-Backup System (Every Hour)");
    cron.schedule('0 * * * *', () => {
        try {
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(BACKUPS_DIR, `auto_backup_${timestamp}.json`);
            
            if (fs.existsSync(DB_FILE)) {
                fs.copyFileSync(DB_FILE, backupPath);
                
                // Cleanup: Keep only last 48 hours of backups
                const files = fs.readdirSync(BACKUPS_DIR);
                const nowMs = Date.now();
                const retentionMs = 48 * 60 * 60 * 1000; 
                
                files.forEach(file => {
                    if (file.startsWith('auto_backup_')) {
                        const filePath = path.join(BACKUPS_DIR, file);
                        const stats = fs.statSync(filePath);
                        if (nowMs - stats.mtimeMs > retentionMs) {
                            fs.unlinkSync(filePath);
                        }
                    }
                });
            }
        } catch (e) {
            logToFile(`[AutoBackup] Failed: ${e.message}`);
        }
    });
};
scheduleAutoBackup();


// --- HELPER FOR NEXT NUMBER ---
const findNextNumberByFiscalYear = (db, arr, key, type, fiscalYearId, companyName) => {
    let startNum = 1000;
    try {
        const safeArr = Array.isArray(arr) ? arr : [];
        const safeCompany = companyName ? companyName.trim() : '';
        
        // 1. Check Fiscal Year Settings
        if (fiscalYearId && safeCompany && db.settings.fiscalYears) {
            const activeYear = db.settings.fiscalYears.find(y => y.id === fiscalYearId);
            if (activeYear && activeYear.companySequences) {
                const seqConfig = activeYear.companySequences[safeCompany];
                if (seqConfig) {
                    if (type === 'payment') startNum = seqConfig.startTrackingNumber || 1000;
                    else if (type === 'exit') startNum = seqConfig.startExitPermitNumber || 1000;
                    else if (type === 'bijak') startNum = seqConfig.startBijakNumber || 1000;
                }
            }
        } else {
            // 2. Fallback to Global Settings
            if (type === 'payment') startNum = db.settings.currentTrackingNumber || 1000;
            else if (type === 'exit') startNum = db.settings.currentExitPermitNumber || 1000;
            else if (type === 'bijak') {
                const sequences = db.settings.warehouseSequences || {};
                startNum = sequences[safeCompany] || 1000;
            }
        }
        
        // 3. Find Max in Existing Data (to prevent duplicates)
        // Only consider items from the same company if fiscal year logic applies, otherwise global max
        // For simplicity and safety, we look for the max existing number that is >= startNum
        const existing = safeArr.map(o => Number(o[key])).filter(n => !isNaN(n)).sort((a, b) => a - b);
        
        let next = startNum;
        if (existing.length > 0) {
             const maxExisting = existing[existing.length - 1];
             if (maxExisting >= startNum) {
                 next = maxExisting + 1;
             }
        }
        return next;
    } catch (e) {
        return 1001; 
    }
};

// --- ROUTES ---
app.get('/api/version', (req, res) => res.json({ version: SERVER_BUILD_ID }));

// --- SMART RESTORE ENDPOINT ---
app.post('/api/emergency-restore', (req, res) => {
    try {
        const { fileData } = req.body;
        if (!fileData) return res.status(400).json({ success: false, error: 'No file data' });

        const base64Data = fileData.replace(/^data:.*?;base64,/, "");
        const jsonContent = Buffer.from(base64Data, 'base64').toString('utf-8');
        const parsedBackup = JSON.parse(jsonContent);

        if (!parsedBackup.users) return res.status(400).json({ success: false, error: 'Invalid backup: No users found' });

        // Backup current state before restoring
        if (fs.existsSync(DB_FILE)) {
            fs.copyFileSync(DB_FILE, path.join(BACKUPS_DIR, `pre_restore_${Date.now()}.json`));
        }

        // --- SMART MERGE LOGIC (CRITICAL FOR UPDATES) ---
        // 1. Start with fresh DEFAULT_DB (This has all new fields from update)
        const finalDB = JSON.parse(JSON.stringify(DEFAULT_DB));

        // 2. Helper to merge arrays safely
        const mergeArray = (key) => {
            if (parsedBackup[key] && Array.isArray(parsedBackup[key])) {
                finalDB[key] = parsedBackup[key];
            }
        };

        // 3. Merge ALL Data Arrays (Old + New Support)
        mergeArray('orders');
        mergeArray('exitPermits');
        mergeArray('warehouseItems');
        mergeArray('warehouseTransactions');
        mergeArray('users');
        mergeArray('messages');
        mergeArray('groups');
        mergeArray('tasks');
        mergeArray('tradeRecords');
        mergeArray('securityLogs');
        mergeArray('personnelDelays');
        mergeArray('securityIncidents');

        // 4. Merge Settings (Deep Merge)
        // Keep new settings keys (like dailySecurityMeta) even if backup doesn't have them
        if (parsedBackup.settings) {
            finalDB.settings = { ...DEFAULT_DB.settings, ...parsedBackup.settings };
            
            // Re-ensure arrays
            ['companies', 'companyNames', 'fiscalYears', 'savedContacts'].forEach(key => {
                 if (!Array.isArray(finalDB.settings[key])) finalDB.settings[key] = [];
            });
        }

        saveDb(finalDB);
        logToFile(`>>> DATABASE SMART RESTORE SUCCESSFUL`);
        res.json({ success: true });
    } catch (e) {
        logToFile(`Restore Failed: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Full Backup Download
app.get('/api/full-backup', async (req, res) => {
    try {
        const db = getDb();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=backup_${Date.now()}.json`);
        res.json(db); // Sends complete DB object
    } catch (e) {
        res.status(500).send("Backup Error");
    }
});

const safeHandler = (fn) => (req, res) => {
    try {
        fn(req, res);
    } catch (e) {
        logToFile(`Route Error ${req.path}: ${e.message}`);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

app.post('/api/login', safeHandler((req, res) => { 
    const db = getDb();
    const u = db.users.find(x => x.username === req.body.username && x.password === req.body.password); 
    u ? res.json(u) : res.status(401).send('Invalid'); 
}));

// --- ORDERS ---
app.get('/api/orders', safeHandler((req, res) => res.json(getDb().orders || [])));
app.post('/api/orders', safeHandler((req, res) => { 
    const db = getDb(); 
    const order = req.body; 
    order.id = Date.now().toString(); 
    // Use Fiscal Year Numbering
    order.trackingNumber = findNextNumberByFiscalYear(db, db.orders, 'trackingNumber', 'payment', db.settings.activeFiscalYearId, order.payingCompany);
    
    // Update global counter if no fiscal year specific
    if (!db.settings.activeFiscalYearId) {
         db.settings.currentTrackingNumber = order.trackingNumber;
    }

    db.orders.unshift(order); 
    saveDb(db); 
    res.json(db.orders); 
}));
app.put('/api/orders/:id', safeHandler((req, res) => { const db=getDb(); const idx=db.orders.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.orders[idx]={...db.orders[idx],...req.body}; saveDb(db); res.json(db.orders); } else res.sendStatus(404); }));
app.delete('/api/orders/:id', safeHandler((req, res) => { const db=getDb(); db.orders=db.orders.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.orders); }));

// --- EXIT PERMITS (Numbering Fix) ---
app.get('/api/exit-permits', safeHandler((req, res) => res.json(getDb().exitPermits || [])));
app.post('/api/exit-permits', safeHandler((req, res) => { 
    const db = getDb(); 
    const permit = req.body; 
    
    // 1. Calculate Number using Fiscal Year logic
    // Note: 'permit.recipientName' is usually not the company, we need 'payingCompany' equivalent. 
    // But Exit Permits don't strictly have a 'payingCompany' field in standard form, usually the sender is the default company.
    // We assume the system default company or if user provided one.
    const company = db.settings.defaultCompany; // Default context for numbering
    
    permit.permitNumber = findNextNumberByFiscalYear(db, db.exitPermits, 'permitNumber', 'exit', db.settings.activeFiscalYearId, company);
    
    // 2. Update Counters
    if (!db.settings.activeFiscalYearId) {
        db.settings.currentExitPermitNumber = permit.permitNumber;
    }

    db.exitPermits.push(permit); 
    saveDb(db); 
    res.json(db.exitPermits); 
}));
app.put('/api/exit-permits/:id', safeHandler((req, res) => { const db=getDb(); const idx=db.exitPermits.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.exitPermits[idx]={...db.exitPermits[idx],...req.body}; saveDb(db); res.json(db.exitPermits); } else res.sendStatus(404); }));
app.delete('/api/exit-permits/:id', safeHandler((req, res) => { const db=getDb(); db.exitPermits=db.exitPermits.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.exitPermits); }));

// --- EXIT PERMIT NUMBER PREVIEW ---
app.get('/api/next-exit-permit-number', safeHandler((req, res) => {
    const db = getDb();
    const company = db.settings.defaultCompany;
    const nextNum = findNextNumberByFiscalYear(db, db.exitPermits, 'permitNumber', 'exit', db.settings.activeFiscalYearId, company);
    res.json({ nextNumber: nextNum });
}));

// --- WAREHOUSE ---
app.get('/api/warehouse/items', safeHandler((req, res) => res.json(getDb().warehouseItems || [])));
app.post('/api/warehouse/items', safeHandler((req, res) => { const db=getDb(); db.warehouseItems.push(req.body); saveDb(db); res.json(db.warehouseItems); }));
app.put('/api/warehouse/items/:id', safeHandler((req, res) => { const db=getDb(); const idx=db.warehouseItems.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.warehouseItems[idx]={...db.warehouseItems[idx], ...req.body}; saveDb(db); res.json(db.warehouseItems); } else res.sendStatus(404); }));
app.delete('/api/warehouse/items/:id', safeHandler((req, res) => { const db=getDb(); db.warehouseItems=db.warehouseItems.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.warehouseItems); }));

app.get('/api/warehouse/transactions', safeHandler((req, res) => res.json(getDb().warehouseTransactions || [])));
app.post('/api/warehouse/transactions', safeHandler((req, res) => { const db=getDb(); db.warehouseTransactions.unshift(req.body); saveDb(db); res.json(db.warehouseTransactions); }));
app.put('/api/warehouse/transactions/:id', safeHandler((req, res) => { const db=getDb(); const idx=db.warehouseTransactions.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.warehouseTransactions[idx]={...db.warehouseTransactions[idx], ...req.body}; saveDb(db); res.json(db.warehouseTransactions); } else res.sendStatus(404); }));
app.delete('/api/warehouse/transactions/:id', safeHandler((req, res) => { const db=getDb(); db.warehouseTransactions=db.warehouseTransactions.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.warehouseTransactions); }));

// --- SETTINGS ---
app.get('/api/settings', safeHandler((req, res) => res.json(getDb().settings)));
app.post('/api/settings', safeHandler((req, res) => { const db = getDb(); db.settings = { ...db.settings, ...req.body }; saveDb(db); res.json(db.settings); }));
app.get('/api/users', safeHandler((req, res) => res.json(getDb().users || [])));

// Serve React App
app.get('*', (req, res) => { 
    const p = path.join(ROOT_DIR, 'dist', 'index.html'); 
    if(fs.existsSync(p)) res.sendFile(p); 
    else res.send('System is running. React build not found in dist/.'); 
});

const server = app.listen(PORT, '0.0.0.0', () => {
    logToFile(`\n>>> Server successfully running on port ${PORT}`);
    logToFile(`>>> Root: ${ROOT_DIR}`);
});
