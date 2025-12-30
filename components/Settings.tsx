
import React, { useState, useEffect, useRef } from 'react';
import { getSettings, saveSettings, uploadFile } from '../services/storageService';
import { SystemSettings, Company, Contact, CompanyBank, User, PrintTemplate } from '../types';
import { Settings as SettingsIcon, Save, Loader2, Database, Bell, Plus, Trash2, Building, ShieldCheck, Landmark, Package, AppWindow, Calendar, LayoutTemplate, MessageCircle, RefreshCw, FolderSync } from 'lucide-react';
import { FiscalYearManager } from './FiscalModule';

const Settings: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'system' | 'fiscal' | 'data' | 'templates' | 'permissions'>('system');
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { 
      getSettings().then(setSettings); 
  }, []);

  const handleSave = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      if (!settings) return;
      setLoading(true); 
      try { 
          await saveSettings(settings); 
          setMessage('ذخیره شد ✅'); setTimeout(() => setMessage(''), 3000); 
      } catch (e) { setMessage('خطا ❌'); } finally { setLoading(false); } 
  };

  if (!settings) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[600px] mb-20 animate-fade-in">
        <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-l border-gray-200 p-4">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 px-2"><SettingsIcon size={24} className="text-blue-600"/> تنظیمات</h2>
            <nav className="space-y-1">
                <button onClick={() => setActiveCategory('system')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'system' ? 'bg-white shadow text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><AppWindow size={18}/> عمومی و سیستم</button>
                <button onClick={() => setActiveCategory('fiscal')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'fiscal' ? 'bg-white shadow text-emerald-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><FolderSync size={18}/> مدیریت سال مالی</button>
                <button onClick={() => setActiveCategory('data')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'data' ? 'bg-white shadow text-indigo-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Database size={18}/> اطلاعات پایه</button>
                <button onClick={() => setActiveCategory('templates')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'templates' ? 'bg-white shadow text-teal-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><LayoutTemplate size={18}/> قالب‌های چاپ</button>
                <button onClick={() => setActiveCategory('permissions')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'permissions' ? 'bg-white shadow text-amber-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><ShieldCheck size={18}/> دسترسی‌ها</button>
            </nav>
        </div>

        <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[calc(100vh-100px)]">
            {activeCategory === 'fiscal' ? (
                <FiscalYearManager />
            ) : (
                <form onSubmit={handleSave} className="space-y-8 max-w-4xl mx-auto">
                    {activeCategory === 'system' && (
                        <div className="space-y-6">
                            <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><AppWindow size={20}/> تنظیمات سیستمی</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="text-sm font-bold block mb-1">نام پیش‌فرض شرکت</label><input className="w-full border rounded-lg p-2 bg-white" value={settings.defaultCompany} onChange={e=>setSettings({...settings, defaultCompany: e.target.value})}/></div>
                                <div><label className="text-sm font-bold block mb-1">توکن ربات تلگرام</label><input className="w-full border rounded-lg p-2 bg-white font-mono text-xs" value={settings.telegramBotToken} onChange={e=>setSettings({...settings, telegramBotToken: e.target.value})}/></div>
                            </div>
                        </div>
                    )}
                    
                    {/* ... سایر تب‌ها ... */}

                    <div className="flex justify-end pt-4 border-t sticky bottom-0 bg-white p-4">
                        <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-70">
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} ذخیره تغییرات
                        </button>
                    </div>
                </form>
            )}
        </div>
        {message && (<div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white text-sm font-bold shadow-2xl z-[100] animate-bounce ${message.includes('خطا') ? 'bg-red-600' : 'bg-green-600'}`}>{message}</div>)}
    </div>
  );
};
export default Settings;
