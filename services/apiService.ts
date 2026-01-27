
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
        // Increased timeout significantly for mobile networks AND large file uploads (60s)
        const timeoutId = setTimeout(() => controller.abort(), 60000); 

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

        console.log(`API calling: ${method} ${finalUrl}`); 

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

            // --- CACHING ENABLED ---
            // Crucial for Android app to prevent "raw/empty" state if network fluctuates
            if (method === 'GET') {
                try {
                    if (endpoint === '/orders') localStorage.setItem(LS_KEYS.ORDERS, JSON.stringify(data));
                    else if (endpoint === '/users') localStorage.setItem(LS_KEYS.USERS, JSON.stringify(data));
                    else if (endpoint === '/settings') localStorage.setItem(LS_KEYS.SETTINGS, JSON.stringify(data));
                    else if (endpoint === '/chat') localStorage.setItem(LS_KEYS.CHAT, JSON.stringify(data));
                    else if (endpoint === '/trade') localStorage.setItem(LS_KEYS.TRADE, JSON.stringify(data));
                    else if (endpoint === '/warehouse/items') localStorage.setItem(LS_KEYS.WH_ITEMS, JSON.stringify(data));
                    else if (endpoint === '/warehouse/transactions') localStorage.setItem(LS_KEYS.WH_TX, JSON.stringify(data));
                } catch (cacheError) {
                    console.warn("Cache write failed (storage full?)", cacheError);
                }
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

        // --- CACHE FALLBACK (READ-ONLY) ---
        // If network fails, return cached data to prevent empty UI
        if (method === 'GET') {
            if (endpoint === '/orders') return getLocalData<any>(LS_KEYS.ORDERS, INITIAL_ORDERS);
            if (endpoint === '/trade') return getLocalData<any>(LS_KEYS.TRADE, []);
            if (endpoint === '/warehouse/items') return getLocalData<any>(LS_KEYS.WH_ITEMS, []);
            if (endpoint === '/warehouse/transactions') return getLocalData<any>(LS_KEYS.WH_TX, []);
            if (endpoint === '/settings') return getLocalData<any>(LS_KEYS.SETTINGS, { currentTrackingNumber: 1000 });
            if (endpoint === '/chat') return getLocalData<any>(LS_KEYS.CHAT, []);
            if (endpoint === '/users') return getLocalData<any>(LS_KEYS.USERS, MOCK_USERS);
        }
        
        throw error;
    }
};
