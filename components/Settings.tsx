
import React, { useState, useEffect } from 'react';
import { SystemSettings, User } from '../types';
import { getSettings, saveSettings } from '../services/storageService';
import { getUsers } from '../services/authService';
import { Truck, Save } from 'lucide-react';
import { FiscalYearManager } from './FiscalModule';

const Settings: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        getSettings().then(setSettings);
        getUsers().then(setUsers);
    }, []);

    const handleSave = async () => {
        if(settings) {
            await saveSettings(settings);
            alert('تنظیمات ذخیره شد');
        }
    }

    if (!settings) return <div>Loading...</div>;

    const getMergedContactOptions = () => {
       const userContacts = users.filter(u => u.phoneNumber).map(u => ({ name: u.fullName, number: u.phoneNumber!, isGroup: false }));
       const saved = settings.savedContacts || [];
       return [...userContacts, ...saved];
    };

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-gray-800 border-b pb-4">تنظیمات سیستم</h1>
            
            <section>
                <h2 className="text-xl font-semibold mb-4 text-gray-700">سال‌های مالی</h2>
                <FiscalYearManager />
            </section>
            
            <section className="bg-orange-50 p-6 rounded-xl border border-orange-200">
                <h3 className="font-bold text-orange-800 mb-4 flex items-center gap-2"><Truck size={20}/> تنظیمات خروج کارخانه</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-2">شماره موبایل سرپرست انبار (جهت مجوز خروج)</label>
                        <select 
                            className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-orange-200 outline-none" 
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
                        <p className="text-xs text-gray-500 mt-1">پس از تایید مجوز خروج توسط مدیرعامل، تصویر مجوز به این شخص/گروه (سرپرست انبار) ارسال خواهد شد.</p>
                    </div>
                    
                    <div className="border-t border-orange-200 pt-4">
                        <label className="text-sm font-bold text-gray-700 block mb-2">گروه دوم جهت اطلاع‌رسانی (اختیاری)</label>
                        <select 
                            className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-orange-200 outline-none" 
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
                        <p className="text-xs text-gray-500 mt-1">یک کپی از مجوز خروج همزمان به این گروه نیز ارسال خواهد شد (مثلاً گروه مدیریت یا حسابداری).</p>
                    </div>
                </div>
            </section>

            <div className="flex justify-end pt-4">
                <button onClick={handleSave} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg flex items-center gap-2">
                    <Save size={20}/> ذخیره تنظیمات
                </button>
            </div>
        </div>
    )
}
export default Settings;
