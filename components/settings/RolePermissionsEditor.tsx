
import React, { useState } from 'react';
import { SystemSettings, UserRole, RolePermissions, CustomRole } from '../../types';
import { ShieldCheck, Truck, Warehouse, Lock, ChevronDown, ChevronUp, Landmark, Trash2, CheckSquare, Square, Info } from 'lucide-react';

interface Props {
    settings: SystemSettings;
    onUpdateSettings: (newSettings: SystemSettings) => void;
}

const PERMISSION_GROUPS = [
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
        id: 'exit', 
        title: 'ماژول خروج کارخانه', 
        icon: Truck, 
        color: 'orange', 
        items: [
            { id: 'canCreateExitPermit', label: 'ثبت درخواست خروج بار (فروش)' },
            { id: 'canViewExitPermits', label: 'مشاهده کارتابل خروج' },
            { id: 'canApproveExitCeo', label: 'تایید خروج (مدیرعامل)' },
            { id: 'canApproveExitFactory', label: 'تایید خروج (مدیر کارخانه)' },
            { id: 'canApproveExitWarehouse', label: 'تایید خروج (سرپرست انبار/توزین)' },
            { id: 'canApproveExitSecurity', label: 'تایید خروج (انتظامات - نهایی)' },
            { id: 'canViewExitArchive', label: 'مشاهده بایگانی خروج' },
            { id: 'canEditExitArchive', label: 'اصلاح اسناد بایگانی (Admin)' }
        ] 
    }, 
    { 
        id: 'warehouse', 
        title: 'ماژول انبار', 
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
            { id: 'canEditOwn', label: 'ویرایش دستور خود' },
            { id: 'canDeleteOwn', label: 'حذف دستور خود' },
            { id: 'canEditAll', label: 'ویرایش تمام دستورات' },
            { id: 'canDeleteAll', label: 'حذف تمام دستورات' },
            { id: 'canManageTrade', label: 'دسترسی به بخش بازرگانی' },
            { id: 'canManageSettings', label: 'دسترسی به تنظیمات سیستم' }
        ] 
    }
];

const DEFAULT_ROLES = [
    { id: UserRole.USER, label: 'کاربر عادی' },
    { id: UserRole.FINANCIAL, label: 'مدیر مالی' },
    { id: UserRole.MANAGER, label: 'مدیر داخلی' },
    { id: UserRole.CEO, label: 'مدیر عامل' },
    { id: UserRole.SALES_MANAGER, label: 'مدیر فروش' },
    { id: UserRole.FACTORY_MANAGER, label: 'مدیر کارخانه' },
    { id: UserRole.WAREHOUSE_KEEPER, label: 'انبار واردات' },
    { id: UserRole.SECURITY_HEAD, label: 'سرپرست انتظامات' },
    { id: UserRole.SECURITY_GUARD, label: 'نگهبان' },
    { id: UserRole.ADMIN, label: 'مدیر سیستم' },
];

// Helper to determine if a permission is forced-enabled by system logic
const isForcedSystemPermission = (roleId: string, permId: string): boolean => {
    if (roleId === UserRole.FACTORY_MANAGER && permId === 'canApproveExitFactory') return true;
    if (roleId === UserRole.WAREHOUSE_KEEPER && permId === 'canApproveExitWarehouse') return true;
    if (roleId === UserRole.SECURITY_HEAD && permId === 'canApproveExitSecurity') return true;
    if (roleId === UserRole.CEO && permId === 'canApproveExitCeo') return true;
    return false;
};

