
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import cron from 'node-cron';
import puppeteer from 'puppeteer';
import webpush from 'web-push'; 

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

app.use(cors()); 
app.use(compression()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const staticOptions = { maxAge: '1y', etag: true, lastModified: true };
app.use(express.static(path.join(__dirname, 'dist'), staticOptions));
app.use('/uploads', express.static(UPLOADS_DIR, staticOptions));

// --- WEB PUSH CONFIGURATION ---
const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY || 'BM2Ea_t-e3yJz7Z-X8qY_9A-2B_3C-4D_5E-6F_7G-8H_9I-0J_1K-2L_3M-4N_5O', 
    privateKey: process.env.VAPID_PRIVATE_KEY || 'a1-b2-c3-d4-e5-f6-g7-h8-i9-j0-k1-l2-m3-n4-o5' 
};

// Android Native FCM Key (Optional - for APK builds only)
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY || ''; 

try {
    if(vapidKeys.publicKey.includes('X8qY')) {
       vapidKeys.publicKey = 'BKowKy7Y_aJ2y8q9z0A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2W3x4Y5z6';
       vapidKeys.privateKey = 'q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6j7k8l9z0';
    }
    webpush.setVapidDetails('mailto:admin@example.com', vapidKeys.publicKey, vapidKeys.privateKey);
} catch (e) {
    console.error("WebPush Init Error:", e);
}

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

const findNextNumberByFiscalYear = (db, arr, key, type, fiscalYearId, companyName) => {
    const filtered = companyName ? arr.filter(item => 
        (type === 'payment' && item.payingCompany === companyName) ||
        (type === 'bijak' && item.company === companyName)
    ) : arr;
    const existing = filtered.map(o => Number(o[key])).filter(n => !isNaN(n)).sort((a, b) => a - b);
    let next = 1000; 
    if (existing.length > 0) {
        next = existing[existing.length - 1] + 1;
    }
    return next;
};

const db = getDb();
if (db.settings?.telegramBotToken) try { initTelegram(db.settings.telegramBotToken); } catch (e) { console.error("Telegram Error:", e.message); }
setTimeout(() => { try { initWhatsApp(WAUTH_DIR); } catch(e) { console.error("WA Error:", e); } }, 3000);

// --- PUSH NOTIFICATION HELPERS ---

const sendNativeFCM = async (token, title, body) => {
    if (!FCM_SERVER_KEY) return;
    try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `key=${FCM_SERVER_KEY}`
            },
            body: JSON.stringify({
                to: token,
                notification: { title, body },
                priority: 'high'
            })
        });
        if (!response.ok) {
            console.error("FCM Error:", await response.text());
        }
    } catch (e) {
        console.error("FCM Network Error", e);
    }
};

const sendWebPush = (title, body, url = '/', targetUsername = null) => {
    const db = getDb();
    const subs = db.pushSubscriptions || [];
    
    // Filter subscriptions
    let relevantSubs = subs;
    if (targetUsername) {
        // Strict filtering for specific users
        relevantSubs = subs.filter(s => s.username === targetUsername);
        if (relevantSubs.length === 0) {
            console.log(`Push Warning: No subscription found for user '${targetUsername}'`);
        }
    }

    const payload = JSON.stringify({ title, body, url });
    const options = { headers: { 'Urgency': 'high' } };

    let invalidEndpoints = [];

    Promise.all(relevantSubs.map(sub => {
        // Native Android (APK)
        if (sub.type === 'android' && sub.keys?.auth === 'native') {
            return sendNativeFCM(sub.endpoint, title, body);
        }
        // Web Push (PWA on Android/iOS/Desktop)
        if (sub.endpoint && sub.keys && sub.keys.p256dh && sub.keys.p256dh !== 'native') {
            return webpush.sendNotification(sub, payload, options).catch(err => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    invalidEndpoints.push(sub.endpoint);
                } else {
                    console.error("Push Error:", err);
                }
            });
        }
        return Promise.resolve();
    })).then(() => {
        if (invalidEndpoints.length > 0) {
            const currentDb = getDb();
            currentDb.pushSubscriptions = currentDb.pushSubscriptions.filter(s => !invalidEndpoints.includes(s.endpoint));
            saveDb(currentDb);
        }
    });
};

const sendPushToUsers = (usernames, title, body) => {
    // Deduplicate usernames
    const uniqueUsers = [...new Set(usernames)];
    uniqueUsers.forEach(u => sendWebPush(title, body, '/', u));
};

app.get('/api/version', (req, res) => res.json({ version: SERVER_BUILD_ID }));
app.get('/api/vapid-key', (req, res) => res.json({ publicKey: vapidKeys.publicKey }));

