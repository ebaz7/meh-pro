
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

import { initTelegram, sendDocument as sendTelegramDoc, sendMessage as sendTelegramMsg, notifyNewBijak } from './backend/telegram.js';
import { initWhatsApp, sendMessage as sendWhatsAppMessage, getStatus as getWhatsAppStatus, logout as logoutWhatsApp, getGroups as getWhatsAppGroups, restartClient as restartWhatsApp } from './backend/whatsapp.js';
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
app.get('/api/whatsapp/status', (req, res) => res.json(getWhatsAppStatus()));
app.post('/api/whatsapp/restart', async (req, res) => {
    try {
        await restartWhatsApp();
        res.json({ success: true, message: 'درخواست راه‌اندازی مجدد ارسال شد. لطفاً چند لحظه صبر کنید.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/whatsapp/logout', async (req, res) => { await logoutWhatsApp(); res.json({ success: true }); });

// ... (بقیه کدهای سرور که قبلاً بودند)
app.get('/api/version', (req, res) => res.json({ version: '1.0.0' }));
app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db = getDb(); db.settings = { ...db.settings, ...req.body }; saveDb(db); res.json(db.settings); });
app.get('/api/orders', (req, res) => res.json(getDb().orders));
app.post('/api/orders', (req, res) => { /* منطق ثبت سفارش */ });
app.get('/api/chat', (req, res) => res.json(getDb().messages));
app.post('/api/chat', (req, res) => { /* منطق چت */ });
app.get('/api/users', (req, res) => res.json(getDb().users));
app.post('/api/upload', (req, res) => { /* منطق آپلود */ res.json({ success: true }); });

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'dist', 'index.html')); });

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    initWhatsApp(WAUTH_DIR);
});
