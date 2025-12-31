
import { PaymentOrder, User, UserRole, SystemSettings, ChatMessage, ChatGroup, GroupTask, TradeRecord, WarehouseItem, WarehouseTransaction } from '../types';
import { INITIAL_ORDERS } from '../constants';
import { Capacitor } from '@capacitor/core';

// کلید ذخیره سازی آدرس در حافظه گوشی
const STORAGE_KEY_HOST = 'app_server_host';

export const getServerHost = () => {
    // 1. اولویت با آدرسی است که کاربر در صفحه تنظیمات لاگین وارد کرده
    const savedHost = localStorage.getItem(STORAGE_KEY_HOST);
    if (savedHost) return savedHost.replace(/\/$/, ''); // حذف اسلش آخر اگر بود

    // 2. اگر تنظیم نشده بود، در حالت وب خالی برگردان
    return '';
};

export const setServerHost = (url: string) => {
    let cleanUrl = url.trim().replace(/\/$/, '');
    // اگر کاربر http یا https را وارد نکرده بود، پیش‌فرض http بگذار (مگر اینکه دامین باشد)
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'http://' + cleanUrl; 
    }
    localStorage.setItem(STORAGE_KEY_HOST, cleanUrl);
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
        const host = getServerHost();

        if (isNativeApp) {
            if (!host) {
                // اگر آدرس تنظیم نشده بود، خطای خاص پرتاب کن تا UI متوجه شود
                throw new Error("SERVER_URL_MISSING");
            }
            baseUrl = `${host}/api`;
        } else {
            // در حالت وب (توسعه)
            baseUrl = host ? `${host}/api` : '/api';
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
            throw error; // پاس دادن خطا به کامپوننت لاگین
        }

        console.warn(`API Connection Failed: ${endpoint}`, error);

        // در اپ موبایل، اگر نتواند وصل شود نباید به ماک دیتا برود مگر اینکه لاگین نباشد
        // این اجازه می‌دهد کاربر خطای اتصال را ببیند و آدرس را اصلاح کند
        if (endpoint === '/login' && method === 'POST') {
             throw new Error('اتصال به سرور برقرار نشد. لطفاً آدرس سرور و اینترنت را بررسی کنید.');
        }

        // --- MOCK DATA FALLBACKS (فقط برای وب) ---
        if (!isNativeApp) {
            await delay(500);
            if (endpoint === '/orders') return getLocalData<PaymentOrder[]>(LS_KEYS.ORDERS, INITIAL_ORDERS) as unknown as T;
            if (endpoint === '/trade') return getLocalData<TradeRecord[]>(LS_KEYS.TRADE, []) as unknown as T;
            if (endpoint === '/warehouse/items') return getLocalData<WarehouseItem[]>(LS_KEYS.WH_ITEMS, []) as unknown as T;
            if (endpoint === '/warehouse/transactions') return getLocalData<WarehouseTransaction[]>(LS_KEYS.WH_TX, []) as unknown as T;
            if (endpoint === '/settings') return getLocalData<SystemSettings>(LS_KEYS.SETTINGS, { currentTrackingNumber: 1000 } as any) as unknown as T;
            if (endpoint === '/chat') return getLocalData<ChatMessage[]>(LS_KEYS.CHAT, []) as unknown as T;
            if (endpoint === '/users') return getLocalData<User[]>(LS_KEYS.USERS, MOCK_USERS) as unknown as T;
            if (method === 'POST' || method === 'PUT' || method === 'DELETE') return { success: true, offline: true } as unknown as T;
        }

        throw error;
    }
};
