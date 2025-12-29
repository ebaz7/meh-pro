
import { PaymentOrder, User, UserRole, SystemSettings, ChatMessage, ChatGroup, GroupTask, TradeRecord, WarehouseItem, WarehouseTransaction } from '../types';
import { INITIAL_ORDERS } from '../constants';
import { Capacitor } from '@capacitor/core';

// *** تنظیمات اتصال به سرور ***

export const getServerHost = () => {
    return localStorage.getItem('app_server_host') || '';
};

export const setServerHost = (url: string) => {
    // حذف اسلش آخر اگر وجود داشته باشد
    const cleanUrl = url.replace(/\/$/, '');
    localStorage.setItem('app_server_host', cleanUrl);
};

// تشخیص دقیق پلتفرم
const isNativeApp = Capacitor.isNativePlatform();

console.log("Environment:", isNativeApp ? "Native App" : "Web Browser");

const MOCK_USERS: User[] = [
    { id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: UserRole.ADMIN, canManageTrade: true }
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

const setLocalData = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
};

export const apiCall = async <T>(endpoint: string, method: string = 'GET', body?: any): Promise<T> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        let baseUrl = '';

        if (isNativeApp) {
            const host = getServerHost();
            if (!host) {
                // اگر هاست تنظیم نشده باشد، خطای خاص پرتاب می‌کنیم تا UI متوجه شود
                throw new Error("SERVER_URL_MISSING");
            }
            baseUrl = `${host}/api`;
        } else {
            // در حالت وب (توسعه یا پروداکشن وب) از پروکسی یا آدرس نسبی استفاده می‌شود
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
        
        // اگر آدرس سرور در موبایل تنظیم نشده باشد، خطا را به کامپوننت لاگین پاس می‌دهیم
        if (error.message === "SERVER_URL_MISSING") {
            throw error; 
        }

        console.warn(`API Fallback (Mock) triggered for: ${endpoint}`, error);

        await delay(500);
        
        // --- MOCK DATA FALLBACKS (برای تست آفلاین) ---
        if (endpoint === '/login' && method === 'POST') {
            const users = getLocalData<User[]>(LS_KEYS.USERS, MOCK_USERS);
            const user = users.find(u => u.username === body.username && u.password === body.password);
            if (user) return user as unknown as T;
            throw new Error('Invalid credentials');
        }

        // --- سایر موک‌ها برای جلوگیری از کرش کردن برنامه در حالت بدون سرور ---
        if (endpoint === '/orders') return getLocalData<PaymentOrder[]>(LS_KEYS.ORDERS, INITIAL_ORDERS) as unknown as T;
        if (endpoint === '/trade') return getLocalData<TradeRecord[]>(LS_KEYS.TRADE, []) as unknown as T;
        if (endpoint === '/warehouse/items') return getLocalData<WarehouseItem[]>(LS_KEYS.WH_ITEMS, []) as unknown as T;
        if (endpoint === '/warehouse/transactions') return getLocalData<WarehouseTransaction[]>(LS_KEYS.WH_TX, []) as unknown as T;
        if (endpoint === '/settings') return getLocalData<SystemSettings>(LS_KEYS.SETTINGS, { currentTrackingNumber: 1000 } as any) as unknown as T;
        if (endpoint === '/chat') return getLocalData<ChatMessage[]>(LS_KEYS.CHAT, []) as unknown as T;
        if (endpoint === '/users') return getLocalData<User[]>(LS_KEYS.USERS, MOCK_USERS) as unknown as T;
        
        // پاسخ‌های پیش‌فرض برای عملیات‌های نوشتن در حالت آفلاین
        if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
            return { success: true, offline: true } as unknown as T;
        }

        throw new Error(`Mock endpoint not found: ${endpoint}`);
    }
};
