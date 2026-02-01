import React, { useState, useEffect } from 'react';
import { FiscalYear, SystemSettings, Company, CompanySequenceConfig } from '../types';
import { getSettings, saveSettings } from '../services/storageService';
import { generateUUID } from '../constants';
import { Calendar, Plus, Lock, Unlock, CheckCircle2, AlertTriangle, ListOrdered, ChevronDown, Building2, Save } from 'lucide-react';

/**
 * FiscalModule
 * This component manages fiscal years and crucially, allows setting independent
 * sequence numbers for each company for Payments, Exit Permits, and Bijaks.
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
        // Force reload to apply new context globally
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
    const [newYearLabel, setNewYearLabel] = useState('1405'); 
    
    // Config editing state
    const [editingYearId, setEditingYearId] = useState<string | null>(null);
    
    // Local state for the config grid [companyName] -> { pay, exit, bijak }
    const [companyConfig, setCompanyConfig] = useState<Record<string, { pay: string, exit: string, bijak: string }>>({});

    useEffect(() => {
        getSettings().then(s => {
            setSettings(s);
            // Automatically load configuration for the active year if one exists
            if (s.activeFiscalYearId) {
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
        
        // GLOBAL DEFAULTS (Current System State)
        // If year config is missing, we suggest the current system numbers + 1 or existing
        const defaultPay = currentSettings.currentTrackingNumber ? currentSettings.currentTrackingNumber + 1 : 1000;
        const defaultExit = currentSettings.currentExitPermitNumber ? currentSettings.currentExitPermitNumber + 1 : 1000;

        companies.forEach(c => {
            // FIX: Using type assertion to avoid property errors on empty object
            const seq = (year.companySequences?.[c.name] || {}) as CompanySequenceConfig;
            
            // Warehouse Bijak: Use specific company sequence if available in settings, else 1
            const currentBijak = currentSettings.warehouseSequences?.[c.name];
            const defaultBijak = currentBijak ? currentBijak + 1 : 1000;

            configMap[c.name] = {
                // Priority: 1. Existing Fiscal Config, 2. Current System Counter, 3. Default 1000
                pay: seq.startTrackingNumber ? String(seq.startTrackingNumber) : String(defaultPay),
                exit: seq.startExitPermitNumber ? String(seq.startExitPermitNumber) : String(defaultExit),
                bijak: seq.startBijakNumber ? String(seq.startBijakNumber) : String(defaultBijak)
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
            companySequences: {}, 
            createdAt: Date.now()
        };

        const updated = {
            ...settings,
            fiscalYears: [...(settings.fiscalYears || []), newYear],
        };
        
        await saveSettings(updated);
        setSettings(updated);
        setNewYearLabel('');
        alert('سال مالی جدید ایجاد شد. اکنون می‌توانید تنظیمات شماره‌گذاری هر شرکت را ویرایش کنید.');
        
        // Auto select the new year for editing
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
        const sequences: Record<string, CompanySequenceConfig> = {};
        
        Object.entries(companyConfig).forEach(([compName, vals]) => {
            const values = vals as { pay: string, exit: string, bijak: string };
            sequences[compName] = {
                startTrackingNumber: parseInt(values.pay) || 1,
                startExitPermitNumber: parseInt(values.exit) || 1,
                startBijakNumber: parseInt(values.bijak) || 1,
            };
        });

        const updatedYears = settings.fiscalYears?.map(y => 
            y.id === editingYearId ? { ...y, companySequences: sequences } : y
        );

        const updatedSettings = { ...settings, fiscalYears: updatedYears };
        await saveSettings(updatedSettings);
        setSettings(updatedSettings);
        alert('تنظیمات شماره‌گذاری اختصاصی شرکت‌ها برای این سال ذخیره شد.');
    };

    if (!settings) return null;

    const editingYear = settings.fiscalYears?.find(y => y.id === editingYearId);

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Create New Year Section */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus size={20}/> تعریف سال مالی جدید</h3>
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-500 block mb-1">عنوان سال (مثلا 1405)</label>
                        <input className="w-full border rounded-xl p-2 text-sm" value={newYearLabel} onChange={e => setNewYearLabel(e.target.value)} placeholder="1405"/>
                    </div>
                    <button onClick={handleAddYear} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors">ثبت سال مالی</button>
                </div>
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
                        <div className="flex flex-col">
                            <h3 className="font-bold text-indigo-800 flex items-center gap-2"><Building2 size={20}/> تنظیم شماره‌های شروع - سال {editingYear.label}</h3>
                            <span className="text-[10px] text-gray-500 mt-1">
                                شماره شروع اسناد برای هر شرکت در این سال مالی را وارد کنید. اگر می‌خواهید ادامه سال قبل باشد، آخرین شماره سال قبل + ۱ را وارد کنید.
                                <br/>
                                <span className="text-green-600 font-bold">نکته: شماره‌های فعلی سیستم به صورت پیش‌فرض در فیلدها قرار گرفته‌اند.</span>
                            </span>
                        </div>
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
                                    const conf = companyConfig[c.name] || { pay: '1', exit: '1', bijak: '1' };
                                    return (
                                        <tr key={c.id} className="hover:bg-indigo-50/30">
                                            <td className="p-3 font-bold">{c.name}</td>
                                            <td className="p-3">
                                                <input 
                                                    type="number" 
                                                    className="w-full border rounded p-1 text-center dir-ltr focus:border-indigo-500 outline-none"
                                                    value={conf.pay}
                                                    onChange={e => setCompanyConfig({...companyConfig, [c.name]: { ...conf, pay: e.target.value }})}
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input 
                                                    type="number" 
                                                    className="w-full border rounded p-1 text-center dir-ltr focus:border-indigo-500 outline-none"
                                                    value={conf.exit}
                                                    onChange={e => setCompanyConfig({...companyConfig, [c.name]: { ...conf, exit: e.target.value }})}
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input 
                                                    type="number" 
                                                    className="w-full border rounded p-1 text-center dir-ltr focus:border-indigo-500 outline-none"
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
                </div>
            )}
        </div>
    );
};