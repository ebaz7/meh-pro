
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

// *** CRASH PREVENTION HANDLERS ***
process.on('uncaughtException', (err) => { console.error('>>> CRITICAL ERROR:', err.message); });
process.on('unhandledRejection', (reason) => { console.error('>>> CRITICAL REJECTION:', reason); });

import { initTelegram, sendDocument as sendTelegramDoc, sendMessage as sendTelegramMsg, notifyNewBijak } from './backend/telegram.js';
import { initWhatsApp, sendMessage as sendWhatsAppMessage, getStatus as getWhatsAppStatus, logout as logoutWhatsApp, getGroups as getWhatsAppGroups } from './backend/whatsapp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_BUILD_ID = Date.now().toString();

const DB_FILE = path.join(__dirname, 'database.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const AI_UPLOADS_DIR = path.join(__dirname, 'uploads', 'ai');
const BACKUPS_DIR = path.join(__dirname, 'backups');
const WAUTH_DIR = path.join(__dirname, 'wauth');

[UPLOADS_DIR, AI_UPLOADS_DIR, BACKUPS_DIR, WAUTH_DIR].forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

// Allow CORS from ALL origins (Mobile app runs on localhost or file://)
app.use(cors()); 

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/uploads', express.static(UPLOADS_DIR));

const publicVapidKey = 'BPhz-4d_V_X-Xo_2Wd-6X_1Y-5Z_3A-9B_7C-8D_0E-1F_2G-3H_4I-5J_6K-7L_8M-9N_0O'; 
const privateVapidKey = 'aB1-cD2-eF3-gH4-iJ5-kL6-mN7-oP8-qR9-sT0'; 
const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY || 'BMm5y7_u3X9tQ8z4w6E1r2T5y8u9i0o1p2a3s4d5f6g7h8j9k0l1z2x3c4v5b6n7m', 
    privateKey: process.env.VAPID_PRIVATE_KEY || 's8d7f6g5h4j3k2l1z0x9c8v7b6n5m4'
};

