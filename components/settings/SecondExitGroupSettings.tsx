
import React from 'react';
import { SystemSettings, Contact, ExitPermitStatus } from '../../types';
import { Users, CheckSquare, Square } from 'lucide-react';

interface Props {
    settings: SystemSettings;
    setSettings: (s: SystemSettings) => void;
    contacts: Contact[];
}

const SecondExitGroupSettings: React.FC<Props> = ({ settings, setSettings, contacts }) => {
    
    const config = settings.exitPermitSecondGroupConfig || { groupId: '', activeStatuses: [] };

    const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newConfig = { ...config, groupId: e.target.value };
        setSettings({ ...settings, exitPermitSecondGroupConfig: newConfig });
    };

    const toggleStatus = (status: string) => {
        let newStatuses = [...config.activeStatuses];
        if (newStatuses.includes(status)) {
            newStatuses = newStatuses.filter(s => s !== status);
        } else {
            newStatuses.push(status);
        }
        const newConfig = { ...config, activeStatuses: newStatuses };
        setSettings({ ...settings, exitPermitSecondGroupConfig: newConfig });
    };

    const statusOptions = [
        { value: ExitPermitStatus.PENDING_FACTORY, label: 'پس از تایید مدیرعامل (ارسال به کارخانه)' },
        { value: ExitPermitStatus.PENDING_WAREHOUSE, label: 'پس از تایید مدیر کارخانه (ارسال به انبار)' },
        { value: ExitPermitStatus.PENDING_SECURITY, label: 'پس از تایید انبار (ارسال به انتظامات)' },
        { value: ExitPermitStatus.EXITED, label: 'خروج نهایی (تایید انتظامات)' },
    ];

    return (
        <div className="mt-4 border-t-2 border-orange-200 pt-4 bg-orange-100/50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2 text-orange-900 font-bold text-sm">
                <Users size={18}/>
                تنظیمات گروه دوم (ارسال سفارشی)
            </div>
            
            <div className="mb-3">
                <label className="text-xs font-bold text-gray-700 block mb-1">انتخاب گروه/شخص دوم:</label>
                <select 
                    className="w-full border rounded-lg p-2 text-sm bg-white" 
                    value={config.groupId} 
                    onChange={handleGroupChange}
                >
                    <option value="">-- غیرفعال --</option>
                    {contacts.map(c => (
                        <option key={`sec_group_${c.number}`} value={c.number}>
                            {c.name} {c.isGroup ? '(گروه)' : ''}
                        </option>
                    ))}
                </select>
            </div>

            {config.groupId && (
                <div>
                    <label className="text-xs font-bold text-gray-700 block mb-2">در چه مراحلی پیام ارسال شود؟</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {statusOptions.map(opt => {
                            const isChecked = config.activeStatuses.includes(opt.value);
                            return (
                                <div 
                                    key={opt.value} 
                                    onClick={() => toggleStatus(opt.value)}
                                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${isChecked ? 'bg-orange-200 border-orange-400' : 'bg-white border-gray-300'}`}
                                >
                                    {isChecked ? <CheckSquare size={16} className="text-orange-700"/> : <Square size={16} className="text-gray-400"/>}
                                    <span className="text-xs text-gray-800">{opt.label}</span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">
                        * پیام فقط در مراحل انتخاب شده برای این گروه ارسال خواهد شد.
                    </p>
                </div>
            )}
        </div>
    );
};

export default SecondExitGroupSettings;
