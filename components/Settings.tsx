
import React, { useState, useEffect, useRef } from 'react';
import { getSettings, saveSettings, uploadFile } from '../services/storageService';
import { SystemSettings, FiscalYear, UserRole } from '../types';
import { Settings as SettingsIcon, Save, Loader2, Database, Plus, Trash2, Building, ShieldCheck, AppWindow, CalendarDays, Lock, Unlock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { generateUUID } from '../constants';

const Settings: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'system' | 'data' | 'fiscal' | 'permissions'>('system');
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // New Fiscal Year Form
  const [newYearLabel, setNewYearLabel] = useState('');
  const [startPay, setStartPay] = useState('1001');
  const [startExit, setStartExit] = useState('2001');
  const [startBijak, setStartBijak] = useState('5001');

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => { 
      const data = await getSettings(); 
      if (!data.fiscalYears) data.fiscalYears = [];
      setSettings(data); 
  };

  const handleAddFiscalYear = async () => {
      if (!newYearLabel.trim() || !settings) return;
      
      const newYear: FiscalYear = {
          id: generateUUID(),
          label: newYearLabel,
          isClosed: false,
          startTrackingNumber: parseInt(startPay),
          startExitPermitNumber: parseInt(startExit),
          startBijakNumber: parseInt(startBijak),
          createdAt: Date.now()
      };

      const updated = { 
          ...settings, 
          fiscalYears: [...(settings.fiscalYears || []), newYear],
          activeFiscalYearId: settings.activeFiscalYearId || newYear.id 
      };

      setSettings(updated);
      setNewYearLabel('');
      await saveSettings(updated);
      alert('سال مالی جدید با موفقیت ایجاد شد.');
  };

  const handleCloseYear = async (id: string) => {
      if (!settings || !confirm('آیا از بستن این سال مالی اطمینان دارید؟ در سال مالی بسته شده امکان ثبت سند جدید وجود نخواهد داشت.')) return;
      
      const updated = {
          ...settings,
          fiscalYears: settings.fiscalYears?.map(y => y.id === id ? { ...y, isClosed: true } : y)
      };
      
      setSettings(updated);
      await saveSettings(updated);
  };

  const handleSave = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      if (!settings) return;
      setLoading(true); 
      try { 
          await saveSettings(settings); 
          setMessage('ذخیره شد ✅'); setTimeout(() => setMessage(''), 3000); 
      } catch (e) { setMessage('خطا ❌'); } finally { setLoading(false); } 
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[600px] mb-20 animate-fade-in">
        <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-l border-gray-200 p-4">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 px-2"><SettingsIcon size={24} className="text-blue-600"/> تنظیمات</h2>
            <nav className="space-y-1">
                <button onClick={() => setActiveCategory('system')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'system' ? 'bg-white shadow text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><AppWindow size={18}/> عمومی</button>
                <button onClick={() => setActiveCategory('fiscal')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'fiscal' ? 'bg-white shadow text-emerald-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><CalendarDays size={18}/> مدیریت سال مالی</button>
                <button onClick={() => setActiveCategory('data')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'data' ? 'bg-white shadow text-indigo-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Database size={18}/> اطلاعات پایه</button>
            </nav>
        </div>

        <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[calc(100vh-100px)]">
            <form onSubmit={handleSave} className="space-y-8 max-w-4xl mx-auto">
                
                {activeCategory === 'fiscal' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                            <h3 className="font-bold text-emerald-800 mb-4 flex items-center gap-2"><Plus size={20}/> افتتاح سال مالی جدید</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                                <div><label className="text-xs font-bold text-gray-600 block mb-1">نام سال (مثلا 1404)</label><input className="w-full border rounded-lg p-2" value={newYearLabel} onChange={e=>setNewYearLabel(e.target.value)}/></div>
                                <div><label className="text-xs font-bold text-gray-600 block mb-1">شروع دستور پرداخت</label><input type="number" className="w-full border rounded-lg p-2 text-center" value={startPay} onChange={e=>setStartPay(e.target.value)}/></div>
                                <div><label className="text-xs font-bold text-gray-600 block mb-1">شروع مجوز خروج</label><input type="number" className="w-full border rounded-lg p-2 text-center" value={startExit} onChange={e=>setStartExit(e.target.value)}/></div>
                                <button type="button" onClick={handleAddFiscalYear} className="bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-700 h-[42px] transition-all">ایجاد سال</button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-800 border-b pb-2">لیست سال‌های مالی</h3>
                            <div className="space-y-3">
                                {settings?.fiscalYears?.map(y => (
                                    <div key={y.id} className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-center gap-4 ${y.id === settings.activeFiscalYearId ? 'border-blue-500 bg-blue-50/30' : 'bg-white border-gray-200'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-full ${y.isClosed ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-600'}`}>
                                                {y.isClosed ? <Lock size={20}/> : <Unlock size={20}/>}
                                            </div>
                                            <div>
                                                <div className="font-bold text-lg flex items-center gap-2">
                                                    سال {y.label}
                                                    {y.id === settings.activeFiscalYearId && <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full">فعال</span>}
                                                </div>
                                                <div className="text-[10px] text-gray-500 mt-1 flex gap-3">
                                                    <span>شروع پرداخت: {y.startTrackingNumber}</span>
                                                    <span>شروع خروج: {y.startExitPermitNumber}</span>
                                                    <span>شروع بیجک: {y.startBijakNumber}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {!y.isClosed && (
                                                <button type="button" onClick={() => handleCloseYear(y.id)} className="bg-amber-50 text-amber-600 border border-amber-200 px-4 py-2 rounded-lg text-xs font-bold hover:bg-amber-100 flex items-center gap-2">
                                                    <AlertTriangle size={14}/> بستن سال مالی
                                                </button>
                                            )}
                                            {y.isClosed && (
                                                <span className="text-gray-400 text-xs font-bold flex items-center gap-1"><CheckCircle2 size={14}/> این سال بسته شده است</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ... سایر کتگوری‌ها ... */}
                {activeCategory === 'system' && (
                    <div className="space-y-4">
                        <h3 className="font-bold text-gray-800 border-b pb-2">تنظیمات عمومی</h3>
                        <p className="text-sm text-gray-500">در اینجا می‌توانید تنظیمات عمومی سیستم را مدیریت کنید.</p>
                    </div>
                )}

                <div className="flex justify-end pt-4 border-t sticky bottom-0 bg-white p-4">
                    <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-70">
                        {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} ذخیره تغییرات
                    </button>
                </div>
            </form>
        </div>
        {message && (<div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white text-sm font-bold shadow-2xl z-[100] animate-bounce ${message.includes('خطا') ? 'bg-red-600' : 'bg-green-600'}`}>{message}</div>)}
    </div>
  );
};
export default Settings;
