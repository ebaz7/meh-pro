
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
// This function searches for the correct root directory
const findRootDirectory = () => {
    const candidates = [
        "C:\\PaymentSystem", // Priority 1: The user specified path
        __dirname,           // Priority 2: Where this script is located
        process.cwd(),       // Priority 3: Current working directory
        path.resolve(__dirname, '..') // Priority 4: One level up
    ];

    for (const dir of candidates) {
        // Look for package.json or database.json to confirm this is the app root
        if (fs.existsSync(path.join(dir, 'package.json')) || fs.existsSync(path.join(dir, 'database.json'))) {
            return dir;
        }
    }
    
    // Default fallback if nothing found
    return "C:\\PaymentSystem";
};

const ROOT_DIR = findRootDirectory();
const DB_FILE = path.join(ROOT_DIR, 'database.json');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const WAUTH_DIR = path.join(ROOT_DIR, 'wauth');
const VAPID_FILE = path.join(ROOT_DIR, 'vapid.json');
const LOG_FILE = path.join(ROOT_DIR, 'server_status.log');

// --- DEBUG LOGGER ---
const logToFile = (message) => {
    const timestamp = new Date().toISOString();
    try {
        // Ensure log file exists
        if (!fs.existsSync(ROOT_DIR)) fs.mkdirSync(ROOT_DIR, { recursive: true });
        fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
        console.log(message);
    } catch (e) {
        console.error("Logger failed:", e);
    }
};

logToFile("------------------------------------------------");
logToFile(`>>> SYSTEM STARTING`);
logToFile(`>>> Detected Root Path: ${ROOT_DIR}`);
logToFile(`>>> Looking for DB at: ${DB_FILE}`);

// Ensure critical directories exist
[UPLOADS_DIR, BACKUPS_DIR, WAUTH_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch(e) {
            logToFile(`Error creating dir ${dir}: ${e.message}`);
        }
    }
});

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_BUILD_ID = Date.now().toString();

// --- INTEGRATION IMPORTS ---
import { initTelegram, notifyNewBijak } from './backend/telegram.js';
import { initWhatsApp, sendMessage as sendWhatsAppMessage, getStatus as getWhatsAppStatus, logout as logoutWhatsApp, getGroups as getWhatsAppGroups } from './backend/whatsapp.js';
import { sendBaleMessage, initBaleBot } from './backend/bale.js';

app.use(cors()); 
app.use(compression()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(ROOT_DIR, 'dist')));
app.use('/uploads', express.static(UPLOADS_DIR));

// --- WEB PUSH ---
let vapidKeys = { publicKey: '', privateKey: '' };
try {
    if (fs.existsSync(VAPID_FILE)) {
        vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
    } else {
        vapidKeys = webpush.generateVAPIDKeys();
        fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
    }
    webpush.setVapidDetails('mailto:admin@example.com', vapidKeys.publicKey, vapidKeys.privateKey);
} catch (error) { logToFile("VAPID Error: " + error.message); }

// --- DATABASE HANDLER ---
const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) {
            logToFile("!!! Database file missing. Attempting to create new one...");
            const initial = { 
                settings: { currentTrackingNumber: 1000, currentExitPermitNumber: 1000, companyNames: [], companies: [] }, 
                orders: [], exitPermits: [], warehouseItems: [], warehouseTransactions: [], 
                users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin' }], 
                messages: [], groups: [], tasks: [], tradeRecords: [], securityLogs: [], personnelDelays: [], securityIncidents: []
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
            logToFile(">>> New database created successfully.");
            return initial;
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        if (!data || data.trim() === '') {
             throw new Error("Database file is empty");
        }
        return JSON.parse(data);
    } catch (e) {
        logToFile(`!!! CRITICAL DB ERROR: ${e.message}`);
        // Attempt to find a backup
        try {
            const backups = fs.readdirSync(BACKUPS_DIR).sort().reverse();
            if (backups.length > 0) {
                logToFile(`>>> Attempting to restore from backup: ${backups[0]}`);
                const backupData = fs.readFileSync(path.join(BACKUPS_DIR, backups[0]), 'utf8');
                fs.writeFileSync(DB_FILE, backupData);
                return JSON.parse(backupData);
            }
        } catch (restoreErr) {
            logToFile("!!! Restore failed: " + restoreErr.message);
        }
        return { orders: [], users: [] }; // Emergency fallback
    }
};

const saveDb = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        logToFile("!!! Error saving DB: " + e.message);
    }
};

