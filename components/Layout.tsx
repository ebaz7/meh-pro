
import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, PlusCircle, ListChecks, FileText, Users, LogOut, User as UserIcon, Settings, Bell, BellOff, MessageSquare, X, Check, Container, KeyRound, Save, Upload, Camera, Download, Share, ChevronRight, Home, Send, BrainCircuit, Mic, StopCircle, Loader2, Truck, ClipboardList, Package, Printer, CheckSquare, ShieldCheck, Shield, Phone, RefreshCw, Smartphone, MonitorDown, BellRing, Smartphone as MobileIcon, Trash2 } from 'lucide-react';
import { User, UserRole, AppNotification, SystemSettings } from '../types';
import { logout, hasPermission, getRolePermissions, updateUser } from '../services/authService';
import { requestNotificationPermission, setNotificationPreference, isNotificationEnabledInApp, sendNotification } from '../services/notificationService';
import { getSettings, uploadFile } from '../services/storageService';
import { apiCall } from '../services/apiService';
import { FiscalYearSelector } from './FiscalModule'; // ایمپورت انتخاب‌گر جدید

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
  
  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const perms = settings ? getRolePermissions(currentUser.role, settings, currentUser) : null;
  const canSeeSettings = currentUser.role === UserRole.ADMIN || (perms?.canManageSettings ?? false);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex min-h-[100dvh] bg-gray-50 text-gray-800 font-sans relative">
      {/* سایدبار دسکتاپ */}
      <aside className="w-64 bg-slate-800 text-white flex-shrink-0 hidden md:flex flex-col no-print shadow-xl relative h-screen sticky top-0">
          <div className="p-6 border-b border-slate-700 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                  <div className="bg-blue-500 p-2 rounded-lg"><FileText className="w-6 h-6 text-white" /></div>
                  <div><h1 className="text-lg font-bold">سیستم مالی</h1><span className="text-xs text-slate-400">پنل کاربری</span></div>
              </div>
              {/* تزریق انتخاب‌گر سال مالی در سایدبار */}
              <FiscalYearSelector />
          </div>
          
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-700'}`}><LayoutDashboard size={20} /><span>داشبورد</span></button>
              {perms?.canCreatePaymentOrder && <button onClick={() => setActiveTab('create')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'create' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-700'}`}><PlusCircle size={20} /><span>ثبت پرداخت</span></button>}
              {perms?.canViewPaymentOrders && <button onClick={() => setActiveTab('manage')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'manage' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-700'}`}><ListChecks size={20} /><span>سوابق پرداخت</span></button>}
              <button onClick={() => setActiveTab('chat')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'chat' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-700'}`}><MessageSquare size={20} /><span>گفتگو</span></button>
              {canSeeSettings && <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-700'}`}><Settings size={20} /><span>تنظیمات</span></button>}
          </nav>
          
          <div className="p-4 border-t border-slate-700"><button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-slate-700 rounded-lg transition-colors"><LogOut size={20} /><span>خروج</span></button></div>
      </aside>

      {/* محتوای اصلی */}
      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative min-w-0">
        <header className="bg-white shadow-sm p-4 md:hidden no-print flex items-center justify-between shrink-0 z-40 safe-pt">
            <div className="flex items-center gap-2">
                <div className="bg-blue-500 p-1.5 rounded-lg"><FileText size={18} className="text-white"/></div>
                <FiscalYearSelector />
            </div>
            <div className="flex items-center gap-2">
                <div className="relative">
                    <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className="p-2 rounded-full bg-gray-50">
                        <Bell size={20} className="text-gray-600" />
                        {unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>}
                    </button>
                </div>
            </div>
        </header>
        
        <div className="flex-1 overflow-y-auto bg-gray-50 pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0">
            <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-full">{children}</div>
        </div>
      </main>
    </div>
  );
};
export default Layout;
