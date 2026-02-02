
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

import { initTelegram, sendSystemNotification } from './backend/telegram.js';
import { initWhatsApp, sendMessage as sendWhatsAppMessage, getStatus as getWhatsAppStatus, logout as logoutWhatsApp, restartClient as restartWhatsApp } from './backend/whatsapp.js';
import { sendBaleMessage, initBaleBot } from './backend/bale.js';

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');
const WAUTH_DIR = path.join(__dirname, 'wauth');

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1024mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

const getDb = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// --- ROUTES ---

// اصلاح مسیر ارسال واتساپ برای شامل شدن تلگرام
app.post('/api/send-whatsapp', async (req, res) => {
    const { number, message, mediaData } = req.body;
    const db = getDb();
    let results = { whatsapp: false, telegram: false };

    // 1. WhatsApp
    try {
        await sendWhatsAppMessage(number, message, mediaData);
        results.whatsapp = true;
    } catch (e) { console.error("WA Send Fail"); }

    // 2. Telegram (Auto-Notification Hub)
    // هر پیامی که برای واتساپ ساخته می‌شود، به کانال اطلاع‌رسانی تلگرام هم برود
    try {
        if (db.settings.telegramBotToken) {
            await sendSystemNotification(message, mediaData);
            results.telegram = true;
        }
    } catch (e) { console.error("TG Send Fail"); }

    res.json({ success: true, results });
});

app.get('/api/whatsapp/status', (req, res) => res.json(getWhatsAppStatus()));
app.post('/api/whatsapp/restart', async (req, res) => {
    try {
        await restartWhatsApp();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { 
    const db = getDb(); 
    db.settings = { ...db.settings, ...req.body }; 
    saveDb(db); 
    // Re-init bots if tokens changed
    if (req.body.telegramBotToken) initTelegram(req.body.telegramBotToken);
    res.json(db.settings); 
});

app.get('/api/orders', (req, res) => res.json(getDb().orders));
app.get('/api/users', (req, res) => res.json(getDb().users));
app.get('/api/version', (req, res) => res.json({ version: '1.2.5' }));

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'dist', 'index.html')); });

app.listen(PORT, '0.0.0.0', () => {
    const db = getDb();
    console.log(`Server running on port ${PORT}`);
    initWhatsApp(WAUTH_DIR);
    if (db.settings.telegramBotToken) initTelegram(db.settings.telegramBotToken);
});
