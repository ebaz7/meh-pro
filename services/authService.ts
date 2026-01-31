
import { User, UserRole, SystemSettings, RolePermissions } from '../types';
import { apiCall } from './apiService';

const CURRENT_USER_KEY = 'app_current_user';

export const getUsers = async (): Promise<User[]> => {
    return await apiCall<User[]>('/users');
};

export const saveUser = async (user: User): Promise<User[]> => {
    return await apiCall<User[]>('/users', 'POST', user);
};

export const updateUser = async (user: User): Promise<User[]> => {
    return await apiCall<User[]>(`/users/${user.id}`, 'PUT', user);
};

export const deleteUser = async (id: string): Promise<User[]> => {
    return await apiCall<User[]>(`/users/${id}`, 'DELETE');
};

export const login = async (username: string, password: string): Promise<User | null> => {
    const user = await apiCall<User>('/login', 'POST', { username, password });
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    return user;
};

export const logout = (): void => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): User | null => {
  const stored = localStorage.getItem(CURRENT_USER_KEY);
  return stored ? JSON.parse(stored) : null;
};

export const hasPermission = (user: User | null, permissionType: string): boolean => {
  if (!user) return false;
  if (permissionType === 'manage_users') return user.role === UserRole.ADMIN;
  return false;
};

export const getRolePermissions = (userRole: string, settings: SystemSettings | null, userObject?: User): RolePermissions => {
    // 1. Define Boolean Flags for Standard Roles
    const isAdmin = userRole === UserRole.ADMIN;
    const isCeo = userRole === UserRole.CEO;
    const isManager = userRole === UserRole.MANAGER;
    const isFinancial = userRole === UserRole.FINANCIAL;
    const isSales = userRole === UserRole.SALES_MANAGER;
    const isFactory = userRole === UserRole.FACTORY_MANAGER;
    const isWarehouse = userRole === UserRole.WAREHOUSE_KEEPER;
    const isSecurityHead = userRole === UserRole.SECURITY_HEAD;
    const isSecurityGuard = userRole === UserRole.SECURITY_GUARD;
    const isSecurity = isSecurityHead || isSecurityGuard;
    const isStandardRole = Object.values(UserRole).includes(userRole as UserRole);

    // 2. Define Base Permissions
    let perms: RolePermissions = {
        // --- General ---
        canViewAll: isStandardRole && (isAdmin || isCeo || isManager || isFinancial),
        canEditOwn: true,
        canDeleteOwn: true,
        canEditAll: isAdmin || isCeo,
        canDeleteAll: isAdmin,
        
        // --- Payment Module ---
        canCreatePaymentOrder: isStandardRole && (isAdmin || isCeo || isManager || isFinancial || isSales || userRole === UserRole.USER), 
        canViewPaymentOrders: isStandardRole && (isAdmin || isCeo || isManager || isFinancial),
        canApproveFinancial: isAdmin || isFinancial,
        canApproveManager: isAdmin || isManager,
        canApproveCeo: isAdmin || isCeo,
        
        // --- Trade Module ---
        canManageTrade: isAdmin || isCeo || isManager || (userObject?.canManageTrade === true),
        canManageSettings: isAdmin,
        
        // --- EXIT PERMIT MODULE (Fixed Logic) ---
        // Creation: Sales, Admin, CEO, Manager
        canCreateExitPermit: isAdmin || isCeo || isManager || isSales,
        
        // View: Must be visible to EVERYONE in the chain
        canViewExitPermits: isAdmin || isCeo || isManager || isSales || isFactory || isWarehouse || isSecurity,
        
        // Approval Steps (Explicitly linked to Roles)
        canApproveExitCeo: isAdmin || isCeo,
        canApproveExitFactory: isAdmin || isFactory,
        canApproveExitWarehouse: isAdmin || isWarehouse,
        canApproveExitSecurity: isAdmin || isSecurity,
        
        // Archive
        canViewExitArchive: isAdmin || isCeo || isFactory || isWarehouse || isSecurityHead,
        canEditExitArchive: isAdmin,

        // --- WAREHOUSE MODULE ---
        canManageWarehouse: isAdmin || isWarehouse, 
        canViewWarehouseReports: isAdmin || isWarehouse || isFactory || isCeo || isSales || isManager,
        canApproveBijak: isAdmin || isCeo,

        // --- SECURITY MODULE ---
        canViewSecurity: isAdmin || isCeo || isFactory || isSecurity,
        canCreateSecurityLog: isAdmin || isSecurity,
        canApproveSecuritySupervisor: isAdmin || isSecurityHead
    };

    // 3. Merge with Settings (Allow override from UI)
    if (settings && settings.rolePermissions && settings.rolePermissions[userRole]) {
        // We spread settings over defaults, so if a checkbox is unchecked in settings, it stays false.
        // But if it's undefined in settings, the default above applies.
        perms = { ...perms, ...settings.rolePermissions[userRole] };
    }

    // 4. Admin Override (Always True)
    if (isAdmin) {
        Object.keys(perms).forEach(k => { (perms as any)[k] = true; });
    }
    
    return perms;
};
