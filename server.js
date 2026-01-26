
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
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- FILE LOGGER FOR SERVICE DEBUGGING ---
const logToFile = (message) => {
    const logPath = path.join(__dirname, 'service-error.log');
    const timestamp = new Date().toISOString();
    try {
        fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
    } catch(e) {
        console.error("Log Write Error:", e);
    }
};

process.on('uncaughtException', (err) => { 
    console.error('>>> CRITICAL ERROR:', err.message); 
    logToFile(`CRITICAL ERROR: ${err.message}\n${err.stack}`);
});

process.on('unhandledRejection', (reason) => { 
    console.error('>>> CRITICAL REJECTION:', reason); 
    logToFile(`CRITICAL REJECTION: ${reason}`);
});

import { initTelegram, sendDocument as sendTelegramDoc, sendMessage as sendTelegramMsg, notifyNewBijak } from './backend/telegram.js';
import { initWhatsApp, sendMessage as sendWhatsAppMessage, getStatus as getWhatsAppStatus, logout as logoutWhatsApp, getGroups as getWhatsAppGroups } from './backend/whatsapp.js';
import { sendBaleMessage, initBaleBot } from './backend/bale.js'; // IMPORT BALE MODULE

const app = express();

// --- PORT CONFIGURATION ---
const PORT = process.env.PORT || 3000;

const SERVER_BUILD_ID = Date.now().toString();

const DB_FILE = path.join(__dirname, 'database.json');
const VAPID_FILE = path.join(__dirname, 'vapid.json'); 
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const AI_UPLOADS_DIR = path.join(__dirname, 'uploads', 'ai');
const BACKUPS_DIR = path.join(__dirname, 'backups');
const WAUTH_DIR = path.join(__dirname, 'wauth');
const SSL_DIR = path.join(__dirname, 'ssl'); 

// Ensure directories exist synchronously
try {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    if (!fs.existsSync(AI_UPLOADS_DIR)) fs.mkdirSync(AI_UPLOADS_DIR, { recursive: true });
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    if (!fs.existsSync(WAUTH_DIR)) fs.mkdirSync(WAUTH_DIR, { recursive: true });
    if (!fs.existsSync(SSL_DIR)) fs.mkdirSync(SSL_DIR, { recursive: true });
} catch (err) {
    console.error("Directory Creation Error:", err);
    logToFile(`Dir Creation Error: ${err.message}`);
}

app.set('trust proxy', 1); 

app.use(cors()); 
app.use(compression()); 

// *** CRITICAL CHANGE: INCREASED LIMIT TO 1024MB (1GB) ***
app.use(express.json({ limit: '1024mb' })); 
app.use(express.urlencoded({ limit: '1024mb', extended: true }));

const staticOptions = { maxAge: '1y', etag: true, lastModified: true };
app.use(express.static(path.join(__dirname, 'dist'), staticOptions));
app.use('/uploads', express.static(UPLOADS_DIR, staticOptions));

// --- WEB PUSH CONFIGURATION ---
let vapidKeys = { publicKey: '', privateKey: '' };
try {
    if (fs.existsSync(VAPID_FILE)) {
        vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
        console.log(">>> VAPID Keys Loaded from file.");
    } else {
        vapidKeys = webpush.generateVAPIDKeys();
        fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
        console.log(">>> New VAPID Keys Generated and Saved.");
    }
    webpush.setVapidDetails('mailto:admin@example.com', vapidKeys.publicKey, vapidKeys.privateKey);
} catch (error) { console.error(">>> VAPID Key Setup Error:", error); }

const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY || ''; 

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
    if (!data.tradeRecords) data.tradeRecords = [];
    return data;
};
const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

