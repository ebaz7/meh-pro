
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
    // 1. Always give FULL access to Admin
    if (userRole === UserRole.ADMIN) {
        return {
            canViewAll: true, canCreatePaymentOrder: true, canViewPaymentOrders: true, canApproveFinancial: true, canApproveManager: true, canApproveCeo: true, canEditOwn: true, canEditAll: true, canDeleteOwn: true, canDeleteAll: true, canManageTrade: true, canManageSettings: true,
            canCreateExitPermit: true, canViewExitPermits: true, canApproveExitCeo: true, canApproveExitFactory: true, canApproveExitWarehouse: true, canApproveExitSecurity: true, canViewExitArchive: true, canEditExitArchive: true,
            canManageWarehouse: true, canViewWarehouseReports: true, canApproveBijak: true,
            canViewSecurity: true, canCreateSecurityLog: true, canApproveSecuritySupervisor: true
        };
    }

    // 2. Default Fallback Permissions (Minimal Access)
    let perms: RolePermissions = {
        canViewAll: false,
        canEditOwn: true,
        canDeleteOwn: true,
        canCreatePaymentOrder: true, // Usually everyone can request
        canViewPaymentOrders: true,
        
        // Explicitly set approvals to false by default to rely on Settings
        canApproveFinancial: false,
        canApproveManager: false,
        canApproveCeo: false,
        
        canCreateExitPermit: false,
        canViewExitPermits: false,
        canApproveExitCeo: false,
        canApproveExitFactory: false,
        canApproveExitWarehouse: false,
        canApproveExitSecurity: false,
        
        canManageWarehouse: false,
        canViewSecurity: false
    };

    // 3. Apply Legacy Hardcoded Defaults (ONLY if no settings exist for this role)
    // This ensures backward compatibility but Settings will override it.
    if (!settings?.rolePermissions?.[userRole]) {
        switch (userRole) {
            case UserRole.CEO:
                perms.canApproveCeo = true;
                perms.canApproveExitCeo = true;
                perms.canViewExitPermits = true;
                perms.canViewAll = true;
                perms.canManageTrade = true;
                break;
            case UserRole.FACTORY_MANAGER:
                perms.canApproveExitFactory = true;
                perms.canViewExitPermits = true;
                perms.canViewWarehouseReports = true;
                perms.canViewSecurity = true;
                break;
            case UserRole.WAREHOUSE_KEEPER:
                perms.canApproveExitWarehouse = true;
                perms.canViewExitPermits = true;
                perms.canManageWarehouse = true;
                break;
            case UserRole.SECURITY_HEAD:
            case UserRole.SECURITY_GUARD:
                perms.canApproveExitSecurity = true;
                perms.canViewExitPermits = true;
                perms.canViewSecurity = true;
                perms.canCreateSecurityLog = true;
                if(userRole === UserRole.SECURITY_HEAD) perms.canApproveSecuritySupervisor = true;
                break;
            case UserRole.SALES_MANAGER:
                perms.canCreateExitPermit = true;
                perms.canViewExitPermits = true;
                break;
        }
    }

    // 4. OVERRIDE with Database Settings (The most important part)
    // If the admin has configured permissions for this role ID in settings, USE THEM.
    if (settings && settings.rolePermissions && settings.rolePermissions[userRole]) {
        const savedPerms = settings.rolePermissions[userRole];
        // Merge: Default < Saved
        perms = { ...perms, ...savedPerms };
    }
    
    // 5. User Specific Override
    if (userObject?.canManageTrade) {
        perms.canManageTrade = true;
    }

    return perms;
};
