
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression';
import { fileURLToPath } from 'url';
import nodeCron from 'node-cron';
import puppeteer from 'puppeteer';
import admZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تنظیمات آدرس‌دهی مطلق برای پایداری در سرویس ویندوز
const DB_FILE = path.resolve(__dirname, 'database.json');
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const BACKUPS_DIR = path.resolve(__dirname, 'backups');
const WAUTH_DIR = path.resolve(__dirname, 'wauth');

// ایجاد پوشه‌های مورد نیاز
[UPLOADS_DIR, BACKUPS_DIR, WAUTH_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

import { initTelegram } from './backend/telegram.js';
import { initWhatsApp, getStatus, restartWhatsAppService, sendMessage as sendWAMessage, getGroups as getWAGroups } from './backend/whatsapp.js';
import { initBaleBot } from './backend/bale.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1024mb' }));
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/uploads', express.static(UPLOADS_DIR));

// --- مدیریت دیتابیس ---
const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const initial = { 
                orders: [], users: [], settings: { currentTrackingNumber: 1000, currentExitPermitNumber: 1000 }, 
                exitPermits: [], warehouseTransactions: [], warehouseItems: [], 
                chat: [], groups: [], tasks: [], tradeRecords: [], 
                securityLogs: [], personnelDelays: [], securityIncidents: [] 
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
            return initial;
        }
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error("DB Read Error:", e);
        return { orders: [] };
    }
};

const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// --- سیستم بک‌آپ ---
const runBackup = () => {
    try {
        if (fs.existsSync(DB_FILE)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(BACKUPS_DIR, `db-backup-${timestamp}.json`);
            fs.copyFileSync(DB_FILE, backupPath);
            console.log(`[Backup] Created: ${backupPath}`);
            const files = fs.readdirSync(BACKUPS_DIR).map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime() }));
            if (files.length > 30) {
                files.sort((a, b) => a.time - b.time);
                fs.unlinkSync(path.join(BACKUPS_DIR, files[0].name));
            }
        }
    } catch (e) { console.error("Backup Error:", e); }
};
nodeCron.schedule('0 */6 * * *', runBackup);

// --- API ROUTES ---

// Orders (پرداخت)
app.get('/api/orders', (req, res) => res.json(getDb().orders || []));
app.post('/api/orders', (req, res) => { const db = getDb(); db.orders.unshift(req.body); saveDb(db); res.json(db.orders); });
app.put('/api/orders/:id', (req, res) => { const db = getDb(); db.orders = db.orders.map(o => o.id === req.params.id ? { ...o, ...req.body } : o); saveDb(db); res.json(db.orders); });
app.delete('/api/orders/:id', (req, res) => { const db = getDb(); db.orders = db.orders.filter(o => o.id !== req.params.id); saveDb(db); res.json(db.orders); });

// Exit Permits (خروج بار)
app.get('/api/exit-permits', (req, res) => res.json(getDb().exitPermits || []));
app.post('/api/exit-permits', (req, res) => { const db = getDb(); db.exitPermits.push(req.body); saveDb(db); res.json(db.exitPermits); });
app.put('/api/exit-permits/:id', (req, res) => { const db = getDb(); db.exitPermits = db.exitPermits.map(p => p.id === req.params.id ? { ...p, ...req.body } : p); saveDb(db); res.json(db.exitPermits); });
app.delete('/api/exit-permits/:id', (req, res) => { const db = getDb(); db.exitPermits = db.exitPermits.filter(p => p.id !== req.params.id); saveDb(db); res.json(db.exitPermits); });

// Warehouse (انبار)
app.get('/api/warehouse/items', (req, res) => res.json(getDb().warehouseItems || []));
app.post('/api/warehouse/items', (req, res) => { const db = getDb(); db.warehouseItems.push(req.body); saveDb(db); res.json(db.warehouseItems); });
app.put('/api/warehouse/items/:id', (req, res) => { const db = getDb(); db.warehouseItems = db.warehouseItems.map(i => i.id === req.params.id ? { ...i, ...req.body } : i); saveDb(db); res.json(db.warehouseItems); });
app.delete('/api/warehouse/items/:id', (req, res) => { const db = getDb(); db.warehouseItems = db.warehouseItems.filter(i => i.id !== req.params.id); saveDb(db); res.json(db.warehouseItems); });

