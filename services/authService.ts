
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

// --- FIXED PERMISSION LOGIC ---
export const getRolePermissions = (userRole: string, settings: SystemSettings | null, userObject?: User): RolePermissions => {
    // 1. ADMIN SUPERUSER (Full Access)
    if (userRole === UserRole.ADMIN) {
        return {
            canViewAll: true, canCreatePaymentOrder: true, canViewPaymentOrders: true, canApproveFinancial: true, canApproveManager: true, canApproveCeo: true, canEditOwn: true, canEditAll: true, canDeleteOwn: true, canDeleteAll: true, canManageTrade: true, canManageSettings: true,
            canCreateExitPermit: true, canViewExitPermits: true, canApproveExitCeo: true, canApproveExitFactory: true, canApproveExitWarehouse: true, canApproveExitSecurity: true, canViewExitArchive: true, canEditExitArchive: true,
            canManageWarehouse: true, canViewWarehouseReports: true, canApproveBijak: true,
            canViewSecurity: true, canCreateSecurityLog: true, canApproveSecuritySupervisor: true
        };
    }

    // 2. DEFINE DEFAULTS BASED ON ROLE (Strict Workflow)
    let perms: RolePermissions = {
        canEditOwn: true,
        canDeleteOwn: true,
        canViewPaymentOrders: false,
        canViewExitPermits: false,
    };

    switch (userRole) {
        case UserRole.CEO:
            perms.canViewAll = true;
            perms.canViewPaymentOrders = true;
            perms.canApproveCeo = true; // Payment
            perms.canViewExitPermits = true;
            perms.canApproveExitCeo = true; // Exit Step 1
            perms.canManageTrade = true;
            perms.canApproveBijak = true;
            perms.canViewSecurity = true;
            break;
            
        case UserRole.SALES_MANAGER:
            perms.canCreatePaymentOrder = true;
            perms.canCreateExitPermit = true; // Exit Step 0 (Create)
            perms.canViewExitPermits = true;
            break;

        case UserRole.FACTORY_MANAGER:
            perms.canViewExitPermits = true;
            perms.canApproveExitFactory = true; // Exit Step 2
            perms.canViewSecurity = true;
            break;

        case UserRole.WAREHOUSE_KEEPER:
            perms.canViewExitPermits = true;
            perms.canApproveExitWarehouse = true; // Exit Step 3
            perms.canManageWarehouse = true;
            break;

        case UserRole.SECURITY_HEAD:
            perms.canViewExitPermits = true;
            perms.canApproveExitSecurity = true; // Exit Step 4 (Final)
            perms.canViewSecurity = true;
            perms.canApproveSecuritySupervisor = true;
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
            
        case UserRole.SECURITY_GUARD:
            perms.canViewSecurity = true;
            perms.canCreateSecurityLog = true;
            break;
            
        case UserRole.USER:
            perms.canCreatePaymentOrder = true;
            break;
    }

    // 3. APPLY SETTINGS OVERRIDES (Allows Manual Toggles in Settings Page)
    if (settings && settings.rolePermissions && settings.rolePermissions[userRole]) {
        const savedPerms = settings.rolePermissions[userRole];
        perms = { ...perms, ...savedPerms };
    }

    // 4. User Specific Overrides
    if (userObject?.canManageTrade) {
        perms.canManageTrade = true;
    }

    return perms;
};
