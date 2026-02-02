
import { PaymentOrder, User, OrderStatus, SystemSettings, ChatMessage, ChatGroup, GroupTask, TradeRecord, ExitPermit, ExitPermitStatus, WarehouseItem, WarehouseTransaction, SecurityLog, PersonnelDelay, SecurityIncident } from '../types';
import { apiCall } from './apiService';

const safeArray = <T>(data: any): T[] => Array.isArray(data) ? data : [];

// --- Payment Orders ---
export const getOrders = async (): Promise<PaymentOrder[]> => safeArray(await apiCall<PaymentOrder[]>('/orders'));
export const saveOrder = async (order: PaymentOrder): Promise<PaymentOrder[]> => await apiCall<PaymentOrder[]>('/orders', 'POST', order);
export const editOrder = async (updatedOrder: PaymentOrder): Promise<PaymentOrder[]> => await apiCall<PaymentOrder[]>(`/orders/${updatedOrder.id}`, 'PUT', updatedOrder);
export const updateOrderStatus = async (id: string, status: OrderStatus, approverUser: User, rejectionReason?: string): Promise<PaymentOrder[]> => {
    const orders = await getOrders();
    const order = orders.find(o => o.id === id);
    if (order) {
        const updates: any = { status, updatedAt: Date.now() };
        if (status === OrderStatus.APPROVED_FINANCE) updates.approverFinancial = approverUser.fullName;
        else if (status === OrderStatus.APPROVED_MANAGER) updates.approverManager = approverUser.fullName;
        else if (status === OrderStatus.APPROVED_CEO) updates.approverCeo = approverUser.fullName;
        if (status === OrderStatus.REJECTED) { updates.rejectionReason = rejectionReason; updates.rejectedBy = approverUser.fullName; }
        return await apiCall<PaymentOrder[]>(`/orders/${id}`, 'PUT', { ...order, ...updates });
    }
    return orders;
};
export const deleteOrder = async (id: string): Promise<PaymentOrder[]> => await apiCall<PaymentOrder[]>(`/orders/${id}`, 'DELETE');

// --- Exit Permits ---
export const getExitPermits = async (): Promise<ExitPermit[]> => safeArray(await apiCall<ExitPermit[]>('/exit-permits'));
export const saveExitPermit = async (permit: ExitPermit): Promise<ExitPermit[]> => await apiCall<ExitPermit[]>('/exit-permits', 'POST', permit);
export const editExitPermit = async (updatedPermit: ExitPermit): Promise<ExitPermit[]> => await apiCall<ExitPermit[]>(`/exit-permits/${updatedPermit.id}`, 'PUT', updatedPermit);
export const updateExitPermitStatus = async (id: string, status: ExitPermitStatus, approverUser: User, extra?: { rejectionReason?: string, exitTime?: string }): Promise<ExitPermit[]> => {
    const permits = await getExitPermits();
    const permit = permits.find(p => p.id === id);
    if(permit) {
        const updates: any = { status, updatedAt: Date.now() };
        if (status === ExitPermitStatus.PENDING_FACTORY) updates.approverCeo = approverUser.fullName;
        else if (status === ExitPermitStatus.PENDING_WAREHOUSE) updates.approverFactory = approverUser.fullName;
        else if (status === ExitPermitStatus.PENDING_SECURITY) updates.approverWarehouse = approverUser.fullName;
        else if (status === ExitPermitStatus.EXITED) { updates.approverSecurity = approverUser.fullName; if (extra?.exitTime) updates.exitTime = extra.exitTime; }
        if (status === ExitPermitStatus.REJECTED) { updates.rejectionReason = extra?.rejectionReason; updates.rejectedBy = approverUser.fullName; }
        return await apiCall<ExitPermit[]>(`/exit-permits/${id}`, 'PUT', { ...permit, ...updates });
    }
    return permits;
};
export const deleteExitPermit = async (id: string): Promise<ExitPermit[]> => await apiCall<ExitPermit[]>(`/exit-permits/${id}`, 'DELETE');

