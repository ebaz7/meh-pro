
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

// --- REWRITTEN PERMISSION LOGIC (STRICT MODE) ---
export const getRolePermissions = (userRole: string, settings: SystemSettings | null, userObject?: User): RolePermissions => {
    // 1. ADMIN GETS EVERYTHING
    if (userRole === UserRole.ADMIN) {
        return {
            canViewAll: true, canCreatePaymentOrder: true, canViewPaymentOrders: true, canApproveFinancial: true, canApproveManager: true, canApproveCeo: true, canEditOwn: true, canEditAll: true, canDeleteOwn: true, canDeleteAll: true, canManageTrade: true, canManageSettings: true,
            canCreateExitPermit: true, canViewExitPermits: true, canApproveExitCeo: true, canApproveExitFactory: true, canApproveExitWarehouse: true, canApproveExitSecurity: true, canViewExitArchive: true, canEditExitArchive: true,
            canManageWarehouse: true, canViewWarehouseReports: true, canApproveBijak: true,
            canViewSecurity: true, canCreateSecurityLog: true, canApproveSecuritySupervisor: true
        };
    }

    // 2. START WITH EVERYTHING FALSE (Zero Trust)
    let perms: RolePermissions = {
        canViewAll: false,
        canEditOwn: true, // Allow users to edit their own pending drafts by default
        canDeleteOwn: true,
        
        // Payment Defaults: FALSE
        canCreatePaymentOrder: false,
        canViewPaymentOrders: false,
        canApproveFinancial: false,
        canApproveManager: false,
        canApproveCeo: false,
        canEditAll: false,
        canDeleteAll: false,
        
        // Trade/Settings Defaults: FALSE
        canManageTrade: false,
        canManageSettings: false,
        
        // Exit Permit Defaults: FALSE
        canCreateExitPermit: false,
        canViewExitPermits: false,
        canApproveExitCeo: false,
        canApproveExitFactory: false,
        canApproveExitWarehouse: false,
        canApproveExitSecurity: false,
        canViewExitArchive: false,
        canEditExitArchive: false,

        // Warehouse Defaults: FALSE
        canManageWarehouse: false,
        canViewWarehouseReports: false,
        canApproveBijak: false,

        // Security Defaults: FALSE
        canViewSecurity: false,
        canCreateSecurityLog: false,
        canApproveSecuritySupervisor: false
    };

    // 3. APPLY SETTINGS (Database Overrides) - Highest Priority for Custom Roles
    // If settings exist for this specific role ID, we merge them.
    // This solves the issue where you check a box in settings but it doesn't apply.
    if (settings && settings.rolePermissions && settings.rolePermissions[userRole]) {
        const savedPerms = settings.rolePermissions[userRole];
        perms = { ...perms, ...savedPerms };
        
        // User Specific Override (e.g. Trade Access Checkbox on User Edit)
        if (userObject?.canManageTrade) {
            perms.canManageTrade = true;
        }
        
        return perms;
    }

    // 4. HARDCODED DEFAULTS (ONLY if no settings exist for this role)
    // This ensures backward compatibility for system roles if settings are empty.
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
            perms.canViewExitPermits = true; // Usually Manager can view exits
            break;

        case UserRole.SALES_MANAGER:
            perms.canCreatePaymentOrder = true; // Can request payment
            perms.canCreateExitPermit = true; // Can request exit
            perms.canViewExitPermits = true;
            break;

        case UserRole.FACTORY_MANAGER:
            // STRICTLY FACTORY STUFF
            perms.canViewExitPermits = true;
            perms.canApproveExitFactory = true;
            perms.canViewSecurity = true;
            // NO PAYMENT ACCESS BY DEFAULT
            break;

        case UserRole.WAREHOUSE_KEEPER:
            // STRICTLY WAREHOUSE STUFF
            perms.canViewExitPermits = true;
            perms.canApproveExitWarehouse = true;
            perms.canManageWarehouse = true;
            // NO PAYMENT ACCESS BY DEFAULT
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
            // Minimal access
            perms.canCreatePaymentOrder = true;
            break;
    }

    // User Specific Override (Trade)
    if (userObject?.canManageTrade) {
        perms.canManageTrade = true;
    }

    return perms;
};
