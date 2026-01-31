
import React, { useState } from 'react';
import { SystemSettings, UserRole, CustomRole } from '../../types';
import { ShieldCheck, Truck, Warehouse, Lock, Landmark, Trash2, Check, X, User, Shield, AlertCircle, Plus } from 'lucide-react';
import { getRolePermissions } from '../../services/authService';

interface Props {
    settings: SystemSettings;
    onUpdateSettings: (newSettings: SystemSettings) => void;
}

// DEFINITION OF ALL PERMISSION KEYS
const PERMISSION_GROUPS = [
    { 
        id: 'payment', 
        title: 'مدیریت پرداخت‌ها', 
        description: 'دسترسی‌های مربوط به ثبت و تایید دستور پرداخت',
        icon: Landmark, 
        color: 'text-blue-600 bg-blue-50', 
        items: [
            { id: 'canCreatePaymentOrder', label: 'ثبت دستور پرداخت' },
            { id: 'canViewPaymentOrders', label: 'مشاهده کارتابل پرداخت' },
            { id: 'canApproveFinancial', label: 'تایید مرحله ۱: مدیر مالی' },
            { id: 'canApproveManager', label: 'تایید مرحله ۲: مدیر داخلی' },
            { id: 'canApproveCeo', label: 'تایید مرحله ۳: مدیرعامل (نهایی)' }
        ] 
    }, 
    { 
        id: 'exit', 
        title: 'مدیریت خروج کالا', 
        description: 'چرخه مجوز خروج (فروش تا انتظامات)',
        icon: Truck, 
        color: 'text-orange-600 bg-orange-50', 
        items: [
            { id: 'canCreateExitPermit', label: 'ثبت درخواست خروج (فروش)' },
            { id: 'canViewExitPermits', label: 'مشاهده کارتابل خروج' },
            { id: 'canApproveExitCeo', label: 'تایید مرحله ۱: مدیرعامل' },
            { id: 'canApproveExitFactory', label: 'تایید مرحله ۲: مدیر کارخانه' },
            { id: 'canApproveExitWarehouse', label: 'تایید مرحله ۳: انبار/توزین' },
            { id: 'canApproveExitSecurity', label: 'تایید مرحله ۴: انتظامات (خروج)' },
            { id: 'canViewExitArchive', label: 'مشاهده آرشیو خروج' },
            { id: 'canEditExitArchive', label: 'ویرایش مجوزهای خارج شده (بایگانی)' }
        ] 
    }, 
    { 
        id: 'warehouse', 
        title: 'مدیریت انبار', 
        description: 'صدور بیجک و مدیریت موجودی',
        icon: Warehouse, 
        color: 'text-green-600 bg-green-50', 
        items: [
            { id: 'canManageWarehouse', label: 'مدیریت کامل انبار (ورود/خروج)' },
            { id: 'canViewWarehouseReports', label: 'مشاهده گزارشات موجودی' },
            { id: 'canApproveBijak', label: 'تایید نهایی بیجک (مدیریت)' }
        ] 
    }, 
    { 
        id: 'security', 
        title: 'انتظامات و حراست', 
        description: 'گزارشات ورود و خروج و وقایع',
        icon: ShieldCheck, 
        color: 'text-purple-600 bg-purple-50', 
        items: [
            { id: 'canViewSecurity', label: 'دسترسی به ماژول انتظامات' },
            { id: 'canCreateSecurityLog', label: 'ثبت گزارش روزانه (نگهبان)' },
            { id: 'canApproveSecuritySupervisor', label: 'تایید گزارشات (سرپرست)' }
        ] 
    }, 
    { 
        id: 'general', 
        title: 'عمومی و سیستم', 
        description: 'دسترسی‌های کلی و مدیریتی',
        icon: Lock, 
        color: 'text-gray-600 bg-gray-50', 
        items: [
            { id: 'canViewAll', label: 'مشاهده تمام درخواست‌ها (فارغ از ثبت کننده)' },
            { id: 'canEditOwn', label: 'ویرایش درخواست‌های خود' },
            { id: 'canEditAll', label: 'ویرایش تمام درخواست‌ها' },
            { id: 'canDeleteOwn', label: 'حذف درخواست‌های خود' },
            { id: 'canDeleteAll', label: 'حذف تمام درخواست‌ها' },
            { id: 'canManageTrade', label: 'دسترسی به ماژول بازرگانی' },
            { id: 'canManageSettings', label: 'دسترسی به تنظیمات سیستم' }
        ] 
    }
];

