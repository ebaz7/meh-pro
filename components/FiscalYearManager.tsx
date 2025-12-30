
import React, { useState, useEffect } from 'react';
import { SystemSettings, FiscalYear } from '../types';
import { getSettings, saveSettings } from '../services/storageService';
import { generateUUID } from '../constants';
import { Calendar, Plus, Lock, Unlock, Trash2, CheckCircle2, AlertTriangle, ListOrdered } from 'lucide-react';

const FiscalYearManager: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [newYear, setNewYear] = useState({ label: '', startPay: '1001', startExit: '2001', startBijak: '5001' });

    useEffect(() => {
        getSettings().then(setSettings);
    }, []);

    const handleAddYear = async () => {
        if (!newYear.label.trim() || !settings) return;
        
        const year: FiscalYear = {
            id: generateUUID(),
            label: newYear.label,
            isClosed: false,
            startTrackingNumber: parseInt(newYear.startPay),
            startExitPermitNumber: parseInt(newYear.startExit),
            startBijakNumber: parseInt(newYear.startBijak),
            createdAt: Date.now()
        };

        const updated = {
            ...settings,
            fiscalYears: [...(settings.fiscalYears || []), year],
            activeFiscalYearId: settings.activeFiscalYearId || year.id
        };
        
        await saveSettings(updated);
        setSettings(updated);
        setNewYear({ label: '', startPay: '1001', startExit: '2001', startBijak: '5001' });
        alert('سال مالی جدید با شماره‌گذاری اختصاصی ایجاد شد.');
    };

    const handleCloseYear = async (id: string) => {
        if (!settings || !confirm('آیا از بستن این سال مالی اطمینان دارید؟ در سال بسته شده امکان ثبت سند جدید وجود نخواهد داشت.')) return;
        const updated = {
            ...settings,
            fiscalYears: settings.fiscalYears?.map(y => y.id === id ? { ...y, isClosed: true } : y)
        };
        await saveSettings(updated);
        setSettings(updated);
    };

    const handleSetActive = async (id: string) => {
        if (!settings) return;
        const updated = { ...settings, activeFiscalYearId: id };
        await saveSettings(updated);
        setSettings(updated);
        window.location.reload(); // رفرش برای اعمال فیلتر سراسری
    };

    if (!settings) return null;

    return (
        <div className="space-y-6">
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                <h3 className="font-bold text-emerald-800 mb-4 flex items-center gap-2"><Plus size={20}/> افتتاح سال مالی جدید و تنظیمات شروع شماره‌ها</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">نام سال (مثلا 1404)</label>
                        <input className="w-full border rounded-xl p-2.5" value={newYear.label} onChange={e => setNewYear({...newYear, label: e.target.value})} placeholder="1404"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">شروع دستور پرداخت</label>
                        <input type="number" className="w-full border rounded-xl p-2.5 text-center font-mono" value={newYear.startPay} onChange={e => setNewYear({...newYear, startPay: e.target.value})}/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">شروع مجوز خروج</label>
                        <input type="number" className="w-full border rounded-xl p-2.5 text-center font-mono" value={newYear.startExit} onChange={e => setNewYear({...newYear, startExit: e.target.value})}/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">شروع بیجک انبار</label>
                        <input type="number" className="w-full border rounded-xl p-2.5 text-center font-mono" value={newYear.startBijak} onChange={e => setNewYear({...newYear, startBijak: e.target.value})}/>
                    </div>
                </div>
                <button onClick={handleAddYear} className="w-full mt-4 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20">
                    <CheckCircle2 size={20}/> تایید و ایجاد سال مالی
                </button>
            </div>

            <div className="space-y-3">
                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Calendar size={20}/> لیست سال‌های مالی</h3>
                {settings.fiscalYears?.map(y => (
                    <div key={y.id} className={`p-4 rounded-2xl border flex flex-col md:flex-row justify-between items-center gap-4 transition-all ${y.id === settings.activeFiscalYearId ? 'border-blue-500 bg-blue-50/30 ring-4 ring-blue-500/5' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${y.isClosed ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-600'}`}>
                                {y.isClosed ? <Lock size={20}/> : <Unlock size={20}/>}
                            </div>
                            <div>
                                <div className="font-bold text-lg flex items-center gap-2">
                                    سال {y.label}
                                    {y.id === settings.activeFiscalYearId && <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">فعال</span>}
                                    {y.isClosed && <span className="text-[10px] bg-gray-500 text-white px-2 py-0.5 rounded-full uppercase">بسته شده</span>}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-1 flex gap-4">
                                    <span className="flex items-center gap-1"><ListOrdered size={10}/> شروع پرداخت: {y.startTrackingNumber}</span>
                                    <span className="flex items-center gap-1"><ListOrdered size={10}/> شروع خروج: {y.startExitPermitNumber}</span>
                                    <span className="flex items-center gap-1"><ListOrdered size={10}/> شروع بیجک: {y.startBijakNumber}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {y.id !== settings.activeFiscalYearId && (
                                <button onClick={() => handleSetActive(y.id)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm transition-all">انتخاب به عنوان فعال</button>
                            )}
                            {!y.isClosed && (
                                <button onClick={() => handleCloseYear(y.id)} className="bg-amber-50 text-amber-600 border border-amber-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-100 flex items-center gap-1">
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

export default FiscalYearManager;
