
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
const userSessions = new Map();

// --- HELPERS ---
const getDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
    } catch (e) { console.error("DB Read Error", e); }
    return null;
};

const saveDb = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) { console.error("DB Write Error", e); }
};

const getUserByTelegramId = (db, chatId) => {
    return db.users.find(u => u.telegramChatId && u.telegramChatId.toString() === chatId.toString());
};

const fmt = (num) => new Intl.NumberFormat('fa-IR').format(num);

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fa-IR');
};

// --- PDF ENGINE (RE-STABILIZED) ---
const generatePdf = async (htmlContent, options = {}) => {
    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: "new", 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });
        const pdfBuffer = await page.pdf({ 
            format: options.format || 'A4', 
            landscape: options.landscape !== undefined ? options.landscape : true, 
            printBackground: true,
            margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
        });
        return pdfBuffer;
    } catch (e) {
        console.error("Puppeteer PDF Error:", e);
        throw e;
    } finally {
        if (browser) await browser.close();
    }
};

// --- HTML TEMPLATES ---
const createVoucherHtml = (order) => `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"/><style>@font-face { font-family: 'Vazir'; src: url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Regular.woff2') format('woff2'); } body{font-family:'Vazir', Tahoma;padding:20mm;direction:rtl;} .header{display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:10px} table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px} th,td{border:1px solid #ccc;padding:8px;text-align:center} .box{background:#f9f9f9;padding:15px;border:1px solid #ddd;margin-bottom:10px}</style></head><body><div class="header"><h1>${order.payingCompany || 'رسید پرداخت'}</h1><div><h2>دستور پرداخت</h2><p>شماره: ${order.trackingNumber}</p><p>تاریخ: ${formatDate(order.date)}</p></div></div><div class="box"><div><b>ذینفع:</b> ${order.payee}</div><div><b>مبلغ:</b> ${fmt(order.totalAmount)} ریال</div><div><b>بابت:</b> ${order.description}</div></div><table><thead><tr><th>روش</th><th>مبلغ</th><th>بانک/چک</th></tr></thead><tbody>${order.paymentDetails.map(d=>`<tr><td>${d.method}</td><td>${fmt(d.amount)}</td><td>${d.bankName||d.chequeNumber||'-'}</td></tr>`).join('')}</tbody></table></body></html>`;

const createBijakHtml = (tx) => `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"/><style>@font-face { font-family: 'Vazir'; src: url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Regular.woff2') format('woff2'); } body{font-family:'Vazir', Tahoma;padding:10mm;direction:rtl;}</style></head><body><h2 style="text-align:center">${tx.company}</h2><h3 style="text-align:center">حواله خروج کالا #${tx.number}</h3><p>گیرنده: ${tx.recipientName}</p><table border="1" width="100%" style="border-collapse:collapse;text-align:center"><thead><tr><th>کالا</th><th>تعداد</th></tr></thead><tbody>${tx.items.map(i=>`<tr><td>${i.itemName}</td><td>${i.quantity}</td></tr>`).join('')}</tbody></table></body></html>`;

