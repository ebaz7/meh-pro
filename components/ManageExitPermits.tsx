
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, getSettings } from '../services/storageService';
import { getUsers } from '../services/authService';
import { apiCall } from '../services/apiService';
import { formatDate } from '../constants';
import { Truck, Search, Filter, CheckCircle, XCircle, Eye, Trash2, AlertTriangle, FileText, Share2, MoreVertical, Loader2 } from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import WarehouseFinalizeModal from './WarehouseFinalizeModal';
import EditExitPermitModal from './EditExitPermitModal';

interface Props {
    currentUser: User;
    settings?: SystemSettings;
    statusFilter?: 'pending' | null;
}

const ManageExitPermits: React.FC<Props> = ({ currentUser, settings: initialSettings, statusFilter }) => {
    const [permits, setPermits] = useState<ExitPermit[]>([]);
    const [filteredPermits, setFilteredPermits] = useState<ExitPermit[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(initialSettings || null);
    
    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [viewPermit, setViewPermit] = useState<ExitPermit | null>(null);
    const [editPermit, setEditPermit] = useState<ExitPermit | null>(null);
    const [warehouseFinalizePermit, setWarehouseFinalizePermit] = useState<ExitPermit | null>(null);
    
    const [loading, setLoading] = useState(false);
    
    // Auto-send state for hidden rendering
    const [approvedPermitForAutoSend, setApprovedPermitForAutoSend] = useState<ExitPermit | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [p, u, s] = await Promise.all([getExitPermits(), getUsers(), getSettings()]);
            setPermits(p || []);
            setUsers(u || []);
            setSettings(s || null);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let result = permits;
        
        // Status Filter
        if (statusFilter === 'pending') {
            result = result.filter(p => p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED);
        }

        // Search Filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(p => 
                p.permitNumber.toString().includes(lowerTerm) ||
                p.recipientName?.toLowerCase().includes(lowerTerm) ||
                p.goodsName?.toLowerCase().includes(lowerTerm) ||
                p.requester.toLowerCase().includes(lowerTerm)
            );
        }

        // Sort: Newest first
        result.sort((a, b) => b.createdAt - a.createdAt);
        setFilteredPermits(result);
    }, [permits, searchTerm, statusFilter]);

    const handleApprove = async (permit: ExitPermit) => {
        // Workflow Logic
        let nextStatus: ExitPermitStatus | null = null;
        let requiresInput = false;

        // Stage 1: CEO -> Factory
        if (permit.status === ExitPermitStatus.PENDING_CEO) {
            if (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN) {
                nextStatus = ExitPermitStatus.PENDING_FACTORY;
            }
        }
        // Stage 2: Factory -> Warehouse
        else if (permit.status === ExitPermitStatus.PENDING_FACTORY) {
            if (currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN) {
                nextStatus = ExitPermitStatus.PENDING_WAREHOUSE;
            }
        }
        // Stage 3: Warehouse -> Security (Requires Weight/Count Finalization)
        else if (permit.status === ExitPermitStatus.PENDING_WAREHOUSE) {
            if (currentUser.role === UserRole.WAREHOUSE_KEEPER || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.FACTORY_MANAGER) {
                setWarehouseFinalizePermit(permit); // Open Modal
                return; 
            }
        }
        // Stage 4: Security -> Exited (Requires Time)
        else if (permit.status === ExitPermitStatus.PENDING_SECURITY) {
            if (currentUser.role === UserRole.SECURITY_GUARD || currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.ADMIN) {
                if (confirm('آیا خروج نهایی بار را تایید می‌کنید؟')) {
                    const now = new Date().toLocaleTimeString('fa-IR', {hour: '2-digit', minute: '2-digit'});
                    await updateExitPermitStatus(permit.id, ExitPermitStatus.EXITED, currentUser, { exitTime: now });
                    loadData();
                    setViewPermit(null);
                }
                return;
            }
        }

        if (nextStatus) {
            if (confirm(`آیا تایید و ارسال به مرحله بعد (${nextStatus}) را انجام می‌دهید؟`)) {
                const updatedList = await updateExitPermitStatus(permit.id, nextStatus, currentUser);
                const updatedPermit = updatedList.find(p => p.id === permit.id);
                setPermits(updatedList);
                setViewPermit(null);

                // --- NOTIFICATION LOGIC ---
                // Only triggers on transition from PENDING_CEO to PENDING_FACTORY (CEO Approval)
                if (permit.status === ExitPermitStatus.PENDING_CEO && nextStatus === ExitPermitStatus.PENDING_FACTORY) {
                    if (!updatedPermit) return;
                    setApprovedPermitForAutoSend(updatedPermit);
                    
                    // Wait for render
                    setTimeout(async () => {
                        const element = document.getElementById(`print-permit-autosend-${updatedPermit.id}`);
                        if (element) {
                            try {
                                // @ts-ignore
                                const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                                const base64 = canvas.toDataURL('image/png').split(',')[1];

                                // Target Lists - Be Aggressive
                                const targets = new Set<string>();

                                // 1. Always notify CEO (Confirmation)
                                const ceo = users.find(u => u.role === UserRole.CEO && u.phoneNumber);
                                if (ceo) targets.add(ceo.phoneNumber!);

                                // 2. Always notify Group(s)
                                if (settings?.exitPermitNotificationGroup) targets.add(settings.exitPermitNotificationGroup);
                                if (settings?.exitPermitNotificationGroup2) targets.add(settings.exitPermitNotificationGroup2);

                                // 3. Notify Factory Manager
                                const fm = users.find(u => u.role === UserRole.FACTORY_MANAGER && u.phoneNumber);
                                if (fm) targets.add(fm.phoneNumber!);

                                let caption = `🚛 *مجوز خروج تایید شد*\n`;
                                caption += `شماره: ${updatedPermit.permitNumber}\n`;
                                caption += `گیرنده: ${updatedPermit.recipientName}\n`;
                                caption += `وضعیت: تایید مدیرعامل -> ارجاع به کارخانه`;

                                for (const targetNum of Array.from(targets)) {
                                    await apiCall('/send-whatsapp', 'POST', { 
                                        number: targetNum, 
                                        message: caption, 
                                        mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_Approved_${updatedPermit.permitNumber}.png` } 
                                    });
                                }
                                alert('تایید و به گروه‌ها ارسال شد.');
                            } catch(e) { console.error("Notification Error", e); }
                        }
                        setApprovedPermitForAutoSend(null);
                    }, 2000);
                } else {
                    alert('تایید شد.');
                }
            }
        }
    };

    const handleReject = async (permit: ExitPermit) => {
        const reason = prompt('دلیل رد درخواست:');
        if (reason) {
            await updateExitPermitStatus(permit.id, ExitPermitStatus.REJECTED, currentUser, { rejectionReason: reason });
            loadData();
            setViewPermit(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('آیا از حذف این مجوز اطمینان دارید؟')) {
            // Check if we need to send "Deleted" notification
            const permit = permits.find(p => p.id === id);
            
            // Only send if it was already approved by CEO (meaning it was public)
            if (permit && (permit.status !== ExitPermitStatus.PENDING_CEO && permit.status !== ExitPermitStatus.REJECTED)) {
                 const settingsRef = settings || await getSettings();
                 const targetGroup = settingsRef?.exitPermitNotificationGroup;
                 
                 if (targetGroup) {
                     // We need to render a "DELETED" watermark version. 
                     // We can reuse the auto-send hidden div logic, but we need to set state first.
                     // For simplicity in this fix, we just send a text alert or skip visual generation to avoid complexity.
                     // Let's send a text alert.
                     try {
                         let msg = `❌❌ *مجوز خروج باطل شد* ❌❌\n`;
                         msg += `شماره: ${permit.permitNumber}\n`;
                         msg += `گیرنده: ${permit.recipientName}\n`;
                         msg += `توسط: ${currentUser.fullName}\n`;
                         msg += `⚠️ *این مجوز فاقد اعتبار است.*`;
                         await apiCall('/send-whatsapp', 'POST', { number: targetGroup, message: msg });
                     } catch(e) {}
                 }
            }

            await deleteExitPermit(id);
            loadData();
        }
    };

    const handleWarehouseFinalize = async (updatedItems: any[]) => {
        if (!warehouseFinalizePermit) return;
        // Update items with actual delivery amounts
        const updatedPermit = { ...warehouseFinalizePermit, items: updatedItems };
        // Save updates (we use edit logic conceptually but status update)
        // Actually updateExitPermitStatus only updates status and extra fields.
        // We might need to use `editExitPermit` to save items first? 
        // Or we assume `updateExitPermitStatus` backend can handle item updates? 
        // Based on existing code, `updateExitPermitStatus` is for status. `editExitPermit` is for content.
        // We should probably save content first, then update status. But `editExitPermit` resets approvals in some logic.
        // Let's use a specialized update if possible, or just modify the object locally and send to `editExitPermit` but manually set status to PENDING_SECURITY.
        // However, `editExitPermit` usually resets flow.
        
        // CORRECT APPROACH: Use `editExitPermit` but pass a flag or handle it such that it doesn't reset flow if we are just "finalizing".
        // OR: Update `updateExitPermitStatus` to accept items.
        // Simplified: We will update the permit in DB with new items, then set status.
        
        // Since we don't have a direct "update items without reset" API exposed in front-end easily without modifying `storageService`, 
        // we will assume `updateExitPermitStatus` was modified or we use `apiCall` directly to update.
        
        // Let's try updating via `editExitPermit` but carefully.
        // Actually, `editExitPermit` in storageService does a PUT.
        // We can just call PUT with the updated items AND the new status.
        
        const finalPermit = { 
            ...updatedPermit, 
            status: ExitPermitStatus.PENDING_SECURITY,
            approverWarehouse: currentUser.fullName
        };
        
        // Direct API call to avoid "reset to pending" logic if it exists in `editExitPermit` wrapper
        await apiCall(`/exit-permits/${finalPermit.id}`, 'PUT', finalPermit);
        
        setWarehouseFinalizePermit(null);
        loadData();
        alert('تایید و به انتظامات ارسال شد.');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case ExitPermitStatus.PENDING_CEO: return 'bg-yellow-100 text-yellow-800';
            case ExitPermitStatus.PENDING_FACTORY: return 'bg-blue-100 text-blue-800';
            case ExitPermitStatus.PENDING_WAREHOUSE: return 'bg-purple-100 text-purple-800';
            case ExitPermitStatus.PENDING_SECURITY: return 'bg-orange-100 text-orange-800';
            case ExitPermitStatus.EXITED: return 'bg-green-100 text-green-800';
            case ExitPermitStatus.REJECTED: return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const canEdit = (p: ExitPermit) => {
        if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) return true;
        if (p.requester === currentUser.fullName && p.status === ExitPermitStatus.PENDING_CEO) return true;
        return false;
    };

    return (
        <div className="p-4 md:p-6 space-y-6 pb-20">
            {/* Hidden Auto-Send Render */}
            {approvedPermitForAutoSend && (
                <div className="hidden-print-export" style={{position: 'absolute', top: '-9999px', left: '-9999px'}}>
                    <div id={`print-permit-autosend-${approvedPermitForAutoSend.id}`}>
                        <PrintExitPermit permit={approvedPermitForAutoSend} onClose={()=>{}} embed />
                    </div>
                </div>
            )}

            {/* Modals */}
            {viewPermit && (
                <PrintExitPermit 
                    permit={viewPermit} 
                    onClose={() => setViewPermit(null)} 
                    onApprove={() => handleApprove(viewPermit)}
                    onReject={() => handleReject(viewPermit)}
                    onEdit={canEdit(viewPermit) ? () => { setEditPermit(viewPermit); setViewPermit(null); } : undefined}
                    settings={settings || undefined}
                />
            )}
            
            {editPermit && (
                <EditExitPermitModal 
                    permit={editPermit} 
                    onClose={() => setEditPermit(null)} 
                    onSave={loadData} 
                />
            )}

            {warehouseFinalizePermit && (
                <WarehouseFinalizeModal 
                    permit={warehouseFinalizePermit} 
                    onClose={() => setWarehouseFinalizePermit(null)} 
                    onConfirm={handleWarehouseFinalize} 
                />
            )}

            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Truck className="text-orange-600"/> مدیریت مجوزهای خروج</h2>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <input className="w-full border rounded-xl pl-9 pr-3 py-2 text-sm" placeholder="جستجو..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <Search size={18} className="absolute left-3 top-2.5 text-gray-400"/>
                    </div>
                    {statusFilter && <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1"><Filter size={16}/> فقط جاری</div>}
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 gap-4">
                {filteredPermits.map(permit => (
                    <div key={permit.id} onClick={() => setViewPermit(permit)} className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-shadow cursor-pointer relative group">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-3">
                                <div className="bg-orange-50 p-2.5 rounded-full text-orange-600 font-bold text-sm">{permit.permitNumber}</div>
                                <div>
                                    <h3 className="font-bold text-gray-800">{permit.recipientName}</h3>
                                    <div className="text-xs text-gray-500 mt-0.5">{permit.goodsName} | {permit.cartonCount} کارتن</div>
                                </div>
                            </div>
                            <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${getStatusColor(permit.status)}`}>{permit.status}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-400 mt-3 border-t pt-2">
                            <div className="flex gap-3">
                                <span>📅 {formatDate(permit.date)}</span>
                                <span>👤 {permit.requester}</span>
                            </div>
                            <div className="flex gap-2">
                                {(currentUser.role === UserRole.ADMIN || (currentUser.role === UserRole.SALES_MANAGER && permit.status === ExitPermitStatus.PENDING_CEO)) && (
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(permit.id); }} className="p-1.5 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded transition-colors"><Trash2 size={16}/></button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {filteredPermits.length === 0 && <div className="text-center text-gray-400 py-10">موردی یافت نشد.</div>}
            </div>
        </div>
    );
};

export default ManageExitPermits;