const findNextNumberByFiscalYear = (db, arr, key, type, fiscalYearId, companyName) => {
    let startNum = 1000;
    const safeCompany = companyName ? companyName.trim() : '';
    
    if (fiscalYearId && safeCompany && db.settings.fiscalYears) {
        const activeYear = db.settings.fiscalYears.find(y => y.id === fiscalYearId);
        if (activeYear && activeYear.companySequences) {
            let seqConfig = activeYear.companySequences[safeCompany];
            if (!seqConfig) {
                const foundKey = Object.keys(activeYear.companySequences).find(k => k.trim() === safeCompany);
                if (foundKey) seqConfig = activeYear.companySequences[foundKey];
            }

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
            let legacySeq = sequences[safeCompany];
            if (!legacySeq) {
                 const foundKey = Object.keys(sequences).find(k => k.trim() === safeCompany);
                 if (foundKey) legacySeq = sequences[foundKey];
            }
            startNum = legacySeq || 1000;
        }
    }

    const filtered = safeCompany ? arr.filter(item => {
        const itemComp = (type === 'payment' ? item.payingCompany : (type === 'bijak' ? item.company : item.companyName));
        return itemComp && itemComp.trim() === safeCompany;
    }) : arr;

    const existing = filtered.map(o => Number(o[key])).filter(n => !isNaN(n)).sort((a, b) => a - b);
    
    let next = startNum; 
    
    if (existing.length > 0) {
        const maxExisting = existing[existing.length - 1];
        next = Math.max(maxExisting + 1, startNum);
    } else {
        next = startNum;
    }
    
    return next;
};

const db = getDb();
if (db.settings?.telegramBotToken) try { initTelegram(db.settings.telegramBotToken); } catch (e) { console.error("Telegram Error:", e.message); }
// Initialize Bale Bot
if (db.settings?.baleBotToken) try { initBaleBot(db.settings.baleBotToken); } catch (e) { console.error("Bale Error:", e.message); }

setTimeout(() => { 
    try { 
        initWhatsApp(WAUTH_DIR); 
    } catch(e) { 
        console.error("WA Init Error:", e); 
        logToFile(`WA Init Error: ${e.message}`);
    } 
}, 5000);

const sendNativeFCM = async (token, title, body, url = '/') => {
    if (!FCM_SERVER_KEY) return;
    try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `key=${FCM_SERVER_KEY}` },
            body: JSON.stringify({ to: token, notification: { title, body }, data: { url: url }, priority: 'high' })
        });
        if (!response.ok) console.error("FCM Error:", await response.text());
    } catch (e) { console.error("FCM Network Error", e); }
};

const sendWebPush = (title, body, url = '/', targetUsername = null) => {
    const db = getDb();
    const subs = db.pushSubscriptions || [];
    let relevantSubs = subs;
    if (targetUsername) {
        relevantSubs = subs.filter(s => s.username === targetUsername);
        console.log(`Sending push to '${targetUsername}'. Devices found: ${relevantSubs.length}`);
    } else {
        console.log(`Sending broadcast push to ${subs.length} devices.`);
    }
    const payload = JSON.stringify({ title, body, url });
    const options = { headers: { 'Urgency': 'high' } };
    let invalidEndpoints = [];
    Promise.all(relevantSubs.map(sub => {
        if (sub.type === 'android' && sub.keys?.auth === 'native') return sendNativeFCM(sub.endpoint, title, body, url);
        if (sub.endpoint && sub.keys && sub.keys.p256dh && sub.keys.p256dh !== 'native') {
            return webpush.sendNotification(sub, payload, options).catch(err => {
                console.warn(`WebPush Failed (${err.statusCode}):`, err.body || err.message);
                if (err.statusCode === 410 || err.statusCode === 404) invalidEndpoints.push(sub.endpoint);
            });
        }
        return Promise.resolve();
    })).then(() => {
        if (invalidEndpoints.length > 0) {
            const currentDb = getDb();
            currentDb.pushSubscriptions = currentDb.pushSubscriptions.filter(s => !invalidEndpoints.includes(s.endpoint));
            saveDb(currentDb);
            console.log(`Cleaned up ${invalidEndpoints.length} invalid subscriptions`);
        }
    });
};