// --- System Settings ---
export const getSettings = async (): Promise<SystemSettings> => await apiCall<SystemSettings>('/settings');
export const saveSettings = async (settings: SystemSettings): Promise<SystemSettings> => await apiCall<SystemSettings>('/settings', 'POST', settings);

// --- Sequence Number Fetchers ---
export const getNextTrackingNumber = async (company?: string): Promise<number> => {
    const res = await apiCall<{ nextTrackingNumber: number }>(`/next-tracking-number?company=${encodeURIComponent(company || '')}&t=${Date.now()}`);
    return res.nextTrackingNumber || 1001;
};

export const getNextExitPermitNumber = async (company?: string): Promise<number> => {
    const res = await apiCall<{ nextNumber: number }>(`/next-exit-permit-number?company=${encodeURIComponent(company || '')}&t=${Date.now()}`);
    return res.nextNumber || 1001;
};

export const getNextBijakNumber = async (company: string): Promise<number> => {
    const res = await apiCall<{ nextNumber: number }>(`/next-bijak-number?company=${encodeURIComponent(company)}&t=${Date.now()}`);
    return res.nextNumber || 1001;
};

// --- Warehouse Management ---
export const getWarehouseItems = async (): Promise<WarehouseItem[]> => safeArray(await apiCall<WarehouseItem[]>('/warehouse/items'));
export const saveWarehouseItem = async (item: WarehouseItem): Promise<WarehouseItem[]> => await apiCall<WarehouseItem[]>('/warehouse/items', 'POST', item);
export const updateWarehouseItem = async (item: WarehouseItem): Promise<WarehouseItem[]> => await apiCall<WarehouseItem[]>(`/warehouse/items/${item.id}`, 'PUT', item);
export const deleteWarehouseItem = async (id: string): Promise<WarehouseItem[]> => await apiCall<WarehouseItem[]>(`/warehouse/items/${id}`, 'DELETE');

export const getWarehouseTransactions = async (): Promise<WarehouseTransaction[]> => safeArray(await apiCall<WarehouseTransaction[]>('/warehouse/transactions'));
export const saveWarehouseTransaction = async (tx: WarehouseTransaction): Promise<WarehouseTransaction[]> => await apiCall<WarehouseTransaction[]>('/warehouse/transactions', 'POST', tx);
export const updateWarehouseTransaction = async (tx: WarehouseTransaction): Promise<WarehouseTransaction[]> => await apiCall<WarehouseTransaction[]>(`/warehouse/transactions/${tx.id}`, 'PUT', tx);
export const deleteWarehouseTransaction = async (id: string): Promise<WarehouseTransaction[]> => await apiCall<WarehouseTransaction[]>(`/warehouse/transactions/${id}`, 'DELETE');

// --- File Uploads ---
export const uploadFile = async (fileName: string, fileData: string): Promise<{ fileName: string, url: string }> => await apiCall<{ fileName: string, url: string }>('/upload', 'POST', { fileName, fileData });

// --- Chat & Messaging ---
/* Added getMessages, sendMessage, updateMessage, deleteMessage for ChatRoom and App */
export const getMessages = async (): Promise<ChatMessage[]> => safeArray(await apiCall<ChatMessage[]>('/chat'));
export const sendMessage = async (msg: ChatMessage): Promise<ChatMessage[]> => await apiCall<ChatMessage[]>('/chat', 'POST', msg);
export const updateMessage = async (msg: ChatMessage): Promise<ChatMessage[]> => await apiCall<ChatMessage[]>(`/chat/${msg.id}`, 'PUT', msg);
export const deleteMessage = async (id: string): Promise<ChatMessage[]> => await apiCall<ChatMessage[]>(`/chat/${id}`, 'DELETE');