const SYSTEM_ROLES = [
    { id: UserRole.ADMIN, label: 'مدیر سیستم (Admin)', desc: 'دسترسی کامل به تمام بخش‌ها' },
    { id: UserRole.CEO, label: 'مدیر عامل (CEO)', desc: 'تایید نهایی پرداخت، خروج، بیجک' },
    { id: UserRole.MANAGER, label: 'مدیر داخلی (Manager)', desc: 'تایید مرحله دوم پرداخت' },
    { id: UserRole.FINANCIAL, label: 'مدیر مالی (Financial)', desc: 'ثبت و تایید اولیه پرداخت' },
    { id: UserRole.SALES_MANAGER, label: 'مدیر فروش (Sales)', desc: 'ثبت درخواست خروج' },
    { id: UserRole.FACTORY_MANAGER, label: 'مدیر کارخانه', desc: 'تایید خروج از کارخانه' },
    { id: UserRole.WAREHOUSE_KEEPER, label: 'انباردار (Warehouse)', desc: 'تایید تحویل بار (توزین)' },
    { id: UserRole.SECURITY_HEAD, label: 'سرپرست انتظامات', desc: 'مدیریت واحد حراست' },
    { id: UserRole.SECURITY_GUARD, label: 'نگهبان (Guard)', desc: 'ثبت وقایع روزانه' },
    { id: UserRole.USER, label: 'کاربر عادی (User)', desc: 'دسترسی محدود پایه' },
];