const RolePermissionsEditor: React.FC<Props> = ({ settings, onUpdateSettings }) => {
    const [expandedRole, setExpandedRole] = useState<string | null>(null);
    const [newRoleName, setNewRoleName] = useState('');

    const allRoles = [...DEFAULT_ROLES, ...(settings.customRoles || [])];

    const toggleExpand = (roleId: string) => {
        setExpandedRole(prev => prev === roleId ? null : roleId);
    };

    const handlePermissionChange = (roleId: string, permKey: string, value: boolean) => {
        // Prevent disabling forced permissions
        if (isForcedSystemPermission(roleId, permKey)) return;

        const currentRolePerms = settings.rolePermissions?.[roleId] || {};
        const updatedRolePerms = { ...currentRolePerms, [permKey]: value };
        const newSettings = { ...settings, rolePermissions: { ...settings.rolePermissions, [roleId]: updatedRolePerms } };
        onUpdateSettings(newSettings);
    };

    const toggleGroup = (roleId: string, groupItems: {id: string}[], isChecked: boolean) => {
        const currentRolePerms = settings.rolePermissions?.[roleId] || {};
        const updatedRolePerms = { ...currentRolePerms };
        
        groupItems.forEach(item => {
             // Skip forced permissions
             if (isForcedSystemPermission(roleId, item.id)) {
                 // @ts-ignore
                 updatedRolePerms[item.id] = true;
             } else {
                 // @ts-ignore
                 updatedRolePerms[item.id] = isChecked;
             }
        });

        const newSettings = { ...settings, rolePermissions: { ...settings.rolePermissions, [roleId]: updatedRolePerms } };
        onUpdateSettings(newSettings);
    };

    const handleAddRole = () => {
        if (!newRoleName.trim()) return;
        const roleId = `role_${Date.now()}`;
        const newRole: CustomRole = { id: roleId, label: newRoleName.trim() };
        const newSettings = { ...settings, customRoles: [...(settings.customRoles || []), newRole] };
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
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
                <Info className="text-blue-600 shrink-0 mt-1" size={20}/>
                <div className="text-sm text-blue-800">
                    <p className="font-bold mb-1">راهنمای سطح دسترسی:</p>
                    <p>دسترسی‌های کلیدی نقش‌های سیستمی (مثل تایید مدیر کارخانه) به صورت <strong>خودکار و دائمی</strong> فعال هستند و نیازی به تنظیم دستی ندارند (آیکون قفل سبز).</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row gap-4 items-end shadow-sm">
                <div className="flex-1 w-full space-y-1">
                    <label className="text-xs font-bold text-gray-500">افزودن نقش سفارشی جدید</label>
                    <input className="w-full border rounded-lg p-2 text-sm focus:border-blue-500 outline-none transition-colors" placeholder="نام نقش..." value={newRoleName} onChange={e => setNewRoleName(e.target.value)} />
                </div>
                <button type="button" onClick={handleAddRole} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-700 h-[38px] w-full md:w-auto">افزودن نقش</button>
            </div>

            <div className="space-y-3">
                {allRoles.map(role => (
                    <div key={role.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                        <div className={`p-4 flex justify-between items-center cursor-pointer select-none transition-colors ${expandedRole === role.id ? 'bg-blue-50' : 'bg-gray-50 hover:bg-gray-100'}`} onClick={() => toggleExpand(role.id)}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${role.id === UserRole.ADMIN ? 'bg-red-100 text-red-600' : 'bg-white border text-gray-600'}`}><ShieldCheck size={20}/></div>
                                <div><span className="font-bold text-gray-800 block">{role.label}</span><span className="text-[10px] text-gray-500 font-mono">{role.id}</span></div>
                            </div>
                            <div className="flex items-center gap-2">
                                {!Object.values(UserRole).includes(role.id as any) && (<button onClick={(e) => { e.stopPropagation(); handleRemoveRole(role.id); }} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition-colors"><Trash2 size={16}/></button>)}
                                {expandedRole === role.id ? <ChevronUp size={20} className="text-blue-600"/> : <ChevronDown size={20} className="text-gray-400"/>}
                            </div>
                        </div>
                        
                        {expandedRole === role.id && (
                            <div className="p-4 bg-white border-t border-gray-100 animate-fade-in">
                                {role.id === UserRole.ADMIN ? (
                                    <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm font-bold text-center border border-red-100 flex items-center justify-center gap-2"><Lock size={16}/> مدیر سیستم دسترسی کامل به تمامی بخش‌ها دارد.</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {PERMISSION_GROUPS.map(group => {
                                            const GroupIcon = group.icon;
                                            const rolePerms = settings.rolePermissions?.[role.id] || {};
                                            // @ts-ignore
                                            const isGroupAllChecked = group.items.every(item => isForcedSystemPermission(role.id, item.id) || rolePerms[item.id]);

                                            return (
                                                <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                                    <div className={`px-4 py-2 bg-${group.color}-50 border-b border-${group.color}-100 flex justify-between items-center`}>
                                                        <div className="flex items-center gap-2 text-sm font-bold text-gray-700"><GroupIcon size={16} className={`text-${group.color}-600`}/>{group.title}</div>
                                                        <label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" className="hidden" checked={isGroupAllChecked} onChange={(e) => toggleGroup(role.id, group.items, e.target.checked)}/><span className="text-[10px] text-blue-600 hover:underline">{isGroupAllChecked ? 'لغو همه' : 'انتخاب همه'}</span></label>
                                                    </div>
                                                    <div className="p-2 space-y-1">
                                                        {group.items.map(perm => {
                                                            const isForced = isForcedSystemPermission(role.id, perm.id);
                                                            // @ts-ignore
                                                            const isChecked = isForced || !!rolePerms[perm.id];
                                                            
                                                            return (
                                                                <div key={perm.id} className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${isChecked ? 'bg-green-50' : 'hover:bg-gray-50'}`} onClick={() => !isForced && handlePermissionChange(role.id, perm.id, !isChecked)}>
                                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'} ${isForced ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                                        {isChecked && (isForced ? <Lock size={12} className="text-white"/> : <CheckSquare size={14} className="text-white"/>)}
                                                                    </div>
                                                                    <span className={`text-xs select-none ${isChecked ? 'text-gray-800 font-bold' : 'text-gray-600'} ${isForced ? 'text-green-700' : ''}`}>{perm.label} {isForced && '(سیستمی)'}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RolePermissionsEditor;
