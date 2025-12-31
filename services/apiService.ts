
import { PaymentOrder, User, UserRole, SystemSettings, ChatMessage, ChatGroup, GroupTask, TradeRecord, WarehouseItem, WarehouseTransaction } from '../types';
import { INITIAL_ORDERS } from '../constants';
import { Capacitor } from '@capacitor/core';

// ******************************************************************
// تنظیمات حیاتی اتصال به سرور
// ******************************************************************
// اگر روی لوکال هاست (شبیه ساز) تست می‌کنید، از 10.0.2.2 استفاده کنید
// اگر روی گوشی واقعی تست می‌کنید، آی‌پی سیستم خود را وارد کنید (مثلا 192.168.1.50)
// اگر سرور آنلاین دارید، آدرس سایت را وارد کنید (مثلا https://api.mysite.com)
// مثال: 'http://192.168.1.105:3000'
const HARDCODED_SERVER_URL = 'http://192.168.1.100:3000'; // <--- این آدرس را حتما به آی‌پی سرور خود تغییر دهید

export const getServerHost = () => {
    // اولویت با آدرس هاردکد شده است
    if (HARDCODED_SERVER_URL && !HARDCODED_SERVER_URL.includes('YOUR_DOMAIN')) {
        return (HARDCODED_SERVER_URL as string).replace(/\/$/, '');
    }
    // خواندن از حافظه (برای تغییر دستی در صفحه لاگین)
    return localStorage.getItem('app_server_host') || '';
};

export const setServerHost = (url: string) => {
    const cleanUrl = url.replace(/\/$/, '');
    localStorage.setItem('app_server_host', cleanUrl);
};

const isNativeApp = Capacitor.isNativePlatform();

console.log("Environment:", isNativeApp ? "Native App" : "Web Browser");

const MOCK_USERS: User[] = [
    { id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم (آفلاین)', role: UserRole.ADMIN, canManageTrade: true }
];

const LS_KEYS = {
    ORDERS: 'app_data_orders',
    USERS: 'app_data_users',
    SETTINGS: 'app_data_settings',
    CHAT: 'app_data_chat',
    GROUPS: 'app_data_groups',
    TASKS: 'app_data_tasks',
    TRADE: 'app_data_trade',
    WH_ITEMS: 'app_data_wh_items',
    WH_TX: 'app_data_wh_tx'
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getLocalData = <T>(key: string, defaultData: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultData;
    } catch {
        return defaultData;
    }
};

export const apiCall = async <T>(endpoint: string, method: string = 'GET', body?: any): Promise<T> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        let baseUrl = '';

        if (isNativeApp) {
            const host = getServerHost();
            if (!host) {
                // اگر آدرس تنظیم نشده بود، خطا بده تا کاربر به صفحه تنظیمات هدایت شود
                throw new Error("SERVER_URL_MISSING");
            }
            baseUrl = `${host}/api`;
        } else {
            baseUrl = '/api';
        }

        const response = await fetch(`${baseUrl}${endpoint}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.includes("application/json")) {
            return await response.json();
        }
        
        if (response.ok && (!contentType || !contentType.includes("application/json"))) {
             return { success: true } as unknown as T;
        }

        throw new Error(`Server Error: ${response.status}`);
    } catch (error: any) {
        
        if (error.message === "SERVER_URL_MISSING") {
            throw error; 
        }

        console.warn(`API Fallback (Mock) triggered for: ${endpoint}`, error);

        // اگر لاگین بود و به سرور وصل نشد، اجازه نده با ادمین آفلاین وارد شود تا کاربر گیج نشود
        // مگر اینکه بخواهید آفلاین کار کنید.
        if (endpoint === '/login' && method === 'POST') {
             throw new Error('اتصال به سرور برقرار نشد. لطفاً آدرس سرور و اینترنت را بررسی کنید.');
        }

        await delay(500);
        
        // --- MOCK DATA FALLBACKS (فقط برای نمایش در حالت توسعه وب) ---
        if (endpoint === '/orders') return getLocalData<PaymentOrder[]>(LS_KEYS.ORDERS, INITIAL_ORDERS) as unknown as T;
        if (endpoint === '/trade') return getLocalData<TradeRecord[]>(LS_KEYS.TRADE, []) as unknown as T;
        if (endpoint === '/warehouse/items') return getLocalData<WarehouseItem[]>(LS_KEYS.WH_ITEMS, []) as unknown as T;
        if (endpoint === '/warehouse/transactions') return getLocalData<WarehouseTransaction[]>(LS_KEYS.WH_TX, []) as unknown as T;
        if (endpoint === '/settings') return getLocalData<SystemSettings>(LS_KEYS.SETTINGS, { currentTrackingNumber: 1000 } as any) as unknown as T;
        if (endpoint === '/chat') return getLocalData<ChatMessage[]>(LS_KEYS.CHAT, []) as unknown as T;
        if (endpoint === '/users') return getLocalData<User[]>(LS_KEYS.USERS, MOCK_USERS) as unknown as T;
        
        if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
            return { success: true, offline: true } as unknown as T;
        }

        throw new Error(`اتصال به سرور برقرار نیست: ${endpoint}`);
    }
};
