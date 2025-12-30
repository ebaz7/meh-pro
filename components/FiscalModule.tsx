
import React, { useState, useEffect } from 'react';
import { FiscalYear, SystemSettings } from '../types';
import { getSettings, saveSettings } from '../services/storageService';
import { generateUUID } from '../constants';
import { Calendar, Plus, Lock, Unlock, CheckCircle2, AlertTriangle, ListOrdered, ChevronDown } from 'lucide-react';

/**
 * FiscalModule
 * Separated component for managing fiscal years without cluttering Settings.tsx too much
 */

// --- HEADER SWITCHER COMPONENT ---
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
        // Force reload to apply new context globally (easiest way to ensure all data fetchers use new ID)
        window.location.reload(); 
    };

    if (!settings || !settings.fiscalYears || settings.fiscalYears.length === 0) return null;

    return (
        <div className="relative no-print">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold text-white transition-all border border-slate-500 shadow-inner"
            >
                <Calendar size={14} className="text-blue-400"/>
                <span className="truncate max-w-[100px]">{activeYear ? `سال مالی ${activeYear.label}` : 'انتخاب سال مالی'}</span>
                <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-200 z-[9999] overflow-hidden animate-scale-in">
                    <div className="p-2 bg-gray-50 border-b text-[10px] font-bold text-gray-400 uppercase">تغییر سال مالی</div>
                    <div className="max-h-60 overflow-y-auto">
                        {settings.fiscalYears.map(y => (
                            <button
                                key={y.id}
                                onClick={() => handleSelect(y.id)}
                                className={`w-full text-right px-4 py-3 text-xs flex justify-between items-center hover:bg-blue-50 transition-colors ${y.id === settings.activeFiscalYearId ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700'}`}
                            >
                                <span>{y.label} {y.isClosed ? '(بسته)' : ''}</span>
                                {y.id === settings.activeFiscalYearId && <CheckCircle2 size={14} />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MANAGER COMPONENT (FOR SETTINGS) ---
export const FiscalYearManager: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [newYearLabel, setNewYearLabel] = useState('');
    const [startPayNum, setStartPayNum] = useState('1');
    const [startExitNum, setStartExitNum] = useState('1');
    const [startBijakNum, setStartBijakNum] = useState('1');

    useEffect(() => {
        getSettings().then(setSettings);
    }, []);

    const handleAddYear = async () => {
        if (!newYearLabel.trim() || !settings) return;
        
        const newYear: FiscalYear = {
            id: generateUUID(),
            label: newYearLabel,
            isClosed: false,
            startTrackingNumber: parseInt(startPayNum) || 1,
            startExitPermitNumber: parseInt(startExitNum) || 1,
            startBijakNumber: parseInt(startBijakNum) || 1,
            createdAt: Date.now()
        };

        const updated = {
            ...settings,
            fiscalYears: [...(settings.fiscalYears || []), newYear],
            // If no active year, set this one
            activeFiscalYearId: settings.activeFiscalYearId || newYear.id
        };
        
        await saveSettings(updated);
        setSettings(updated);
        setNewYearLabel('');
        alert('سال مالی جدید ایجاد شد.');
    };

    const handleCloseYear = async (id: string) => {
        if (!settings || !confirm('آیا مطمئن هستید؟ سال بسته شده فقط قابل مشاهده خواهد بود.')) return;
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
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus size={20}/> تعریف سال مالی جدید</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">عنوان سال (مثلا 1404)</label>
                        <input className="w-full border rounded-xl p-2 text-sm" value={newYearLabel} onChange={e => setNewYearLabel(e.target.value)} placeholder="1404"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">شروع شماره پرداخت</label>
                        <input type="number" className="w-full border rounded-xl p-2 text-sm text-center dir-ltr" value={startPayNum} onChange={e => setStartPayNum(e.target.value)}/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">شروع شماره خروج</label>
                        <input type="number" className="w-full border rounded-xl p-2 text-sm text-center dir-ltr" value={startExitNum} onChange={e => setStartExitNum(e.target.value)}/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">شروع شماره بیجک</label>
                        <input type="number" className="w-full border rounded-xl p-2 text-sm text-center dir-ltr" value={startBijakNum} onChange={e => setStartBijakNum(e.target.value)}/>
                    </div>
                </div>
                <button onClick={handleAddYear} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors w-full md:w-auto">ثبت سال مالی</button>
            </div>

            <div className="space-y-3">
                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><ListOrdered size={20}/> لیست سال‌های مالی</h3>
                {settings.fiscalYears?.map(y => (
                    <div key={y.id} className={`p-4 rounded-xl border flex justify-between items-center ${y.id === settings.activeFiscalYearId ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center gap-3">
                            {y.isClosed ? <Lock size={18} className="text-gray-400"/> : <Unlock size={18} className="text-green-500"/>}
                            <div>
                                <div className="font-bold text-sm">{y.label} {y.id === settings.activeFiscalYearId && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded">فعال</span>}</div>
                                <div className="text-[10px] text-gray-500 mt-1">شروع پرداخت: {y.startTrackingNumber} | شروع خروج: {y.startExitPermitNumber} | شروع بیجک: {y.startBijakNumber}</div>
                            </div>
                        </div>
                        {!y.isClosed && (
                            <button onClick={() => handleCloseYear(y.id)} className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-100 transition-colors">بستن سال</button>
                        )}
                    </div>
                ))}
                {(!settings.fiscalYears || settings.fiscalYears.length === 0) && <div className="text-center text-gray-400 py-8">هنوز سال مالی تعریف نشده است.</div>}
            </div>
        </div>
    );
};
