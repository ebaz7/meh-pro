
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';
import nodeCron from 'node-cron';

// تنظیمات آدرس‌دهی مطلق (فیکس کردن دیتابیس در پوشه C:\PaymentSystem)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.resolve(__dirname, 'database.json');
const BACKUPS_DIR = path.resolve(__dirname, 'backups');
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const WAUTH_DIR = path.resolve(__dirname, 'wauth');

// ایجاد پوشه‌های حیاتی
[BACKUPS_DIR, UPLOADS_DIR, WAUTH_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

import { initTelegram } from './backend/telegram.js';
import { initWhatsApp } from './backend/whatsapp.js';
import { initBaleBot } from './backend/bale.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1024mb' }));
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/uploads', express.static(UPLOADS_DIR));

// تابع اصلی بک‌آپ با برچسب زمان
const runBackup = () => {
    try {
        if (fs.existsSync(DB_FILE)) {
            const timestamp = new Date().toLocaleDateString('fa-IR').replace(/\//g, '-') + '_' + new Date().getHours() + '-' + new Date().getMinutes();
            const backupPath = path.join(BACKUPS_DIR, `auto-backup-${timestamp}.json`);
            fs.copyFileSync(DB_FILE, backupPath);
            console.log(`[Backup] Successful: ${backupPath}`);
            
            // نگهداری فقط ۳۰ فایل آخر برای جلوگیری از پر شدن هارد
            const files = fs.readdirSync(BACKUPS_DIR).map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime() }));
            if (files.length > 30) {
                files.sort((a, b) => a.time - b.time);
                fs.unlinkSync(path.join(BACKUPS_DIR, files[0].name));
            }
        }
    } catch (e) {
        console.error("[Backup Error]", e);
    }
};

// تابع خواندن دیتابیس
const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const initial = { orders: [], users: [], settings: { currentTrackingNumber: 1000 }, warehouseTransactions: [], warehouseItems: [], chat: [], groups: [], tasks: [], tradeRecords: [], securityLogs: [], personnelDelays: [], securityIncidents: [] };
            fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
            return initial;
        }
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) { return { orders: [] }; }
};

const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// مسیرهای API
app.get('/api/orders', (req, res) => res.json(getDb().orders));
app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { 
    const db = getDb(); 
    db.settings = { ...db.settings, ...req.body }; 
    saveDb(db);
    res.json(db.settings); 
});
app.get('/api/version', (req, res) => res.json({ version: '1.4.0' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`-------------------------------------------`);
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`DB Path: ${DB_FILE}`);
    
    // ۱. بک‌آپ آنی به محض اجرا برای امنیت دیتای پیدا شده
    runBackup(); 

    // ۲. تنظیم بک‌آپ خودکار هر ۶ ساعت
    nodeCron.schedule('0 */6 * * *', () => {
        console.log('Running scheduled backup...');
        runBackup();
    });

    console.log(`Auto-Backup: ACTIVE (Every 6 Hours)`);
    console.log(`-------------------------------------------`);
    
    initWhatsApp(WAUTH_DIR);
    const db = getDb();
    if (db.settings.telegramBotToken) initTelegram(db.settings.telegramBotToken);
    if (db.settings.baleBotToken) initBaleBot(db.settings.baleBotToken);
});
