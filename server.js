
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
const VAPID_FILE = path.join(ROOT_DIR, 'vapid.json');
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
    // Keep process alive
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

// --- DEFAULT DB STRUCTURE ---
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

// --- FAIL-SAFE DATABASE LOADER WITH DEEP SANITIZATION ---
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
        
        // 1. Root Level Sanitization
        const safeDB = { ...DEFAULT_DB, ...parsed };
        
        // Ensure root arrays are arrays
        ['orders', 'exitPermits', 'warehouseItems', 'warehouseTransactions', 'users', 'messages', 'tradeRecords', 'securityLogs', 'personnelDelays'].forEach(key => {
            if (!Array.isArray(safeDB[key])) safeDB[key] = [];
        });

        // 2. Deep Sanitization for Orders
        safeDB.orders = safeDB.orders.map(order => ({
            ...order,
            paymentDetails: Array.isArray(order.paymentDetails) ? order.paymentDetails : [],
            attachments: Array.isArray(order.attachments) ? order.attachments : []
        }));

        // 3. Deep Sanitization for Exit Permits (Critical for your issue)
        safeDB.exitPermits = safeDB.exitPermits.map(permit => ({
            ...permit,
            items: Array.isArray(permit.items) ? permit.items : [],
            destinations: Array.isArray(permit.destinations) ? permit.destinations : []
        }));

        // 4. Warehouse Transactions
        safeDB.warehouseTransactions = safeDB.warehouseTransactions.map(tx => ({
            ...tx,
            items: Array.isArray(tx.items) ? tx.items : []
        }));

        // 5. Settings Sanitization
        if (safeDB.settings) {
            if (!Array.isArray(safeDB.settings.companies)) safeDB.settings.companies = [];
            safeDB.settings.companies = safeDB.settings.companies.map(c => ({
                ...c,
                banks: Array.isArray(c.banks) ? c.banks : []
            }));
        }

        return safeDB;

    } catch (e) {
        logToFile(`!!! CRITICAL DB CORRUPTION: ${e.message}`);
        
        // Backup corrupt file
        try {
            const corruptName = path.join(ROOT_DIR, `database_corrupt_${Date.now()}.json`);
            if (fs.existsSync(DB_FILE)) {
                fs.renameSync(DB_FILE, corruptName);
                logToFile(`>>> Moved corrupt DB to: ${corruptName}`);
            }
        } catch (renameErr) {
            logToFile(`Failed to rename corrupt DB: ${renameErr.message}`);
        }

        // Return default so server starts
        logToFile(">>> Starting with FRESH DATABASE to allow recovery.");
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

const findNextNumberByFiscalYear = (db, arr, key, type, fiscalYearId, companyName) => {
    let startNum = 1000;
    try {
        // SAFE GUARD: Ensure arr is an array
        const safeArr = Array.isArray(arr) ? arr : [];

        const safeCompany = companyName ? companyName.trim() : '';
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
            if (type === 'payment') startNum = db.settings.currentTrackingNumber || 1000;
            else if (type === 'exit') startNum = db.settings.currentExitPermitNumber || 1000;
            else if (type === 'bijak') {
                const sequences = db.settings.warehouseSequences || {};
                startNum = sequences[safeCompany] || 1000;
            }
        }
        const filtered = safeCompany ? safeArr.filter(item => {
            const itemComp = (type === 'payment' ? item.payingCompany : (type === 'bijak' ? item.company : item.companyName)); // Exit permit uses companyName? No, usually no company field on root, mostly requester.
            // For ExitPermit numbering logic in legacy was global or simple. Assuming global if no company.
            return itemComp && itemComp.trim() === safeCompany;
        }) : safeArr;
        const existing = filtered.map(o => Number(o[key])).filter(n => !isNaN(n)).sort((a, b) => a - b);
        let next = existing.length > 0 ? Math.max(existing[existing.length - 1] + 1, startNum) : startNum;
        return next;
    } catch (e) {
        logToFile("findNextNumber Error: " + e.message);
        return 1001; 
    }
};

// --- ROUTES ---
app.get('/api/version', (req, res) => res.json({ version: SERVER_BUILD_ID }));