app.get('/api/warehouse/transactions', (req, res) => res.json(getDb().warehouseTransactions || []));
app.post('/api/warehouse/transactions', (req, res) => { 
    const db = getDb(); 
    const tx = req.body;
    if (tx.type === 'OUT' && tx.number) {
        const exists = db.warehouseTransactions.some(t => t.type === 'OUT' && t.company === tx.company && t.number === tx.number);
        if (exists) return res.status(409).json({ error: 'شماره بیجک تکراری است' });
    }
    db.warehouseTransactions.unshift(tx); 
    saveDb(db); 
    res.json(db.warehouseTransactions); 
});
app.put('/api/warehouse/transactions/:id', (req, res) => { const db = getDb(); db.warehouseTransactions = db.warehouseTransactions.map(t => t.id === req.params.id ? { ...t, ...req.body } : t); saveDb(db); res.json(db.warehouseTransactions); });
app.delete('/api/warehouse/transactions/:id', (req, res) => { const db = getDb(); db.warehouseTransactions = db.warehouseTransactions.filter(t => t.id !== req.params.id); saveDb(db); res.json(db.warehouseTransactions); });

// Security (انتظامات)
app.get('/api/security/logs', (req, res) => res.json(getDb().securityLogs || []));
app.post('/api/security/logs', (req, res) => { const db = getDb(); db.securityLogs.push(req.body); saveDb(db); res.json(db.securityLogs); });
app.put('/api/security/logs/:id', (req, res) => { const db = getDb(); db.securityLogs = db.securityLogs.map(l => l.id === req.params.id ? { ...l, ...req.body } : l); saveDb(db); res.json(db.securityLogs); });
app.delete('/api/security/logs/:id', (req, res) => { const db = getDb(); db.securityLogs = db.securityLogs.filter(l => l.id !== req.params.id); saveDb(db); res.json(db.securityLogs); });

app.get('/api/security/delays', (req, res) => res.json(getDb().personnelDelays || []));
app.post('/api/security/delays', (req, res) => { const db = getDb(); db.personnelDelays.push(req.body); saveDb(db); res.json(db.personnelDelays); });
app.put('/api/security/delays/:id', (req, res) => { const db = getDb(); db.personnelDelays = db.personnelDelays.map(d => d.id === req.params.id ? { ...d, ...req.body } : d); saveDb(db); res.json(db.personnelDelays); });
app.delete('/api/security/delays/:id', (req, res) => { const db = getDb(); db.personnelDelays = db.personnelDelays.filter(d => d.id !== req.params.id); saveDb(db); res.json(db.personnelDelays); });

app.get('/api/security/incidents', (req, res) => res.json(getDb().securityIncidents || []));
app.post('/api/security/incidents', (req, res) => { const db = getDb(); db.securityIncidents.push(req.body); saveDb(db); res.json(db.securityIncidents); });
app.put('/api/security/incidents/:id', (req, res) => { const db = getDb(); db.securityIncidents = db.securityIncidents.map(i => i.id === req.params.id ? { ...i, ...req.body } : i); saveDb(db); res.json(db.securityIncidents); });
app.delete('/api/security/incidents/:id', (req, res) => { const db = getDb(); db.securityIncidents = db.securityIncidents.filter(i => i.id !== req.params.id); saveDb(db); res.json(db.securityIncidents); });

// Trade (بازرگانی)
app.get('/api/trade', (req, res) => res.json(getDb().tradeRecords || []));
app.post('/api/trade', (req, res) => { const db = getDb(); db.tradeRecords.push(req.body); saveDb(db); res.json(db.tradeRecords); });
app.put('/api/trade/:id', (req, res) => { const db = getDb(); db.tradeRecords = db.tradeRecords.map(r => r.id === req.params.id ? { ...r, ...req.body } : r); saveDb(db); res.json(db.tradeRecords); });
app.delete('/api/trade/:id', (req, res) => { const db = getDb(); db.tradeRecords = db.tradeRecords.filter(r => r.id !== req.params.id); saveDb(db); res.json(db.tradeRecords); });