const findNextNumberByFiscalYear = (db, arr, key, type, fiscalYearId, companyName) => {
    let startNum = 1000;
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
    const filtered = safeCompany ? arr.filter(item => {
        const itemComp = (type === 'payment' ? item.payingCompany : (type === 'bijak' ? item.company : item.companyName));
        return itemComp && itemComp.trim() === safeCompany;
    }) : arr;
    const existing = filtered.map(o => Number(o[key])).filter(n => !isNaN(n)).sort((a, b) => a - b);
    let next = existing.length > 0 ? Math.max(existing[existing.length - 1] + 1, startNum) : startNum;
    return next;
};

// --- AUTO BACKUP ---
cron.schedule('0 */4 * * *', () => {
    try {
        if (fs.existsSync(DB_FILE)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(BACKUPS_DIR, `backup-${timestamp}.json`);
            fs.copyFileSync(DB_FILE, backupPath);
            logToFile(`[Backup] Auto-backup created: ${backupPath}`);
            
            // Clean old backups (keep last 30)
            const files = fs.readdirSync(BACKUPS_DIR).map(f => ({ 
                name: f, 
                path: path.join(BACKUPS_DIR, f),
                time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime() 
            })).sort((a, b) => b.time - a.time); // Newest first

            if (files.length > 30) {
                for(let i=30; i<files.length; i++) {
                    fs.unlinkSync(files[i].path);
                }
            }
        }
    } catch (err) {
        logToFile("[Backup] Failed: " + err.message);
    }
});

// --- BOTS INIT ---
const db = getDb();
if (db && db.settings) {
    if (db.settings.telegramBotToken) try { initTelegram(db.settings.telegramBotToken); } catch (e) { logToFile("Telegram Error: " + e.message); }
    if (db.settings.baleBotToken) try { initBaleBot(db.settings.baleBotToken); } catch (e) { logToFile("Bale Error: " + e.message); }
}

setTimeout(() => { 
    try { initWhatsApp(WAUTH_DIR); } catch(e) { logToFile("WA Init Error: " + e.message); } 
}, 5000);

// --- ROUTES ---
app.get('/api/version', (req, res) => res.json({ version: SERVER_BUILD_ID }));
app.get('/api/vapid-key', (req, res) => res.json({ publicKey: vapidKeys.publicKey }));

