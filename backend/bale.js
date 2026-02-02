
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

let pollingActive = false;
let lastOffset = 0;

const getDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) { console.error("DB Read Error", e); }
    return null;
};

const callBaleApi = (token, method, data = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'tapi.bale.ai',
            port: 443,
            path: `/bot${token}/${method}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
};

export const sendBaleMessage = async (token, chatId, caption, mediaData) => {
    if (!token || !chatId) return;
    if (!mediaData) {
        return callBaleApi(token, 'sendMessage', { chat_id: chatId, text: caption });
    }
    const isPhoto = mediaData.mimeType.includes('image');
    const method = isPhoto ? 'sendPhoto' : 'sendDocument';
    const fileField = isPhoto ? 'photo' : 'document';
    
    const boundary = '----BaleBoundary' + Date.now().toString(16);
    const buffer = Buffer.from(mediaData.data, 'base64');
    const filename = mediaData.filename || (isPhoto ? 'image.png' : 'file.pdf');

    const header = `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n` +
                   `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n` +
                   `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: ${mediaData.mimeType}\r\n\r\n`;
    const footer = `\r\n--${boundary}--`;

    const options = {
        hostname: 'tapi.bale.ai',
        path: `/bot${token}/${method}`,
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (c) => body += c);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        req.write(header);
        req.write(buffer);
        req.write(footer);
        req.end();
    });
};

const handleCommand = async (token, update) => {
    const msg = update.message;
    if (!msg || !msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const db = getDb();
    if (!db) return;

    const user = db.users.find(u => u.baleChatId && u.baleChatId.toString() === msg.from.id.toString());
    if (!user) {
        if (text === '/start') await callBaleApi(token, 'sendMessage', { chat_id: chatId, text: `⛔ عدم دسترسی. شناسه بله شما: ${msg.from.id}` });
        return;
    }

    if (text === '/start' || text === 'منو') {
        const keyboard = [
            ['💰 کارتابل پرداخت', '🚛 کارتابل خروج'],
            ['📦 کارتابل بیجک', '🌍 گزارش بازرگانی']
        ];
        await callBaleApi(token, 'sendMessage', { 
            chat_id: chatId, 
            text: `سلام ${user.fullName} عزیز 👋\nبه سیستم مدیریت خوش آمدید.`,
            reply_markup: { keyboard, resize_keyboard: true }
        });
    }

    if (text === '💰 کارتابل پرداخت') {
        const pending = db.orders.filter(o => o.status.includes('در انتظار'));
        if (pending.length === 0) return callBaleApi(token, 'sendMessage', { chat_id: chatId, text: "✅ کارتابل پرداخت خالی است." });
        for (const o of pending.slice(0, 10)) {
            const txt = `💰 *دستور پرداخت #${o.trackingNumber}*\n👤 ذینفع: ${o.payee}\n💵 مبلغ: ${new Intl.NumberFormat('fa-IR').format(o.totalAmount)} ریال\n⏳ وضعیت: ${o.status}`;
            await callBaleApi(token, 'sendMessage', { chat_id: chatId, text: txt });
        }
    }
    
    if (text === '📦 کارتابل بیجک') {
        const pending = db.warehouseTransactions.filter(t => t.type === 'OUT' && t.status === 'PENDING');
        if (pending.length === 0) return callBaleApi(token, 'sendMessage', { chat_id: chatId, text: "✅ بیجک منتظر تایید وجود ندارد." });
        for (const t of pending) {
            const txt = `📦 *درخواست خروج کالا*\n🏢 شرکت: ${t.company}\n🔢 شماره: ${t.number}\n👤 گیرنده: ${t.recipientName}`;
            await callBaleApi(token, 'sendMessage', { chat_id: chatId, text: txt });
        }
    }
};

const poll = async (token) => {
    if (!pollingActive) return;
    try {
        const res = await callBaleApi(token, 'getUpdates', { offset: lastOffset + 1 });
        if (res.ok && res.result.length > 0) {
            for (const update of res.result) {
                lastOffset = update.update_id;
                await handleCommand(token, update);
            }
        }
    } catch (e) { console.error("Bale Error:", e.message); }
    setTimeout(() => poll(token), 3000);
};

export const initBaleBot = (token) => {
    if (!token || pollingActive) return;
    pollingActive = true;
    poll(token);
};