// --- CORE FUNCTIONS ---
export const initTelegram = (token) => {
    if (!token || bot) return;
    try {
        bot = new TelegramBot(token, { polling: true });
        console.log(">>> Telegram Bot Ready ✅");

        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = (msg.text || '').trim();
            const db = getDb();
            const user = getUserByTelegramId(db, chatId);
            
            if (text === '/start' || text === 'منو') {
                if (!user) return bot.sendMessage(chatId, `❌ دسترسی غیرمجاز. شناسه تلگرام شما: ${chatId}`);
                return bot.sendMessage(chatId, `سلام ${user.fullName}، به سیستم مدیریت مالی خوش آمدید.`, {
                    reply_markup: { keyboard: [['💰 کارتابل پرداخت', '🚛 کارتابل خروج'], ['📦 کارتابل بیجک', '🌍 گزارش بازرگانی']], resize_keyboard: true }
                });
            }
            
            // Handle specific menu commands
            if (text === '💰 کارتابل پرداخت') sendPaymentCartable(chatId, db, user);
        });

        bot.on('callback_query', async (query) => {
            const chatId = query.message.chat.id;
            const data = query.data;
            const db = getDb();

            // FIXED: Download PDF logic
            if (data.startsWith('dl_pay_single_')) {
                const orderId = data.replace('dl_pay_single_', '');
                const order = db.orders.find(o => o.id === orderId);
                if (!order) return bot.answerCallbackQuery(query.id, { text: "سند یافت نشد" });

                bot.sendMessage(chatId, "⏳ در حال تولید فایل PDF...");
                try {
                    const html = createVoucherHtml(order);
                    const pdfBuffer = await generatePdf(html, { format: 'A5', landscape: true });
                    // IMPORTANT: Pass Buffer directly to sendDocument
                    await bot.sendDocument(chatId, pdfBuffer, { caption: `📄 رسید دستور پرداخت #${order.trackingNumber}` }, { filename: `Voucher_${order.trackingNumber}.pdf`, contentType: 'application/pdf' });
                } catch (e) {
                    bot.sendMessage(chatId, "❌ خطا در تولید PDF");
                }
            }
            
            if (data.startsWith('dl_bijak_')) {
                const txId = data.replace('dl_bijak_', '');
                const tx = db.warehouseTransactions.find(t => t.id === txId);
                if (!tx) return bot.answerCallbackQuery(query.id, { text: "بیجک یافت نشد" });
                
                try {
                    const html = createBijakHtml(tx);
                    const pdfBuffer = await generatePdf(html, { format: 'A5', landscape: false });
                    await bot.sendDocument(chatId, pdfBuffer, { caption: `🧾 بیجک #${tx.number}` }, { filename: `Bijak_${tx.number}.pdf`, contentType: 'application/pdf' });
                } catch (e) { bot.sendMessage(chatId, "❌ خطا"); }
            }
        });
    } catch (e) { console.error("Telegram Init Fail", e); }
};

// تابع جدید برای ارسال نوتیفیکیشن به همه ادمین‌ها/کاربران مجاز در تلگرام
export const sendSystemNotification = async (text, mediaData = null) => {
    if (!bot) return;
    const db = getDb();
    if (!db) return;

    // پیدا کردن تمام کاربرانی که ChatID تلگرام دارند و اجازه دریافت اعلان دارند
    const targetUsers = db.users.filter(u => u.telegramChatId && u.receiveNotifications !== false);

    for (const user of targetUsers) {
        try {
            if (mediaData && mediaData.data) {
                // اگر عکس باشد (مثل واتساپ)
                const buffer = Buffer.from(mediaData.data, 'base64');
                await bot.sendPhoto(user.telegramChatId, buffer, { caption: text, parse_mode: 'Markdown' });
            } else {
                await bot.sendMessage(user.telegramChatId, text, { parse_mode: 'Markdown' });
            }
        } catch (e) {
            console.error(`Failed to send Telegram msg to ${user.fullName}:`, e.message);
        }
    }
};

const sendPaymentCartable = async (chatId, db, user) => {
    const pending = db.orders.filter(o => o.status.includes('در انتظار') || o.status.includes('تایید'));
    if (pending.length === 0) return bot.sendMessage(chatId, "✅ کارتابل پرداخت خالی است.");
    
    for (const o of pending.slice(0, 5)) {
        const msg = `💰 *دستور پرداخت #${o.trackingNumber}*\n👤 ذینفع: ${o.payee}\n💵 مبلغ: ${fmt(o.totalAmount)} ریال\n⏳ وضعیت: ${o.status}`;
        bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '📥 دانلود PDF', callback_data: `dl_pay_single_${o.id}` }]] }
        });
    }
};