const sendPushToUsers = (usernames, title, body, url = '/') => {
    const uniqueUsers = [...new Set(usernames)];
    uniqueUsers.forEach(u => sendWebPush(title, body, url, u));
};

app.get('/api/version', (req, res) => res.json({ version: SERVER_BUILD_ID }));
app.get('/api/vapid-key', (req, res) => res.json({ publicKey: vapidKeys.publicKey }));

app.post('/api/send-test-push', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({error: 'Username required'});
    const db = getDb();
    const hasSub = db.pushSubscriptions?.some(s => s.username === username);
    if (!hasSub) return res.status(404).json({ error: 'No subscription found for this user', details: 'مطمئن شوید دکمه فعال‌سازی نوتیفیکیشن را زده‌اید و مجوز مرورگر داده شده است.' });
    sendWebPush('تست سیستم', 'این یک پیام آزمایشی از سرور است.', '/#settings', username);
    res.json({ success: true, message: 'Push triggered' });
});

app.post('/api/subscribe', (req, res) => { 
    const s = req.body; 
    if (!s || !s.endpoint) return res.status(400).json({ error: 'Invalid subscription object' });
    const d = getDb(); 
    if(!d.pushSubscriptions) d.pushSubscriptions = [];
    const existingIdx = d.pushSubscriptions.findIndex(x => x.endpoint === s.endpoint);
    if(existingIdx !== -1) { d.pushSubscriptions[existingIdx] = { ...d.pushSubscriptions[existingIdx], ...s }; } 
    else { d.pushSubscriptions.push(s); }
    saveDb(d); 
    if (s.keys && s.keys.p256dh !== 'native') {
        webpush.sendNotification(s, JSON.stringify({ title: 'اتصال برقرار شد', body: `دستگاه شما با موفقیت ثبت شد.` })).catch(e => console.error("Welcome Push Failed", e.statusCode));
    }
    res.status(201).json({ success: true }); 
});

