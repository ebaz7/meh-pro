
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

const findRootDirectory = () => {
    const candidates = ["C:\\PaymentSystem", __dirname, process.cwd(), path.resolve(__dirname, '..')];
    for (const dir of candidates) {
        if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    }
    return "C:\\PaymentSystem";
};

const ROOT_DIR = findRootDirectory();
const DB_FILE = path.join(ROOT_DIR, 'database.json');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const WAUTH_DIR = path.join(ROOT_DIR, 'wauth');
const LOG_FILE = path.join(ROOT_DIR, 'server_status.log');

const logToFile = (message) => {
    const timestamp = new Date().toISOString();
    try {
        if (!fs.existsSync(ROOT_DIR)) fs.mkdirSync(ROOT_DIR, { recursive: true });
        fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
        console.log(message);
    } catch (e) {}
};

[UPLOADS_DIR, BACKUPS_DIR, WAUTH_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); 
app.use(compression()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.static(path.join(ROOT_DIR, 'dist')));
app.use('/uploads', express.static(UPLOADS_DIR));

const DEFAULT_DB = { 
    settings: { currentTrackingNumber: 1000, currentExitPermitNumber: 1000, companyNames: [], companies: [], fiscalYears: [], warehouseSequences: {} }, 
    orders: [], exitPermits: [], warehouseItems: [], warehouseTransactions: [], users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin' }]
};

const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) { saveDb(DEFAULT_DB); return DEFAULT_DB; }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return data ? JSON.parse(data) : DEFAULT_DB;
    } catch (e) { return DEFAULT_DB; }
};

const saveDb = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) { logToFile("Save DB Error: " + e.message); }
};

// --- BRUTE FORCE NUMBER GENERATOR ---
const calculateNextNumber = (db, type, companyName = null) => {
    let maxFound = 0;
    let settingStart = 1000;
    const activeYearId = db.settings.activeFiscalYearId;
    const activeYear = activeYearId ? db.settings.fiscalYears?.find(y => y.id === activeYearId) : null;
    const safeCompany = companyName ? companyName.trim() : (db.settings.defaultCompany || '');

    if (type === 'payment') {
        // 1. Check Settings Baseline
        if (activeYear?.companySequences?.[safeCompany]?.startTrackingNumber) {
            settingStart = parseInt(activeYear.companySequences[safeCompany].startTrackingNumber);
        } else {
            settingStart = parseInt(db.settings.currentTrackingNumber) || 1000;
        }
        // 2. Scan DB Forcefully
        db.orders?.forEach(o => {
            const n = parseInt(o.trackingNumber);
            if (!isNaN(n) && n > maxFound) maxFound = n;
        });
    } 
    else if (type === 'exit') {
        if (activeYear?.companySequences?.[safeCompany]?.startExitPermitNumber) {
            settingStart = parseInt(activeYear.companySequences[safeCompany].startExitPermitNumber);
        } else {
            settingStart = parseInt(db.settings.currentExitPermitNumber) || 1000;
        }
        db.exitPermits?.forEach(p => {
            const n = parseInt(p.permitNumber);
            if (!isNaN(n) && n > maxFound) maxFound = n;
        });
    } 
    else if (type === 'bijak') {
        if (activeYear?.companySequences?.[safeCompany]?.startBijakNumber) {
            settingStart = parseInt(activeYear.companySequences[safeCompany].startBijakNumber);
        } else if (db.settings.warehouseSequences?.[safeCompany]) {
            settingStart = parseInt(db.settings.warehouseSequences[safeCompany]);
        }
        db.warehouseTransactions?.filter(t => t.type === 'OUT' && t.company === safeCompany).forEach(t => {
            const n = parseInt(t.number);
            if (!isNaN(n) && n > maxFound) maxFound = n;
        });
    }

    const next = Math.max(maxFound + 1, settingStart);
    logToFile(`Calculated Next ${type} for ${safeCompany}: ${next} (MaxInDB: ${maxFound}, Setting: ${settingStart})`);
    return next;
};

// --- ROUTES ---
app.get('/api/version', (req, res) => res.json({ version: Date.now().toString() }));

app.post('/api/login', (req, res) => {
    const db = getDb();
    const u = db.users.find(x => x.username === req.body.username && x.password === req.body.password);
    u ? res.json(u) : res.status(401).send('Invalid');
});

// Orders
app.get('/api/orders', (req, res) => res.json(getDb().orders || []));
app.get('/api/next-tracking-number', (req, res) => {
    const db = getDb();
    res.json({ nextTrackingNumber: calculateNextNumber(db, 'payment', req.query.company) });
});
app.post('/api/orders', (req, res) => {
    const db = getDb();
    const order = req.body;
    order.id = Date.now().toString();
    order.trackingNumber = calculateNextNumber(db, 'payment', order.payingCompany);
    db.orders.unshift(order);
    db.settings.currentTrackingNumber = order.trackingNumber;
    saveDb(db);
    res.json(db.orders);
});

// Exit Permits
app.get('/api/exit-permits', (req, res) => res.json(getDb().exitPermits || []));
app.get('/api/next-exit-permit-number', (req, res) => {
    const db = getDb();
    res.json({ nextNumber: calculateNextNumber(db, 'exit', req.query.company) });
});
app.post('/api/exit-permits', (req, res) => {
    const db = getDb();
    const p = req.body;
    p.permitNumber = calculateNextNumber(db, 'exit');
    db.exitPermits.push(p);
    db.settings.currentExitPermitNumber = p.permitNumber;
    saveDb(db);
    res.json(db.exitPermits);
});

// Warehouse Transactions
app.get('/api/warehouse/transactions', (req, res) => res.json(getDb().warehouseTransactions || []));
app.get('/api/next-bijak-number', (req, res) => {
    const db = getDb();
    res.json({ nextNumber: calculateNextNumber(db, 'bijak', req.query.company) });
});
app.post('/api/warehouse/transactions', (req, res) => {
    const db = getDb();
    const tx = req.body;
    if (tx.type === 'OUT') {
        tx.number = calculateNextNumber(db, 'bijak', tx.company);
        if (!db.settings.warehouseSequences) db.settings.warehouseSequences = {};
        db.settings.warehouseSequences[tx.company] = tx.number;
    }
    db.warehouseTransactions.unshift(tx);
    saveDb(db);
    res.json(db.warehouseTransactions);
});

app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => {
    const db = getDb();
    db.settings = { ...db.settings, ...req.body };
    saveDb(db);
    res.json(db.settings);
});

app.get('*', (req, res) => res.sendFile(path.join(ROOT_DIR, 'dist', 'index.html')));

app.listen(PORT, '0.0.0.0', () => logToFile(`Server on ${PORT}`));
