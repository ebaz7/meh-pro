
import { PaymentOrder, User, UserRole, SystemSettings, ChatMessage, ChatGroup, GroupTask, TradeRecord, WarehouseItem, WarehouseTransaction } from '../types';
import { INITIAL_ORDERS } from '../constants';
import { Capacitor } from '@capacitor/core';

// تنظیمات آدرس سرور
let DEFAULT_SERVER_URL = ''; 

export const getServerHost = () => {
    const stored = localStorage.getItem('app_server_host');
    if (stored) return stored.trim().replace(/\/$/, '');
    if (DEFAULT_SERVER_URL) return DEFAULT_SERVER_URL.replace(/\/$/, '');
    return '';
};

export const setServerHost = (url: string) => {
    const cleanUrl = url.trim().replace(/\/$/, '');
    localStorage.setItem('app_server_host', cleanUrl);
};

const isNativeApp = Capacitor.isNativePlatform();

const MOCK_USERS: User[] = [
    { id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم (آفلاین)', role: UserRole.ADMIN, canManageTrade: true }
];

export const LS_KEYS = {
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

// Exported so App.tsx can use it for instant load
export const getLocalData = <T>(key: string, defaultData: T): T => {
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
        const timeoutId = setTimeout(() => controller.abort(), 10000); 

        let baseUrl = '';
        const host = getServerHost();

        if (isNativeApp) {
            if (!host) {
                throw new Error("SERVER_URL_MISSING");
            }
            baseUrl = `${host}/api`;
        } else {
            if (host) {
                baseUrl = `${host}/api`;
            } else {
                baseUrl = '/api';
            }
        }

        // endpoint should start with /
        const finalUrl = `${baseUrl}${endpoint}`;

        const response = await fetch(finalUrl, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const contentType = response.headers.get("content-type");
            let data;
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                data = { success: true } as unknown as T;
            }

            // --- CACHING LOGIC ---
            // Automatically cache successful GET requests to support "Instant Load"
            if (method === 'GET') {
                if (endpoint === '/orders') localStorage.setItem(LS_KEYS.ORDERS, JSON.stringify(data));
                else if (endpoint === '/users') localStorage.setItem(LS_KEYS.USERS, JSON.stringify(data));
                else if (endpoint === '/settings') localStorage.setItem(LS_KEYS.SETTINGS, JSON.stringify(data));
                else if (endpoint === '/chat') localStorage.setItem(LS_KEYS.CHAT, JSON.stringify(data));
            }
            
            return data;
        }

        throw new Error(`Server Error: ${response.status}`);
    } catch (error: any) {
        
        if (error.message === "SERVER_URL_MISSING") {
            throw error; 
        }

        console.warn(`API Error for ${endpoint}:`, error);

        if (endpoint === '/login' && method === 'POST') {
             throw new Error('اتصال به سرور برقرار نشد. آدرس سرور یا اینترنت را بررسی کنید.');
        }

        // Fallback to cache if network fails (Offline Mode)
        if (method === 'GET') {
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