app.post('/api/subscribe', (req, res) => { 
    const s = req.body; 
    if (!s || !s.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
    const d = getDb(); 
    if(!d.pushSubscriptions) d.pushSubscriptions = [];
    const existingIdx = d.pushSubscriptions.findIndex(x => x.endpoint === s.endpoint);
    if(existingIdx !== -1) { d.pushSubscriptions[existingIdx] = { ...d.pushSubscriptions[existingIdx], ...s }; } 
    else { d.pushSubscriptions.push(s); }
    saveDb(d); 
    res.status(201).json({ success: true }); 
});

app.post('/api/send-whatsapp', async (req, res) => {
    try {
        const { number, message, mediaData } = req.body;
        await sendWhatsAppMessage(number, message, mediaData);
        res.json({ success: true });
    } catch (e) { 
        logToFile("WA Send Error: " + e.message);
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/upload', (req, res) => {
    try {
        const { fileName, fileData } = req.body;
        const base64Data = fileData.replace(/^data:.*?;base64,/, "");
        const uniqueName = `${Date.now()}_${fileName.replace(/\s/g, '_')}`;
        const filePath = path.join(UPLOADS_DIR, uniqueName);
        fs.writeFileSync(filePath, base64Data, 'base64');
        res.json({ fileName: uniqueName, url: `/uploads/${uniqueName}` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- EMERGENCY RESTORE ENDPOINT ---
app.post('/api/emergency-restore', (req, res) => {
    try {
        const { fileData } = req.body;
        if (!fileData) {
            return res.status(400).json({ success: false, error: 'No file data provided' });
        }

        // Clean base64 header if present
        const base64Data = fileData.replace(/^data:.*?;base64,/, "");
        const jsonContent = Buffer.from(base64Data, 'base64').toString('utf-8');

        // Validate JSON
        const parsed = JSON.parse(jsonContent);
        if (!parsed.users || !parsed.settings) {
             return res.status(400).json({ success: false, error: 'Invalid backup file format' });
        }

        // Create a safety backup before overwriting
        if (fs.existsSync(DB_FILE)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            fs.copyFileSync(DB_FILE, path.join(BACKUPS_DIR, `pre-restore-${timestamp}.json`));
        }

        // Write new DB
        fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2));
        logToFile(`>>> DATABASE RESTORED VIA EMERGENCY API`);

        res.json({ success: true });
    } catch (e) {
        logToFile(`Emergency Restore Failed: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/render-pdf', async (req, res) => { 
    let browser = null;
    try { 
        const { html, landscape, width, height, format } = req.body; 
        browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] }); 
        const page = await browser.newPage(); 
        await page.setContent(html, { waitUntil: 'networkidle0' }); 
        const pdf = await page.pdf({ printBackground: true, landscape: !!landscape, width, height, format: width ? undefined : (format || 'A4') }); 
        res.contentType("application/pdf");
        res.send(pdf); 
    } catch (e) { res.status(500).json({error: e.message}); } finally { if (browser) await browser.close(); }
});

// Data Routes
app.get('/api/orders', (req, res) => res.json(getDb().orders));
app.post('/api/orders', (req, res) => { const db = getDb(); const order = req.body; order.id = Date.now().toString(); order.trackingNumber = findNextNumberByFiscalYear(db, db.orders, 'trackingNumber', 'payment', db.settings.activeFiscalYearId, order.payingCompany); db.orders.unshift(order); saveDb(db); res.json(db.orders); });
app.put('/api/orders/:id', (req, res) => { const db=getDb(); const idx=db.orders.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.orders[idx]={...db.orders[idx],...req.body}; saveDb(db); res.json(db.orders); } else res.sendStatus(404); });
app.delete('/api/orders/:id', (req, res) => { const db=getDb(); db.orders=db.orders.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.orders); });

app.get('/api/trade', (req, res) => res.json(getDb().tradeRecords || []));
app.post('/api/trade', (req, res) => { const db = getDb(); if (!db.tradeRecords) db.tradeRecords = []; db.tradeRecords.push({...req.body, id: Date.now().toString()}); saveDb(db); res.json(db.tradeRecords); });
app.put('/api/trade/:id', (req, res) => { const db = getDb(); const idx = db.tradeRecords.findIndex(r => r.id === req.params.id); if (idx !== -1) { db.tradeRecords[idx] = { ...db.tradeRecords[idx], ...req.body }; saveDb(db); res.json(db.tradeRecords); } else res.sendStatus(404); });
app.delete('/api/trade/:id', (req, res) => { const db = getDb(); db.tradeRecords = db.tradeRecords.filter(r => r.id !== req.params.id); saveDb(db); res.json(db.tradeRecords); });

app.get('/api/exit-permits', (req, res) => res.json(getDb().exitPermits));
app.post('/api/exit-permits', (req, res) => { const db = getDb(); const permit = req.body; permit.id = Date.now().toString(); permit.permitNumber = findNextNumberByFiscalYear(db, db.exitPermits, 'permitNumber', 'exit', db.settings.activeFiscalYearId, permit.companyName); db.exitPermits.push(permit); saveDb(db); res.json(db.exitPermits); });
app.put('/api/exit-permits/:id', (req, res) => { const db=getDb(); const idx=db.exitPermits.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.exitPermits[idx]={...db.exitPermits[idx],...req.body}; saveDb(db); res.json(db.exitPermits); } else res.sendStatus(404); });
app.delete('/api/exit-permits/:id', (req, res) => { const db=getDb(); db.exitPermits=db.exitPermits.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.exitPermits); });

app.get('/api/next-tracking-number', (req, res) => { const db = getDb(); const next = findNextNumberByFiscalYear(db, db.orders, 'trackingNumber', 'payment', db.settings.activeFiscalYearId, req.query.company); res.json({ nextTrackingNumber: next }); });
app.get('/api/next-exit-permit-number', (req, res) => { const db = getDb(); const next = findNextNumberByFiscalYear(db, db.exitPermits, 'permitNumber', 'exit', db.settings.activeFiscalYearId, req.query.company); res.json({ nextNumber: next }); });
app.get('/api/next-bijak-number', (req, res) => { const db = getDb(); const next = findNextNumberByFiscalYear(db, db.warehouseTransactions.filter(x => x.type === 'OUT'), 'number', 'bijak', db.settings.activeFiscalYearId, req.query.company); res.json({ nextNumber: next }); });

app.get('/api/warehouse/transactions', (req, res) => res.json(getDb().warehouseTransactions));
app.post('/api/warehouse/transactions', (req, res) => { const db = getDb(); const t = req.body; if(t.type === 'OUT'){ t.number = findNextNumberByFiscalYear(db, db.warehouseTransactions.filter(x => x.type === 'OUT'), 'number', 'bijak', db.settings.activeFiscalYearId, t.company); notifyNewBijak(t); } db.warehouseTransactions.unshift(t); saveDb(db); res.json(db.warehouseTransactions); });
app.put('/api/warehouse/transactions/:id', (req, res) => { const db=getDb(); const idx=db.warehouseTransactions.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.warehouseTransactions[idx]={...db.warehouseTransactions[idx],...req.body}; saveDb(db); res.json(db.warehouseTransactions); } else res.sendStatus(404); });
app.delete('/api/warehouse/transactions/:id', (req, res) => { const db=getDb(); db.warehouseTransactions=db.warehouseTransactions.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.warehouseTransactions); });

app.get('/api/chat', (req, res) => res.json(getDb().messages));
app.post('/api/chat', (req, res) => { const db = getDb(); db.messages.push({...req.body, id: Date.now().toString()}); saveDb(db); res.json(db.messages); });

app.get('/api/whatsapp/status', (req, res) => res.json(getWhatsAppStatus()));
app.post('/api/whatsapp/logout', async (req, res) => { await logoutWhatsApp(); res.json({ success: true }); });
app.get('/api/whatsapp/groups', async (req, res) => { try { const groups = await getWhatsAppGroups(); res.json({ success: true, groups }); } catch (e) { res.status(500).json({ success: false, error: e.message }); } });

app.get('/api/warehouse/items', (req, res) => res.json(getDb().warehouseItems));
app.post('/api/warehouse/items', (req, res) => { const db=getDb(); db.warehouseItems.push({...req.body, id:Date.now().toString()}); saveDb(db); res.json(db.warehouseItems); });
app.put('/api/warehouse/items/:id', (req, res) => { const db=getDb(); const idx=db.warehouseItems.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.warehouseItems[idx]={...db.warehouseItems[idx],...req.body}; saveDb(db); res.json(db.warehouseItems); } else res.sendStatus(404); });
app.delete('/api/warehouse/items/:id', (req, res) => { const db=getDb(); db.warehouseItems=db.warehouseItems.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.warehouseItems); });

app.get('/api/security/logs', (req, res) => res.json(getDb().securityLogs));
app.post('/api/security/logs', (req, res) => { const db=getDb(); db.securityLogs.unshift({...req.body, id:Date.now().toString()}); saveDb(db); res.json(db.securityLogs); });
app.put('/api/security/logs/:id', (req, res) => { const db=getDb(); const idx=db.securityLogs.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.securityLogs[idx]={...db.securityLogs[idx],...req.body}; saveDb(db); res.json(db.securityLogs); } else res.sendStatus(404); });
app.delete('/api/security/logs/:id', (req, res) => { const db=getDb(); db.securityLogs=db.securityLogs.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.securityLogs); });

app.get('/api/security/delays', (req, res) => res.json(getDb().personnelDelays));
app.post('/api/security/delays', (req, res) => { const db=getDb(); db.personnelDelays.unshift({...req.body, id:Date.now().toString()}); saveDb(db); res.json(db.personnelDelays); });
app.put('/api/security/delays/:id', (req, res) => { const db=getDb(); const idx=db.personnelDelays.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.personnelDelays[idx]={...db.personnelDelays[idx],...req.body}; saveDb(db); res.json(db.personnelDelays); } else res.sendStatus(404); });
app.delete('/api/security/delays/:id', (req, res) => { const db=getDb(); db.personnelDelays=db.personnelDelays.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.personnelDelays); });

app.get('/api/security/incidents', (req, res) => res.json(getDb().securityIncidents));
app.post('/api/security/incidents', (req, res) => { const db=getDb(); db.securityIncidents.unshift({...req.body, id:Date.now().toString()}); saveDb(db); res.json(db.securityIncidents); });
app.put('/api/security/incidents/:id', (req, res) => { const db=getDb(); const idx=db.securityIncidents.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.securityIncidents[idx]={...db.securityIncidents[idx],...req.body}; saveDb(db); res.json(db.securityIncidents); } else res.sendStatus(404); });
app.delete('/api/security/incidents/:id', (req, res) => { const db=getDb(); db.securityIncidents=db.securityIncidents.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.securityIncidents); });

app.get('/api/users', (req, res) => res.json(getDb().users));
app.post('/api/users', (req, res) => { const db=getDb(); db.users.push({...req.body, id:Date.now().toString()}); saveDb(db); res.json(db.users); });
app.put('/api/users/:id', (req, res) => { const db=getDb(); const idx=db.users.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.users[idx]={...db.users[idx],...req.body}; saveDb(db); res.json(db.users); } else res.sendStatus(404); });
app.delete('/api/users/:id', (req, res) => { const db=getDb(); db.users=db.users.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.users); });
app.post('/api/login', (req, res) => { const u=getDb().users.find(x=>x.username===req.body.username && x.password===req.body.password); u?res.json(u):res.status(401).send('Invalid'); });

app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db = getDb(); db.settings = { ...db.settings, ...req.body }; saveDb(db); res.json(db.settings); });

app.get('*', (req, res) => { 
    const p = path.join(ROOT_DIR, 'dist', 'index.html'); 
    if(fs.existsSync(p)) res.sendFile(p); 
    else res.send('Build first or wait for React compilation.'); 
});

const server = app.listen(PORT, '0.0.0.0', () => {
    logToFile(`\n>>> Server successfully running on port ${PORT}`);
    logToFile(`>>> Root: ${ROOT_DIR}`);
});