// --- WHATSAPP & BALE SEND ROUTE ---
app.post('/api/send-whatsapp', async (req, res) => {
    try {
        const { number, message, mediaData } = req.body;
        const db = getDb();
        
        // 1. Send via WhatsApp (Primary)
        let waError = null;
        try {
            await sendWhatsAppMessage(number, message, mediaData);
        } catch (e) {
            waError = e.message;
            console.error("WA Send Error:", e);
        }

        // 2. Check for Bale integration (Automatic Parallel Send)
        if (db && db.settings.baleBotToken) {
            let targetBaleId = null;

            // Strategy A: Check User (Direct Mapping)
            // WhatsApp numbers usually have country code (e.g., 98912...). We normalize for search.
            const targetPhone = number.replace(/\D/g, '').slice(-10); // Last 10 digits
            const targetUser = db.users.find(u => u.phoneNumber && u.phoneNumber.replace(/\D/g, '').includes(targetPhone));
            if (targetUser && targetUser.baleChatId) {
                targetBaleId = targetUser.baleChatId;
            }

            // Strategy B: Check Saved Contacts (Group Mapping)
            // If the number corresponds to a saved group ID (e.g. 12036... @g.us)
            if (!targetBaleId && db.settings.savedContacts) {
                 const contact = db.settings.savedContacts.find(c => c.number === number);
                 if (contact && contact.baleId) {
                     targetBaleId = contact.baleId;
                 }
            }
            
            if (targetBaleId) {
                console.log(`Sending copy to Bale ID: ${targetBaleId}`);
                try {
                    await sendBaleMessage(db.settings.baleBotToken, targetBaleId, message, mediaData);
                } catch (baleErr) {
                    console.error("Bale Send Error:", baleErr);
                    // Don't fail request if secondary channel fails
                }
            }
        }

        if (waError) throw new Error(waError);
        res.json({ success: true });

    } catch (e) {
        logToFile(`WA Send API Error: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// --- NEW UPLOAD ROUTE ---
app.post('/api/upload', (req, res) => {
    try {
        const { fileName, fileData } = req.body;
        if (!fileData) return res.status(400).json({ error: 'No data provided' });

        // Strip Base64 header if present. Handle any mime type.
        const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let buffer;

        if (matches && matches.length === 3) {
            buffer = Buffer.from(matches[2], 'base64');
        } else {
            // Assume raw base64 string if no header or failed regex
            // Some clients send raw base64, some send with header.
            // If it contains comma but no data: prefix, might be partial.
            const raw = fileData.includes(',') ? fileData.split(',')[1] : fileData;
            buffer = Buffer.from(raw, 'base64');
        }

        // Generate unique filename
        const uniqueName = `${Date.now()}_${fileName.replace(/\s/g, '_')}`;
        const filePath = path.join(UPLOADS_DIR, uniqueName);

        fs.writeFileSync(filePath, buffer);

        // Return relative URL
        const fileUrl = `/uploads/${uniqueName}`;
        res.json({ fileName: uniqueName, url: fileUrl });
    } catch (e) {
        console.error("Upload Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- PDF GENERATION ROUTE ---
app.post('/api/render-pdf', async (req, res) => { 
    let browser = null;
    try { 
        const { html, landscape, width, height, format } = req.body; 
        
        browser = await puppeteer.launch({ 
            headless: 'new',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Vital for Docker/Low Memory
                '--disable-gpu'
            ] 
        }); 
        
        const page = await browser.newPage(); 
        
        // Increase timeout to 2 minutes for heavy pages
        await page.setContent(html, { 
            waitUntil: ['load', 'networkidle0'],
            timeout: 120000 
        }); 
        
        await page.emulateMediaType('print');

        const pdfOptions = { 
            printBackground: true, 
            landscape: !!landscape,
            timeout: 120000 
        };

        if (width && height) {
            pdfOptions.width = width;
            pdfOptions.height = height;
        } else {
            pdfOptions.format = format || (width || height ? undefined : 'A4');
        }

        const pdf = await page.pdf(pdfOptions); 
        
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': pdf.length
        });
        res.send(pdf); 
    } catch (e) { 
        console.error("PDF Gen Error:", e);
        res.status(500).json({error: e.message}); 
    } finally {
        if (browser) await browser.close();
    }
});

// --- RESTORE API ---
app.post('/api/full-restore', (req, res) => { try { const { fileData } = req.body; if (!fileData) throw new Error("No data"); const zip = new AdmZip(Buffer.from(fileData.split(',')[1], 'base64')); const dbEntry = zip.getEntry('database.json'); if (dbEntry) { fs.writeFileSync(DB_FILE, zip.readAsText(dbEntry)); } const uploadsEntry = zip.getEntry('uploads/'); if (uploadsEntry) { zip.extractEntryTo('uploads/', UPLOADS_DIR, false, true); } zip.extractAllTo(__dirname, true); res.json({ success: true }); } catch (e) { console.error("Restore Error:", e); res.status(500).json({ error: e.message }); } });

// --- ENTITY ROUTES ---
app.get('/api/orders', (req, res) => { const db = getDb(); res.json(db.orders); });
app.post('/api/orders', (req, res) => { const db = getDb(); const order = req.body; order.id = Date.now().toString(); const activeYearId = db.settings.activeFiscalYearId; order.fiscalYearId = activeYearId; order.trackingNumber = findNextNumberByFiscalYear(db, db.orders, 'trackingNumber', 'payment', activeYearId, order.payingCompany); db.orders.unshift(order); saveDb(db); const targetUsers = db.users.filter(u => u.role === 'financial' || u.role === 'admin').map(u => u.username); sendPushToUsers(targetUsers, 'دستور پرداخت جدید', `شماره ${order.trackingNumber} - مبلغ: ${new Intl.NumberFormat('fa-IR').format(order.totalAmount)} ریال`, '#manage'); res.json(db.orders); });
app.put('/api/orders/:id', (req, res) => { const db=getDb(); const idx=db.orders.findIndex(x=>x.id===req.params.id); if(idx!==-1){ const oldStatus = db.orders[idx].status; db.orders[idx]={...db.orders[idx],...req.body}; saveDb(db); if (req.body.status && req.body.status !== oldStatus) { sendPushToUsers([db.orders[idx].requester], 'تغییر وضعیت پرداخت', `شماره ${db.orders[idx].trackingNumber}: ${req.body.status}`, '#manage'); } res.json(db.orders); } else res.sendStatus(404); });
app.delete('/api/orders/:id', (req, res) => { const db=getDb(); db.orders=db.orders.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.orders); });

app.get('/api/trade', (req, res) => { const db = getDb(); if (!Array.isArray(db.tradeRecords)) db.tradeRecords = []; res.json(db.tradeRecords); });
app.post('/api/trade', (req, res) => { const db = getDb(); if (!Array.isArray(db.tradeRecords)) db.tradeRecords = []; const record = req.body; if (!record.id) record.id = Date.now().toString(); db.tradeRecords.push(record); saveDb(db); res.json(db.tradeRecords); });
app.put('/api/trade/:id', (req, res) => { const db = getDb(); if (!Array.isArray(db.tradeRecords)) db.tradeRecords = []; const idx = db.tradeRecords.findIndex(r => r.id === req.params.id); if (idx !== -1) { db.tradeRecords[idx] = { ...db.tradeRecords[idx], ...req.body }; saveDb(db); res.json(db.tradeRecords); } else { res.status(404).json({ error: "Not found" }); }});
app.delete('/api/trade/:id', (req, res) => { const db = getDb(); if (!Array.isArray(db.tradeRecords)) db.tradeRecords = []; db.tradeRecords = db.tradeRecords.filter(r => r.id !== req.params.id); saveDb(db); res.json(db.tradeRecords); });

app.get('/api/exit-permits', (req, res) => { const db = getDb(); res.json(db.exitPermits); });
app.post('/api/exit-permits', (req, res) => { const db = getDb(); const permit = req.body; permit.id = Date.now().toString(); const activeYearId = db.settings.activeFiscalYearId; permit.fiscalYearId = activeYearId; permit.permitNumber = findNextNumberByFiscalYear(db, db.exitPermits, 'permitNumber', 'exit', activeYearId, permit.companyName); db.exitPermits.push(permit); saveDb(db); const targetUsers = db.users.filter(u => u.role === 'ceo' || u.role === 'admin').map(u => u.username); sendPushToUsers(targetUsers, 'مجوز خروج جدید', `شماره ${permit.permitNumber} - گیرنده: ${permit.recipientName}`, '#manage-exit'); res.json(db.exitPermits); });
app.put('/api/exit-permits/:id', (req, res) => { const db=getDb(); const idx=db.exitPermits.findIndex(x=>x.id===req.params.id); if(idx!==-1){ const oldStatus = db.exitPermits[idx].status; db.exitPermits[idx]={...db.exitPermits[idx],...req.body}; saveDb(db); if (req.body.status && req.body.status !== oldStatus) { sendWebPush('تغییر وضعیت مجوز خروج', `شماره ${db.exitPermits[idx].permitNumber}: ${req.body.status}`, '#manage-exit'); } res.json(db.exitPermits); } else res.sendStatus(404); });
app.delete('/api/exit-permits/:id', (req, res) => { const db=getDb(); db.exitPermits=db.exitPermits.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.exitPermits); });

app.get('/api/next-tracking-number', (req, res) => { const db = getDb(); const activeYearId = db.settings.activeFiscalYearId; const company = req.query.company; const next = findNextNumberByFiscalYear(db, db.orders, 'trackingNumber', 'payment', activeYearId, company); res.json({ nextTrackingNumber: next }); });
app.get('/api/next-exit-permit-number', (req, res) => { const db = getDb(); const activeYearId = db.settings.activeFiscalYearId; const company = req.query.company; const next = findNextNumberByFiscalYear(db, db.exitPermits, 'permitNumber', 'exit', activeYearId, company); res.json({ nextNumber: next }); });
app.get('/api/next-bijak-number', (req, res) => { const db = getDb(); const activeYearId = db.settings.activeFiscalYearId; const company = req.query.company; const next = findNextNumberByFiscalYear(db, db.warehouseTransactions.filter(x => x.type === 'OUT'), 'number', 'bijak', activeYearId, company); res.json({ nextNumber: next }); });

app.get('/api/warehouse/transactions', (req, res) => { const db = getDb(); res.json(db.warehouseTransactions); });
app.post('/api/warehouse/transactions', (req, res) => { const db = getDb(); const t = req.body; const activeYearId = db.settings.activeFiscalYearId; t.fiscalYearId = activeYearId; if(t.type === 'OUT'){ t.number = findNextNumberByFiscalYear(db, db.warehouseTransactions.filter(x => x.type === 'OUT'), 'number', 'bijak', activeYearId, t.company); notifyNewBijak(t); const targetUsers = db.users.filter(u => u.role === 'ceo' || u.role === 'admin').map(u => u.username); sendPushToUsers(targetUsers, 'بیجک جدید صادر شد', `شماره ${t.number} - شرکت: ${t.company}`, '#warehouse'); } db.warehouseTransactions.unshift(t); saveDb(db); res.json(db.warehouseTransactions); });
app.put('/api/warehouse/transactions/:id', (req, res) => { const db=getDb(); const idx=db.warehouseTransactions.findIndex(x=>x.id===req.params.id); if(idx!==-1){ db.warehouseTransactions[idx]={...db.warehouseTransactions[idx],...req.body}; saveDb(db); res.json(db.warehouseTransactions); } else res.sendStatus(404); });
app.delete('/api/warehouse/transactions/:id', (req, res) => { const db=getDb(); db.warehouseTransactions=db.warehouseTransactions.filter(x=>x.id!==req.params.id); saveDb(db); res.json(db.warehouseTransactions); });

app.get('/api/chat', (req, res) => res.json(getDb().messages));
app.post('/api/chat', (req, res) => { const db = getDb(); const m = req.body; m.id = Date.now().toString(); db.messages.push(m); saveDb(db); const title = `پیام جدید از ${m.sender}`; let body = m.message || 'فایل ضمیمه'; if(body.startsWith('CALL_INVITE|')) body = '📞 تماس ورودی...'; const chatUrl = '#chat'; if (m.recipient) { sendPushToUsers([m.recipient], title, body, chatUrl); } else if (m.groupId) { const group = db.groups.find(g => g.id === m.groupId); if (group) { const targets = group.members.filter(u => u !== m.senderUsername); sendPushToUsers(targets, title + ` (گروه ${group.name})`, body, chatUrl); } } else { const targets = db.users.filter(u => u.username !== m.senderUsername).map(u => u.username); sendPushToUsers(targets, title + ' (عمومی)', body, chatUrl); } res.json(db.messages); });

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

app.get('*', (req, res) => { const p = path.join(__dirname, 'dist', 'index.html'); if(fs.existsSync(p)) res.sendFile(p); else res.send('Build first'); });

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n>>> Server running on port ${PORT}`);
    logToFile(`Server started on port ${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n!!! ERROR: Port ${PORT} is busy! !!!`);
        logToFile(`Error: Port ${PORT} is busy`);
    } else {
        console.error(err);
        logToFile(`Server error: ${err.message}`);
    }
});
