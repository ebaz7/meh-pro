
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


// --- ULTIMATE NUMBER GENERATOR (STRICT MODE) ---
// 1. Scan DB for Max value of this company (including archive)
// 2. Check Fiscal Year start number for this company
// 3. Fallback to Global settings
const calculateNextNumber = (db, type, companyName = null) => {
    let maxFoundInDb = 0;
    let fiscalStartSetting = 0;
    let globalDefaultSetting = 1000;
    
    const safeCompany = companyName ? companyName.trim() : (db.settings.defaultCompany || '');
    const activeYearId = db.settings.activeFiscalYearId;
    const activeYear = activeYearId ? db.settings.fiscalYears?.find(y => y.id === activeYearId) : null;

    if (type === 'payment') {
        // 1. SCAN DB FOR MAX - FILTER BY COMPANY
        if (db.orders && Array.isArray(db.orders)) {
            db.orders.forEach(o => {
                if (!safeCompany || o.payingCompany === safeCompany) {
                    const num = parseInt(o.trackingNumber);
                    if (!isNaN(num) && num > maxFoundInDb) maxFoundInDb = num;
                }
            });
        }
        // 2. FISCAL SETTING
        if (activeYear && activeYear.companySequences && activeYear.companySequences[safeCompany]) {
            fiscalStartSetting = parseInt(activeYear.companySequences[safeCompany].startTrackingNumber) || 0;
        }
        // 3. GLOBAL SETTING
        globalDefaultSetting = parseInt(db.settings.currentTrackingNumber) || 1000;

    } else if (type === 'exit') {
        // 1. SCAN DB FOR MAX - FILTER BY COMPANY
        if (db.exitPermits && Array.isArray(db.exitPermits)) {
            db.exitPermits.forEach(p => {
                if (!safeCompany || p.company === safeCompany) {
                    const num = parseInt(p.permitNumber);
                    if (!isNaN(num) && num > maxFoundInDb) maxFoundInDb = num;
                }
            });
        }
        // 2. FISCAL SETTING
        if (activeYear && activeYear.companySequences && activeYear.companySequences[safeCompany]) {
            fiscalStartSetting = parseInt(activeYear.companySequences[safeCompany].startExitPermitNumber) || 0;
        }
        // 3. GLOBAL SETTING
        globalDefaultSetting = parseInt(db.settings.currentExitPermitNumber) || 1000;

    } else if (type === 'bijak') {
        // 1. SCAN DB FOR MAX - FILTER BY COMPANY
        if (db.warehouseTransactions && Array.isArray(db.warehouseTransactions)) {
            db.warehouseTransactions
                .filter(t => t.type === 'OUT' && (!safeCompany || t.company === safeCompany))
                .forEach(t => {
                    const num = parseInt(t.number);
                    if (!isNaN(num) && num > maxFoundInDb) maxFoundInDb = num;
                });
        }
        // 2. FISCAL SETTING
        if (activeYear && activeYear.companySequences && activeYear.companySequences[safeCompany]) {
             fiscalStartSetting = parseInt(activeYear.companySequences[safeCompany].startBijakNumber) || 0;
        }
        // 3. GLOBAL SETTING (Company specific in Warehouse)
        if (db.settings.warehouseSequences && db.settings.warehouseSequences[safeCompany]) {
             globalDefaultSetting = parseInt(db.settings.warehouseSequences[safeCompany]) || 1000;
        } else {
             globalDefaultSetting = 1000;
        }
    }

    // FINAL SELECTION: 
    // If DB records exist, MaxInDB + 1 is almost always the answer to ensure uniqueness.
    // However, if we're starting a new company/year, settings take precedence if they are higher.
    
    let result = Math.max(maxFoundInDb + 1, fiscalStartSetting, globalDefaultSetting);
    
    // Logging for traceability
    logToFile(`[Numbering] Type: ${type}, Co: ${safeCompany}, MaxInDb: ${maxFoundInDb}, Fiscal: ${fiscalStartSetting}, Global: ${globalDefaultSetting} -> Result: ${result}`);

    return result;
};

