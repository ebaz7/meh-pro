
import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, PlusCircle, ListChecks, FileText, Users, LogOut, User as UserIcon, Settings, Bell, BellOff, MessageSquare, X, Check, Container, KeyRound, Save, Upload, Camera, Download, Share, ChevronRight, Home, Send, BrainCircuit, Mic, StopCircle, Loader2, Truck, ClipboardList, Package, Printer, CheckSquare, ShieldCheck, Shield, Phone, RefreshCw, Smartphone, MonitorDown, BellRing, Smartphone as MobileIcon, Trash2 } from 'lucide-react';
import { User, UserRole, AppNotification, SystemSettings } from '../types';
import { logout, hasPermission, getRolePermissions, updateUser } from '../services/authService';
import { requestNotificationPermission, setNotificationPreference, isNotificationEnabledInApp, sendNotification } from '../services/notificationService';
import { getSettings, uploadFile } from '../services/storageService';
import { apiCall } from '../services/apiService';
import { Capacitor } from '@capacitor/core';

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
  const notifRef = useRef<HTMLDivElement>(null);
  const mobileNotifRef = useRef<HTMLDivElement>(null);
  
  // PWA & Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  // Profile/Password Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Local Profile Form State
  const [profileForm, setProfileForm] = useState({
      password: '',
      confirmPassword: '',
      telegramChatId: '',
      phoneNumber: '',
      receiveNotifications: true
  });

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // AI Voice Assistant State
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [processingVoice, setProcessingVoice] = useState(false);
  const [voiceResult, setVoiceResult] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recordingMimeType, setRecordingMimeType] = useState<string>('');

  // Update Detection State
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

  useEffect(() => {
    if (showProfileModal && currentUser) {
        setProfileForm({
            password: '',
            confirmPassword: '',
            telegramChatId: currentUser.telegramChatId || '',
            phoneNumber: currentUser.phoneNumber || '',
            receiveNotifications: currentUser.receiveNotifications !== false 
        });
    }
  }, [showProfileModal, currentUser]);

  useEffect(() => {
    // SAFE CHECK: Check if Notification API exists and doesn't throw
    if (Capacitor.isNativePlatform()) {
        setNotifEnabled(isNotificationEnabledInApp());
    } else {
        try {
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && isNotificationEnabledInApp()) {
                setNotifEnabled(true);
            } else {
                setNotifEnabled(false);
            }
        } catch(e) {
            console.warn("Notification API not supported or blocked");
            setNotifEnabled(false);
        }
    }
  }, []);

  useEffect(() => {
    checkVersion();
    const interval = setInterval(checkVersion, 60000);
    return () => clearInterval(interval);
  }, []);

  const checkVersion = async () => {
    try {
      const response = await apiCall<{version: string}>(`/version?t=${Date.now()}`);
      if (response && response.version) {
        if (serverVersion === null) {
          setServerVersion(response.version);
        } else if (serverVersion !== response.version) {
          setIsUpdateAvailable(true);
        }
      }
    } catch (e) {}
  };

  const handleReload = () => {
    window.location.reload();
  };

  useEffect(() => {
    getSettings().then(data => {
        setSettings(data);
        if (data.pwaIcon) {
            const timestamp = Date.now();
            const iconUrl = data.pwaIcon.includes('?') ? `${data.pwaIcon}&t=${timestamp}` : `${data.pwaIcon}?t=${timestamp}`;
            const link = document.querySelector("link[rel*='apple-touch-icon']") as HTMLLinkElement;
            if (link) { link.href = iconUrl; } else { const newLink = document.createElement('link'); newLink.rel = 'apple-touch-icon'; newLink.href = iconUrl; document.head.appendChild(newLink); }
        }
    });
    
    const handleClickOutside = (event: MouseEvent) => { 
        // Logic to close dropdown if clicked outside
        const target = event.target as Element;
        if (showNotifDropdown && !target.closest('.notification-dropdown-container') && !target.closest('.notification-trigger')) {
            setShowNotifDropdown(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    
    window.addEventListener('beforeinstallprompt', (e) => { 
        e.preventDefault(); 
        setDeferredPrompt(e); 
    });

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    try {
        const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;
        const isDisplayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
        setIsStandalone(isInStandaloneMode || isDisplayModeStandalone);
    } catch(e) {
        setIsStandalone(false);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifDropdown]);

  const handleLogout = () => { logout(); onLogout(); };
  
  const handleToggleNotif = async () => { 
      // CRITICAL FIX: Prevent crash on mobile by handling permissions safely
      if (!Capacitor.isNativePlatform()) {
          if (typeof window === 'undefined' || !('Notification' in window)) {
              alert("این دستگاه/مرورگر از اعلان‌های وب پشتیبانی نمی‌کند.");
              return;
          }

          if (!isSecure && window.location.hostname !== 'localhost') { 
              alert("⚠️ مرورگرها اجازه فعال‌سازی نوتیفیکیشن در شبکه غیرامن (HTTP) را نمی‌دهند."); 
              return; 
          } 
      }
      
      if (notifEnabled) { 
          setNotifEnabled(false); 
          setNotificationPreference(false); 
          return;
      } 

      try {
          const granted = await requestNotificationPermission(); 
          if (granted) { 
              setNotifEnabled(true); 
              setNotificationPreference(true); 
              onAddNotification("سیستم دستور پرداخت", "نوتیفیکیشن‌ها با موفقیت فعال شدند."); 
          } else {
              setNotifEnabled(false);
              // Don't show alert for native as requestNotificationPermission handles the error internally now
              if (!Capacitor.isNativePlatform()) {
                  if (Notification.permission === 'denied') {
                      alert("دسترسی به نوتیفیکیشن توسط شما مسدود شده است.");
                  } else {
                      alert("امکان فعال‌سازی وجود ندارد.");
                  }
              }
          } 
      } catch (err) {
          console.error("Notification toggle error:", err);
          // Only alert if not native, to avoid disrupting user experience on mobile crashes
          if(!Capacitor.isNativePlatform()) alert("خطا در فعال‌سازی نوتیفیکیشن");
      }
  };

  const handleTestNotification = async () => {
      onAddNotification("تست سیستم", `این یک پیام آزمایشی است (${new Date().toLocaleTimeString('fa-IR')}).`);
      // sendNotification handled inside App.tsx or implicitly by onAddNotification hook
      await sendNotification("تست سیستم", "این یک پیام آزمایشی روی دستگاه شماست.");
  };
  
  const handleInstallClick = () => { 
      if (isIOS) {
          setShowIOSPrompt(true);
      } else if (deferredPrompt) { 
          deferredPrompt.prompt(); 
          deferredPrompt.userChoice.then((choiceResult: any) => { 
              if (choiceResult.outcome === 'accepted') { setDeferredPrompt(null); } 
          }); 
      } else {
          alert('دستگاه شما از نصب خودکار پشتیبانی نمی‌کند یا برنامه قبلاً نصب شده است.');
      }
  };

  // ... (Profile update handlers kept same) ...
  const handleUpdateProfile = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      const updates: Partial<User> = {}; 
      if (profileForm.password) { 
          if (profileForm.password !== profileForm.confirmPassword) { alert('رمز عبور و تکرار آن مطابقت ندارند.'); return; } 
          if (profileForm.password.length < 4) { alert('رمز عبور باید حداقل ۴ کاراکتر باشد.'); return; } 
          updates.password = profileForm.password; 
      } 
      updates.telegramChatId = profileForm.telegramChatId;
      updates.phoneNumber = profileForm.phoneNumber;
      updates.receiveNotifications = profileForm.receiveNotifications;
      try { await updateUser({ ...currentUser, ...updates }); alert('اطلاعات با موفقیت بروزرسانی شد.'); setProfileForm(prev => ({...prev, password: '', confirmPassword: ''})); setShowProfileModal(false); window.location.reload(); } catch (err) { alert('خطا در بروزرسانی اطلاعات'); } 
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => { 
      const file = e.target.files?.[0]; if (!file) return; 
      setUploadingAvatar(true); 
      const reader = new FileReader(); 
      reader.onload = async (ev) => { 
          const base64 = ev.target?.result as string; 
          try { const result = await uploadFile(file.name, base64); await updateUser({ ...currentUser, avatar: result.url }); window.location.reload(); } catch (error) { alert('خطا در آپلود تصویر'); } finally { setUploadingAvatar(false); } 
      }; 
      reader.readAsDataURL(file); 
  };

  const handleStartRecording = async () => { /* ... Voice Logic ... */ };
  const handleStopRecording = () => { /* ... Voice Logic ... */ };

  const unreadCount = notifications.filter(n => !n.read).length;
  const perms = settings ? getRolePermissions(currentUser.role, settings, currentUser) : null;
  const canCreatePayment = perms ? perms.canCreatePaymentOrder === true : false;
  const canCreateExit = perms?.canCreateExitPermit ?? false;
  const canManageWarehouse = currentUser.role === UserRole.ADMIN || (perms && perms.canManageWarehouse === true);
  const canSeeTrade = perms?.canManageTrade ?? false;
  const canSeeSettings = currentUser.role === UserRole.ADMIN || (perms?.canManageSettings ?? false);
  const canSeeSecurity = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO || currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.SECURITY_GUARD || (perms && perms.canViewSecurity !== false);

  const navItems = [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  ];
  if (canCreatePayment) navItems.push({ id: 'create', label: 'ثبت پرداخت', icon: PlusCircle });
  if (perms?.canViewPaymentOrders) navItems.push({ id: 'manage', label: 'سوابق پرداخت', icon: ListChecks });
  if (canCreateExit) navItems.push({ id: 'create-exit', label: 'ثبت خروج', icon: Truck });
  if (perms?.canViewExitPermits) navItems.push({ id: 'manage-exit', label: 'سوابق خروج', icon: ClipboardList });
  if (canManageWarehouse) navItems.push({ id: 'warehouse', label: 'مدیریت انبار', icon: Package });
  if (canSeeSecurity) navItems.push({ id: 'security', label: 'انتظامات', icon: Shield });
  navItems.push({ id: 'chat', label: 'گفتگو', icon: MessageSquare });
  if (canSeeTrade) navItems.push({ id: 'trade', label: 'بازرگانی', icon: Container });
  if (hasPermission(currentUser, 'manage_users')) navItems.push({ id: 'users', label: 'کاربران', icon: Users });
  if (canSeeSettings) navItems.push({ id: 'settings', label: 'تنظیمات', icon: Settings });

  const NotificationDropdown = () => ( 
    <div className="notification-dropdown-container fixed top-16 left-4 right-4 md:absolute md:top-auto md:bottom-16 md:left-2 md:right-auto md:w-80 bg-white rounded-xl shadow-2xl border border-gray-200 text-gray-800 z-[9999] overflow-hidden origin-top md:origin-bottom-left animate-scale-in max-h-[60vh] flex flex-col">
        <div className="bg-blue-50 p-3 flex justify-between items-center border-b border-blue-100 shrink-0">
            <div className="flex items-center gap-2">
                {notifEnabled ? <Bell size={16} className="text-blue-600"/> : <BellOff size={16} className="text-gray-500"/>}
                <span className="text-xs font-bold text-blue-800">وضعیت اعلان‌ها:</span>
            </div>
            <button onClick={handleToggleNotif} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${notifEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700 hover:bg-red-200 animate-pulse'}`}>
                {notifEnabled ? 'فعال است' : 'فعال‌سازی'}
            </button>
        </div>
        <div className="bg-gray-50 p-2 flex justify-between items-center border-b shrink-0">
            <span className="text-xs font-bold text-gray-600">پیام‌های سیستم</span>
            {notifications.length > 0 && (
                <button onClick={clearNotifications} className="text-gray-400 hover:text-red-500 flex items-center gap-1 text-[10px]">
                    <Trash2 size={12} /> پاک کردن همه
                </button>
            )}
        </div>
        <div className="overflow-y-auto flex-1 custom-scrollbar">
            {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 flex flex-col items-center">
                    <BellOff size={24} className="mb-2 opacity-20"/>
                    هیچ پیامی نیست
                </div>
            ) : (
                notifications.map(n => (
                    <div key={n.id} className="p-3 border-b hover:bg-gray-50 text-right last:border-0 relative group">
                        <div className="flex justify-between items-start pl-6">
                            <div className="text-xs font-bold text-gray-800 mb-1">{n.title}</div>
                            <div className="text-[9px] text-gray-400 whitespace-nowrap">{new Date(n.timestamp).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}</div>
                        </div>
                        <div className="text-xs text-gray-600 leading-tight">{n.message}</div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onRemoveNotification(n.id); }} 
                            className="absolute top-3 left-2 text-gray-300 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                            title="حذف پیام"
                        >
                            <X size={14}/>
                        </button>
                    </div>
                ))
            )}
        </div>
    </div> 
  );

  return (
    <div className="flex min-h-[100dvh] bg-gray-50 text-gray-800 font-sans relative">
      
      {/* ... (Update Banner, iOS Prompt, AI Voice Modal, Profile Modal code preserved) ... */}
      {isUpdateAvailable && (<div className="fixed top-0 left-0 right-0 bg-blue-600 text-white z-[9999] p-3 text-center shadow-lg animate-slide-down flex justify-center items-center gap-4"><div className="flex items-center gap-2"><RefreshCw size={20} className="animate-spin"/><span className="font-bold text-sm">نسخه جدید نرم‌افزار در دسترس است!</span></div><button onClick={handleReload} className="bg-white text-blue-600 px-4 py-1 rounded-full text-xs font-bold hover:bg-blue-50 transition-colors shadow-sm">بروزرسانی (رفرش)</button></div>)}
      {showIOSPrompt && (<div className="fixed inset-0 bg-black/80 z-[100] flex items-end md:items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setShowIOSPrompt(false)}><div className="bg-white w-full max-w-sm rounded-t-2xl md:rounded-2xl p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}><button className="absolute top-3 right-3 text-gray-400 hover:text-red-500" onClick={() => setShowIOSPrompt(false)}><X size={24}/></button><div className="flex flex-col items-center text-center"><Smartphone size={48} className="text-blue-600 mb-4" /><h3 className="text-xl font-bold text-gray-800 mb-2">نصب روی آیفون</h3><p className="text-sm text-gray-500 mb-6 leading-relaxed">برای نصب اپلیکیشن، دکمه <span className="inline-block mx-1"><Share size={16}/></span> (اشتراک‌گذاری) در پایین مرورگر سافاری را بزنید و سپس گزینه <span className="font-bold text-gray-800">Add to Home Screen</span> را انتخاب کنید.</p><div className="w-full bg-gray-100 rounded-xl p-4 flex items-center justify-center gap-4 mb-4"><span className="text-xs font-mono text-gray-400">1. Share</span><ChevronRight size={16} className="text-gray-400"/><span className="text-xs font-bold text-gray-700">2. Add to Home Screen</span></div><button onClick={() => setShowIOSPrompt(false)} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">متوجه شدم</button></div></div></div>)}
      
      {/* Hide Global AI Voice Button in Chat Tab */}
      {activeTab !== 'chat' && (
        <div className="fixed bottom-24 left-4 md:bottom-8 md:left-8 z-[60]">
            <button onClick={() => setShowVoiceModal(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center group" title="دستیار صوتی">
                <Mic size={24} className="group-hover:animate-pulse"/>
            </button>
        </div>
      )}

      {showVoiceModal && (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center relative overflow-hidden"><button onClick={() => { setShowVoiceModal(false); setVoiceResult(null); setIsRecording(false); }} className="absolute top-4 right-4 text-gray-400 hover:text-red-500"><X size={20}/></button><h3 className="text-xl font-black text-gray-800 mb-2">دستیار صوتی هوشمند</h3><p className="text-xs text-gray-500 mb-6">دستور خود را بگویید (مثلاً: ثبت ۵ میلیون برای علی...)</p><div className="flex justify-center mb-6"><button onClick={isRecording ? handleStopRecording : handleStartRecording} className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-100 text-red-600 scale-110 shadow-[0_0_0_10px_rgba(239,68,68,0.2)]' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>{isRecording ? <StopCircle size={40} className="animate-pulse"/> : <Mic size={40}/>}</button></div>{processingVoice && (<div className="flex items-center justify-center gap-2 text-blue-600 text-sm font-bold animate-pulse mb-4"><Loader2 size={16} className="animate-spin"/> در حال پردازش...</div>)}{voiceResult && (<div className={`p-4 rounded-xl text-sm text-right mb-4 ${voiceResult.includes("ثبت شد") ? 'bg-green-50 text-green-800' : 'bg-gray-50'}`}><p className="font-bold mb-1">پاسخ:</p><p className="whitespace-pre-wrap">{voiceResult}</p></div>)}</div></div>)}
      
      {/* ... Profile Modal ... */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 flex flex-col items-center justify-center text-white relative">
                    <button onClick={() => setShowProfileModal(false)} className="absolute top-4 right-4 text-white/70 hover:text-white"><X size={20}/></button>
                    <div className="relative group cursor-pointer mb-3" onClick={() => avatarInputRef.current?.click()}>
                        <div className="w-24 h-24 rounded-full bg-white/20 border-4 border-white/30 overflow-hidden shadow-lg">
                            {currentUser.avatar ? <img src={currentUser.avatar} alt="Profile" className="w-full h-full object-cover" /> : <UserIcon size={48} className="w-full h-full p-4 text-white" />}
                        </div>
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {uploadingAvatar ? <Loader2 size={24} className="animate-spin text-white"/> : <Camera size={24} className="text-white"/>}
                        </div>
                        <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} disabled={uploadingAvatar} />
                    </div>
                    <h3 className="text-xl font-bold">{currentUser.fullName}</h3>
                    <p className="text-sm opacity-80">{currentUser.role}</p>
                </div>
                <div className="p-6">
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><label className="text-xs font-bold text-gray-500">رمز عبور جدید</label><input type="password" value={profileForm.password} onChange={e => setProfileForm({...profileForm, password: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="******"/></div>
                            <div className="space-y-1"><label className="text-xs font-bold text-gray-500">تکرار رمز</label><input type="password" value={profileForm.confirmPassword} onChange={e => setProfileForm({...profileForm, confirmPassword: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="******"/></div>
                        </div>
                        <div className="space-y-1"><label className="text-xs font-bold text-gray-500">شماره موبایل (واتساپ)</label><input type="tel" value={profileForm.phoneNumber} onChange={e => setProfileForm({...profileForm, phoneNumber: e.target.value})} className="w-full border rounded-lg p-2 text-sm dir-ltr" placeholder="98912..."/></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-gray-500">آیدی تلگرام (عدد)</label><input type="text" value={profileForm.telegramChatId} onChange={e => setProfileForm({...profileForm, telegramChatId: e.target.value})} className="w-full border rounded-lg p-2 text-sm dir-ltr" placeholder="Chat ID"/></div>
                        
                        <label className="flex items-center gap-2 text-sm cursor-pointer bg-gray-50 p-3 rounded-lg">
                            <input type="checkbox" checked={profileForm.receiveNotifications} onChange={e => setProfileForm({...profileForm, receiveNotifications: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                            <span className="text-gray-700">دریافت پیام‌های اطلاع‌رسانی</span>
                        </label>

                        <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all mt-2">ذخیره تغییرات</button>
                    </form>
                </div>
            </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-slate-800 text-white flex-shrink-0 hidden md:flex flex-col no-print shadow-xl relative h-screen sticky top-0">
          <div className="p-6 border-b border-slate-700 flex items-center gap-3"><div className="bg-blue-500 p-2 rounded-lg"><FileText className="w-6 h-6 text-white" /></div><div><h1 className="text-lg font-bold tracking-wide">سیستم مالی</h1><span className="text-xs text-slate-400">پنل کاربری</span></div></div>
          <div className="p-4 bg-slate-700/50 mx-4 mt-4 rounded-xl flex items-center gap-3 border border-slate-600 relative group cursor-pointer hover:bg-slate-600 transition-colors" onClick={() => setShowProfileModal(true)} title="تنظیمات کاربری"><div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden shrink-0">{currentUser.avatar ? <img src={currentUser.avatar} alt="" className="w-full h-full object-cover"/> : <UserIcon size={20} className="text-blue-300" />}</div><div className="overflow-hidden flex-1"><p className="text-sm font-bold truncate">{currentUser.fullName}</p><p className="text-xs text-slate-400 truncate">نقش: {currentUser.role}</p></div><div className="absolute right-2 top-2 bg-slate-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Settings size={14} /></div></div>
          
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              {navItems.map((item) => { const Icon = item.icon; return (<React.Fragment key={item.id}><button onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-700'}`}><Icon size={20} /><span className="font-medium">{item.label}</span></button></React.Fragment>); })}
              
              {(!isStandalone && (deferredPrompt || isIOS)) && (
                  <button onClick={handleInstallClick} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-teal-300 hover:bg-slate-700 hover:text-white transition-colors border border-teal-800/30 mt-4">
                      <MonitorDown size={20} />
                      <span className="font-medium">نصب برنامه (PWA)</span>
                  </button>
              )}

              <div className="pt-4 mt-2 border-t border-slate-700 relative" ref={notifRef}>
                  <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className={`notification-trigger w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm relative ${unreadCount > 0 ? 'text-white bg-slate-700' : 'text-slate-400 hover:bg-slate-700'}`}><div className="relative"><Bell size={18} />{unreadCount > 0 && (<span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">{unreadCount}</span>)}</div><span>مرکز اعلان‌ها</span></button>
                  {showNotifDropdown && <NotificationDropdown />}
              </div>
          </nav>
          
          <div className="p-4 border-t border-slate-700"><button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded-lg transition-colors"><LogOut size={20} /><span>خروج از سیستم</span></button></div>
      </aside>
      
      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-2 flex justify-between z-50 no-print shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] overflow-x-auto safe-pb" style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))', height: 'calc(70px + env(safe-area-inset-bottom))' }}>
        <div className="flex w-full justify-between items-center px-1 gap-2">
            {navItems.map((item) => { const Icon = item.icon; return (<button key={item.id} onClick={() => setActiveTab(item.id)} className={`p-2 rounded-xl flex flex-col items-center justify-center text-xs min-w-[64px] flex-shrink-0 transition-all ${activeTab === item.id ? 'text-blue-600 bg-blue-50 font-bold' : 'text-gray-500'}`}><Icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2}/><span className="mt-1 whitespace-nowrap text-[10px] truncate w-full text-center">{item.label}</span></button>); })}
            <button onClick={handleLogout} className="p-2 rounded-xl flex flex-col items-center justify-center text-xs text-red-500 min-w-[50px] flex-shrink-0 bg-red-50"><LogOut size={22} /><span className="mt-1 text-[10px]">خروج</span></button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative min-w-0">
        <header className="bg-white shadow-sm p-4 md:hidden no-print flex items-center justify-between shrink-0 relative z-40 safe-pt" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
            <div className="flex items-center gap-3">
                {activeTab !== 'dashboard' && (<button onClick={() => setActiveTab('dashboard')} className="p-1.5 -mr-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"><ChevronRight size={24} /></button>)}
                <div className="flex items-center gap-2" onClick={() => setShowProfileModal(true)}><div className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden border border-gray-300">{currentUser.avatar ? <img src={currentUser.avatar} alt="" className="w-full h-full object-cover"/> : <UserIcon size={18} className="text-gray-500 m-2" />}</div><div><h1 className="font-bold text-gray-800 text-sm leading-tight">{activeTab === 'dashboard' ? 'سیستم مالی' : navItems.find(i => i.id === activeTab)?.label}</h1><div className="text-[10px] text-gray-500">{currentUser.fullName}</div></div></div>
            </div>
            <div className="flex items-center gap-2">
                {(!isStandalone && (deferredPrompt || isIOS)) && (
                    <button onClick={handleInstallClick} className="p-2 bg-teal-50 text-teal-600 rounded-lg text-xs font-bold flex items-center gap-1">
                        <Download size={16} />
                        <span className="hidden xs:inline">نصب</span>
                    </button>
                )}
                <div className="relative notification-trigger" ref={mobileNotifRef}>
                    <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className="relative p-2 rounded-full hover:bg-gray-100">
                        <Bell size={22} className="text-gray-600" />
                        {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>}
                    </button>
                    {showNotifDropdown && <NotificationDropdown />}
                </div>
            </div>
        </header>
        
        <div className={`flex-1 overflow-y-auto bg-gray-50 pb-[calc(90px+env(safe-area-inset-bottom))] md:pb-0 min-w-0 ${isUpdateAvailable ? 'pt-12' : ''}`}>
            <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-full min-w-0">
                {children}
            </div>
        </div>
      </main>
    </div>
  );
};
export default Layout;