try {
    webpush.setVapidDetails(
      'mailto:admin@example.com',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
} catch (e) {
    // Keys gen logic if needed
}

// ... (DB Helper functions) ...
const getDb = () => {
    if (!fs.existsSync(DB_FILE)) {
        const initial = { 
            settings: { currentTrackingNumber: 1000, currentExitPermitNumber: 1000, companyNames: [], companies: [], bankNames: [], rolePermissions: {}, savedContacts: [], warehouseSequences: {}, fiscalYears: [], activeFiscalYearId: '' }, 
            orders: [], exitPermits: [], warehouseItems: [], warehouseTransactions: [], securityLogs: [], personnelDelays: [], securityIncidents: [],
            users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin', canManageTrade: true }], 
            messages: [], groups: [], tasks: [], tradeRecords: [],
            pushSubscriptions: [] 
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
        return initial;
    }
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!data.pushSubscriptions) data.pushSubscriptions = []; 
    return data;
};
const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// --- FISCAL YEAR AWARE NUMBER GENERATOR ---
const findNextNumberByFiscalYear = (arr, key, baseNum, fiscalYearId) => {
    // Filter items that belong to this fiscal year
    // If an item has no fiscalYearId, it belongs to 'legacy' (undefined)
    const filtered = arr.filter(item => item.fiscalYearId === fiscalYearId);
    
    // Sort and find next
    const existing = filtered.map(o => Number(o[key])).filter(n => !isNaN(n)).sort((a, b) => a - b);
    let next = baseNum;
    for (const num of existing) { 
        if (num === next) next++; 
        else if (num > next) break; // Gap found or just next available
    }
    return next;
};

// Legacy fallback helper (kept for other non-fiscal logic if any)
const findNextAvailableNumber = (arr, key, base) => {
    const startNum = base + 1;
    const existing = arr.map(o => o[key]).sort((a, b) => a - b);
    let next = startNum;
    for (const num of existing) { if (num === next) next++; else if (num > next) return next; }
    return next;
};

// ... (Telegram & WA Init logic remains the same) ...
const db = getDb();
if (db.settings?.telegramBotToken) try { initTelegram(db.settings.telegramBotToken); } catch (e) { console.error("Telegram Error:", e.message); }
setTimeout(() => { try { initWhatsApp(WAUTH_DIR); } catch(e) { console.error("WA Error:", e); } }, 3000);

const sendWebPush = (title, body, url = '/') => {
    const db = getDb();
    const subs = db.pushSubscriptions || [];
    const payload = JSON.stringify({ title, body, url });
    subs.forEach((subscription, index) => {
        webpush.sendNotification(subscription, payload).catch(err => {
            // cleanup logic
        });
    });
};

app.get('/api/version', (req, res) => res.json({ version: SERVER_BUILD_ID }));
app.get('/api/vapid-key', (req, res) => res.json({ publicKey: vapidKeys.publicKey }));
app.post('/api/subscribe', (req, res) => { const s = req.body; const d = getDb(); if(!d.pushSubscriptions.find(x=>x.endpoint===s.endpoint)){d.pushSubscriptions.push(s); saveDb(d);} res.status(201).json({}); });

// --- ORDERS ---
app.get('/api/orders', (req, res) => {
    const db = getDb();
    const activeYearId = db.settings.activeFiscalYearId;
    if (activeYearId) {
        // Filter by Active Year for View
        return res.json(db.orders.filter(o => o.fiscalYearId === activeYearId));
    }
    // If no active year set (legacy mode), return all
    res.json(db.orders);
});

app.post('/api/orders', (req, res) => { 
    const db = getDb(); 
    const order = req.body; 
    order.id = Date.now().toString(); 
    
    // FISCAL LOGIC
    const activeYearId = db.settings.activeFiscalYearId;
    const activeYear = db.settings.fiscalYears?.find(y => y.id === activeYearId);
    
    if (activeYear && activeYear.isClosed) {
        return res.status(403).json({ error: "سال مالی فعال بسته شده است." });
    }

    order.fiscalYearId = activeYearId;
    const baseNum = activeYear ? activeYear.startTrackingNumber : 1000;
    
    order.trackingNumber = findNextNumberByFiscalYear(db.orders, 'trackingNumber', baseNum, activeYearId);
    
    db.orders.unshift(order); 
    saveDb(db); 
    sendWebPush('سند جدید', `شماره ${order.trackingNumber}`); 
    
    // Return filtered list to keep UI consistent
    res.json(db.orders.filter(o => o.fiscalYearId === activeYearId)); 
});

app.put('/api/orders/:id', (req, res) => { const db=getDb(); const idx=db.orders.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.orders[idx]={...db.orders[idx],...req.body}; saveDb(db); res.json(db.orders.filter(o => o.fiscalYearId === db.orders[idx].fiscalYearId)); } else res.sendStatus(404); });
app.delete('/api/orders/:id', (req, res) => { const db=getDb(); const target = db.orders.find(x=>x.id===req.params.id); db.orders=db.orders.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.orders.filter(o => o.fiscalYearId === target?.fiscalYearId)); });

// --- EXIT PERMITS ---
app.get('/api/exit-permits', (req, res) => {
    const db = getDb();
    const activeYearId = db.settings.activeFiscalYearId;
    if (activeYearId) {
        return res.json(db.exitPermits.filter(p => p.fiscalYearId === activeYearId));
    }
    res.json(db.exitPermits);
});

app.post('/api/exit-permits', (req, res) => { 
    const db = getDb(); 
    const permit = req.body; 
    permit.id = Date.now().toString(); 
    
    // FISCAL LOGIC
    const activeYearId = db.settings.activeFiscalYearId;
    const activeYear = db.settings.fiscalYears?.find(y => y.id === activeYearId);

    if (activeYear && activeYear.isClosed) {
        return res.status(403).json({ error: "سال مالی بسته شده است." });
    }

    permit.fiscalYearId = activeYearId;
    const baseNum = activeYear ? activeYear.startExitPermitNumber : 1000;
    
    permit.permitNumber = findNextNumberByFiscalYear(db.exitPermits, 'permitNumber', baseNum, activeYearId);
    
    db.exitPermits.push(permit); 
    saveDb(db); 
    res.json(db.exitPermits.filter(p => p.fiscalYearId === activeYearId)); 
});

app.put('/api/exit-permits/:id', (req, res) => { const db=getDb(); const idx=db.exitPermits.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.exitPermits[idx]={...db.exitPermits[idx],...req.body}; saveDb(db); res.json(db.exitPermits.filter(p => p.fiscalYearId === db.exitPermits[idx].fiscalYearId)); } else res.sendStatus(404); });
app.delete('/api/exit-permits/:id', (req, res) => { const db=getDb(); const target = db.exitPermits.find(x=>x.id===req.params.id); db.exitPermits=db.exitPermits.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.exitPermits.filter(p => p.fiscalYearId === target?.fiscalYearId)); });