/* Added group management for ChatRoom */
export const getGroups = async (): Promise<ChatGroup[]> => safeArray(await apiCall<ChatGroup[]>('/groups'));
export const createGroup = async (group: ChatGroup): Promise<ChatGroup[]> => await apiCall<ChatGroup[]>('/groups', 'POST', group);
export const updateGroup = async (group: ChatGroup): Promise<ChatGroup[]> => await apiCall<ChatGroup[]>(`/groups/${group.id}`, 'PUT', group);
export const deleteGroup = async (id: string): Promise<ChatGroup[]> => await apiCall<ChatGroup[]>(`/groups/${id}`, 'DELETE');

/* Added task management for ChatRoom */
export const getTasks = async (): Promise<GroupTask[]> => safeArray(await apiCall<GroupTask[]>('/tasks'));
export const createTask = async (task: GroupTask): Promise<GroupTask[]> => await apiCall<GroupTask[]>('/tasks', 'POST', task);
export const updateTask = async (task: GroupTask): Promise<GroupTask[]> => await apiCall<GroupTask[]>(`/tasks/${task.id}`, 'PUT', task);
export const deleteTask = async (id: string): Promise<GroupTask[]> => await apiCall<GroupTask[]>(`/tasks/${id}`, 'DELETE');

// --- Trade Records ---
/* Added trade management for TradeModule */
export const getTradeRecords = async (): Promise<TradeRecord[]> => safeArray(await apiCall<TradeRecord[]>('/trade'));
export const saveTradeRecord = async (record: TradeRecord): Promise<TradeRecord[]> => await apiCall<TradeRecord[]>('/trade', 'POST', record);
export const updateTradeRecord = async (record: TradeRecord): Promise<TradeRecord[]> => await apiCall<TradeRecord[]>(`/trade/${record.id}`, 'PUT', record);
export const deleteTradeRecord = async (id: string): Promise<TradeRecord[]> => await apiCall<TradeRecord[]>(`/trade/${id}`, 'DELETE');

// --- Security Module ---
/* Added security log management */
export const getSecurityLogs = async (): Promise<SecurityLog[]> => safeArray(await apiCall<SecurityLog[]>('/security/logs'));
export const saveSecurityLog = async (log: SecurityLog): Promise<SecurityLog[]> => await apiCall<SecurityLog[]>('/security/logs', 'POST', log);
export const updateSecurityLog = async (log: SecurityLog): Promise<SecurityLog[]> => await apiCall<SecurityLog[]>(`/security/logs/${log.id}`, 'PUT', log);
export const deleteSecurityLog = async (id: string): Promise<SecurityLog[]> => await apiCall<SecurityLog[]>(`/security/logs/${id}`, 'DELETE');

/* Added personnel delay management */
export const getPersonnelDelays = async (): Promise<PersonnelDelay[]> => safeArray(await apiCall<PersonnelDelay[]>('/security/delays'));
export const savePersonnelDelay = async (delay: PersonnelDelay): Promise<PersonnelDelay[]> => await apiCall<PersonnelDelay[]>('/security/delays', 'POST', delay);
export const updatePersonnelDelay = async (delay: PersonnelDelay): Promise<PersonnelDelay[]> => await apiCall<PersonnelDelay[]>(`/security/delays/${delay.id}`, 'PUT', delay);
export const deletePersonnelDelay = async (id: string): Promise<PersonnelDelay[]> => await apiCall<PersonnelDelay[]>(`/security/delays/${id}`, 'DELETE');

/* Added security incident management */
export const getSecurityIncidents = async (): Promise<SecurityIncident[]> => safeArray(await apiCall<SecurityIncident[]>('/security/incidents'));
export const saveSecurityIncident = async (incident: SecurityIncident): Promise<SecurityIncident[]> => await apiCall<SecurityIncident[]>('/security/incidents', 'POST', incident);
export const updateSecurityIncident = async (incident: SecurityIncident): Promise<SecurityIncident[]> => await apiCall<SecurityIncident[]>(`/security/incidents/${incident.id}`, 'PUT', incident);
export const deleteSecurityIncident = async (id: string): Promise<SecurityIncident[]> => await apiCall<SecurityIncident[]>(`/security/incidents/${id}`, 'DELETE');
