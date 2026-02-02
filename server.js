
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
let integrations = {
    whatsapp: null,
    telegram: null,
    bale: null
};

(async () => {
    try {
        integrations.telegram = await import('./backend/telegram.js');
    } catch (e) { logToFile("Telegram Import Warning: " + e.message); }
    
    try {
        integrations.whatsapp = await import('./backend/whatsapp.js');
    } catch (e) { logToFile("WhatsApp Import Warning: " + e.message); }
    
    try {
        integrations.bale = await import('./backend/bale.js');
    } catch (e) { logToFile("Bale Import Warning: " + e.message); }
})();

app.use(cors()); 
app.use(compression()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(ROOT_DIR, 'dist')));
app.use('/uploads', express.static(UPLOADS_DIR));

// --- DEFAULT DB STRUCTURE (The Source of Truth) ---
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

// --- FAIL-SAFE DATABASE LOADER ---
const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) {
            logToFile("DB Missing. Creating new.");
            saveDb(DEFAULT_DB);
            return DEFAULT_DB;
        }
        
        const data = fs.readFileSync(DB_FILE, 'utf8');
        if (!data || data.trim() === '') throw new Error("Empty DB File");
        
        const parsed = JSON.parse(data);
        if (!parsed.users) throw new Error("Invalid DB Structure");
        
        return { ...DEFAULT_DB, ...parsed };

    } catch (e) {
        logToFile(`!!! CRITICAL DB CORRUPTION: ${e.message}`);
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


// --- ULTIMATE NUMBER GENERATOR (FORCE MODE) ---
// This function doesn't trust settings. It looks at the ACTUAL data.
const calculateNextNumber = (db, type, companyName = null) => {
    let maxFound = 0;
    let settingStart = 1000;
    
    // 1. Determine Start From Settings (as a baseline fallback)
    const activeYearId = db.settings.activeFiscalYearId;
    const activeYear = activeYearId ? db.settings.fiscalYears?.find(y => y.id === activeYearId) : null;
    const safeCompany = companyName ? companyName.trim() : (db.settings.defaultCompany || '');

    if (type === 'payment') {
        // Try to get from Fiscal Year first
        if (activeYear && activeYear.companySequences && activeYear.companySequences[safeCompany]) {
            settingStart = parseInt(activeYear.companySequences[safeCompany].startTrackingNumber) || 1000;
        } else {
            // Fallback to global setting
            settingStart = parseInt(db.settings.currentTrackingNumber) || 1000;
        }
        
        // SCAN DB FOR MAX
        if (db.orders && Array.isArray(db.orders)) {
            db.orders.forEach(o => {
                const num = parseInt(o.trackingNumber);
                if (!isNaN(num) && num > maxFound) maxFound = num;
            });
        }

    } else if (type === 'exit') {
        // Try to get from Fiscal Year first
        if (activeYear && activeYear.companySequences && activeYear.companySequences[safeCompany]) {
            settingStart = parseInt(activeYear.companySequences[safeCompany].startExitPermitNumber) || 1000;
        } else {
            // Fallback to global setting
            settingStart = parseInt(db.settings.currentExitPermitNumber) || 1000;
        }

        // SCAN DB FOR MAX
        if (db.exitPermits && Array.isArray(db.exitPermits)) {
            db.exitPermits.forEach(p => {
                const num = parseInt(p.permitNumber);
                if (!isNaN(num) && num > maxFound) maxFound = num;
            });
        }

    } else if (type === 'bijak') {
        // Bijak is strictly per company usually
        if (activeYear && activeYear.companySequences && activeYear.companySequences[safeCompany]) {
             settingStart = parseInt(activeYear.companySequences[safeCompany].startBijakNumber) || 1000;
        } else if (db.settings.warehouseSequences && db.settings.warehouseSequences[safeCompany]) {
             settingStart = parseInt(db.settings.warehouseSequences[safeCompany]) || 1000;
        }

        // SCAN DB FOR MAX (Filtered by Company)
        if (db.warehouseTransactions && Array.isArray(db.warehouseTransactions)) {
            db.warehouseTransactions
                .filter(t => t.type === 'OUT' && (!safeCompany || t.company === safeCompany))
                .forEach(t => {
                    const num = parseInt(t.number);
                    if (!isNaN(num) && num > maxFound) maxFound = num;
                });
        }
    }

    // Logic: If data exists > setting, take data + 1. Else take setting.
    // This handles the case where user manually sets a high number in settings, 
    // OR if they reset settings but DB still has high numbers.
    
    // Safety check for NaN
    if (isNaN(maxFound)) maxFound = 0;
    if (isNaN(settingStart)) settingStart = 1000;

    let next = Math.max(maxFound + 1, settingStart);
    
    // Explicitly log this calculation for debugging
    logToFile(`[AutoNum] Type: ${type}, Company: ${safeCompany || 'ALL'}, MaxInDB: ${maxFound}, Setting: ${settingStart} -> NEXT: ${next}`);

    return next;
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

        if (fs.existsSync(DB_FILE)) {
            fs.copyFileSync(DB_FILE, path.join(BACKUPS_DIR, `pre_restore_${Date.now()}.json`));
        }

        const finalDB = JSON.parse(JSON.stringify(DEFAULT_DB));

        const restoreList = [
            'orders', 'exitPermits', 'warehouseItems', 'warehouseTransactions', 'users', 
            'messages', 'groups', 'tasks', 'tradeRecords', 'securityLogs', 
            'personnelDelays', 'securityIncidents'
        ];

        restoreList.forEach(key => {
            if (parsedBackup[key] && Array.isArray(parsedBackup[key])) {
                finalDB[key] = parsedBackup[key];
            }
        });

        if (parsedBackup.settings) {
            finalDB.settings = { ...DEFAULT_DB.settings, ...parsedBackup.settings };
            ['companies', 'companyNames', 'fiscalYears', 'savedContacts'].forEach(key => {
                 if (!Array.isArray(finalDB.settings[key])) finalDB.settings[key] = [];
            });
        }

        saveDb(finalDB);
        logToFile(`>>> DATABASE SMART RESTORE SUCCESSFUL (Merged ${Object.keys(parsedBackup).length} keys)`);
        res.json({ success: true });
    } catch (e) {
        logToFile(`Restore Failed: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/full-backup', async (req, res) => {
    try {
        const db = getDb();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=backup_${Date.now()}.json`);
        res.json(db); 
    } catch (e) {
        res.status(500).send("Backup Error");
    }
});

