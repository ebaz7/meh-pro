import { PaymentOrder, User, UserRole, SystemSettings, ChatMessage, ChatGroup, GroupTask, TradeRecord, WarehouseItem, WarehouseTransaction } from '../types';
import { INITIAL_ORDERS } from '../constants';
import { Capacitor } from '@capacitor/core';

// تنظیمات آدرس سرور
// ما این را داینامیک می‌کنیم تا از LocalStorage خوانده شود.
// اگر آدرس هاردکد شده را پر کنید، به عنوان پیش‌فرض استفاده می‌شود اما کاربر می‌تواند آن را تغییر دهد.
let DEFAULT_SERVER_URL = ''; 

export const getServerHost = () => {
    // اولویت با آدرسی است که کاربر در تنظیمات وارد کرده است
    const stored = localStorage.getItem('app_server_host');
    if (stored) return stored.replace(/\/$/, '');
    
    // اگر کاربر چیزی وارد نکرده بود، از آدرس پیش‌فرض استفاده کن
    if (DEFAULT_SERVER_URL) return DEFAULT_SERVER_URL.replace(/\/$/, '');
    
    return '';
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
            // در حالت وب (توسعه یا پروداکشن وب)
            const host = getServerHost();
            if (host) {
                baseUrl = `${host}/api`;
            } else {
                baseUrl = '/api';
            }
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
        
        // این خطا را به UI پاس می‌دهیم تا فرم تنظیمات را باز کند
        if (error.message === "SERVER_URL_MISSING") {
            throw error; 
        }

        console.warn(`API Fallback (Mock) triggered for: ${endpoint}`, error);

        // اگر لاگین بود و به سرور وصل نشد
        if (endpoint === '/login' && method === 'POST') {
             // اگر URL داریم اما وصل نمی‌شود:
             if (getServerHost()) {
                 throw new Error('اتصال به سرور برقرار نشد. آدرس یا اینترنت را بررسی کنید.');
             }
        }

        await delay(500);
        
        // --- MOCK DATA FALLBACKS (فقط برای نمایش در حالت توسعه وب یا آفلاین اضطراری) ---
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