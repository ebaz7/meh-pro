
import React, { useState, useEffect, useRef } from 'react';
import { getSettings, saveSettings, uploadFile } from '../services/storageService';
import { SystemSettings, Company, Contact, CompanyBank, User, PrintTemplate } from '../types';
import { Settings as SettingsIcon, Save, Loader2, Database, Bell, Plus, Trash2, Building, ShieldCheck, Landmark, AppWindow, BellRing, BellOff, Send, Image as ImageIcon, Pencil, X, Check, MessageCircle, RefreshCw, Users, FolderSync, Smartphone, Link, Truck, DownloadCloud, UploadCloud, Warehouse, FileText, Container, LayoutTemplate, WifiOff, Info, Power } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { requestNotificationPermission, setNotificationPreference, isNotificationEnabledInApp } from '../services/notificationService';
import { getUsers } from '../services/authService';
import { generateUUID } from '../constants';

const QRCode = ({ value, size }: { value: string, size: number }) => { 
    const [error, setError] = useState(false);
    if (error) return <div className="flex flex-col items-center justify-center text-gray-400 text-xs border-2 border-dashed border-gray-300 rounded-lg p-2" style={{width: size, height: size}}><WifiOff size={24} className="mb-2"/><span className="text-center">خطا در نمایش</span></div>;
    return <img src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`} alt="QR Code" width={size} height={size} className="mix-blend-multiply" onError={() => setError(true)}/>; 
};

const Settings: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'system' | 'fiscal' | 'data' | 'integrations' | 'whatsapp' | 'permissions' | 'warehouse' | 'commerce' | 'templates'>('system');
  const [settings, setSettings] = useState<SystemSettings>({ 
      currentTrackingNumber: 1000, currentExitPermitNumber: 1000, companyNames: [], companies: [], defaultCompany: '', bankNames: [], operatingBankNames: [], commodityGroups: [], rolePermissions: {}, customRoles: [], savedContacts: [], pwaIcon: '', telegramBotToken: '', telegramAdminId: '', baleBotToken: '', smsApiKey: '', smsSenderNumber: '', googleCalendarId: '', whatsappNumber: '', geminiApiKey: '', warehouseSequences: {}, companyNotifications: {}, defaultWarehouseGroup: '', defaultSalesManager: '', insuranceCompanies: [], exitPermitNotificationGroup: '', printTemplates: [], fiscalYears: []
  });

  const [loading, setLoading] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<{ready: boolean, qr: string | null, user: string | null} | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);

  useEffect(() => { loadSettings(); checkWhatsappStatus(); }, []);

  const loadSettings = async () => { try { const data = await getSettings(); setSettings(data); } catch (e) { } };
  const checkWhatsappStatus = async () => { try { const status = await apiCall<{ready: boolean, qr: string | null, user: string | null}>('/whatsapp/status'); setWhatsappStatus(status); } catch (e) { } };

  const handleRestartWhatsapp = async () => {
      if (!confirm('سرویس واتساپ روی سرور مجدداً راه‌اندازی می‌شود. آیا ادامه می‌دهید؟')) return;
      setIsRestarting(true);
      try {
          await apiCall('/whatsapp/restart', 'POST');
          alert('درخواست ارسال شد. لطفاً ۳۰ ثانیه صبر کنید و سپس صفحه را رفرش کنید.');
          setWhatsappStatus(null);
          setTimeout(checkWhatsappStatus, 10000);
      } catch (e) { alert('خطا در ارسال درخواست'); } finally { setIsRestarting(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault(); setLoading(true);
      try { await saveSettings(settings); alert('ذخیره شد'); } catch (e) { } finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[600px] mb-20">
        <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-l border-gray-200 p-4">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2"><SettingsIcon size={24}/> تنظیمات</h2>
            <nav className="space-y-1">
                <button onClick={() => setActiveCategory('system')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'system' ? 'bg-white shadow text-blue-700 font-bold' : 'text-gray-600'}`}><AppWindow size={18}/> عمومی</button>
                <button onClick={() => setActiveCategory('whatsapp')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'whatsapp' ? 'bg-white shadow text-green-700 font-bold' : 'text-gray-600'}`}><MessageCircle size={18}/> پیام‌رسان‌ها</button>
            </nav>
        </div>

        <div className="flex-1 p-6 md:p-8">
            {activeCategory === 'whatsapp' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><MessageCircle size={20}/> مدیریت پلتفرم‌ها</h3>
                        <button type="button" onClick={handleRestartWhatsapp} disabled={isRestarting} className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 flex items-center gap-1">
                            {isRestarting ? <Loader2 size={14} className="animate-spin"/> : <Power size={14}/>} راه‌اندازی مجدد سرویس واتساپ
                        </button>
                    </div>

                    <div className={`bg-${whatsappStatus?.ready ? 'green' : 'amber'}-50 border border-${whatsappStatus?.ready ? 'green' : 'amber'}-200 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6`}>
                        {whatsappStatus?.ready ? (
                            <div className="flex-1">
                                <h3 className="font-bold text-green-800">واتساپ متصل است ✅</h3>
                                <p className="text-sm">شماره: {whatsappStatus.user}</p>
                            </div>
                        ) : (
                            <>
                                <div className="bg-white p-2 rounded-lg border shadow-sm">
                                    {whatsappStatus?.qr ? <QRCode value={whatsappStatus.qr} size={160} /> : <div className="w-40 h-40 flex items-center justify-center text-gray-400 text-xs">در انتظار...</div>}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-amber-800 mb-2">اتصال به واتساپ</h3>
                                    <p className="text-sm text-gray-600">کد بالا را با واتساپ گوشی اسکن کنید. اگر کد نمایش داده نمی‌شود، از دکمه "راه‌اندازی مجدد سرویس" در بالا استفاده کنید.</p>
                                </div>
                            </>
                        )}
                    </div>

                    <form onSubmit={handleSave} className="space-y-4 pt-4 border-t">
                        <div>
                            <label className="text-sm font-bold text-gray-700 block mb-1">توکن ربات تلگرام</label>
                            <input className="w-full border rounded-lg p-2 text-left dir-ltr" value={settings.telegramBotToken} onChange={e => setSettings({...settings, telegramBotToken: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-700 block mb-1">توکن ربات بله</label>
                            <input className="w-full border rounded-lg p-2 text-left dir-ltr" value={settings.baleBotToken} onChange={e => setSettings({...settings, baleBotToken: e.target.value})} />
                        </div>
                        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                            {loading ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} ذخیره تنظیمات
                        </button>
                    </form>
                </div>
            )}
        </div>
    </div>
  );
};
export default Settings;
