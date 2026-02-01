
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

// --- REWRITTEN PERMISSION LOGIC (STRICT MODE & FAILSAFE) ---
export const getRolePermissions = (userRole: string, settings: SystemSettings | null, userObject?: User): RolePermissions => {
    
    // 1. ADMIN GETS EVERYTHING (Hard Override)
    if (userRole === UserRole.ADMIN) {
        return {
            canViewAll: true, canCreatePaymentOrder: true, canViewPaymentOrders: true, canApproveFinancial: true, canApproveManager: true, canApproveCeo: true, canEditOwn: true, canEditAll: true, canDeleteOwn: true, canDeleteAll: true, canManageTrade: true, canManageSettings: true,
            canCreateExitPermit: true, canViewExitPermits: true, canApproveExitCeo: true, canApproveExitFactory: true, canApproveExitWarehouse: true, canApproveExitSecurity: true, canViewExitArchive: true, canEditExitArchive: true,
            canManageWarehouse: true, canViewWarehouseReports: true, canApproveBijak: true,
            canViewSecurity: true, canCreateSecurityLog: true, canApproveSecuritySupervisor: true
        };
    }

    // 2. DEFINE DEFAULTS (Base Permissions based on Role Type)
    // Start with all false
    let perms: RolePermissions = {
        canViewAll: false,
        canEditOwn: true, 
        canDeleteOwn: true,
        canCreatePaymentOrder: false, canViewPaymentOrders: false, canApproveFinancial: false, canApproveManager: false, canApproveCeo: false, canEditAll: false, canDeleteAll: false,
        canManageTrade: false, canManageSettings: false,
        canCreateExitPermit: false, canViewExitPermits: false, canApproveExitCeo: false, canApproveExitFactory: false, canApproveExitWarehouse: false, canApproveExitSecurity: false, canViewExitArchive: false, canEditExitArchive: false,
        canManageWarehouse: false, canViewWarehouseReports: false, canApproveBijak: false,
        canViewSecurity: false, canCreateSecurityLog: false, canApproveSecuritySupervisor: false
    };

    // Apply System Defaults (Hardcoded Logic)
    switch (userRole) {
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
            perms.canCreateExitPermit = true; // Can create exit request
            perms.canViewExitPermits = true; // Can view status
            break;

        case UserRole.FACTORY_MANAGER:
            perms.canViewExitPermits = true;
            perms.canApproveExitFactory = true; // CRITICAL DEFAULT
            perms.canViewSecurity = true;
            break;

        case UserRole.WAREHOUSE_KEEPER:
            perms.canViewExitPermits = true;
            perms.canApproveExitWarehouse = true; // CRITICAL DEFAULT
            perms.canManageWarehouse = true;
            break;

        case UserRole.SECURITY_HEAD:
            perms.canViewExitPermits = true;
            perms.canApproveExitSecurity = true; // CRITICAL DEFAULT
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

    // 3. APPLY DATABASE SETTINGS (MERGE)
    if (settings && settings.rolePermissions && settings.rolePermissions[userRole]) {
        const savedPerms = settings.rolePermissions[userRole];
        perms = { ...perms, ...savedPerms };
    }

    // 4. FORCE SYSTEM DEFAULTS AGAIN (SAFETY NET)
    // Ensure critical approvals for system roles aren't accidentally disabled by empty settings
    if (userRole === UserRole.FACTORY_MANAGER) perms.canApproveExitFactory = true;
    if (userRole === UserRole.WAREHOUSE_KEEPER) perms.canApproveExitWarehouse = true;
    if (userRole === UserRole.SECURITY_HEAD) perms.canApproveExitSecurity = true;
    if (userRole === UserRole.CEO) { perms.canApproveExitCeo = true; perms.canApproveCeo = true; }

    // 5. USER SPECIFIC OVERRIDES
    if (userObject?.canManageTrade) {
        perms.canManageTrade = true;
    }

    return perms;
};
