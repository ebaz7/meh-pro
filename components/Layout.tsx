
import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, PlusCircle, ListChecks, FileText, Users, LogOut, User as UserIcon, Settings, Bell, BellOff, MessageSquare, X, Check, Container, KeyRound, Save, Upload, Camera, Download, Share, ChevronRight, Home, Send, BrainCircuit, Mic, StopCircle, Loader2, Truck, ClipboardList, Package, Printer, CheckSquare, ShieldCheck, Shield, Phone, RefreshCw, Smartphone, MonitorDown, BellRing, Smartphone as MobileIcon, Trash2, CalendarDays } from 'lucide-react';
import { User, UserRole, AppNotification, SystemSettings, FiscalYear } from '../types';
import { logout, hasPermission, getRolePermissions, updateUser } from '../services/authService';
import { requestNotificationPermission, setNotificationPreference, isNotificationEnabledInApp, sendNotification } from '../services/notificationService';
import { getSettings, saveSettings, uploadFile } from '../services/storageService';
import { apiCall } from '../services/apiService';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  onLogout: () => void;
  notifications: AppNotification[];
  clearNotifications: () => void;
  onAddNotification: (title: string, message: string) => void;
  onRemoveNotification: (id: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, currentUser, onLogout, notifications, clearNotifications, onAddNotification, onRemoveNotification }) => {
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const isSecure = window.isSecureContext;
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ password: '', confirmPassword: '', telegramChatId: '', phoneNumber: '', receiveNotifications: true });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const data = await getSettings();
    setSettings(data);
  };

  const handleFiscalYearChange = async (yearId: string) => {
    if (!settings) return;
    const updated = { ...settings, activeFiscalYearId: yearId };
    await saveSettings(updated);
    // Reload data in all components by refreshing
    window.location.reload();
  };

  const activeYear = settings?.fiscalYears?.find(y => y.id === settings.activeFiscalYearId);
  const perms = settings ? getRolePermissions(currentUser.role, settings, currentUser) : null;
  const canSeeSettings = currentUser.role === UserRole.ADMIN || (perms?.canManageSettings ?? false);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex min-h-[100dvh] bg-gray-50 text-gray-800 font-sans relative">
      <aside className="w-64 bg-slate-800 text-white flex-shrink-0 hidden md:flex flex-col no-print shadow-xl relative h-screen sticky top-0">
          <div className="p-6 border-b border-slate-700 flex items-center gap-3">
              <div className="bg-blue-500 p-2 rounded-lg"><FileText className="w-6 h-6 text-white" /></div>
              <div>
                <h1 className="text-lg font-bold">سیستم مالی</h1>
                <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                  <CalendarDays size={10}/> {activeYear ? `سال ${activeYear.label}` : 'سال انتخاب نشده'}
                </div>
              </div>
          </div>
          
          {/* Fiscal Year Quick Switcher */}
          <div className="px-4 py-2 mt-2">
            <label className="text-[9px] text-slate-500 font-bold mb-1 block px-2">انتخاب سال مالی فعال:</label>
            <select 
              className="w-full bg-slate-700 border-none rounded-lg py-2 px-3 text-xs text-white appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500"
              value={settings?.activeFiscalYearId || ''}
              onChange={(e) => handleFiscalYearChange(e.target.value)}
            >
              {settings?.fiscalYears?.map(y => (
                <option key={y.id} value={y.id}>{y.label} {y.isClosed ? '(بسته)' : ''}</option>
              ))}
              {!settings?.fiscalYears?.length && <option value="">تعریف نشده</option>}
            </select>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}><LayoutDashboard size={20} /><span>داشبورد</span></button>
              {perms?.canCreatePaymentOrder && <button onClick={() => setActiveTab('create')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'create' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}><PlusCircle size={20} /><span>ثبت پرداخت</span></button>}
              {perms?.canViewPaymentOrders && <button onClick={() => setActiveTab('manage')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'manage' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}><ListChecks size={20} /><span>سوابق پرداخت</span></button>}
              <button onClick={() => setActiveTab('chat')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'chat' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}><MessageSquare size={20} /><span>گفتگو</span></button>
              {canSeeSettings && <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}><Settings size={20} /><span>تنظیمات</span></button>}
          </nav>
          
          <div className="p-4 border-t border-slate-700">
              <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-slate-700 rounded-lg transition-colors"><LogOut size={20} /><span>خروج</span></button>
          </div>
      </aside>

      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative min-w-0">
        <header className="bg-white shadow-sm p-4 md:hidden no-print flex items-center justify-between shrink-0 z-40 safe-pt">
            <div className="flex items-center gap-2">
                <div className="bg-blue-500 p-1.5 rounded-lg"><FileText size={18} className="text-white"/></div>
                <div className="flex flex-col">
                  <span className="font-bold text-xs">سیستم مالی</span>
                  <span className="text-[9px] text-blue-600 font-bold">سال: {activeYear?.label || '--'}</span>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                <select 
                  className="bg-gray-100 border-none rounded-lg py-1 px-2 text-[10px] font-bold text-gray-700"
                  value={settings?.activeFiscalYearId || ''}
                  onChange={(e) => handleFiscalYearChange(e.target.value)}
                >
                  {settings?.fiscalYears?.map(y => (
                    <option key={y.id} value={y.id}>{y.label}</option>
                  ))}
                </select>
                <button onClick={() => setShowProfileModal(true)} className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                    <UserIcon size={16} className="text-blue-600"/>
                </button>
            </div>
        </header>
        
        <div className={`flex-1 overflow-y-auto bg-gray-50 pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0`}>
            <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-full">
                {children}
            </div>
        </div>
      </main>
    </div>
  );
};
export default Layout;