const RolePermissionsEditor: React.FC<Props> = ({ settings, onUpdateSettings }) => {
    const [selectedRole, setSelectedRole] = useState<string>(UserRole.USER);
    const [newRoleName, setNewRoleName] = useState('');

    const customRoles = settings.customRoles || [];
    
    // Calculate Effective Permissions for the SELECTED role
    // This uses the exact same logic as the app security check
    const effectivePermissions = getRolePermissions(selectedRole, settings);

    const handleToggle = (permKey: string) => {
        // We are toggling the *effective* state.
        // If effective is TRUE, we want to force it to FALSE.
        // If effective is FALSE, we want to force it to TRUE.
        
        const currentEffective = !!effectivePermissions[permKey as keyof typeof effectivePermissions];
        const newTargetValue = !currentEffective;

        const currentRoleSettings = settings.rolePermissions?.[selectedRole] || {};
        
        const updatedSettings = {
            ...settings,
            rolePermissions: {
                ...settings.rolePermissions,
                [selectedRole]: {
                    ...currentRoleSettings,
                    [permKey]: newTargetValue
                }
            }
        };
        
        onUpdateSettings(updatedSettings);
    };

    const handleAddRole = () => {
        if (!newRoleName.trim()) return;
        const roleId = `role_${Date.now()}`;
        const newRole: CustomRole = { id: roleId, label: newRoleName.trim() };
        onUpdateSettings({ 
            ...settings, 
            customRoles: [...customRoles, newRole] 
        });
        setNewRoleName('');
        setSelectedRole(roleId);
    };

    const handleDeleteRole = (roleId: string) => {
        if (!confirm('آیا از حذف این نقش اطمینان دارید؟')) return;
        const updatedRoles = customRoles.filter(r => r.id !== roleId);
        const updatedPerms = { ...settings.rolePermissions };
        delete updatedPerms[roleId];
        
        onUpdateSettings({ 
            ...settings, 
            customRoles: updatedRoles,
            rolePermissions: updatedPerms
        });
        setSelectedRole(UserRole.USER);
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 h-[600px]">
            {/* LEFT: Role List */}
            <div className="w-full md:w-1/3 bg-gray-50 border rounded-2xl flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-white">
                    <h3 className="font-bold text-gray-800 mb-1">لیست نقش‌ها</h3>
                    <p className="text-xs text-gray-500">نقش مورد نظر را انتخاب کنید</p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    <div className="px-2 py-1 text-xs font-bold text-gray-400 mt-2">نقش‌های سیستمی</div>
                    {SYSTEM_ROLES.map(role => (
                        <button
                            key={role.id}
                            onClick={() => setSelectedRole(role.id)}
                            className={`w-full text-right p-3 rounded-xl transition-all flex items-center justify-between group ${selectedRole === role.id ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-white hover:shadow-sm text-gray-700'}`}
                        >
                            <div>
                                <div className="font-bold text-sm">{role.label}</div>
                                <div className={`text-[10px] mt-0.5 ${selectedRole === role.id ? 'text-blue-200' : 'text-gray-400'}`}>{role.desc}</div>
                            </div>
                            {role.id === UserRole.ADMIN && <Shield size={16} className={selectedRole === role.id ? 'text-white' : 'text-purple-500'}/>}
                        </button>
                    ))}

                    <div className="px-2 py-1 text-xs font-bold text-gray-400 mt-4 border-t pt-2">نقش‌های سفارشی</div>
                    {customRoles.map(role => (
                        <div
                            key={role.id}
                            onClick={() => setSelectedRole(role.id)}
                            className={`w-full text-right p-3 rounded-xl transition-all flex items-center justify-between cursor-pointer group ${selectedRole === role.id ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-white hover:shadow-sm text-gray-700'}`}
                        >
                            <div className="font-bold text-sm">{role.label}</div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }} 
                                className={`p-1 rounded-full ${selectedRole === role.id ? 'hover:bg-indigo-500 text-indigo-200' : 'hover:bg-red-100 text-gray-400 hover:text-red-500'}`}
                            >
                                <Trash2 size={14}/>
                            </button>
                        </div>
                    ))}
                    
                    {customRoles.length === 0 && (
                        <div className="text-center text-xs text-gray-400 py-4 italic">هیچ نقش سفارشی تعریف نشده است</div>
                    )}
                </div>

                <div className="p-3 border-t bg-white">
                    <div className="flex gap-2">
                        <input 
                            className="flex-1 border rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white transition-colors outline-none focus:border-blue-500" 
                            placeholder="نام نقش جدید..." 
                            value={newRoleName}
                            onChange={e => setNewRoleName(e.target.value)}
                        />
                        <button onClick={handleAddRole} disabled={!newRoleName.trim()} className="bg-blue-100 text-blue-700 p-2 rounded-lg hover:bg-blue-200 disabled:opacity-50">
                            <Plus size={20}/>
                        </button>
                    </div>
                </div>
            </div>

            {/* RIGHT: Permissions Detail */}
            <div className="flex-1 bg-white border rounded-2xl flex flex-col overflow-hidden relative">
                
                {/* Header */}
                <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
                            <User size={20} className="text-blue-600"/>
                            دسترسی‌های: {SYSTEM_ROLES.find(r => r.id === selectedRole)?.label || customRoles.find(r => r.id === selectedRole)?.label}
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">تغییرات شما به صورت آنی روی تمام کاربران این نقش اعمال می‌شود.</p>
                    </div>
                    {selectedRole === UserRole.ADMIN && (
                        <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200 flex items-center gap-1">
                            <AlertCircle size={14}/>
                            دسترسی کامل (غیرقابل تغییر)
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {selectedRole === UserRole.ADMIN ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <Shield size={64} className="mb-4 text-red-100"/>
                            <p className="text-center max-w-xs leading-relaxed">مدیر سیستم (Admin) به تمام بخش‌های نرم‌افزار دسترسی کامل دارد و نیازی به تنظیمات دستی نیست.</p>
                        </div>
                    ) : (
                        PERMISSION_GROUPS.map(group => (
                            <div key={group.id} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                <div className={`px-4 py-3 flex items-center gap-3 border-b border-gray-100 ${group.color}`}>
                                    <group.icon size={20}/>
                                    <div>
                                        <h4 className="font-bold text-sm">{group.title}</h4>
                                        <p className="text-[10px] opacity-80">{group.description}</p>
                                    </div>
                                </div>
                                <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-2 bg-white">
                                    {group.items.map(perm => {
                                        // Use calculated effective permission
                                        const isChecked = !!effectivePermissions[perm.id as keyof typeof effectivePermissions];
                                        
                                        return (
                                            <div 
                                                key={perm.id} 
                                                onClick={() => handleToggle(perm.id)}
                                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${isChecked ? 'bg-green-50 border-green-200' : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'}`}
                                            >
                                                <div className={`w-10 h-6 rounded-full relative transition-colors ${isChecked ? 'bg-green-500' : 'bg-gray-300'}`}>
                                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${isChecked ? 'left-1 translate-x-0' : 'left-auto right-1'}`}></div>
                                                </div>
                                                <span className={`text-sm font-medium select-none ${isChecked ? 'text-green-800' : 'text-gray-500'}`}>
                                                    {perm.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default RolePermissionsEditor;
