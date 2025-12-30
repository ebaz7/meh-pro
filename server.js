
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import cron from 'node-cron';
import puppeteer from 'puppeteer';
import webpush from 'web-push'; 

process.on('uncaughtException', (err) => { console.error('>>> CRITICAL ERROR:', err.message); });
process.on('unhandledRejection', (reason) => { console.error('>>> CRITICAL REJECTION:', reason); });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_BUILD_ID = Date.now().toString();

const DB_FILE = path.join(__dirname, 'database.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

[UPLOADS_DIR].forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

app.use(cors()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/uploads', express.static(UPLOADS_DIR));

const getDb = () => {
    if (!fs.existsSync(DB_FILE)) {
        const initial = { settings: { currentTrackingNumber: 1000, currentExitPermitNumber: 1000, fiscalYears: [], activeFiscalYearId: '' }, orders: [], exitPermits: [], warehouseItems: [], warehouseTransactions: [], users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin' }], pushSubscriptions: [] };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
        return initial;
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
};

const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

/**
 * تابع هوشمند تولید شماره بر اساس سال مالی
 * اگر سال مالی فعال باشد، شمارش را از شماره شروع همان سال آغاز می‌کند.
 */
const findNextNumberByFiscalYear = (arr, key, baseNum, fiscalYearId) => {
    // فقط اسنادی که مربوط به سال مالی انتخاب شده هستند را در نظر می‌گیریم
    const existing = arr
        .filter(o => o.fiscalYearId === fiscalYearId)
        .map(o => Number(o[key]))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);
        
    let next = baseNum; 
    for (const num of existing) { 
        if (num === next) next++; 
        else if (num > next) break; 
    }
    return next;
};

app.get('/api/version', (req, res) => res.json({ version: SERVER_BUILD_ID }));

// دریافت اسناد (فیلتر شده بر اساس سال مالی فعال)
app.get('/api/orders', (req, res) => {
    const db = getDb();
    const activeYearId = db.settings.activeFiscalYearId;
    if (activeYearId) {
        return res.json(db.orders.filter(o => o.fiscalYearId === activeYearId));
    }
    res.json(db.orders);
});

app.post('/api/orders', (req, res) => {
    const db = getDb();
    const order = req.body;
    const activeYearId = db.settings.activeFiscalYearId;
    const activeYear = db.settings.fiscalYears?.find(y => y.id === activeYearId);
    
    // جلوگیری از ثبت در سال بسته شده
    if (activeYear?.isClosed) return res.status(403).json({ error: "این سال مالی بسته شده است." });

    const baseNum = activeYear ? activeYear.startTrackingNumber : 1001;
    order.id = Date.now().toString();
    order.fiscalYearId = activeYearId;
    order.trackingNumber = findNextNumberByFiscalYear(db.orders, 'trackingNumber', baseNum, activeYearId);
    
    db.orders.unshift(order);
    saveDb(db);
    res.json(db.orders);
});

app.get('/api/exit-permits', (req, res) => {
    const db = getDb();
    const activeYearId = db.settings.activeFiscalYearId;
    if (activeYearId) {
        return res.json(db.exitPermits.filter(o => o.fiscalYearId === activeYearId));
    }
    res.json(db.exitPermits);
});

app.post('/api/exit-permits', (req, res) => {
    const db = getDb();
    const permit = req.body;
    const activeYearId = db.settings.activeFiscalYearId;
    const activeYear = db.settings.fiscalYears?.find(y => y.id === activeYearId);

    if (activeYear?.isClosed) return res.status(403).json({ error: "سال مالی بسته شده است." });

    const baseNum = activeYear ? activeYear.startExitPermitNumber : 1;
    permit.id = Date.now().toString();
    permit.fiscalYearId = activeYearId;
    permit.permitNumber = findNextNumberByFiscalYear(db.exitPermits, 'permitNumber', baseNum, activeYearId);
    
    db.exitPermits.push(permit);
    saveDb(db);
    res.json(db.exitPermits);
});

app.get('/api/warehouse/transactions', (req, res) => {
    const db = getDb();
    const activeYearId = db.settings.activeFiscalYearId;
    if (activeYearId) {
        return res.json(db.warehouseTransactions.filter(o => o.fiscalYearId === activeYearId));
    }
    res.json(db.warehouseTransactions);
});

app.post('/api/warehouse/transactions', (req, res) => {
    const db = getDb();
    const t = req.body;
    const activeYearId = db.settings.activeFiscalYearId;
    const activeYear = db.settings.fiscalYears?.find(y => y.id === activeYearId);

    if (activeYear?.isClosed) return res.status(403).json({ error: "سال مالی بسته شده است." });

    t.fiscalYearId = activeYearId;
    if(t.type === 'OUT'){
        const baseNum = activeYear ? activeYear.startBijakNumber : 1;
        const companyTxs = db.warehouseTransactions.filter(x => x.type === 'OUT' && x.company === t.company && x.fiscalYearId === activeYearId);
        t.number = findNextNumberByFiscalYear(companyTxs, 'number', baseNum, activeYearId);
    }
    db.warehouseTransactions.unshift(t);
    saveDb(db);
    res.json(db.warehouseTransactions);
});

app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db=getDb(); db.settings=req.body; saveDb(db); res.json(db.settings); });

// سایر اندپوینت‌ها طبق روال قبلی...
app.get('/api/users', (req, res) => res.json(getDb().users));
app.post('/api/users', (req, res) => { const db=getDb(); const user=req.body; db.users.push(user); saveDb(db); res.json(db.users); });
app.put('/api/users/:id', (req, res) => { const db=getDb(); const idx=db.users.findIndex(u=>u.id===req.params.id); if(idx!==-1){ db.users[idx]=req.body; saveDb(db); } res.json(db.users); });
app.delete('/api/users/:id', (req, res) => { const db=getDb(); db.users=db.users.filter(u=>u.id!==req.params.id); saveDb(db); res.json(db.users); });
app.post('/api/login', (req, res) => { const {username, password}=req.body; const db=getDb(); const user=db.users.find(u=>u.username===username && u.password===password); if(user) res.json(user); else res.status(401).json({error: 'Invalid credentials'}); });

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