// Emergency Restore with STRICT TYPE SANITIZATION
app.post('/api/emergency-restore', (req, res) => {
    try {
        const { fileData } = req.body;
        if (!fileData) return res.status(400).json({ success: false, error: 'No file data' });

        const base64Data = fileData.replace(/^data:.*?;base64,/, "");
        const jsonContent = Buffer.from(base64Data, 'base64').toString('utf-8');
        const parsed = JSON.parse(jsonContent);

        if (!parsed.users) return res.status(400).json({ success: false, error: 'Invalid backup structure' });

        if (fs.existsSync(DB_FILE)) {
            fs.copyFileSync(DB_FILE, path.join(BACKUPS_DIR, `pre_restore_${Date.now()}.json`));
        }

        const ensureArray = (val) => Array.isArray(val) ? val : [];
        const ensureObject = (val) => (val && typeof val === 'object' && !Array.isArray(val)) ? val : {};

        const finalDB = { ...DEFAULT_DB, ...parsed };
        finalDB.orders = ensureArray(parsed.orders);
        finalDB.exitPermits = ensureArray(parsed.exitPermits);
        finalDB.warehouseItems = ensureArray(parsed.warehouseItems);
        finalDB.warehouseTransactions = ensureArray(parsed.warehouseTransactions);
        finalDB.users = ensureArray(parsed.users);
        
        saveDb(finalDB);
        logToFile(`>>> DATABASE RESTORED SUCCESSFULLY`);
        res.json({ success: true });
    } catch (e) {
        logToFile(`Restore Failed: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Safe Route Wrapper
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
    order.trackingNumber = findNextNumberByFiscalYear(db, db.orders, 'trackingNumber', 'payment', db.settings.activeFiscalYearId, order.payingCompany); 
    db.orders.unshift(order); 
    saveDb(db); 
    res.json(db.orders); 
}));
app.put('/api/orders/:id', safeHandler((req, res) => { const db=getDb(); const idx=db.orders.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.orders[idx]={...db.orders[idx],...req.body}; saveDb(db); res.json(db.orders); } else res.sendStatus(404); }));
app.delete('/api/orders/:id', safeHandler((req, res) => { const db=getDb(); db.orders=db.orders.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.orders); }));

// --- EXIT PERMITS (CRITICAL MISSING PART RESTORED) ---
app.get('/api/exit-permits', safeHandler((req, res) => res.json(getDb().exitPermits || [])));
app.post('/api/exit-permits', safeHandler((req, res) => { 
    const db = getDb(); 
    const permit = req.body; 
    // Usually permit number is pre-calculated on client or simple int
    // If client sends permitNumber, use it, else calculate. 
    // Usually client calls getNextExitPermitNumber first.
    db.exitPermits.push(permit); 
    saveDb(db); 
    res.json(db.exitPermits); 
}));
app.put('/api/exit-permits/:id', safeHandler((req, res) => { const db=getDb(); const idx=db.exitPermits.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.exitPermits[idx]={...db.exitPermits[idx],...req.body}; saveDb(db); res.json(db.exitPermits); } else res.sendStatus(404); }));
app.delete('/api/exit-permits/:id', safeHandler((req, res) => { const db=getDb(); db.exitPermits=db.exitPermits.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.exitPermits); }));

// --- WAREHOUSE ---
app.get('/api/warehouse/items', safeHandler((req, res) => res.json(getDb().warehouseItems || [])));
app.post('/api/warehouse/items', safeHandler((req, res) => { const db=getDb(); db.warehouseItems.push(req.body); saveDb(db); res.json(db.warehouseItems); }));
app.put('/api/warehouse/items/:id', safeHandler((req, res) => { const db=getDb(); const idx=db.warehouseItems.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.warehouseItems[idx]={...db.warehouseItems[idx], ...req.body}; saveDb(db); res.json(db.warehouseItems); } else res.sendStatus(404); }));
app.delete('/api/warehouse/items/:id', safeHandler((req, res) => { const db=getDb(); db.warehouseItems=db.warehouseItems.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.warehouseItems); }));

app.get('/api/warehouse/transactions', safeHandler((req, res) => res.json(getDb().warehouseTransactions || [])));
app.post('/api/warehouse/transactions', safeHandler((req, res) => { const db=getDb(); db.warehouseTransactions.unshift(req.body); saveDb(db); res.json(db.warehouseTransactions); }));
app.put('/api/warehouse/transactions/:id', safeHandler((req, res) => { const db=getDb(); const idx=db.warehouseTransactions.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.warehouseTransactions[idx]={...db.warehouseTransactions[idx], ...req.body}; saveDb(db); res.json(db.warehouseTransactions); } else res.sendStatus(404); }));
app.delete('/api/warehouse/transactions/:id', safeHandler((req, res) => { const db=getDb(); db.warehouseTransactions=db.warehouseTransactions.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.warehouseTransactions); }));

// Minimal routes for boot
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