// --- ROUTES ---
app.get('/api/version', (req, res) => res.json({ version: SERVER_BUILD_ID }));

// Convert Render HTML to PDF
app.post('/api/render-pdf', async (req, res) => {
    try {
        const { html, landscape, format, width, height } = req.body;
        if (!html) return res.status(400).json({ error: "HTML content required" });
        
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        
        if (width && height) {
            await page.setViewport({ width: 1200, height: 800 }); 
        }

        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfOptions = { printBackground: true, landscape: !!landscape };
        if (width && height) { pdfOptions.width = width; pdfOptions.height = height; }
        else { pdfOptions.format = format || 'A4'; }

        const pdfBuffer = await page.pdf(pdfOptions);
        await browser.close();
        res.contentType("application/pdf");
        res.send(pdfBuffer);
    } catch (e) {
        logToFile(`PDF Error: ${e.message}`);
        res.status(500).json({ error: "Failed to generate PDF", details: e.message });
    }
});

// AI Request Proxy
app.post('/api/ai-request', async (req, res) => {
    try {
        const { message } = req.body;
        const db = getDb();
        if (!db.settings.geminiApiKey) throw new Error("API Key Missing");
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: db.settings.geminiApiKey });
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: 'user', parts: [{ text: message }] }]
        });
        res.json({ reply: result.text });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ... [Keep other routes: subscribe, whatsapp, backup, etc.] ...

app.post('/api/login', (req, res) => { 
    const db = getDb();
    const u = db.users.find(x => x.username === req.body.username && x.password === req.body.password); 
    u ? res.json(u) : res.status(401).send('Invalid'); 
});

app.get('/api/orders', (req, res) => res.json(getDb().orders || []));
app.post('/api/orders', (req, res) => { 
    const db = getDb(); 
    const order = req.body; 
    order.id = Date.now().toString(); 
    
    // STRICT RE-CALCULATION ON SAVE
    const finalNum = calculateNextNumber(db, 'payment', order.payingCompany);
    order.trackingNumber = finalNum;
    
    db.orders.unshift(order); 
    saveDb(db); 
    res.json(db.orders); 
});

app.get('/api/next-tracking-number', (req, res) => {
    const db = getDb();
    const company = req.query.company; 
    const nextNum = calculateNextNumber(db, 'payment', company);
    res.json({ nextTrackingNumber: nextNum });
});

app.get('/api/exit-permits', (req, res) => res.json(getDb().exitPermits || []));
app.post('/api/exit-permits', (req, res) => { 
    const db = getDb(); 
    const permit = req.body; 
    
    // STRICT RE-CALCULATION ON SAVE
    const finalNum = calculateNextNumber(db, 'exit', permit.company);
    permit.permitNumber = finalNum;

    db.exitPermits.push(permit); 
    saveDb(db); 
    res.json(db.exitPermits); 
});

app.get('/api/next-exit-permit-number', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    const nextNum = calculateNextNumber(db, 'exit', company);
    res.json({ nextNumber: nextNum });
});

app.get('/api/next-bijak-number', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    if (!company) return res.json({ nextNumber: 1000 });
    const nextNum = calculateNextNumber(db, 'bijak', company);
    res.json({ nextNumber: nextNum });
});

app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db = getDb(); db.settings = { ...db.settings, ...req.body }; saveDb(db); res.json(db.settings); });
app.get('/api/users', (req, res) => res.json(getDb().users || []));

// Serve React App
app.get('*', (req, res) => { 
    const p = path.join(ROOT_DIR, 'dist', 'index.html'); 
    if(fs.existsSync(p)) res.sendFile(p); 
    else res.send('System is running. React build not found in dist/.'); 
});

const server = app.listen(PORT, '0.0.0.0', () => {
    logToFile(`\n>>> Server successfully running on port ${PORT}`);
});
