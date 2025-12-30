
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
    // رفرش کل صفحه برای اعمال فیلتر سال مالی در تمام کامپوننت‌ها
    window.location.reload();
  };

  const activeYear = settings?.fiscalYears?.find(y => y.id === settings.activeFiscalYearId);
  const unreadCount = notifications.filter(n => !n.read).length;
  const perms = settings ? getRolePermissions(currentUser.role, settings, currentUser) : null;
  const canSeeSettings = currentUser.role === UserRole.ADMIN || (perms?.canManageSettings ?? false);

  const NotificationDropdown = () => ( 
    <div className="notification-dropdown-container fixed top-16 left-4 right-4 md:absolute md:top-auto md:bottom-16 md:left-2 md:right-auto md:w-80 bg-white rounded-xl shadow-2xl border border-gray-200 text-gray-800 z-[9999] overflow-hidden origin-top md:origin-bottom-left animate-scale-in max-h-[60vh] flex flex-col">
        <div className="bg-blue-50 p-3 flex justify-between items-center border-b shrink-0">
            <span className="text-xs font-bold text-blue-800">پیام‌های سیستم</span>
            <button onClick={clearNotifications} className="text-gray-400 hover:text-red-500 text-[10px]">پاک کردن همه</button>
        </div>
        <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? <div className="p-6 text-center text-xs text-gray-400">پیامی نیست</div> : 
                notifications.map(n => (
                    <div key={n.id} className="p-3 border-b hover:bg-gray-50 text-right relative">
                        <div className="text-xs font-bold text-gray-800 mb-1">{n.title}</div>
                        <div className="text-xs text-gray-600 leading-tight">{n.message}</div>
                        <button onClick={() => onRemoveNotification(n.id)} className="absolute top-3 left-2 text-gray-300 hover:text-red-500"><X size={14}/></button>
                    </div>
                ))
            }
        </div>
    </div> 
  );

  return (
    <div className="flex min-h-[100dvh] bg-gray-50 text-gray-800 font-sans relative">
      {/* سایدبار دسکتاپ */}
      <aside className="w-64 bg-slate-800 text-white flex-shrink-0 hidden md:flex flex-col no-print shadow-xl relative h-screen sticky top-0">
          <div className="p-6 border-b border-slate-700 flex items-center gap-3">
              <div className="bg-blue-500 p-2 rounded-lg"><FileText className="w-6 h-6 text-white" /></div>
              <div><h1 className="text-lg font-bold">سیستم مالی</h1><span className="text-[10px] text-blue-400 font-bold">سال مالی: {activeYear?.label || '--'}</span></div>
          </div>
          
          {/* انتخاب‌گر سال مالی در سایدبار */}
          <div className="px-4 py-2 mt-4">
              <label className="text-[9px] text-slate-500 font-bold uppercase mb-1 block px-2">انتخاب سال مالی</label>
              <div className="relative">
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
                  <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-700'}`}><LayoutDashboard size={20} /><span>داشبورد</span></button>
              {perms?.canCreatePaymentOrder && <button onClick={() => setActiveTab('create')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'create' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-700'}`}><PlusCircle size={20} /><span>ثبت پرداخت</span></button>}
              {perms?.canViewPaymentOrders && <button onClick={() => setActiveTab('manage')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'manage' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-700'}`}><ListChecks size={20} /><span>سوابق پرداخت</span></button>}
              <button onClick={() => setActiveTab('chat')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'chat' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-700'}`}><MessageSquare size={20} /><span>گفتگو</span></button>
              {canSeeSettings && <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-700'}`}><Settings size={20} /><span>تنظیمات</span></button>}
          </nav>
          
          <div className="p-4 border-t border-slate-700">
              <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-slate-700 rounded-lg transition-colors"><LogOut size={20} /><span>خروج</span></button>
          </div>
      </aside>

      {/* هدر و محتوای اصلی */}
      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative min-w-0">
        <header className="bg-white shadow-sm p-4 md:hidden no-print flex items-center justify-between shrink-0 z-40 safe-pt">
            <div className="flex items-center gap-2">
                <div className="bg-blue-500 p-1.5 rounded-lg"><FileText size={18} className="text-white"/></div>
                <div className="flex flex-col">
                  <span className="font-bold text-xs">سیستم مالی</span>
                  <span className="text-[9px] text-blue-600 font-bold">{activeYear?.label || '--'}</span>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                {/* انتخاب‌گر سال در موبایل */}
                <select 
                  className="bg-gray-100 border-none rounded-lg py-1 px-2 text-[10px] font-bold text-gray-700"
                  value={settings?.activeFiscalYearId || ''}
                  onChange={(e) => handleFiscalYearChange(e.target.value)}
                >
                  {settings?.fiscalYears?.map(y => (
                    <option key={y.id} value={y.id}>{y.label}</option>
                  ))}
                </select>

                <div className="relative">
                    <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className="p-2 rounded-full bg-gray-50">
                        <Bell size={20} className="text-gray-600" />
                        {unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>}
                    </button>
                    {showNotifDropdown && <NotificationDropdown />}
                </div>
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
