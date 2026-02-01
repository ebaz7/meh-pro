
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

/**
 * REWRITTEN PERMISSION LOGIC (FAILSAFE)
 * 1. Admin gets everything.
 * 2. System Roles get HARDCODED defaults.
 * 3. DB Settings are MERGED on top, ensuring defaults are never lost.
 */
export const getRolePermissions = (userRole: string, settings: SystemSettings | null, userObject?: User): RolePermissions => {
    
    // --- 1. ADMIN OVERRIDE ---
    if (userRole === UserRole.ADMIN) {
        return {
            canViewAll: true, canCreatePaymentOrder: true, canViewPaymentOrders: true, canApproveFinancial: true, canApproveManager: true, canApproveCeo: true, canEditOwn: true, canEditAll: true, canDeleteOwn: true, canDeleteAll: true, canManageTrade: true, canManageSettings: true,
            canCreateExitPermit: true, canViewExitPermits: true, canApproveExitCeo: true, canApproveExitFactory: true, canApproveExitWarehouse: true, canApproveExitSecurity: true, canViewExitArchive: true, canEditExitArchive: true,
            canManageWarehouse: true, canViewWarehouseReports: true, canApproveBijak: true,
            canViewSecurity: true, canCreateSecurityLog: true, canApproveSecuritySupervisor: true
        };
    }

    // --- 2. DEFINE SYSTEM DEFAULTS (The Safety Net) ---
    // These permissions exist regardless of what is saved in the database settings.
    let basePerms: RolePermissions = {
        canViewAll: false,
        canEditOwn: true, 
        canDeleteOwn: true,
        // Default all criticals to false, enable in switch
        canApproveExitCeo: false,
        canApproveExitFactory: false,
        canApproveExitWarehouse: false,
        canApproveExitSecurity: false
    };

    switch (userRole) {
        case UserRole.CEO:
            basePerms.canViewAll = true;
            basePerms.canViewPaymentOrders = true;
            basePerms.canApproveCeo = true;
            basePerms.canViewExitPermits = true;
            basePerms.canApproveExitCeo = true; // CEO can approve Exit Step 1
            basePerms.canManageTrade = true;
            basePerms.canApproveBijak = true;
            basePerms.canViewSecurity = true;
            break;

        case UserRole.FINANCIAL:
            basePerms.canCreatePaymentOrder = true;
            basePerms.canViewPaymentOrders = true;
            basePerms.canApproveFinancial = true;
            break;

        case UserRole.MANAGER:
            basePerms.canCreatePaymentOrder = true;
            basePerms.canViewPaymentOrders = true;
            basePerms.canApproveManager = true;
            basePerms.canViewExitPermits = true; 
            break;

        case UserRole.SALES_MANAGER:
            basePerms.canCreatePaymentOrder = true;
            basePerms.canCreateExitPermit = true; // Sales creates request
            basePerms.canViewExitPermits = true;
            break;

        case UserRole.FACTORY_MANAGER:
            basePerms.canViewExitPermits = true;
            basePerms.canApproveExitFactory = true; // Factory Manager approves Step 2
            basePerms.canViewSecurity = true;
            break;

        case UserRole.WAREHOUSE_KEEPER:
            basePerms.canViewExitPermits = true;
            basePerms.canApproveExitWarehouse = true; // Warehouse approves Step 3
            basePerms.canManageWarehouse = true;
            break;

        case UserRole.SECURITY_HEAD:
            basePerms.canViewExitPermits = true;
            basePerms.canApproveExitSecurity = true; // Security approves Step 4 (Final)
            basePerms.canViewSecurity = true;
            basePerms.canApproveSecuritySupervisor = true;
            break;
            
        case UserRole.SECURITY_GUARD:
            basePerms.canViewSecurity = true;
            basePerms.canCreateSecurityLog = true;
            break;
            
        case UserRole.USER:
            basePerms.canCreatePaymentOrder = true;
            break;
    }

    // --- 3. MERGE DATABASE SETTINGS ---
    // Critical Fix: Merge settings ON TOP of defaults instead of replacing them.
    if (settings && settings.rolePermissions && settings.rolePermissions[userRole]) {
        const dbPerms = settings.rolePermissions[userRole];
        basePerms = { ...basePerms, ...dbPerms };
    }

    // --- 4. USER SPECIFIC FLAGS ---
    if (userObject?.canManageTrade) {
        basePerms.canManageTrade = true;
    }

    return basePerms;
};
