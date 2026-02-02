
import wwebjs from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { parseMessage } from './whatsapp/parser.js';
import * as Actions from './whatsapp/actions.js';

const { Client, LocalAuth, MessageMedia } = wwebjs;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// FIX: Using absolute path relative to project root
const DB_PATH = path.resolve(__dirname, '..', 'database.json');

let client = null;
let isReady = false;
let qrCode = null;
let clientInfo = null;
let authDataPath = null;

const getDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
    } catch (e) { console.error("WA DB Read Error", e); }
    return null;
};

export const initWhatsApp = async (authDir) => {
    authDataPath = path.resolve(authDir);
    if (client) { try { await client.destroy(); } catch (e) {} }

    console.log(">>> Initializing WhatsApp at:", authDataPath);
    client = new Client({ 
        authStrategy: new LocalAuth({ clientId: 'main_session', dataPath: authDataPath }), 
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
    });

    client.on('qr', (qr) => { qrCode = qr; isReady = false; qrcode.generate(qr, { small: true }); });
    client.on('ready', () => { isReady = true; qrCode = null; clientInfo = client.info.wid.user; console.log(">>> WA Ready!"); });
    
    client.on('message', async msg => {
        const body = msg.body.trim();
        const db = getDb();
        if (!db) return;
        const result = await parseMessage(body, db);
        if (!result) return;
        // ... action handling ...
    });

    await client.initialize();
};

export const restartWhatsAppService = async () => {
    isReady = false;
    qrCode = null;
    if (authDataPath) await initWhatsApp(authDataPath);
};

export const getStatus = () => ({ ready: isReady, qr: qrCode, user: clientInfo });
export const sendMessage = async (number, text, mediaData) => {
    if (!client || !isReady) throw new Error("WA Not Ready");
    let chatId = number.includes('@') ? number : `${number.replace(/\D/g, '').replace(/^0/, '98')}@c.us`;
    if (mediaData && mediaData.data) {
        const media = new MessageMedia(mediaData.mimeType, mediaData.data, mediaData.filename);
        await client.sendMessage(chatId, media, { caption: text || '' });
    } else if (text) await client.sendMessage(chatId, text);
};