app.post('/api/subscribe', (req, res) => { 
    const s = req.body; // { endpoint, keys, type, username, role }
    const d = getDb(); 
    if(!d.pushSubscriptions) d.pushSubscriptions = [];
    
    // Update existing or add new
    const existingIdx = d.pushSubscriptions.findIndex(x => x.endpoint === s.endpoint);
    if(existingIdx !== -1) {
        // Update user metadata for existing subscription
        d.pushSubscriptions[existingIdx] = { ...d.pushSubscriptions[existingIdx], ...s };
    } else {
        d.pushSubscriptions.push(s); 
    }
    
    saveDb(d); 
    
    // Send welcome ONLY if it's a freshly added subscription (not an update)
    if (existingIdx === -1 && s.keys && s.keys.p256dh !== 'native') {
        webpush.sendNotification(s, JSON.stringify({ title: 'فعال‌سازی موفق', body: `نوتیفیکیشن برای کاربر ${s.username || 'شما'} فعال شد.` }))
        .catch(e => console.error("Welcome Push Failed", e));
    }
    
    res.status(201).json({}); 
});

// --- ORDERS ---
app.get('/api/orders', (req, res) => {
    const db = getDb();
    res.json(db.orders);
});

app.post('/api/orders', (req, res) => { 
    const db = getDb(); 
    const order = req.body; 
    order.id = Date.now().toString(); 
    const activeYearId = db.settings.activeFiscalYearId;
    order.fiscalYearId = activeYearId;
    order.trackingNumber = findNextNumberByFiscalYear(db, db.orders, 'trackingNumber', 'payment', activeYearId, order.payingCompany);
    
    db.orders.unshift(order); 
    saveDb(db); 
    
    // Notify Financial & Admin Users
    const targetUsers = db.users.filter(u => u.role === 'financial' || u.role === 'admin').map(u => u.username);
    sendPushToUsers(targetUsers, 'دستور پرداخت جدید', `شماره ${order.trackingNumber} - مبلغ: ${new Intl.NumberFormat('fa-IR').format(order.totalAmount)} ریال`); 
    
    res.json(db.orders); 
});

app.put('/api/orders/:id', (req, res) => { 
    const db=getDb(); 
    const idx=db.orders.findIndex(x=>x.id===req.params.id); 
    if(idx!==-1){ 
        const oldStatus = db.orders[idx].status;
        db.orders[idx]={...db.orders[idx],...req.body}; 
        saveDb(db); 
        
        if (req.body.status && req.body.status !== oldStatus) {
             // Notify Requester
             sendPushToUsers([db.orders[idx].requester], 'تغییر وضعیت پرداخت', `شماره ${db.orders[idx].trackingNumber}: ${req.body.status}`);
        }
        
        res.json(db.orders); 
    } else res.sendStatus(404); 
});
app.delete('/api/orders/:id', (req, res) => { const db=getDb(); db.orders=db.orders.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.orders); });

// --- EXIT PERMITS ---
app.get('/api/exit-permits', (req, res) => {
    const db = getDb();
    res.json(db.exitPermits);
});

app.post('/api/exit-permits', (req, res) => { 
    const db = getDb(); 
    const permit = req.body; 
    permit.id = Date.now().toString(); 
    const activeYearId = db.settings.activeFiscalYearId;
    permit.fiscalYearId = activeYearId;
    permit.permitNumber = findNextNumberByFiscalYear(db, db.exitPermits, 'permitNumber', 'exit', activeYearId, permit.companyName);
    
    db.exitPermits.push(permit); 
    saveDb(db); 
    
    // Notify CEO
    const targetUsers = db.users.filter(u => u.role === 'ceo' || u.role === 'admin').map(u => u.username);
    sendPushToUsers(targetUsers, 'مجوز خروج جدید', `شماره ${permit.permitNumber} - گیرنده: ${permit.recipientName}`);
    
    res.json(db.exitPermits); 
});

app.put('/api/exit-permits/:id', (req, res) => { 
    const db=getDb(); 
    const idx=db.exitPermits.findIndex(x=>x.id===req.params.id); 
    if(idx!==-1){ 
        const oldStatus = db.exitPermits[idx].status;
        db.exitPermits[idx]={...db.exitPermits[idx],...req.body}; 
        saveDb(db);
        
        if (req.body.status && req.body.status !== oldStatus) {
             sendWebPush('تغییر وضعیت مجوز خروج', `شماره ${db.exitPermits[idx].permitNumber}: ${req.body.status}`);
        }
        
        res.json(db.exitPermits); 
    } else res.sendStatus(404); 
});
app.delete('/api/exit-permits/:id', (req, res) => { const db=getDb(); db.exitPermits=db.exitPermits.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.exitPermits); });

