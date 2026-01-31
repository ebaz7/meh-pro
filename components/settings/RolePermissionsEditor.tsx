
import React, { useState } from 'react';
import { SystemSettings, UserRole, CustomRole } from '../../types';
import { ShieldCheck, Truck, Warehouse, Lock, ChevronDown, ChevronUp, Landmark, Trash2, CheckSquare, Square, Info, AlertTriangle } from 'lucide-react';

interface Props {
    settings: SystemSettings;
    onUpdateSettings: (newSettings: SystemSettings) => void;
}

// DEFINITION OF ALL PERMISSION KEYS
const PERMISSION_GROUPS = [
    { 
        id: 'exit', 
        title: 'ماژول خروج کارخانه (مهم)', 
        icon: Truck, 
        color: 'orange', 
        items: [
            { id: 'canCreateExitPermit', label: 'ثبت درخواست خروج بار (فروش)' },
            { id: 'canViewExitPermits', label: 'مشاهده کارتابل خروج' },
            { id: 'canApproveExitCeo', label: 'تایید مرحله ۱: مدیرعامل' },
            { id: 'canApproveExitFactory', label: 'تایید مرحله ۲: مدیر کارخانه' },
            { id: 'canApproveExitWarehouse', label: 'تایید مرحله ۳: سرپرست انبار/توزین' },
            { id: 'canApproveExitSecurity', label: 'تایید مرحله ۴: انتظامات (خروج نهایی)' },
            { id: 'canViewExitArchive', label: 'مشاهده بایگانی خروج' },
        ] 
    }, 
    // ... Other groups ...
    { 
        id: 'payment', 
        title: 'ماژول پرداخت', 
        icon: Landmark, 
        color: 'blue', 
        items: [
            { id: 'canCreatePaymentOrder', label: 'ثبت دستور پرداخت جدید' },
            { id: 'canViewPaymentOrders', label: 'مشاهده کارتابل پرداخت' },
            { id: 'canApproveFinancial', label: 'تایید مرحله مالی' },
            { id: 'canApproveManager', label: 'تایید مرحله مدیریت' },
            { id: 'canApproveCeo', label: 'تایید مرحله نهایی (مدیرعامل)' }
        ] 
    }, 
    { 
        id: 'warehouse', 
        title: 'ماژول انبار (بیجک)', 
        icon: Warehouse, 
        color: 'green', 
        items: [
            { id: 'canManageWarehouse', label: 'مدیریت انبار (ورود/خروج)' },
            { id: 'canViewWarehouseReports', label: 'مشاهده گزارشات انبار' },
            { id: 'canApproveBijak', label: 'تایید نهایی بیجک (مدیریت)' }
        ] 
    }, 
    { 
        id: 'security', 
        title: 'ماژول انتظامات', 
        icon: ShieldCheck, 
        color: 'purple', 
        items: [
            { id: 'canViewSecurity', label: 'مشاهده ماژول انتظامات' },
            { id: 'canCreateSecurityLog', label: 'ثبت گزارشات (نگهبان)' },
            { id: 'canApproveSecuritySupervisor', label: 'تایید گزارشات (سرپرست)' }
        ] 
    }, 
    { 
        id: 'general', 
        title: 'عمومی و مدیریتی', 
        icon: Lock, 
        color: 'gray', 
        items: [
            { id: 'canViewAll', label: 'مشاهده تمام دستورات (همه کاربران)' },
            { id: 'canEditAll', label: 'ویرایش تمام دستورات' },
            { id: 'canDeleteAll', label: 'حذف تمام دستورات' },
            { id: 'canManageTrade', label: 'دسترسی به بخش بازرگانی' },
            { id: 'canManageSettings', label: 'دسترسی به تنظیمات سیستم' }
        ] 
    }
];

const DEFAULT_ROLES = [
    { id: UserRole.USER, label: 'کاربر عادی (User)' },
    { id: UserRole.FINANCIAL, label: 'مدیر مالی (Financial)' },
    { id: UserRole.MANAGER, label: 'مدیر داخلی (Manager)' },
    { id: UserRole.CEO, label: 'مدیر عامل (CEO)' },
    { id: UserRole.SALES_MANAGER, label: 'مدیر فروش (Sales)' },
    { id: UserRole.FACTORY_MANAGER, label: 'مدیر کارخانه (Factory Manager)' },
    { id: UserRole.WAREHOUSE_KEEPER, label: 'انبار (Warehouse Keeper)' },
    { id: UserRole.SECURITY_HEAD, label: 'سرپرست انتظامات (Security Head)' },
    { id: UserRole.SECURITY_GUARD, label: 'نگهبان (Guard)' },
    { id: UserRole.ADMIN, label: 'مدیر سیستم (Admin)' },
];

