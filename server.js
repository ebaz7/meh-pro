
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
        const initial = { settings: { currentTrackingNumber: 1000, fiscalYears: [], activeFiscalYearId: '' }, orders: [], exitPermits: [], warehouseItems: [], warehouseTransactions: [], users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin' }], messages: [], pushSubscriptions: [] };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
        return initial;
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
};

const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// تابع هوشمند پیدا کردن شماره بعدی بر اساس فیلتر سال مالی
const findNextAvailableNumberByYear = (arr, key, base, fiscalYearId) => {
    const startNum = base;
    // فیلتر کردن اسنادی که مربوط به همین سال مالی هستند
    const existing = arr
        .filter(o => o.fiscalYearId === fiscalYearId)
        .map(o => Number(o[key]))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);
        
    let next = startNum;
    for (const num of existing) { 
        if (num === next) next++; 
        else if (num > next) break; 
    }
    return next;
};

app.get('/api/version', (req, res) => res.json({ version: SERVER_BUILD_ID }));

// دریافت لیست بر اساس سال مالی فعال
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
    
    if (activeYear?.isClosed) return res.status(403).json({ error: "این سال مالی بسته شده است." });

    const baseNum = activeYear ? activeYear.startTrackingNumber : 1001;
    order.id = Date.now().toString();
    order.fiscalYearId = activeYearId;
    order.trackingNumber = findNextAvailableNumberByYear(db.orders, 'trackingNumber', baseNum, order.fiscalYearId);
    
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

    const baseNum = activeYear ? activeYear.startExitPermitNumber : 2001;
    permit.id = Date.now().toString();
    permit.fiscalYearId = activeYearId;
    permit.permitNumber = findNextAvailableNumberByYear(db.exitPermits, 'permitNumber', baseNum, permit.fiscalYearId);
    
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
        const baseNum = activeYear ? activeYear.startBijakNumber : 5001;
        const companyTxs = db.warehouseTransactions.filter(x => x.type === 'OUT' && x.company === t.company && x.fiscalYearId === t.fiscalYearId);
        t.number = findNextAvailableNumberByYear(companyTxs, 'number', baseNum, t.fiscalYearId);
    }
    db.warehouseTransactions.unshift(t);
    saveDb(db);
    res.json(db.warehouseTransactions);
});

app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db=getDb(); db.settings=req.body; saveDb(db); res.json(db.settings); });

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
