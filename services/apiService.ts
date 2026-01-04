
import { PaymentOrder, User, UserRole, SystemSettings, ChatMessage, ChatGroup, GroupTask, TradeRecord, WarehouseItem, WarehouseTransaction } from '../types';
import { INITIAL_ORDERS } from '../constants';
import { Capacitor } from '@capacitor/core';

// تنظیمات آدرس سرور
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
        // Reduced timeout for faster failure/feedback
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); 

        let baseUrl = '';
        const host = getServerHost();

        if (isNativeApp) {
            if (!host) {
                throw new Error("SERVER_URL_MISSING");
            }
            baseUrl = `${host}/api`;
        } else {
            // Web Mode
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
        if (response.ok) {
            if (contentType && contentType.includes("application/json")) {
                return await response.json();
            }
            return { success: true } as unknown as T;
        }

        throw new Error(`Server Error: ${response.status}`);
    } catch (error: any) {
        
        if (error.message === "SERVER_URL_MISSING") {
            throw error; 
        }

        console.warn(`API Error for ${endpoint}:`, error);

        // Critical for login: Don't fallback, show error
        if (endpoint === '/login' && method === 'POST') {
             throw new Error('اتصال به سرور برقرار نشد. آدرس یا اینترنت را بررسی کنید.');
        }

        // Only fallback to mock data if NOT a critical write operation
        if (method === 'GET') {
            // Quick Fallback for read operations to keep UI responsive
            if (endpoint === '/orders') return getLocalData<PaymentOrder[]>(LS_KEYS.ORDERS, INITIAL_ORDERS) as unknown as T;
            if (endpoint === '/trade') return getLocalData<TradeRecord[]>(LS_KEYS.TRADE, []) as unknown as T;
            if (endpoint === '/warehouse/items') return getLocalData<WarehouseItem[]>(LS_KEYS.WH_ITEMS, []) as unknown as T;
            if (endpoint === '/warehouse/transactions') return getLocalData<WarehouseTransaction[]>(LS_KEYS.WH_TX, []) as unknown as T;
            if (endpoint === '/settings') return getLocalData<SystemSettings>(LS_KEYS.SETTINGS, { currentTrackingNumber: 1000 } as any) as unknown as T;
            if (endpoint === '/chat') return getLocalData<ChatMessage[]>(LS_KEYS.CHAT, []) as unknown as T;
            if (endpoint === '/users') return getLocalData<User[]>(LS_KEYS.USERS, MOCK_USERS) as unknown as T;
        }
        
        throw error;
    }
};