// --- WHATSAPP RESTART ROUTE ---
app.post('/api/whatsapp/restart', async (req, res) => {
    try {
        const waModule = integrations.whatsapp;
        
        if (waModule && typeof waModule.restartSession === 'function') {
            await waModule.restartSession(WAUTH_DIR);
            res.json({ success: true, message: "WhatsApp session restarting..." });
        } else {
            try {
                 const newWa = await import('./backend/whatsapp.js');
                 if (newWa && typeof newWa.restartSession === 'function') {
                     await newWa.restartSession(WAUTH_DIR);
                     integrations.whatsapp = newWa;
                     return res.json({ success: true, message: "WhatsApp re-imported and restarting..." });
                 }
            } catch(reImportErr) {
                logToFile(`WA Re-import failed: ${reImportErr.message}`);
            }
            
            res.status(500).json({ success: false, error: "WhatsApp module not loaded or function missing" });
        }
    } catch (e) {
        logToFile(`WA Restart Error: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
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
    
    // FORCE CALCULATION
    const nextNum = calculateNextNumber(db, 'payment', order.payingCompany);
    order.trackingNumber = nextNum;
    
    // Sync settings if needed (optional, just to keep it somewhat updated)
    if (!db.settings.activeFiscalYearId) {
         db.settings.currentTrackingNumber = nextNum;
    }
    
    db.orders.unshift(order); 
    saveDb(db); 
    res.json(db.orders); 
}));

app.put('/api/orders/:id', safeHandler((req, res) => { const db=getDb(); const idx=db.orders.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.orders[idx]={...db.orders[idx],...req.body}; saveDb(db); res.json(db.orders); } else res.sendStatus(404); }));
app.delete('/api/orders/:id', safeHandler((req, res) => { const db=getDb(); db.orders=db.orders.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.orders); }));

// --- NEW ENDPOINT FOR NEXT TRACKING NUMBER ---
app.get('/api/next-tracking-number', safeHandler((req, res) => {
    const db = getDb();
    const company = req.query.company; 
    // FORCE CALCULATION
    const nextNum = calculateNextNumber(db, 'payment', company);
    res.json({ nextTrackingNumber: nextNum });
}));

// --- EXIT PERMITS ---
app.get('/api/exit-permits', safeHandler((req, res) => res.json(getDb().exitPermits || [])));
app.post('/api/exit-permits', safeHandler((req, res) => { 
    const db = getDb(); 
    const permit = req.body; 
    
    // FORCE CALCULATION
    // Note: Exit permits usually don't have a 'company' field in the root object in legacy logic, 
    // but if you have added it, pass it. Assuming global sequence or default company for now.
    const company = db.settings.defaultCompany; 
    const nextNum = calculateNextNumber(db, 'exit', company);
    permit.permitNumber = nextNum;
    
    if (!db.settings.activeFiscalYearId) {
        db.settings.currentExitPermitNumber = nextNum;
    }

    db.exitPermits.push(permit); 
    saveDb(db); 
    res.json(db.exitPermits); 
}));
app.put('/api/exit-permits/:id', safeHandler((req, res) => { const db=getDb(); const idx=db.exitPermits.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.exitPermits[idx]={...db.exitPermits[idx],...req.body}; saveDb(db); res.json(db.exitPermits); } else res.sendStatus(404); }));
app.delete('/api/exit-permits/:id', safeHandler((req, res) => { const db=getDb(); db.exitPermits=db.exitPermits.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.exitPermits); }));

app.get('/api/next-exit-permit-number', safeHandler((req, res) => {
    const db = getDb();
    const company = db.settings.defaultCompany;
    // FORCE CALCULATION
    const nextNum = calculateNextNumber(db, 'exit', company);
    res.json({ nextNumber: nextNum });
}));

// --- WAREHOUSE ---
app.get('/api/warehouse/items', safeHandler((req, res) => res.json(getDb().warehouseItems || [])));
app.post('/api/warehouse/items', safeHandler((req, res) => { const db=getDb(); db.warehouseItems.push(req.body); saveDb(db); res.json(db.warehouseItems); }));
app.put('/api/warehouse/items/:id', safeHandler((req, res) => { const db=getDb(); const idx=db.warehouseItems.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.warehouseItems[idx]={...db.warehouseItems[idx], ...req.body}; saveDb(db); res.json(db.warehouseItems); } else res.sendStatus(404); }));
app.delete('/api/warehouse/items/:id', safeHandler((req, res) => { const db=getDb(); db.warehouseItems=db.warehouseItems.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.warehouseItems); }));

app.get('/api/warehouse/transactions', safeHandler((req, res) => res.json(getDb().warehouseTransactions || [])));
app.post('/api/warehouse/transactions', safeHandler((req, res) => { 
    const db=getDb(); 
    const tx = req.body;
    
    // Ensure unique number for OUT transactions
    if (tx.type === 'OUT') {
         const nextNum = calculateNextNumber(db, 'bijak', tx.company);
         tx.number = nextNum;
         
         // Sync setting
         if (!db.settings.warehouseSequences) db.settings.warehouseSequences = {};
         db.settings.warehouseSequences[tx.company] = nextNum;
    }
    
    db.warehouseTransactions.unshift(tx); 
    saveDb(db); 
    res.json(db.warehouseTransactions); 
}));
app.put('/api/warehouse/transactions/:id', safeHandler((req, res) => { const db=getDb(); const idx=db.warehouseTransactions.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.warehouseTransactions[idx]={...db.warehouseTransactions[idx], ...req.body}; saveDb(db); res.json(db.warehouseTransactions); } else res.sendStatus(404); }));
app.delete('/api/warehouse/transactions/:id', safeHandler((req, res) => { const db=getDb(); db.warehouseTransactions=db.warehouseTransactions.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.warehouseTransactions); }));

// --- NEW BIJAK NUMBER ENDPOINT ---
app.get('/api/next-bijak-number', safeHandler((req, res) => {
    const db = getDb();
    const company = req.query.company;
    if (!company) return res.json({ nextNumber: 1000 });
    
    const nextNum = calculateNextNumber(db, 'bijak', company);
    res.json({ nextNumber: nextNum });
}));

// --- TRADE ---
app.get('/api/trade', safeHandler((req, res) => res.json(getDb().tradeRecords || [])));
app.post('/api/trade', safeHandler((req, res) => { const db=getDb(); db.tradeRecords.push(req.body); saveDb(db); res.json(db.tradeRecords); }));
app.put('/api/trade/:id', safeHandler((req, res) => { const db=getDb(); const idx=db.tradeRecords.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.tradeRecords[idx]={...db.tradeRecords[idx],...req.body}; saveDb(db); res.json(db.tradeRecords); } else res.sendStatus(404); }));
app.delete('/api/trade/:id', safeHandler((req, res) => { const db=getDb(); db.tradeRecords=db.tradeRecords.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.tradeRecords); }));

// --- SECURITY ---
app.get('/api/security/logs', safeHandler((req, res) => res.json(getDb().securityLogs || [])));
app.post('/api/security/logs', safeHandler((req, res) => { const db=getDb(); db.securityLogs.push(req.body); saveDb(db); res.json(db.securityLogs); }));
app.put('/api/security/logs/:id', safeHandler((req, res) => { const db=getDb(); const idx=db.securityLogs.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.securityLogs[idx]={...db.securityLogs[idx],...req.body}; saveDb(db); res.json(db.securityLogs); } else res.sendStatus(404); }));
app.delete('/api/security/logs/:id', safeHandler((req, res) => { const db=getDb(); db.securityLogs=db.securityLogs.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.securityLogs); }));

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