app.get('/api/next-tracking-number', (req, res) => {
    // This endpoint is slightly redundant now but kept for compatibility. 
    // It should ideally return based on active year.
    const db = getDb();
    const activeYearId = db.settings.activeFiscalYearId;
    const activeYear = db.settings.fiscalYears?.find(y => y.id === activeYearId);
    const baseNum = activeYear ? activeYear.startTrackingNumber : (db.settings.currentTrackingNumber || 1000);
    
    res.json({ nextTrackingNumber: findNextNumberByFiscalYear(db.orders, 'trackingNumber', baseNum, activeYearId) });
});

app.get('/api/next-exit-permit-number', (req, res) => {
    const db = getDb();
    const activeYearId = db.settings.activeFiscalYearId;
    const activeYear = db.settings.fiscalYears?.find(y => y.id === activeYearId);
    const baseNum = activeYear ? activeYear.startExitPermitNumber : (db.settings.currentExitPermitNumber || 1000);

    res.json({ nextNumber: findNextNumberByFiscalYear(db.exitPermits, 'permitNumber', baseNum, activeYearId) });
});

// --- WAREHOUSE TRANSACTIONS ---
app.get('/api/warehouse/transactions', (req, res) => {
    const db = getDb();
    const activeYearId = db.settings.activeFiscalYearId;
    if (activeYearId) {
        return res.json(db.warehouseTransactions.filter(t => t.fiscalYearId === activeYearId));
    }
    res.json(db.warehouseTransactions);
});

app.post('/api/warehouse/transactions', (req, res) => { 
    const db = getDb(); 
    const t = req.body; 
    
    const activeYearId = db.settings.activeFiscalYearId;
    const activeYear = db.settings.fiscalYears?.find(y => y.id === activeYearId);

    if (activeYear && activeYear.isClosed) {
        return res.status(403).json({ error: "سال مالی بسته شده است." });
    }

    t.fiscalYearId = activeYearId;

    if(t.type === 'OUT'){ 
        const baseNum = activeYear ? activeYear.startBijakNumber : (db.settings.warehouseSequences?.[t.company]||1000);
        
        // Filter by Company AND Fiscal Year
        const companyTxs = db.warehouseTransactions.filter(x => x.type === 'OUT' && x.company === t.company && x.fiscalYearId === activeYearId);
        
        const n = findNextNumberByFiscalYear(companyTxs, 'number', baseNum, activeYearId);
        t.number = n; 
        
        if(!db.settings.warehouseSequences) db.settings.warehouseSequences={}; 
        db.settings.warehouseSequences[t.company]=n; // Update legacy sequence tracking just in case
        notifyNewBijak(t); 
    } 
    db.warehouseTransactions.unshift(t); 
    saveDb(db); 
    res.json(db.warehouseTransactions.filter(x => x.fiscalYearId === activeYearId)); 
});

app.put('/api/warehouse/transactions/:id', (req, res) => { const db=getDb(); const idx=db.warehouseTransactions.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.warehouseTransactions[idx]={...db.warehouseTransactions[idx],...req.body}; saveDb(db); res.json(db.warehouseTransactions.filter(x => x.fiscalYearId === db.warehouseTransactions[idx].fiscalYearId)); } else res.sendStatus(404); });
app.delete('/api/warehouse/transactions/:id', (req, res) => { const db=getDb(); const target = db.warehouseTransactions.find(x=>x.id===req.params.id); db.warehouseTransactions=db.warehouseTransactions.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.warehouseTransactions.filter(x => x.fiscalYearId === target?.fiscalYearId)); });

// ... (Other routes remain untouched) ...
app.get('/api/chat', (req, res) => res.json(getDb().messages));
app.post('/api/chat', (req, res) => { const db=getDb(); const m=req.body; m.id=Date.now().toString(); db.messages.push(m); saveDb(db); sendWebPush('پیام جدید', m.message || 'فایل'); res.json(db.messages); });
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
app.post('/api/settings', (req, res) => { const db=getDb(); db.settings=req.body; saveDb(db); res.json(db.settings); });
app.post('/api/render-pdf', async (req, res) => {
    try {
        const { html, landscape, width, height } = req.body;
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'domcontentloaded' });
        const pdf = await page.pdf({ printBackground: true, width, height, format: (width||height)?undefined:'A4', landscape });
        await browser.close();
        res.set({'Content-Type':'application/pdf'}); res.send(pdf);
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.get('*', (req, res) => { const p = path.join(__dirname, 'dist', 'index.html'); if(fs.existsSync(p)) res.sendFile(p); else res.send('Build first'); });

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT} (Accessible via IP)`));
