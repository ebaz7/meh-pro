
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import * as Actions from './whatsapp/actions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

let bot = null;

const getDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) { console.error("DB Read Error", e); }
    return null;
};

const getUserByTelegramId = (db, chatId) => {
    return db.users.find(u => u.telegramChatId && u.telegramChatId.toString() === chatId.toString());
};

const generatePdf = async (htmlContent, options = {}) => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: options.format || 'A4', landscape: options.landscape || false, printBackground: true });
    await browser.close();
    return pdfBuffer;
};

export const initTelegram = (token) => {
    if (!token || bot) return;
    bot = new TelegramBot(token, { polling: true });
    console.log(">>> Telegram Bot Ready ✅");

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text?.trim();
        if (text === '/start') {
            const db = getDb();
            const user = getUserByTelegramId(db, chatId);
            if (!user) return bot.sendMessage(chatId, `⛔ عدم دسترسی. شناسه: ${chatId}`);
            bot.sendMessage(chatId, `سلام ${user.fullName}، خوش آمدید.`, {
                reply_markup: { keyboard: [['💰 کارتابل پرداخت', '🚛 کارتابل خروج'], ['📦 کارتابل بیجک', '🌍 گزارشات']], resize_keyboard: true }
            });
        }
    });
};

export const sendTelegramNotification = async (chatId, text, mediaData = null) => {
    if (!bot || !chatId) return;
    try {
        if (mediaData && mediaData.data) {
            const buffer = Buffer.from(mediaData.data, 'base64');
            const isPhoto = mediaData.mimeType.includes('image');
            if (isPhoto) await bot.sendPhoto(chatId, buffer, { caption: text });
            else await bot.sendDocument(chatId, buffer, { caption: text }, { filename: mediaData.filename || 'file.pdf' });
        } else {
            await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
        }
    } catch (e) { console.error("Telegram Notification Fail", e.message); }
};
