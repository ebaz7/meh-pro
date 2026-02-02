import React, { useState, useEffect, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import CreateOrder from './components/CreateOrder';
import ManageOrders from './components/ManageOrders';
import Login from './components/Login';
import ManageUsers from './components/ManageUsers';
import Settings from './components/Settings';
import ChatRoom from './components/ChatRoom';
import TradeModule from './components/TradeModule';
import CreateExitPermit from './components/CreateExitPermit'; 
import ManageExitPermits from './components/ManageExitPermits'; 
import WarehouseModule from './components/WarehouseModule';
import SecurityModule from './components/SecurityModule'; 
import PrintVoucher from './components/PrintVoucher'; 
import NotificationController from './components/NotificationController'; 
import { getOrders, getSettings, getMessages } from './services/storageService'; 
import { getCurrentUser, getUsers } from './services/authService';
import { PaymentOrder, User, OrderStatus, UserRole, AppNotification, SystemSettings, PaymentMethod, ChatMessage } from './types';
import { Loader2, Bell, X } from 'lucide-react';
import { generateUUID, parsePersianDate, formatCurrency } from './constants';
import { apiCall, getLocalData, LS_KEYS } from './services/apiService'; 
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app'; 
import { PushNotifications } from '@capacitor/push-notifications'; 
import { sendNotification } from './services/notificationService';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTabState] = useState('dashboard');
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]); 
  const [settings, setSettings] = useState<SystemSettings | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  const [manageOrdersInitialTab, setManageOrdersInitialTab] = useState<'current' | 'archive'>('current');
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<any>(null); 
  const [exitPermitStatusFilter, setExitPermitStatusFilter] = useState<'pending' | null>(null);
  const [warehouseInitialTab, setWarehouseInitialTab] = useState<'dashboard' | 'approvals'>('dashboard');

  const [toast, setToast] = useState<{show: boolean, title: string, message: string} | null>(null);
  const toastTimeoutRef = useRef<any>(null);
  const isFirstLoad = useRef(true);
  const isNative = Capacitor.isNativePlatform();

  // Basic Navigation
  const setActiveTab = (tab: string) => { 
      setActiveTabState(tab);
      if (!isNative) {
          try { window.history.pushState({ tab }, '', `#${tab}`); } catch(e) {}
      }
  };

  useEffect(() => {
      const user = getCurrentUser();
      if (user) setCurrentUser(user);
      
      if (!isNative) {
          const hash = window.location.hash.replace('#', '');
          if (hash) setActiveTabState(hash);
      }
  }, []);

  // Data Loading
  const loadData = async (silent = false) => {
    if (!currentUser) return;
    if (!silent && isFirstLoad.current) setLoading(true);

    try {
        const [ordersData, settingsData, messagesData] = await Promise.all([getOrders(), getSettings(), getMessages()]);
        setSettings(settingsData);
        setOrders(ordersData);
        setChatMessages(messagesData || []);
        isFirstLoad.current = false;
    } catch (error) {
        console.error("Failed to load data", error);
    } finally {
        if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
      if (currentUser) {
          loadData(false);
          const interval = setInterval(() => loadData(true), 10000);
          return () => clearInterval(interval);
      }
  }, [currentUser]);

  const handleLogout = () => {
      setCurrentUser(null);
      isFirstLoad.current = true;
  };

  const handleLogin = (user: User) => {
      setCurrentUser(user);
      setActiveTab('dashboard');
  };

  const addAppNotification = (title: string, message: string) => {
      setNotifications(prev => [{ id: generateUUID(), title, message, timestamp: Date.now(), read: false }, ...prev]);
      setToast({ show: true, title, message });
      if(toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setToast(null), 5000);
  };

  if (!currentUser) {
      return <Login onLogin={handleLogin} />;
  }

  return (
    <Layout 
        activeTab={activeTab} 
        setActiveTab={(t) => { setActiveTab(t); if(t!=='warehouse') setWarehouseInitialTab('dashboard'); if(t!=='manage-exit') setExitPermitStatusFilter(null); if(t!=='manage') setDashboardStatusFilter(null); }} 
        currentUser={currentUser} 
        onLogout={handleLogout} 
        notifications={notifications} 
        clearNotifications={() => setNotifications([])}
        onAddNotification={addAppNotification}
        onRemoveNotification={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
    >
        <NotificationController currentUser={currentUser} />

        {toast && toast.show && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] bg-white border-l-4 border-blue-600 shadow-2xl rounded-lg p-4 flex items-start gap-4 min-w-[300px] animate-slide-down" onClick={() => setToast(null)}>
                <div className="bg-blue-100 p-2 rounded-full text-blue-600"><Bell size={20} /></div>
                <div>
                    <h4 className="font-bold text-gray-800 text-sm">{toast.title}</h4>
                    <p className="text-xs text-gray-600">{toast.message}</p>
                </div>
            </div>
        )}

        {loading && isFirstLoad.current ? (
            <div className="flex h-[50vh] items-center justify-center text-blue-600 flex-col gap-3">
                <Loader2 size={48} className="animate-spin" />
                <span className="text-sm font-bold">در حال بارگذاری...</span>
            </div>
        ) : (
            <>
                {activeTab === 'dashboard' && <Dashboard orders={orders} settings={settings} currentUser={currentUser} onGoToPaymentApprovals={()=>{setDashboardStatusFilter('pending_all'); setActiveTab('manage');}} onGoToExitApprovals={()=>{setExitPermitStatusFilter('pending'); setActiveTab('manage-exit');}} onGoToBijakApprovals={()=>{setWarehouseInitialTab('approvals'); setActiveTab('warehouse');}} />}
                {activeTab === 'create' && <CreateOrder onSuccess={() => { loadData(true); setActiveTab('manage'); }} currentUser={currentUser} />}
                {activeTab === 'manage' && <ManageOrders orders={orders} refreshData={() => loadData(true)} currentUser={currentUser} initialTab={manageOrdersInitialTab} settings={settings} statusFilter={dashboardStatusFilter} />}
                {activeTab === 'create-exit' && <CreateExitPermit onSuccess={() => setActiveTab('manage-exit')} currentUser={currentUser} />}
                {activeTab === 'manage-exit' && <ManageExitPermits currentUser={currentUser} settings={settings} statusFilter={exitPermitStatusFilter} />}
                {activeTab === 'warehouse' && <WarehouseModule currentUser={currentUser} settings={settings} initialTab={warehouseInitialTab} />}
                {activeTab === 'trade' && <TradeModule currentUser={currentUser} />}
                {activeTab === 'users' && <ManageUsers />}
                {activeTab === 'settings' && <Settings />}
                {activeTab === 'security' && <SecurityModule currentUser={currentUser} />}
                {activeTab === 'chat' && <ChatRoom currentUser={currentUser} preloadedMessages={chatMessages} onRefresh={() => loadData(true)} />} 
            </>
        )}
    </Layout>
  );
}

export default App;