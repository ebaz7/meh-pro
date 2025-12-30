
import React, { useState, useEffect } from 'react';
import { FiscalYear, SystemSettings, Company } from '../types';
import { getSettings, saveSettings } from '../services/storageService';
import { generateUUID } from '../constants';
import { Calendar, Plus, Lock, Unlock, CheckCircle2, AlertTriangle, ListOrdered, ChevronDown, Building2, Save } from 'lucide-react';

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
    const [newYearLabel, setNewYearLabel] = useState('1404');
    const [startPayNum, setStartPayNum] = useState('1');
    const [startExitNum, setStartExitNum] = useState('1');
    const [startBijakNum, setStartBijakNum] = useState('1');
    
    // Config editing state
    const [editingYearId, setEditingYearId] = useState<string | null>(null);
    const [companyConfig, setCompanyConfig] = useState<Record<string, { pay: string, exit: string, bijak: string }>>({});

    useEffect(() => {
        getSettings().then(s => {
            setSettings(s);
            if (s.activeFiscalYearId) {
                // Pre-load active year config if available
                loadCompanyConfig(s.activeFiscalYearId, s);
            }
        });
    }, []);

    const loadCompanyConfig = (yearId: string, currentSettings: SystemSettings) => {
        const year = currentSettings.fiscalYears?.find(y => y.id === yearId);
        if (!year) return;
        setEditingYearId(yearId);
        
        const configMap: Record<string, { pay: string, exit: string, bijak: string }> = {};
        const companies = currentSettings.companies || [];
        
        companies.forEach(c => {
            const seq = year.companySequences?.[c.name] || {};
            configMap[c.name] = {
                pay: seq.startTrackingNumber ? String(seq.startTrackingNumber) : '',
                exit: seq.startExitPermitNumber ? String(seq.startExitPermitNumber) : '',
                bijak: seq.startBijakNumber ? String(seq.startBijakNumber) : ''
            };
        });
        setCompanyConfig(configMap);
    };

    const handleAddYear = async () => {
        if (!newYearLabel.trim() || !settings) return;
        
        const newYear: FiscalYear = {
            id: generateUUID(),
            label: newYearLabel,
            isClosed: false,
            defaultStartTrackingNumber: parseInt(startPayNum) || 1,
            defaultStartExitPermitNumber: parseInt(startExitNum) || 1,
            defaultStartBijakNumber: parseInt(startBijakNum) || 1,
            companySequences: {}, // Empty initially
            createdAt: Date.now()
        };

        const updated = {
            ...settings,
            fiscalYears: [...(settings.fiscalYears || []), newYear],
            activeFiscalYearId: settings.activeFiscalYearId || newYear.id
        };
        
        await saveSettings(updated);
        setSettings(updated);
        setNewYearLabel('');
        alert('سال مالی جدید ایجاد شد. اکنون می‌توانید تنظیمات هر شرکت را ویرایش کنید.');
        loadCompanyConfig(newYear.id, updated);
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

    const handleSaveCompanyConfig = async () => {
        if (!settings || !editingYearId) return;
        
        // Convert UI config back to data structure
        const sequences: Record<string, { startTrackingNumber?: number; startExitPermitNumber?: number; startBijakNumber?: number; }> = {};
        
        Object.entries(companyConfig).forEach(([compName, vals]) => {
            const config = vals as { pay: string, exit: string, bijak: string };
            if (config.pay || config.exit || config.bijak) {
                sequences[compName] = {
                    startTrackingNumber: config.pay ? parseInt(config.pay) : undefined,
                    startExitPermitNumber: config.exit ? parseInt(config.exit) : undefined,
                    startBijakNumber: config.bijak ? parseInt(config.bijak) : undefined,
                };
            }
        });

        const updatedYears = settings.fiscalYears?.map(y => 
            y.id === editingYearId ? { ...y, companySequences: sequences } : y
        );

        const updatedSettings = { ...settings, fiscalYears: updatedYears };
        await saveSettings(updatedSettings);
        setSettings(updatedSettings);
        alert('تنظیمات اختصاصی شرکت‌ها ذخیره شد.');
    };

    if (!settings) return null;

    const editingYear = settings.fiscalYears?.find(y => y.id === editingYearId);

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Create New Year Section */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus size={20}/> تعریف سال مالی جدید</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">عنوان سال (مثلا 1404)</label>
                        <input className="w-full border rounded-xl p-2 text-sm" value={newYearLabel} onChange={e => setNewYearLabel(e.target.value)} placeholder="1404"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">شروع پرداخت (پیش‌فرض)</label>
                        <input type="number" className="w-full border rounded-xl p-2 text-sm text-center dir-ltr" value={startPayNum} onChange={e => setStartPayNum(e.target.value)}/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">شروع خروج (پیش‌فرض)</label>
                        <input type="number" className="w-full border rounded-xl p-2 text-sm text-center dir-ltr" value={startExitNum} onChange={e => setStartExitNum(e.target.value)}/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">شروع بیجک (پیش‌فرض)</label>
                        <input type="number" className="w-full border rounded-xl p-2 text-sm text-center dir-ltr" value={startBijakNum} onChange={e => setStartBijakNum(e.target.value)}/>
                    </div>
                </div>
                <button onClick={handleAddYear} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors w-full md:w-auto">ثبت سال مالی</button>
            </div>

            {/* List Years */}
            <div className="space-y-3">
                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><ListOrdered size={20}/> لیست سال‌های مالی</h3>
                {settings.fiscalYears?.map(y => (
                    <div key={y.id} className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-center gap-4 transition-all ${y.id === settings.activeFiscalYearId ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'bg-white border-gray-200'} ${editingYearId === y.id ? 'shadow-md border-indigo-300' : ''}`}>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            {y.isClosed ? <Lock size={18} className="text-gray-400"/> : <Unlock size={18} className="text-green-500"/>}
                            <div>
                                <div className="font-bold text-sm flex items-center gap-2">
                                    {y.label} 
                                    {y.id === settings.activeFiscalYearId && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded">فعال</span>}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-1">پیش‌فرض‌ها: پ {y.defaultStartTrackingNumber} | خ {y.defaultStartExitPermitNumber} | ب {y.defaultStartBijakNumber}</div>
                            </div>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto justify-end">
                            <button onClick={() => loadCompanyConfig(y.id, settings)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${editingYearId === y.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                                تنظیم شماره شرکت‌ها
                            </button>
                            {!y.isClosed && (
                                <button onClick={() => handleCloseYear(y.id)} className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-100 transition-colors">بستن سال</button>
                            )}
                        </div>
                    </div>
                ))}
                {(!settings.fiscalYears || settings.fiscalYears.length === 0) && <div className="text-center text-gray-400 py-8">هنوز سال مالی تعریف نشده است.</div>}
            </div>

            {/* Detailed Company Config Editor */}
            {editingYear && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 animate-scale-in">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h3 className="font-bold text-indigo-800 flex items-center gap-2"><Building2 size={20}/> تنظیم شماره‌های اختصاصی شرکت‌ها - سال {editingYear.label}</h3>
                        <button onClick={handleSaveCompanyConfig} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-sm"><Save size={16}/> ذخیره تغییرات</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right bg-white rounded-xl border overflow-hidden">
                            <thead className="bg-gray-100 text-gray-600">
                                <tr>
                                    <th className="p-3 border-b">نام شرکت</th>
                                    <th className="p-3 border-b w-40">شروع پرداخت</th>
                                    <th className="p-3 border-b w-40">شروع خروج</th>
                                    <th className="p-3 border-b w-40">شروع بیجک</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {settings.companies?.map(c => {
                                    const conf = companyConfig[c.name] || { pay: '', exit: '', bijak: '' };
                                    return (
                                        <tr key={c.id} className="hover:bg-indigo-50/30">
                                            <td className="p-3 font-bold">{c.name}</td>
                                            <td className="p-3">
                                                <input 
                                                    type="number" 
                                                    className="w-full border rounded p-1 text-center dir-ltr focus:border-indigo-500 outline-none"
                                                    placeholder={`(پیش‌فرض: ${editingYear.defaultStartTrackingNumber})`}
                                                    value={conf.pay}
                                                    onChange={e => setCompanyConfig({...companyConfig, [c.name]: { ...conf, pay: e.target.value }})}
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input 
                                                    type="number" 
                                                    className="w-full border rounded p-1 text-center dir-ltr focus:border-indigo-500 outline-none"
                                                    placeholder={`(پیش‌فرض: ${editingYear.defaultStartExitPermitNumber})`}
                                                    value={conf.exit}
                                                    onChange={e => setCompanyConfig({...companyConfig, [c.name]: { ...conf, exit: e.target.value }})}
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input 
                                                    type="number" 
                                                    className="w-full border rounded p-1 text-center dir-ltr focus:border-indigo-500 outline-none"
                                                    placeholder={`(پیش‌فرض: ${editingYear.defaultStartBijakNumber})`}
                                                    value={conf.bijak}
                                                    onChange={e => setCompanyConfig({...companyConfig, [c.name]: { ...conf, bijak: e.target.value }})}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2 px-2">* نکته: اگر فیلدی خالی رها شود، سیستم از شماره پیش‌فرض تعریف شده برای سال مالی استفاده می‌کند. برای ادامه شماره‌های سال قبل، عدد بعدی را دستی وارد کنید (مثلاً اگر سال قبل تا ۵۰۰ رفته، اینجا ۵۰۱ بزنید).</p>
                </div>
            )}
        </div>
    );
};
