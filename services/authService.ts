
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
    // 1. Define Defaults (Base Logic)
    // These defaults apply ONLY if no specific settings (checkboxes) are saved for the role.
    const isStandardRole = Object.values(UserRole).includes(userRole as UserRole);

    let perms: RolePermissions = {
        // General View
        canViewAll: isStandardRole && (userRole !== UserRole.USER && userRole !== UserRole.SALES_MANAGER && userRole !== UserRole.WAREHOUSE_KEEPER && userRole !== UserRole.SECURITY_GUARD && userRole !== UserRole.SECURITY_HEAD),
        
        // Payment Orders
        canCreatePaymentOrder: isStandardRole && (userRole !== UserRole.FACTORY_MANAGER && userRole !== UserRole.WAREHOUSE_KEEPER && userRole !== UserRole.SALES_MANAGER && userRole !== UserRole.SECURITY_GUARD && userRole !== UserRole.SECURITY_HEAD), 
        canViewPaymentOrders: isStandardRole && (userRole === UserRole.ADMIN || userRole === UserRole.CEO || userRole === UserRole.MANAGER || userRole === UserRole.FINANCIAL),
        canApproveFinancial: isStandardRole && (userRole === UserRole.FINANCIAL || userRole === UserRole.ADMIN),
        canApproveManager: isStandardRole && (userRole === UserRole.MANAGER || userRole === UserRole.ADMIN),
        canApproveCeo: isStandardRole && (userRole === UserRole.CEO || userRole === UserRole.ADMIN),
        
        // CRUD
        canEditOwn: true,
        canEditAll: isStandardRole && (userRole === UserRole.ADMIN || userRole === UserRole.CEO),
        canDeleteOwn: true,
        canDeleteAll: isStandardRole && (userRole === UserRole.ADMIN),
        
        // Modules
        canManageTrade: isStandardRole && (userRole === UserRole.ADMIN || userRole === UserRole.CEO || userRole === UserRole.MANAGER),
        canManageSettings: isStandardRole && (userRole === UserRole.ADMIN),
        
        // --- EXIT PERMIT DEFAULTS (Fixed for Workflow) ---
        canCreateExitPermit: isStandardRole && (userRole === UserRole.SALES_MANAGER || userRole === UserRole.ADMIN || userRole === UserRole.CEO || userRole === UserRole.MANAGER),
        
        // Ensure ALL roles involved in the chain can VIEW the permits list
        canViewExitPermits: isStandardRole && (
            userRole === UserRole.ADMIN || 
            userRole === UserRole.CEO || 
            userRole === UserRole.FACTORY_MANAGER || 
            userRole === UserRole.WAREHOUSE_KEEPER || 
            userRole === UserRole.SECURITY_HEAD || 
            userRole === UserRole.SECURITY_GUARD || 
            userRole === UserRole.SALES_MANAGER ||
            userRole === UserRole.MANAGER
        ),
        
        // Approval Workflow (Specific Steps)
        canApproveExitCeo: userRole === UserRole.CEO || userRole === UserRole.ADMIN,
        canApproveExitFactory: userRole === UserRole.FACTORY_MANAGER || userRole === UserRole.ADMIN,
        canApproveExitWarehouse: userRole === UserRole.WAREHOUSE_KEEPER || userRole === UserRole.ADMIN,
        canApproveExitSecurity: userRole === UserRole.SECURITY_GUARD || userRole === UserRole.SECURITY_HEAD || userRole === UserRole.ADMIN,
        
        canViewExitArchive: isStandardRole && (userRole === UserRole.ADMIN || userRole === UserRole.CEO || userRole === UserRole.FACTORY_MANAGER || userRole === UserRole.SECURITY_HEAD || userRole === UserRole.WAREHOUSE_KEEPER),
        canEditExitArchive: isStandardRole && (userRole === UserRole.ADMIN),

        // Warehouse & Security Modules
        canManageWarehouse: isStandardRole && (userRole === UserRole.ADMIN || userRole === UserRole.WAREHOUSE_KEEPER), 
        canViewWarehouseReports: isStandardRole && (userRole === UserRole.ADMIN || userRole === UserRole.WAREHOUSE_KEEPER || userRole === UserRole.FACTORY_MANAGER || userRole === UserRole.CEO || userRole === UserRole.SALES_MANAGER),
        canApproveBijak: isStandardRole && (userRole === UserRole.ADMIN || userRole === UserRole.CEO),
        canViewSecurity: isStandardRole && (userRole === UserRole.ADMIN || userRole === UserRole.CEO || userRole === UserRole.FACTORY_MANAGER || userRole === UserRole.SECURITY_HEAD || userRole === UserRole.SECURITY_GUARD),
        canCreateSecurityLog: isStandardRole && (userRole === UserRole.SECURITY_GUARD || userRole === UserRole.SECURITY_HEAD || userRole === UserRole.ADMIN),
        canApproveSecuritySupervisor: isStandardRole && (userRole === UserRole.SECURITY_HEAD || userRole === UserRole.ADMIN)
    };

    // 2. Merge with Settings (This allows "Ticks" in Settings to override Defaults)
    if (settings && settings.rolePermissions && settings.rolePermissions[userRole]) {
        perms = { ...perms, ...settings.rolePermissions[userRole] };
    }

    // 3. Safety Net: Ensure Admin always has everything
    if (userRole === UserRole.ADMIN) {
        Object.keys(perms).forEach(k => { (perms as any)[k] = true; });
    }
    
    // User Object Override (Specific User Permissions)
    if (userObject && userObject.canManageTrade) perms.canManageTrade = true;

    return perms;
};
