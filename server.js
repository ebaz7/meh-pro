
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
import nodeCron from 'node-cron';
import puppeteer from 'puppeteer';
import webpush from 'web-push'; 
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CRITICAL FIX: Always use absolute paths for database and storage
const DB_FILE = path.resolve(__dirname, 'database.json');
const WAUTH_DIR = path.resolve(__dirname, 'wauth');
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');

import { initTelegram, sendTelegramNotification } from './backend/telegram.js';
import { initWhatsApp, sendMessage as sendWhatsAppMessage, getStatus as getWhatsAppStatus, logout as logoutWhatsApp, restartWhatsAppService } from './backend/whatsapp.js';
import { sendBaleMessage, initBaleBot } from './backend/bale.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure storage directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1024mb' }));
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/uploads', express.static(UPLOADS_DIR));

const getDb = () => {
    if (!fs.existsSync(DB_FILE)) {
        // Initial DB structure if file missing
        const initialDb = { orders: [], users: [], settings: { currentTrackingNumber: 1000 }, warehouseTransactions: [], warehouseItems: [], chat: [], groups: [], tasks: [], tradeRecords: [], securityLogs: [], personnelDelays: [], securityIncidents: [] };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
        return initialDb;
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
};

const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// --- NOTIFICATION HUB ---
app.post('/api/send-whatsapp', async (req, res) => {
    const { number, message, mediaData } = req.body;
    const db = getDb();
    
    // 1. ارسال به واتساپ
    try { await sendWhatsAppMessage(number, message, mediaData); } catch (e) { console.error("WA Send Fail"); }

    // 2. کپی به تلگرام
    if (db.settings.telegramBotToken) {
        const targetUser = db.users.find(u => u.phoneNumber && u.phoneNumber.includes(number.replace(/\D/g, '').slice(-10)));
        const chatId = targetUser?.telegramChatId || db.settings.telegramAdminId;
        if (chatId) await sendTelegramNotification(chatId, message, mediaData);
    }

    // 3. کپی به بله
    if (db.settings.baleBotToken) {
        const targetUser = db.users.find(u => u.phoneNumber && u.phoneNumber.includes(number.replace(/\D/g, '').slice(-10)));
        const chatId = targetUser?.baleChatId;
        if (chatId) await sendBaleMessage(db.settings.baleBotToken, chatId, message, mediaData);
    }

    res.json({ success: true });
});

// --- ROUTES ---
app.get('/api/orders', (req, res) => res.json(getDb().orders));
app.get('/api/users', (req, res) => res.json(getDb().users));
app.get('/api/settings', (req, res) => res.json(getDb().settings));

app.post('/api/settings', (req, res) => { 
    const db = getDb(); 
    db.settings = { ...db.settings, ...req.body }; 
    saveDb(db);
    if (req.body.telegramBotToken) initTelegram(req.body.telegramBotToken);
    if (req.body.baleBotToken) initBaleBot(req.body.baleBotToken);
    res.json(db.settings); 
});

app.get('/api/whatsapp/status', (req, res) => res.json(getWhatsAppStatus()));
app.post('/api/whatsapp/restart', async (req, res) => {
    await restartWhatsAppService();
    res.json({ success: true, message: 'سرویس در حال ری‌استارت...' });
});

app.get('/api/version', (req, res) => res.json({ version: '1.2.6' }));

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'dist', 'index.html')); });

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Database location: ${DB_FILE}`);
    const db = getDb();
    initWhatsApp(WAUTH_DIR);
    if (db.settings.telegramBotToken) initTelegram(db.settings.telegramBotToken);
    if (db.settings.baleBotToken) initBaleBot(db.settings.baleBotToken);
});