const RolePermissionsEditor: React.FC<Props> = ({ settings, onUpdateSettings }) => {
    const [expandedRole, setExpandedRole] = useState<string | null>(null);
    const [newRoleName, setNewRoleName] = useState('');

    const allRoles = [...DEFAULT_ROLES, ...(settings.customRoles || [])];

    // Toggle a single permission
    const togglePermission = (roleId: string, permKey: string) => {
        const currentRolePerms = settings.rolePermissions?.[roleId] || {};
        // If it was undefined, assume it was false (visual) -> toggle to true
        // NOTE: In backend authService, we might have defaults.
        // But here we explicitly save user intention.
        const currentValue = !!currentRolePerms[permKey];
        const newValue = !currentValue;
        
        const updatedRolePerms = {
            ...currentRolePerms,
            [permKey]: newValue
        };

        const newSettings = {
            ...settings,
            rolePermissions: {
                ...settings.rolePermissions,
                [roleId]: updatedRolePerms
            }
        };
        onUpdateSettings(newSettings);
    };

    const handleAddRole = () => {
        if (!newRoleName.trim()) return;
        const roleId = `role_${Date.now()}`;
        const newRole: CustomRole = { id: roleId, label: newRoleName.trim() };
        const newSettings = { 
            ...settings, 
            customRoles: [...(settings.customRoles || []), newRole] 
        };
        onUpdateSettings(newSettings);
        setNewRoleName('');
    };

    const handleRemoveRole = (roleId: string) => {
        if (!confirm("آیا از حذف این نقش اطمینان دارید؟")) return;
        const updatedRoles = (settings.customRoles || []).filter(r => r.id !== roleId);
        const updatedPermissions = { ...settings.rolePermissions };
        delete updatedPermissions[roleId];
        onUpdateSettings({ ...settings, customRoles: updatedRoles, rolePermissions: updatedPermissions });
    };

    return (
        <div className="space-y-6">
            <div className="bg-amber-50 border-r-4 border-amber-500 p-4 rounded-lg flex gap-3 shadow-sm">
                <AlertTriangle className="text-amber-600 shrink-0 mt-1" size={24}/>
                <div className="text-sm text-amber-900">
                    <p className="font-bold mb-1 text-lg">نکته مهم:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>نقش‌های سیستمی (مثل مدیر کارخانه) به‌صورت پیش‌فرض دسترسی‌های لازم را دارند.</li>
                        <li>اگر می‌خواهید دسترسی پیش‌فرض را <strong>قطع کنید</strong>، تیک آن را بردارید.</li>
                        <li>برای نقش‌های سفارشی، حتماً تیک‌های لازم را بزنید.</li>
                    </ul>
                </div>
            </div>

            <div className="flex gap-2">
                <input 
                    className="flex-1 border rounded-lg p-2 text-sm" 
                    placeholder="نام نقش سفارشی (مثال: حسابدار ارشد)" 
                    value={newRoleName} 
                    onChange={e => setNewRoleName(e.target.value)} 
                />
                <button onClick={handleAddRole} className="bg-blue-600 text-white px-4 rounded-lg text-sm font-bold">افزودن نقش</button>
            </div>

            <div className="space-y-4">
                {allRoles.map(role => {
                    const isSystemRole = Object.values(UserRole).includes(role.id as any);
                    
                    return (
                    <div key={role.id} className={`bg-white border-2 rounded-xl overflow-hidden transition-all ${expandedRole === role.id ? 'border-blue-500 shadow-lg' : 'border-gray-200'}`}>
                        <div 
                            className={`p-4 flex justify-between items-center cursor-pointer ${expandedRole === role.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                            onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${role.id === UserRole.ADMIN ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                    <ShieldCheck size={20}/>
                                </div>
                                <div>
                                    <span className="font-bold text-gray-800 text-lg">{role.label}</span>
                                    <span className="text-xs text-gray-500 font-mono block">{role.id}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {!isSystemRole && <button onClick={(e) => { e.stopPropagation(); handleRemoveRole(role.id); }} className="text-red-500 p-2 hover:bg-red-100 rounded"><Trash2 size={18}/></button>}
                                {expandedRole === role.id ? <ChevronUp size={20} className="text-blue-600"/> : <ChevronDown size={20} className="text-gray-400"/>}
                            </div>
                        </div>
                        
                        {expandedRole === role.id && (
                            <div className="p-6 bg-white border-t border-blue-100">
                                {role.id === UserRole.ADMIN ? (
                                    <div className="text-center text-red-600 font-bold bg-red-50 p-4 rounded">مدیر سیستم به همه چیز دسترسی دارد.</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {PERMISSION_GROUPS.map(group => (
                                            <div key={group.id} className={`border rounded-xl overflow-hidden ${group.id === 'exit' ? 'border-orange-300 shadow-sm' : 'border-gray-200'}`}>
                                                <div className={`px-4 py-3 border-b flex items-center gap-2 font-bold ${group.id === 'exit' ? 'bg-orange-100 text-orange-800' : `bg-${group.color}-50 text-${group.color}-800`}`}>
                                                    <group.icon size={18}/> {group.title}
                                                </div>
                                                <div className="p-3 space-y-2">
                                                    {group.items.map(perm => {
                                                        // Check if explicit setting exists
                                                        const explicitSetting = settings.rolePermissions?.[role.id]?.[perm.id];
                                                        // Determine visual state: if explicit setting exists use it, otherwise undefined (treated as false visually here for simplicity in custom roles)
                                                        const isChecked = !!explicitSetting;

                                                        return (
                                                            <div 
                                                                key={perm.id} 
                                                                className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${isChecked ? 'bg-green-100 border border-green-300' : 'hover:bg-gray-50 border border-transparent'}`}
                                                                onClick={() => togglePermission(role.id, perm.id)}
                                                            >
                                                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${isChecked ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-400'}`}>
                                                                    {isChecked && <CheckSquare size={14}/>}
                                                                </div>
                                                                <span className={`text-sm select-none ${isChecked ? 'text-green-900 font-bold' : 'text-gray-600'}`}>{perm.label}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )})}
            </div>
        </div>
    );
};

export default RolePermissionsEditor;