// Settings & Sequences
app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db = getDb(); db.settings = { ...db.settings, ...req.body }; saveDb(db); res.json(db.settings); });

app.get('/api/next-tracking-number', (req, res) => {
    const db = getDb();
    const last = db.orders.length > 0 ? Math.max(...db.orders.map(o => o.trackingNumber)) : (db.settings.currentTrackingNumber || 1000);
    res.json({ nextTrackingNumber: last + 1 });
});

app.get('/api/next-exit-permit-number', (req, res) => {
    const db = getDb();
    const last = db.exitPermits.length > 0 ? Math.max(...db.exitPermits.map(p => p.permitNumber)) : (db.settings.currentExitPermitNumber || 1000);
    res.json({ nextNumber: last + 1 });
});

app.get('/api/next-bijak-number', (req, res) => {
    const company = req.query.company;
    const db = getDb();
    const companyTxs = db.warehouseTransactions.filter(t => t.type === 'OUT' && t.company === company);
    const last = companyTxs.length > 0 ? Math.max(...companyTxs.map(t => t.number)) : (db.settings.warehouseSequences?.[company] || 1000);
    res.json({ nextNumber: last + 1 });
});

// Chat & Users
app.get('/api/chat', (req, res) => res.json(getDb().chat || []));
app.post('/api/chat', (req, res) => { const db = getDb(); db.chat.push(req.body); saveDb(db); res.json(db.chat); });
app.get('/api/users', (req, res) => res.json(getDb().users || []));
app.post('/api/users', (req, res) => { const db = getDb(); db.users.push(req.body); saveDb(db); res.json(db.users); });
app.put('/api/users/:id', (req, res) => { const db = getDb(); db.users = db.users.map(u => u.id === req.params.id ? { ...u, ...req.body } : u); saveDb(db); res.json(db.users); });
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = getDb().users.find(u => u.username === username && u.password === password);
    if (user) res.json(user); else res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
});

// WhatsApp
app.get('/api/whatsapp/status', (req, res) => res.json(getStatus()));
app.get('/api/whatsapp/groups', async (req, res) => { try { const groups = await getWAGroups(); res.json({ success: true, groups }); } catch(e) { res.status(500).json({ error: e.message }); } });
app.post('/api/whatsapp/logout', async (req, res) => { await restartWhatsAppService(); res.json({ success: true }); });
app.post('/api/send-whatsapp', async (req, res) => {
    try {
        const { number, message, mediaData } = req.body;
        await sendWAMessage(number, message, mediaData);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PDF & Files
app.post('/api/render-pdf', async (req, res) => {
    try {
        const { html, landscape, width, height, format } = req.body;
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ format: format || 'A4', landscape: !!landscape, width: width || undefined, height: height || undefined, printBackground: true });
        await browser.close();
        res.contentType("application/pdf");
        res.send(pdf);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/upload', (req, res) => {
    const { fileName, fileData } = req.body;
    const base64Data = fileData.replace(/^data:.*?;base64,/, "");
    const filePath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(filePath, base64Data, 'base64');
    res.json({ fileName, url: `/uploads/${fileName}` });
});

app.get('/api/full-backup', (req, res) => {
    const zip = new admZip();
    zip.addLocalFile(DB_FILE);
    if (req.query.includeFiles === 'true') zip.addLocalFolder(UPLOADS_DIR, 'uploads');
    const buffer = zip.toBuffer();
    res.contentType("application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=full-backup-${Date.now()}.zip`);
    res.send(buffer);
});

app.get('/api/version', (req, res) => res.json({ version: '1.5.0' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Master Server Started on port ${PORT}`);
    runBackup();
    initWhatsApp(WAUTH_DIR);
    const db = getDb();
    if (db.settings.telegramBotToken) initTelegram(db.settings.telegramBotToken);
    if (db.settings.baleBotToken) initBaleBot(db.settings.baleBotToken);
});
