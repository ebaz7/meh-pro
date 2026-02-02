
import React, { useState, useEffect, useRef } from 'react';
import { getSettings, saveSettings, uploadFile } from '../services/storageService';
import { SystemSettings, Company, Contact, CompanyBank, User, PrintTemplate } from '../types';
import { Settings as SettingsIcon, Save, Loader2, Database, Bell, Plus, Trash2, Building, ShieldCheck, Landmark, AppWindow, BellRing, BellOff, Send, Image as ImageIcon, Pencil, X, Check, MessageCircle, RefreshCw, Users, FolderSync, Smartphone, Link, Truck, DownloadCloud, UploadCloud, Warehouse, FileText, Container, LayoutTemplate, WifiOff, Info, Copy, ExternalLink, Power } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { requestNotificationPermission, setNotificationPreference, isNotificationEnabledInApp } from '../services/notificationService';
import { getUsers } from '../services/authService';
import { generateUUID } from '../constants';
import PrintTemplateDesigner from './PrintTemplateDesigner';
import { FiscalYearManager } from './FiscalModule'; 
import SecondExitGroupSettings from './settings/SecondExitGroupSettings';
import RolePermissionsEditor from './settings/RolePermissionsEditor';

const QRCode = ({ value, size }: { value: string, size: number }) => { 
    const [error, setError] = useState(false);
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center text-gray-400 text-xs border-2 border-dashed border-gray-300 rounded-lg p-2" style={{width: size, height: size}}>
                <WifiOff size={24} className="mb-2"/>
                <span className="text-center font-bold">خطا در بارگذاری تصویر QR</span>
            </div>
        );
    }
    return (
        <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`} 
            alt="QR Code" 
            width={size} 
            height={size} 
            className="mix-blend-multiply" 
            onError={() => setError(true)}
        />
    ); 
};

const Settings: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'system' | 'fiscal' | 'data' | 'integrations' | 'whatsapp' | 'permissions' | 'warehouse' | 'commerce' | 'templates'>('system');
  const [settings, setSettings] = useState<SystemSettings>({ 
      currentTrackingNumber: 1000, currentExitPermitNumber: 1000, companyNames: [], companies: [], defaultCompany: '', bankNames: [], operatingBankNames: [], commodityGroups: [], rolePermissions: {}, customRoles: [], savedContacts: [], pwaIcon: '', telegramBotToken: '', telegramAdminId: '', baleBotToken: '', smsApiKey: '', smsSenderNumber: '', googleCalendarId: '', whatsappNumber: '', geminiApiKey: '', warehouseSequences: {}, companyNotifications: {}, defaultWarehouseGroup: '', defaultSalesManager: '', insuranceCompanies: [], exitPermitNotificationGroup: '', printTemplates: [], fiscalYears: []
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [whatsappStatus, setWhatsappStatus] = useState<{ready: boolean, qr: string | null, user: string | null} | null>(null);
  const [refreshingWA, setRefreshingWA] = useState(false);
  const [restartingWA, setRestartingWA] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => { 
      loadSettings(); 
      setNotificationsEnabled(isNotificationEnabledInApp()); 
      checkWhatsappStatus();
  }, []);

  const loadSettings = async () => { 
      try { const data = await getSettings(); setSettings(data); } catch (e) { console.error("Failed to load settings"); } 
  };

  const checkWhatsappStatus = async () => {
      setRefreshingWA(true);
      try {
          const status = await apiCall<{ready: boolean, qr: string | null, user: string | null}>('/whatsapp/status');
          setWhatsappStatus(status);
      } catch (e) { console.error("Failed to check WA status"); } finally { setRefreshingWA(false); }
  };

  const handleRestartWhatsapp = async () => {
      if (!confirm('سرویس واتساپ روی سرور بسته و مجدداً باز خواهد شد. آیا ادامه می‌دهید؟')) return;
      setRestartingWA(true);
      try {
          await apiCall('/whatsapp/restart', 'POST');
          alert('درخواست ارسال شد. لطفاً ۳۰ ثانیه صبر کرده و سپس روی "بروزرسانی وضعیت" کلیک کنید.');
          setWhatsappStatus(null);
      } catch (e) { alert('خطا در ارسال دستور'); } finally { setRestartingWA(false); }
  };

  const handleWhatsappLogout = async () => {
      if(!confirm('آیا مطمئن هستید؟')) return;
      try { await apiCall('/whatsapp/logout', 'POST'); setTimeout(checkWhatsappStatus, 2000); } catch (e) { alert('خطا'); }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[600px] mb-20 animate-fade-in">
        <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-l border-gray-200 p-4">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 px-2"><SettingsIcon size={24} className="text-blue-600"/> تنظیمات</h2>
            <nav className="space-y-1">
                <button onClick={() => setActiveCategory('system')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'system' ? 'bg-white shadow text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><AppWindow size={18}/> عمومی</button>
                <button onClick={() => setActiveCategory('whatsapp')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'whatsapp' ? 'bg-white shadow text-green-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><MessageCircle size={18}/> پیام‌رسان‌ها</button>
                <button onClick={() => setActiveCategory('integrations')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'integrations' ? 'bg-white shadow text-purple-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Link size={18}/> اتصالات (API)</button>
            </nav>
        </div>

        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
            {activeCategory === 'whatsapp' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><MessageCircle size={20}/> مدیریت واتساپ</h3>
                        <div className="flex gap-2">
                            <button type="button" onClick={handleRestartWhatsapp} disabled={restartingWA} className="text-xs bg-red-50 text-red-700 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-red-100 transition-colors border border-red-100">
                                {restartingWA ? <Loader2 size={14} className="animate-spin"/> : <Power size={14}/>} راه‌اندازی مجدد سرویس
                            </button>
                            <button type="button" onClick={checkWhatsappStatus} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-indigo-100 border border-indigo-100">
                                {refreshingWA ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>} بروزرسانی وضعیت
                            </button>
                        </div>
                    </div>

                    <div className={`bg-${whatsappStatus?.ready ? 'green' : 'amber'}-50 border border-${whatsappStatus?.ready ? 'green' : 'amber'}-200 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6`}>
                        {whatsappStatus?.ready ? (
                            <>
                                <div className="bg-green-100 p-4 rounded-full text-green-600"><Check size={32}/></div>
                                <div className="flex-1 text-center md:text-right">
                                    <h3 className="font-bold text-lg text-green-800 mb-1">واتساپ متصل است</h3>
                                    <p className="text-sm text-green-700">شماره متصل: {whatsappStatus.user ? `+${whatsappStatus.user}` : 'ناشناس'}</p>
                                </div>
                                <button type="button" onClick={handleWhatsappLogout} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors">خروج از حساب</button>
                            </>
                        ) : (
                            <>
                                <div className="bg-white p-2 rounded-lg border shadow-sm flex flex-col items-center">
                                    {whatsappStatus?.qr ? (
                                        <>
                                            <QRCode value={whatsappStatus.qr} size={160} />
                                            <div className="mt-2 text-[10px] text-gray-400 font-mono">کد دریافت شد</div>
                                        </>
                                    ) : (
                                        <div className="w-40 h-40 flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
                                            <Loader2 size={32} className="animate-spin"/>
                                            <span className="text-center px-4">در انتظار پاسخ سرویس واتساپ...</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 space-y-4">
                                    <h3 className="font-bold text-lg text-amber-800">اتصال به واتساپ (روی سرور)</h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">
                                        اگر تصویر لود نمی‌شود یا سرویس متوقف شده است، دکمه <b>"راه‌اندازی مجدد سرویس"</b> در بالا را بزنید.
                                    </p>
                                    
                                    {whatsappStatus?.qr && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <input readOnly value={whatsappStatus.qr} className="flex-1 bg-gray-100 p-2 rounded text-[10px] font-mono border" />
                                                <button type="button" onClick={() => { navigator.clipboard.writeText(whatsappStatus.qr!); alert('کپی شد'); }} className="p-2 bg-blue-600 text-white rounded"><Copy size={16}/></button>
                                            </div>
                                            <p className="text-[10px] text-blue-700 bg-blue-50 p-2 rounded border border-blue-100 flex items-center gap-2">
                                                <Info size={14}/> متن بالا را کپی کنید و در سایت‌های تولید QR وارد کنید.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};
export default Settings;
