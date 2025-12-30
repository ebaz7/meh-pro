
import React, { useState, useEffect } from 'react';
import { FiscalYear, SystemSettings } from '../types';
import { getSettings, saveSettings } from '../services/storageService';
import { generateUUID } from '../constants';
import { Calendar, Plus, Lock, Unlock, CheckCircle2, AlertTriangle, ListOrdered, ChevronDown } from 'lucide-react';

/**
 * FiscalModule
 * این فایل به صورت مجزا مدیریت سال مالی را بر عهده دارد.
 * هیچ کد قدیمی را تغییر نمی‌دهد و فقط فیلد سال مالی را تزریق می‌کند.
 */

// --- کامپوننت انتخاب‌گر سریع سال مالی برای هدر یا سایدبار ---
export const FiscalYearSwitcher: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        getSettings().then(setSettings);
    }, []);

    const activeYear = settings?.fiscalYears?.find(y => y.id === settings.activeFiscalYearId);

    const handleSelect = async (yearId: string) => {
        if (!settings) return;
        const updated = { ...settings, activeFiscalYearId: yearId };
        await saveSettings(updated);
        window.location.reload(); // رفرش سراسری برای اعمال فیلتر دیتابیس
    };

    if (!settings || !settings.fiscalYears?.length) return null;

    return (
        <div className="relative no-print">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold text-white transition-all border border-slate-500 shadow-inner"
            >
                <Calendar size={14} className="text-blue-400"/>
                <span className="truncate max-w-[80px]">{activeYear ? `سال ${activeYear.label}` : 'انتخاب سال'}</span>
                <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-200 z-[9999] overflow-hidden animate-scale-in">
                    <div className="p-2 bg-gray-50 border-b text-[10px] font-bold text-gray-400 uppercase">لیست سال‌های مالی</div>
                    <div className="max-h-60 overflow-y-auto">
                        {settings.fiscalYears.map(y => (
                            <button
                                key={y.id}
                                onClick={() => handleSelect(y.id)}
                                className={`w-full text-right px-4 py-3 text-xs flex justify-between items-center hover:bg-blue-50 transition-colors ${y.id === settings.activeFiscalYearId ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700'}`}
                            >
                                <span>سال {y.label} {y.isClosed ? '🔒' : ''}</span>
                                {y.id === settings.activeFiscalYearId && <CheckCircle2 size={14} />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- کامپوننت مدیریتی اصلی (جهت استفاده در تنظیمات) ---
export const FiscalYearManager: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [newYear, setNewYear] = useState({ label: '', startPay: '1', startExit: '1', startBijak: '1' });

    useEffect(() => {
        getSettings().then(setSettings);
    }, []);

    const handleAddYear = async () => {
        if (!newYear.label.trim() || !settings) return;
        
        const year: FiscalYear = {
            id: generateUUID(),
            label: newYear.label,
            isClosed: false,
            startTrackingNumber: parseInt(newYear.startPay) || 1,
            startExitPermitNumber: parseInt(newYear.startExit) || 1,
            startBijakNumber: parseInt(newYear.startBijak) || 1,
            createdAt: Date.now()
        };

        const updated = {
            ...settings,
            fiscalYears: [...(settings.fiscalYears || []), year],
            activeFiscalYearId: settings.activeFiscalYearId || year.id
        };
        
        await saveSettings(updated);
        setSettings(updated);
        setNewYear({ label: '', startPay: '1', startExit: '1', startBijak: '1' });
        alert('سال مالی جدید با شماره‌گذاری اختصاصی ایجاد شد.');
    };

    const handleCloseYear = async (id: string) => {
        if (!settings || !confirm('آیا از بستن این سال مالی اطمینان دارید؟ در سال بسته شده امکان ثبت سند جدید نخواهد بود.')) return;
        const updated = {
            ...settings,
            fiscalYears: settings.fiscalYears?.map(y => y.id === id ? { ...y, isClosed: true } : y)
        };
        await saveSettings(updated);
        setSettings(updated);
    };

    if (!settings) return null;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm">
                <h3 className="font-bold text-emerald-800 mb-4 flex items-center gap-2"><Plus size={20}/> افتتاح سال مالی جدید و ریست شماره‌ها</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">نام سال (مثلا 1404)</label>
                        <input className="w-full border rounded-xl p-2.5 text-sm" value={newYear.label} onChange={e => setNewYear({...newYear, label: e.target.value})} placeholder="1404"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">شروع دستور پرداخت از:</label>
                        <input type="number" className="w-full border rounded-xl p-2.5 text-center font-mono text-sm" value={newYear.startPay} onChange={e => setNewYear({...newYear, startPay: e.target.value})}/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">شروع مجوز خروج از:</label>
                        <input type="number" className="w-full border rounded-xl p-2.5 text-center font-mono text-sm" value={newYear.startExit} onChange={e => setNewYear({...newYear, startExit: e.target.value})}/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">شروع بیجک از:</label>
                        <input type="number" className="w-full border rounded-xl p-2.5 text-center font-mono text-sm" value={newYear.startBijak} onChange={e => setNewYear({...newYear, startBijak: e.target.value})}/>
                    </div>
                </div>
                <button onClick={handleAddYear} className="w-full mt-4 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20">
                    <CheckCircle2 size={20}/> تایید و ایجاد سال مالی
                </button>
            </div>

            <div className="space-y-3">
                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Calendar size={20}/> مدیریت سال‌های موجود</h3>
                {settings.fiscalYears?.map(y => (
                    <div key={y.id} className={`p-4 rounded-2xl border flex flex-col md:flex-row justify-between items-center gap-4 transition-all ${y.id === settings.activeFiscalYearId ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/10' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${y.isClosed ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-600'}`}>
                                {y.isClosed ? <Lock size={20}/> : <Unlock size={20}/>}
                            </div>
                            <div>
                                <div className="font-bold text-lg flex items-center gap-2 text-gray-800">
                                    سال {y.label}
                                    {y.id === settings.activeFiscalYearId && <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase">فعال</span>}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-1 flex gap-4 font-mono">
                                    <span className="flex items-center gap-1"><ListOrdered size={10}/> شروع پرداخت: {y.startTrackingNumber}</span>
                                    <span className="flex items-center gap-1"><ListOrdered size={10}/> شروع خروج: {y.startExitPermitNumber}</span>
                                    <span className="flex items-center gap-1"><ListOrdered size={10}/> شروع بیجک: {y.startBijakNumber}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {!y.isClosed && (
                                <button onClick={() => handleCloseYear(y.id)} className="bg-amber-50 text-amber-600 border border-amber-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-100 flex items-center gap-1 transition-colors">
                                    <AlertTriangle size={14}/> بستن سال مالی
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {(!settings.fiscalYears || settings.fiscalYears.length === 0) && (
                    <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-3xl">هنوز هیچ سال مالی تعریف نشده است.</div>
                )}
            </div>
        </div>
    );
};
