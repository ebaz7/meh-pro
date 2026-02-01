
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
 * FIXED PERMISSION LOGIC
 * 1. Load DB Settings first.
 * 2. FORCE System Defaults to TRUE for specific roles.
 * This ensures that even if settings are saved incorrectly, core buttons never disappear.
 */
export const getRolePermissions = (userRole: string, settings: SystemSettings | null, userObject?: User): RolePermissions => {
    
    // 1. Start with Empty or DB Settings
    let perms: RolePermissions = {
        canViewAll: false,
        canEditOwn: true,
        canDeleteOwn: true,
        // ... defaults
    };

    // Apply DB settings if available
    if (settings && settings.rolePermissions && settings.rolePermissions[userRole]) {
        perms = { ...perms, ...settings.rolePermissions[userRole] };
    }

    // 2. FORCE SYSTEM DEFAULTS (Overrides DB if DB says false)
    // This solves the issue of buttons disappearing after saving settings.
    switch (userRole) {
        case UserRole.ADMIN:
            return {
                canViewAll: true, canCreatePaymentOrder: true, canViewPaymentOrders: true, canApproveFinancial: true, canApproveManager: true, canApproveCeo: true, canEditOwn: true, canEditAll: true, canDeleteOwn: true, canDeleteAll: true, canManageTrade: true, canManageSettings: true,
                canCreateExitPermit: true, canViewExitPermits: true, canApproveExitCeo: true, canApproveExitFactory: true, canApproveExitWarehouse: true, canApproveExitSecurity: true, canViewExitArchive: true, canEditExitArchive: true,
                canManageWarehouse: true, canViewWarehouseReports: true, canApproveBijak: true,
                canViewSecurity: true, canCreateSecurityLog: true, canApproveSecuritySupervisor: true
            };

        case UserRole.CEO:
            perms.canViewAll = true;
            perms.canViewPaymentOrders = true;
            perms.canApproveCeo = true;
            perms.canViewExitPermits = true;
            perms.canApproveExitCeo = true;
            perms.canManageTrade = true;
            perms.canApproveBijak = true;
            perms.canViewSecurity = true;
            break;

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

        case UserRole.FACTORY_MANAGER:
            perms.canViewExitPermits = true;
            perms.canApproveExitFactory = true;
            perms.canViewSecurity = true;
            break;

        case UserRole.WAREHOUSE_KEEPER:
            perms.canViewExitPermits = true;
            perms.canApproveExitWarehouse = true;
            perms.canManageWarehouse = true;
            break;

        case UserRole.SECURITY_HEAD:
            perms.canViewExitPermits = true;
            perms.canApproveExitSecurity = true;
            perms.canViewSecurity = true;
            perms.canApproveSecuritySupervisor = true;
            break;
            
        case UserRole.SECURITY_GUARD:
            perms.canViewSecurity = true;
            perms.canCreateSecurityLog = true;
            break;
            
        case UserRole.USER:
            perms.canCreatePaymentOrder = true;
            break;
    }

    // 3. User Specific Flags
    if (userObject?.canManageTrade) {
        perms.canManageTrade = true;
    }

    return perms;
};
