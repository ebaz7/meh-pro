
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

// CRITICAL: Always use Absolute Path for the database file
const DB_FILE = path.join(__dirname, 'database.json');
const WAUTH_DIR = path.join(__dirname, 'wauth');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

import { initTelegram, sendTelegramNotification } from './backend/telegram.js';
import { initWhatsApp, sendMessage as sendWhatsAppMessage, getStatus as getWhatsAppStatus, logout as logoutWhatsApp, restartWhatsAppService } from './backend/whatsapp.js';
import { sendBaleMessage, initBaleBot } from './backend/bale.js';

const app = express();
const PORT = process.env.PORT || 3000;

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1024mb' }));
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/uploads', express.static(UPLOADS_DIR));

const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const initialDb = { orders: [], users: [], settings: { currentTrackingNumber: 1000 }, warehouseTransactions: [], warehouseItems: [], chat: [], groups: [], tasks: [], tradeRecords: [], securityLogs: [], personnelDelays: [], securityIncidents: [] };
            fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
            return initialDb;
        }
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error("Critical DB Read Error", e);
        return { orders: [] }; 
    }
};

const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// --- API ENDPOINTS ---
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

app.post('/api/send-whatsapp', async (req, res) => {
    const { number, message, mediaData } = req.body;
    const db = getDb();
    try { await sendWhatsAppMessage(number, message, mediaData); } catch (e) {}
    res.json({ success: true });
});

app.get('/api/whatsapp/status', (req, res) => res.json(getWhatsAppStatus()));

app.get('/api/version', (req, res) => res.json({ version: '1.2.7' }));

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'dist', 'index.html')); });

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Database Absolute Path: ${DB_FILE}`);
    initWhatsApp(WAUTH_DIR);
    const db = getDb();
    if (db.settings.telegramBotToken) initTelegram(db.settings.telegramBotToken);
    if (db.settings.baleBotToken) initBaleBot(db.settings.baleBotToken);
});
