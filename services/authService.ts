
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
 * CORE PERMISSION LOGIC - BUG FIXED
 * Issue: DB settings were overwriting system defaults with 'false'.
 * Fix: Explicitly re-enable critical permissions AFTER merging DB settings.
 */
export const getRolePermissions = (userRole: string, settings: SystemSettings | null, userObject?: User): RolePermissions => {
    
    // 1. Initialize with Admin Override (Super User)
    if (userRole === UserRole.ADMIN) {
        return {
            canViewAll: true, canCreatePaymentOrder: true, canViewPaymentOrders: true, canApproveFinancial: true, canApproveManager: true, canApproveCeo: true, canEditOwn: true, canEditAll: true, canDeleteOwn: true, canDeleteAll: true, canManageTrade: true, canManageSettings: true,
            canCreateExitPermit: true, canViewExitPermits: true, canApproveExitCeo: true, canApproveExitFactory: true, canApproveExitWarehouse: true, canApproveExitSecurity: true, canViewExitArchive: true, canEditExitArchive: true,
            canManageWarehouse: true, canViewWarehouseReports: true, canApproveBijak: true,
            canViewSecurity: true, canCreateSecurityLog: true, canApproveSecuritySupervisor: true
        };
    }

    // 2. Define Base Defaults (Fallback)
    let perms: RolePermissions = {
        canViewAll: false,
        canEditOwn: true,
        canDeleteOwn: true,
        // Exit Permit Defaults - Default to false unless specified
        canApproveExitCeo: false,
        canApproveExitFactory: false,
        canApproveExitWarehouse: false,
        canApproveExitSecurity: false,
    };

    // 3. Apply Database Settings (This might contain 'false' values that caused the bug)
    if (settings && settings.rolePermissions && settings.rolePermissions[userRole]) {
        perms = { ...perms, ...settings.rolePermissions[userRole] };
    }

    // 4. FORCE CRITICAL PERMISSIONS (The Fix)
    // We override whatever is in the DB/Defaults for these specific system roles
    // to ensure the buttons NEVER disappear for them.

    switch (userRole) {
        case UserRole.CEO:
            perms.canViewAll = true;
            perms.canViewPaymentOrders = true;
            perms.canApproveCeo = true;
            perms.canViewExitPermits = true;
            perms.canApproveExitCeo = true; // FORCE TRUE
            perms.canManageTrade = true;
            perms.canApproveBijak = true;
            perms.canViewSecurity = true;
            break;

        case UserRole.FACTORY_MANAGER:
            perms.canViewExitPermits = true;
            perms.canApproveExitFactory = true; // FORCE TRUE
            perms.canViewSecurity = true;
            break;

        case UserRole.WAREHOUSE_KEEPER:
            perms.canViewExitPermits = true;
            perms.canApproveExitWarehouse = true; // FORCE TRUE
            perms.canManageWarehouse = true;
            break;

        case UserRole.SECURITY_HEAD:
            perms.canViewExitPermits = true;
            perms.canApproveExitSecurity = true; // FORCE TRUE
            perms.canViewSecurity = true;
            perms.canApproveSecuritySupervisor = true;
            break;
            
        // ... Other roles keep their merged permissions
        case UserRole.FINANCIAL:
            perms.canCreatePaymentOrder = true;
            perms.canViewPaymentOrders = true;
            perms.canApproveFinancial = true;
            break;

        case UserRole.MANAGER:
            perms.canCreatePaymentOrder = true;
            perms.canViewPaymentOrders = true;
            perms.canApproveManager = true;
            perms.canViewExitPermits = true;
            break;

        case UserRole.SALES_MANAGER:
            perms.canCreatePaymentOrder = true;
            perms.canCreateExitPermit = true;
            perms.canViewExitPermits = true;
            break;
            
        case UserRole.SECURITY_GUARD:
            perms.canViewSecurity = true;
            perms.canCreateSecurityLog = true;
            break;
    }

    // 5. User Specific Flags
    if (userObject?.canManageTrade) {
        perms.canManageTrade = true;
    }

    return perms;
};
