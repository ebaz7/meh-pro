
import React, { useState, useEffect } from 'react';
import { SystemSettings, Company, Contact, UserRole } from '../types';
import { getSettings, saveSettings } from '../services/storageService';
import { FiscalYearManager } from './FiscalModule';
import { Truck, Save, Building2, User, Phone, Bell, Grid, MessageSquare, Database, Printer, Settings as SettingsIcon } from 'lucide-react';
import { generateUUID } from '../constants';

const Settings: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [activeCategory, setActiveCategory] = useState('general');
    
    // UI Local State for forms
    const [newCompanyName, setNewCompanyName] = useState('');
    const [newBankName, setNewBankName] = useState('');
    
    // Contact Form
    const [newContactName, setNewContactName] = useState('');
    const [newContactNumber, setNewContactNumber] = useState('');
    const [isContactGroup, setIsContactGroup] = useState(false);

    useEffect(() => {
        getSettings().then(setSettings);
    }, []);

    const handleSaveSettings = async () => {
        if (settings) {
            await saveSettings(settings);
            alert('تنظیمات با موفقیت ذخیره شد.');
        }
    };

    const handleAddCompany = () => {
        if (!newCompanyName.trim() || !settings) return;
        const newCompany: Company = { id: generateUUID(), name: newCompanyName, banks: [], showInWarehouse: true };
        setSettings({ ...settings, companies: [...(settings.companies || []), newCompany] });
        setNewCompanyName('');
    };

    const handleRemoveCompany = (id: string) => {
        if (!settings) return;
        if(confirm('آیا از حذف این شرکت اطمینان دارید؟')) {
            setSettings({ ...settings, companies: settings.companies?.filter(c => c.id !== id) });
        }
    };

    const handleAddBank = () => {
        if (!newBankName.trim() || !settings) return;
        setSettings({ ...settings, bankNames: [...(settings.bankNames || []), newBankName] });
        setNewBankName('');
    };

    const handleRemoveBank = (name: string) => {
        if (!settings) return;
        setSettings({ ...settings, bankNames: settings.bankNames?.filter(b => b !== name) });
    };

    const handleAddContact = () => {
        if (!newContactName.trim() || !newContactNumber.trim() || !settings) return;
        const newContact: Contact = { id: generateUUID(), name: newContactName, number: newContactNumber, isGroup: isContactGroup };
        setSettings({ ...settings, savedContacts: [...(settings.savedContacts || []), newContact] });
        setNewContactName('');
        setNewContactNumber('');
        setIsContactGroup(false);
    };

    const handleRemoveContact = (id: string) => {
        if (!settings) return;
        setSettings({ ...settings, savedContacts: settings.savedContacts?.filter(c => c.id !== id) });
    };

    if (!settings) return <div className="p-8 text-center text-gray-500">در حال بارگذاری تنظیمات...</div>;

    const getMergedContactOptions = () => settings.savedContacts || [];

    const tabs = [
        { id: 'general', label: 'عمومی', icon: SettingsIcon },
        { id: 'fiscal', label: 'سال مالی', icon: Calendar },
        { id: 'companies', label: 'شرکت‌ها', icon: Building2 },
        { id: 'warehouse', label: 'انبار و خروج', icon: Truck },
        { id: 'contacts', label: 'مخاطبین', icon: User },
        { id: 'backup', label: 'پشتیبان‌گیری', icon: Database },
    ];
    // Calendar icon import fix for tab list
    const Calendar = ({size}:{size:number}) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>;

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] animate-fade-in bg-gray-50 p-6 rounded-2xl border border-gray-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><SettingsIcon className="text-blue-600" /> تنظیمات سیستم</h2>
                <button onClick={handleSaveSettings} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-lg flex items-center gap-2"><Save size={20}/> ذخیره تغییرات</button>
            </div>

            <div className="flex flex-1 overflow-hidden gap-6">
                {/* Sidebar */}
                <div className="w-64 flex flex-col gap-2 bg-white rounded-xl shadow-sm p-2 overflow-y-auto">
                    {tabs.map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveCategory(tab.id)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-bold ${activeCategory === tab.id ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <tab.icon size={18}/>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 bg-white rounded-xl shadow-sm p-6 overflow-y-auto">
                    
                    {activeCategory === 'general' && (
                        <div className="space-y-6">
                            <h3 className="font-bold text-lg border-b pb-2">تنظیمات عمومی</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="text-sm font-bold block mb-1">نام شرکت پیش‌فرض</label><input className="w-full border rounded-lg p-2" value={settings.defaultCompany} onChange={e => setSettings({...settings, defaultCompany: e.target.value})} /></div>
                                <div><label className="text-sm font-bold block mb-1">شماره واتساپ مدیریتی (ارسال گزارشات)</label><input className="w-full border rounded-lg p-2 dir-ltr" value={settings.whatsappNumber || ''} onChange={e => setSettings({...settings, whatsappNumber: e.target.value})} placeholder="98912..." /></div>
                                <div><label className="text-sm font-bold block mb-1">شماره آغازین دستور پرداخت</label><input type="number" className="w-full border rounded-lg p-2 dir-ltr" value={settings.currentTrackingNumber} onChange={e => setSettings({...settings, currentTrackingNumber: parseInt(e.target.value)})} /></div>
                                <div><label className="text-sm font-bold block mb-1">شماره آغازین مجوز خروج</label><input type="number" className="w-full border rounded-lg p-2 dir-ltr" value={settings.currentExitPermitNumber} onChange={e => setSettings({...settings, currentExitPermitNumber: parseInt(e.target.value)})} /></div>
                            </div>
                        </div>
                    )}

                    {activeCategory === 'fiscal' && <FiscalYearManager />}

                    {activeCategory === 'companies' && (
                        <div className="space-y-6">
                            <h3 className="font-bold text-lg border-b pb-2">مدیریت شرکت‌ها و بانک‌ها</h3>
                            
                            <div className="bg-gray-50 p-4 rounded-xl border">
                                <h4 className="font-bold text-sm mb-3">افزودن شرکت جدید</h4>
                                <div className="flex gap-2">
                                    <input className="flex-1 border rounded-lg p-2" placeholder="نام شرکت..." value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} />
                                    <button onClick={handleAddCompany} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">افزودن</button>
                                </div>
                                <div className="mt-4 space-y-2">
                                    {settings.companies?.map(c => (
                                        <div key={c.id} className="flex justify-between items-center bg-white p-3 rounded border">
                                            <span className="font-bold">{c.name}</span>
                                            <div className="flex items-center gap-4">
                                                <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={c.showInWarehouse !== false} onChange={e => { const updated = settings.companies?.map(x => x.id === c.id ? {...x, showInWarehouse: e.target.checked} : x); setSettings({...settings, companies: updated}); }}/> نمایش در انبار</label>
                                                <button onClick={() => handleRemoveCompany(c.id)} className="text-red-500 hover:text-red-700 text-xs font-bold">حذف</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-xl border">
                                <h4 className="font-bold text-sm mb-3">بانک‌های طرف حساب (لیست کلی)</h4>
                                <div className="flex gap-2">
                                    <input className="flex-1 border rounded-lg p-2" placeholder="نام بانک..." value={newBankName} onChange={e => setNewBankName(e.target.value)} />
                                    <button onClick={handleAddBank} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold">افزودن</button>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {settings.bankNames?.map(b => (
                                        <div key={b} className="bg-white border px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                            {b} <button onClick={() => handleRemoveBank(b)} className="text-red-500 font-bold">×</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeCategory === 'warehouse' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                                <h3 className="font-bold text-orange-800 mb-3 flex items-center gap-2"><Truck size={20}/> تنظیمات خروج کارخانه</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-700 block mb-1">گروه اصلی اطلاع‌رسانی خروج (سرپرست انبار/گروه ۱)</label>
                                        <select 
                                            className="w-full border rounded-lg p-2 text-sm bg-white" 
                                            value={settings.exitPermitNotificationGroup || ''} 
                                            onChange={e => setSettings({...settings, exitPermitNotificationGroup: e.target.value})}
                                        >
                                            <option value="">-- ارسال نشود --</option>
                                            {getMergedContactOptions().map(c => (
                                                <option key={`exit_group_${c.number}`} value={c.number}>
                                                    {c.name} {c.isGroup ? '(گروه)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-700 block mb-1">گروه دوم اطلاع‌رسانی (اختیاری)</label>
                                        <select 
                                            className="w-full border rounded-lg p-2 text-sm bg-white" 
                                            value={settings.exitPermitNotificationGroup2 || ''} 
                                            onChange={e => setSettings({...settings, exitPermitNotificationGroup2: e.target.value})}
                                        >
                                            <option value="">-- ارسال نشود --</option>
                                            {getMergedContactOptions().map(c => (
                                                <option key={`exit_group2_${c.number}`} value={c.number}>
                                                    {c.name} {c.isGroup ? '(گروه)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-2">تصویر مجوز خروج پس از تایید مدیر کارخانه و همچنین پس از خروج نهایی به این گروه‌ها ارسال خواهد شد.</p>
                            </div>

                            <div className="bg-white p-4 rounded-xl border">
                                <h3 className="font-bold text-gray-800 mb-3">تنظیمات اطلاع‌رسانی بیجک (به تفکیک شرکت)</h3>
                                <div className="space-y-4">
                                    {settings.companies?.filter(c => c.showInWarehouse !== false).map(comp => {
                                        const config = settings.companyNotifications?.[comp.name] || {};
                                        return (
                                            <div key={comp.id} className="p-3 bg-gray-50 rounded border flex flex-col md:flex-row gap-4 items-center">
                                                <div className="w-40 font-bold text-sm">{comp.name}</div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] text-gray-500 block mb-1">مدیر فروش (جهت تایید)</label>
                                                    <select 
                                                        className="w-full border rounded p-1 text-sm bg-white"
                                                        value={config.salesManager || ''}
                                                        onChange={e => {
                                                            const newConfig = { ...config, salesManager: e.target.value };
                                                            const newCompanyNotifications = { ...settings.companyNotifications, [comp.name]: newConfig };
                                                            setSettings({ ...settings, companyNotifications: newCompanyNotifications });
                                                        }}
                                                    >
                                                        <option value="">-- انتخاب --</option>
                                                        {getMergedContactOptions().map(c => <option key={c.id} value={c.number}>{c.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] text-gray-500 block mb-1">گروه انبار (جهت صدور)</label>
                                                    <select 
                                                        className="w-full border rounded p-1 text-sm bg-white"
                                                        value={config.warehouseGroup || ''}
                                                        onChange={e => {
                                                            const newConfig = { ...config, warehouseGroup: e.target.value };
                                                            const newCompanyNotifications = { ...settings.companyNotifications, [comp.name]: newConfig };
                                                            setSettings({ ...settings, companyNotifications: newCompanyNotifications });
                                                        }}
                                                    >
                                                        <option value="">-- انتخاب --</option>
                                                        {getMergedContactOptions().map(c => <option key={c.id} value={c.number}>{c.name}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeCategory === 'contacts' && (
                        <div className="space-y-6">
                            <h3 className="font-bold text-lg border-b pb-2">دفترچه تلفن هوشمند (واتساپ)</h3>
                            <div className="bg-gray-50 p-4 rounded-xl border grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div className="md:col-span-1"><label className="text-xs font-bold block mb-1">نام مخاطب / گروه</label><input className="w-full border rounded p-2 text-sm" value={newContactName} onChange={e => setNewContactName(e.target.value)} /></div>
                                <div className="md:col-span-1"><label className="text-xs font-bold block mb-1">شماره / آیدی گروه</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={newContactNumber} onChange={e => setNewContactNumber(e.target.value)} placeholder="98912... or 1234@g.us" /></div>
                                <div className="flex items-center gap-2 pb-2"><input type="checkbox" checked={isContactGroup} onChange={e => setIsContactGroup(e.target.checked)} className="w-4 h-4"/> <span className="text-sm">این یک گروه است</span></div>
                                <button onClick={handleAddContact} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold h-[38px]">افزودن</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {settings.savedContacts?.map(c => (
                                    <div key={c.id} className="bg-white border p-3 rounded-lg flex justify-between items-center shadow-sm">
                                        <div>
                                            <div className="font-bold text-sm flex items-center gap-2">{c.name} {c.isGroup && <span className="text-[10px] bg-orange-100 text-orange-700 px-2 rounded">گروه</span>}</div>
                                            <div className="text-xs text-gray-500 font-mono">{c.number}</div>
                                        </div>
                                        <button onClick={() => handleRemoveContact(c.id)} className="text-red-500 hover:text-red-700"><X size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;
    