app.get('/api/next-tracking-number', (req, res) => {
    const db = getDb();
    const activeYearId = db.settings.activeFiscalYearId;
    const company = req.query.company; 
    const next = findNextNumberByFiscalYear(db, db.orders, 'trackingNumber', 'payment', activeYearId, company);
    res.json({ nextTrackingNumber: next });
});

app.get('/api/next-exit-permit-number', (req, res) => {
    const db = getDb();
    const activeYearId = db.settings.activeFiscalYearId;
    const company = req.query.company;
    const next = findNextNumberByFiscalYear(db, db.exitPermits, 'permitNumber', 'exit', activeYearId, company);
    res.json({ nextNumber: next });
});

// --- WAREHOUSE TRANSACTIONS ---
app.get('/api/warehouse/transactions', (req, res) => {
    const db = getDb();
    res.json(db.warehouseTransactions);
});

app.post('/api/warehouse/transactions', (req, res) => { 
    const db = getDb(); 
    const t = req.body; 
    const activeYearId = db.settings.activeFiscalYearId;
    t.fiscalYearId = activeYearId;

    if(t.type === 'OUT'){ 
        t.number = findNextNumberByFiscalYear(db, db.warehouseTransactions.filter(x => x.type === 'OUT'), 'number', 'bijak', activeYearId, t.company);
        notifyNewBijak(t); 
        
        // Notify CEO/Admin
        const targetUsers = db.users.filter(u => u.role === 'ceo' || u.role === 'admin').map(u => u.username);
        sendPushToUsers(targetUsers, 'بیجک جدید صادر شد', `شماره ${t.number} - شرکت: ${t.company}`);
    } 
    db.warehouseTransactions.unshift(t); 
    saveDb(db); 
    res.json(db.warehouseTransactions); 
});

app.put('/api/warehouse/transactions/:id', (req, res) => { const db=getDb(); const idx=db.warehouseTransactions.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.warehouseTransactions[idx]={...db.warehouseTransactions[idx],...req.body}; saveDb(db); res.json(db.warehouseTransactions); } else res.sendStatus(404); });
app.delete('/api/warehouse/transactions/:id', (req, res) => { const db=getDb(); db.warehouseTransactions=db.warehouseTransactions.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.warehouseTransactions); });

// --- CHAT & MESSAGING ---
app.get('/api/chat', (req, res) => res.json(getDb().messages));
app.post('/api/chat', (req, res) => { 
    const db = getDb(); 
    const m = req.body; 
    m.id = Date.now().toString(); 
    db.messages.push(m); 
    saveDb(db); 
    
    // --- TARGETED PUSH FOR CHAT ---
    const title = `پیام جدید از ${m.sender}`;
    let body = m.message || 'فایل ضمیمه';
    if(body.startsWith('CALL_INVITE|')) body = '📞 تماس ورودی...';

    if (m.recipient) {
        // 1. Private Message: Send to recipient
        // Important: Ensure we use 'username' for targeting as per registration
        sendPushToUsers([m.recipient], title, body);
    } else if (m.groupId) {
        // 2. Group Message: Send to all members EXCEPT sender
        const group = db.groups.find(g => g.id === m.groupId);
        if (group) {
            // Member array contains usernames
            const targets = group.members.filter(u => u !== m.senderUsername);
            sendPushToUsers(targets, title + ` (گروه ${group.name})`, body);
        }
    } else {
        // 3. Public Channel: Send to everyone except sender
        const targets = db.users.filter(u => u.username !== m.senderUsername).map(u => u.username);
        sendPushToUsers(targets, title + ' (عمومی)', body);
    }

    res.json(db.messages); 
});

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

app.post('/api/settings', (req, res) => { 
    const db = getDb(); 
    db.settings = { ...db.settings, ...req.body }; 
    saveDb(db); 
    res.json(db.settings); 
});

app.post('/api/full-restore', (req, res) => {
    try {
        const { fileData } = req.body;
        if (!fileData) throw new Error("No data");
        const zip = new AdmZip(Buffer.from(fileData.split(',')[1], 'base64'));
        const dbEntry = zip.getEntry('database.json');
        if (dbEntry) {
            fs.writeFileSync(DB_FILE, zip.readAsText(dbEntry));
        }
        const uploadsEntry = zip.getEntry('uploads/');
        if (uploadsEntry) {
            zip.extractEntryTo('uploads/', UPLOADS_DIR, false, true);
        }
        zip.extractAllTo(__dirname, true);
        res.json({ success: true });
    } catch (e) {
        console.error("Restore Error:", e);
        res.status(500).json({ error: e.message });
    }
});

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
