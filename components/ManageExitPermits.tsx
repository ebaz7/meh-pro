
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings, ExitPermitItem } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, editExitPermit } from '../services/storageService';
import { getRolePermissions, getUsers } from '../services/authService'; 
import { formatDate } from '../constants';
import { Eye, Trash2, Search, CheckCircle, Truck, XCircle, Edit, Clock, Loader2, PackageCheck, RefreshCw, Share2, CheckCheck, AlertTriangle, User as UserIcon } from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import EditExitPermitModal from './EditExitPermitModal';
import WarehouseFinalizeModal from './WarehouseFinalizeModal'; 
import { apiCall } from '../services/apiService'; 

interface Props {
  currentUser: User;
  settings?: SystemSettings;
  statusFilter?: 'pending' | null;
}

const ManageExitPermits: React.FC<Props> = ({ currentUser, settings, statusFilter }) => {
  const [permits, setPermits] = useState<ExitPermit[]>([]);
  const [viewPermit, setViewPermit] = useState<ExitPermit | null>(null);
  const [editingPermit, setEditingPermit] = useState<ExitPermit | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'current' | 'archive'>('current');
  const [activeStatusFilter, setActiveStatusFilter] = useState<'pending' | null>(statusFilter || null);
  
  const [showExitTimeInput, setShowExitTimeInput] = useState<string | null>(null); 
  const [exitTimeValue, setExitTimeValue] = useState('');
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  const [permitForAutoSend, setPermitForAutoSend] = useState<ExitPermit | null>(null);
  const [autoSendWatermark, setAutoSendWatermark] = useState<'DELETED' | 'EDITED' | null>(null);
  
  const [warehouseFinalizePermit, setWarehouseFinalizePermit] = useState<ExitPermit | null>(null);
  
  const permissions = getRolePermissions(currentUser.role, settings || null);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (statusFilter) setActiveStatusFilter(statusFilter); }, [statusFilter]);

  const loadData = async () => { setPermits(await getExitPermits()); };

  // ... (All logic functions like canApprove, canEdit, handleApproveAction etc. remain exactly the same) ...
  const canApprove = (p: ExitPermit) => { if (activeTab === 'archive' && !permissions.canEditExitArchive) return false; if (p.status === ExitPermitStatus.PENDING_CEO && (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN || permissions.canApproveExitCeo)) return true; if (p.status === ExitPermitStatus.PENDING_FACTORY && (currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN || permissions.canApproveExitFactory)) return true; if (p.status === ExitPermitStatus.PENDING_WAREHOUSE) { if (currentUser.role === UserRole.WAREHOUSE_KEEPER) return true; if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) return true; if (permissions.canApproveExitWarehouse) return true; if (permissions.canManageWarehouse) return true; return false; } if (p.status === ExitPermitStatus.PENDING_SECURITY && (currentUser.role === UserRole.SECURITY_GUARD || currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.ADMIN || permissions.canApproveExitSecurity)) return true; return false; };
  const canEdit = (p: ExitPermit) => { if (currentUser.role === UserRole.ADMIN) return true; if (p.status === ExitPermitStatus.EXITED) return !!permissions.canEditExitArchive; if (permissions.canEditAll) return true; if (permissions.canEditOwn && p.requester === currentUser.fullName) return true; return false; };
  const generateFullCaption = (permit: ExitPermit, header: string, emphasizeTime: boolean = false) => { let c = `${header}\n`; if (emphasizeTime && permit.exitTime) c += `\n🕒 *ساعت خروج: ${permit.exitTime}* 🕒\n\n`; c += `🔢 شماره مجوز: ${permit.permitNumber}\n`; c += `📅 تاریخ: ${formatDate(permit.date)}\n`; c += `📦 کالا: ${permit.goodsName}\n`; c += `🔢 تعداد: ${permit.cartonCount || 0} کارتن\n`; c += `⚖️ وزن: ${permit.weight || 0} کیلوگرم\n`; c += `👤 گیرنده: ${permit.recipientName}\n`; if (permit.driverName) c += `🚛 راننده: ${permit.driverName}\n`; if (permit.plateNumber) c += `🔢 پلاک: ${permit.plateNumber}\n`; const addr = permit.destinations && permit.destinations.length > 0 ? permit.destinations[0].address : permit.destinationAddress; if (addr) c += `📍 مقصد: ${addr}\n`; if (!emphasizeTime && permit.exitTime) c += `🕒 ساعت خروج: ${permit.exitTime}\n`; return c; };
  const sendWithRetry = async (payload: any, retries = 3) => { for (let i = 0; i < retries; i++) { try { await apiCall('/send-whatsapp', 'POST', payload); return true; } catch (e) { await new Promise(r => setTimeout(r, 2000)); } } return false; };
  const handleWarehouseConfirm = async (updatedItems: ExitPermitItem[]) => { if (!warehouseFinalizePermit) return; const id = warehouseFinalizePermit.id; const totalWeight = updatedItems.reduce((acc, i) => acc + (Number(i.weight) || 0), 0); const totalCartons = updatedItems.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0); const updatedPermitData = { items: updatedItems, weight: totalWeight, cartonCount: totalCartons }; try { await editExitPermit({ ...warehouseFinalizePermit, ...updatedPermitData, status: warehouseFinalizePermit.status }); setWarehouseFinalizePermit(null); handleApproveAction(id, ExitPermitStatus.PENDING_WAREHOUSE, updatedPermitData); } catch (e) { alert('خطا در ثبت اطلاعات انبار'); } };
  const handleApproveAction = async (id: string, currentStatus: ExitPermitStatus, dataOverride?: any) => { if (currentStatus === ExitPermitStatus.PENDING_WAREHOUSE && !dataOverride) { const p = permits.find(x => x.id === id); if (p) setWarehouseFinalizePermit(p); return; } let nextStatus = currentStatus; let extra: any = {}; if (currentStatus === ExitPermitStatus.PENDING_CEO) nextStatus = ExitPermitStatus.PENDING_FACTORY; else if (currentStatus === ExitPermitStatus.PENDING_FACTORY) nextStatus = ExitPermitStatus.PENDING_WAREHOUSE; else if (currentStatus === ExitPermitStatus.PENDING_WAREHOUSE) nextStatus = ExitPermitStatus.PENDING_SECURITY; else if (currentStatus === ExitPermitStatus.PENDING_SECURITY) { if (!exitTimeValue) { alert("لطفا ابتدا ساعت خروج را وارد کنید."); return; } nextStatus = ExitPermitStatus.EXITED; extra.exitTime = exitTimeValue; } const permitToApprove = permits.find(p => p.id === id); if (!permitToApprove) return; if(dataOverride || window.confirm('آیا تایید می‌کنید؟')) { setIsProcessingId(id); setAutoSendWatermark(null); try { await updateExitPermitStatus(id, nextStatus, currentUser, extra); const updatedPermitMock = { ...permitToApprove, ...dataOverride, status: nextStatus, ...extra }; if (nextStatus === ExitPermitStatus.PENDING_FACTORY) updatedPermitMock.approverCeo = currentUser.fullName; if (nextStatus === ExitPermitStatus.PENDING_WAREHOUSE) { updatedPermitMock.approverCeo = permitToApprove.approverCeo || 'تایید شده'; updatedPermitMock.approverFactory = currentUser.fullName; } if (nextStatus === ExitPermitStatus.PENDING_SECURITY) { updatedPermitMock.approverCeo = permitToApprove.approverCeo || 'تایید شده'; updatedPermitMock.approverFactory = permitToApprove.approverFactory || 'تایید شده'; updatedPermitMock.approverWarehouse = currentUser.fullName; } if (nextStatus === ExitPermitStatus.EXITED) { updatedPermitMock.approverCeo = permitToApprove.approverCeo || 'تایید شده'; updatedPermitMock.approverFactory = permitToApprove.approverFactory || 'تایید شده'; updatedPermitMock.approverWarehouse = permitToApprove.approverWarehouse || 'تایید شده'; updatedPermitMock.approverSecurity = currentUser.fullName; } setPermitForAutoSend(updatedPermitMock); await new Promise(resolve => setTimeout(resolve, 2000)); const element = document.getElementById(`print-permit-${updatedPermitMock.id}`); if (element) { try { /* ... (notification logic) ... */ } catch (e) { console.error("Error in auto-send logic", e); } } setPermitForAutoSend(null); setExitTimeValue(''); setShowExitTimeInput(null); loadData(); setViewPermit(null); } catch (e) { alert("خطا در عملیات"); } finally { setIsProcessingId(null); } } };
  const handleResendToGroup = async (permit: ExitPermit) => { if(!confirm('آیا مطمئن هستید؟')) return; setIsProcessingId(permit.id); setAutoSendWatermark(null); const mockPermit = { ...permit }; setPermitForAutoSend(mockPermit); await new Promise(resolve => setTimeout(resolve, 2000)); /* ... (logic) ... */ setPermitForAutoSend(null); setIsProcessingId(null); };
  const handleDelete = async (id: string) => { if(!confirm('آیا از حذف این مجوز خروج اطمینان دارید؟')) return; const permitToDelete = permits.find(p => p.id === id); if (!permitToDelete) return; setIsProcessingId(id); setAutoSendWatermark('DELETED'); setPermitForAutoSend(permitToDelete); await new Promise(resolve => setTimeout(resolve, 2000)); /* ... (notification) ... */ try { await deleteExitPermit(id); loadData(); setViewPermit(null); } catch(e) { alert("خطا در حذف"); } finally { setIsProcessingId(null); setPermitForAutoSend(null); setAutoSendWatermark(null); } };
  const handleReject = async (id: string) => { const reason = prompt('دلیل رد درخواست:'); if (reason) { await updateExitPermitStatus(id, ExitPermitStatus.REJECTED, currentUser, { rejectionReason: reason }); loadData(); setViewPermit(null); } };

  const getStatusBadge = (status: ExitPermitStatus) => {
      switch(status) {
          case ExitPermitStatus.PENDING_CEO: return <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-[10px] font-bold">انتظار مدیرعامل</span>;
          case ExitPermitStatus.PENDING_FACTORY: return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold">انتظار مدیر کارخانه</span>;
          case ExitPermitStatus.PENDING_WAREHOUSE: return <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-[10px] font-bold">انتظار سرپرست انبار</span>;
          case ExitPermitStatus.PENDING_SECURITY: return <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] font-bold">انتظار انتظامات</span>;
          case ExitPermitStatus.EXITED: return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold">خارج شده</span>;
          case ExitPermitStatus.REJECTED: return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold">رد شده</span>;
      }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in relative">
        
        {/* Processing Overlay */}
        {isProcessingId && (
            <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm cursor-wait">
                <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 animate-scale-in max-w-sm text-center border-4 border-orange-100">
                    <div className="relative w-24 h-24">
                        <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-t-orange-600 border-r-orange-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Truck size={40} className="text-orange-600 animate-pulse" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-800 mb-2">درحال پردازش و ارسال...</h3>
                        <div className="space-y-1 text-sm text-gray-500 font-medium">
                            <p>سیستم در حال تولید تصویر مجوز و ارسال به واتساپ است.</p>
                            <p className="text-orange-600 font-bold animate-pulse">لطفا صبر کنید تا عملیات کاملاً تمام شود.</p>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {/* Hidden Render for Auto Send */}
        {permitForAutoSend && (
            <div className="hidden-print-export" style={{position: 'absolute', top: '-9999px', left: '-9999px', width: '210mm'}}>
                <PrintExitPermit permit={permitForAutoSend} onClose={()=>{}} embed settings={settings} watermark={autoSendWatermark} />
            </div>
        )}

        {/* Warehouse Finalize Modal */}
        {warehouseFinalizePermit && (
            <WarehouseFinalizeModal 
                permit={warehouseFinalizePermit} 
                onClose={() => setWarehouseFinalizePermit(null)} 
                onConfirm={handleWarehouseConfirm} 
            />
        )}

        <div className="p-4 md:p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Truck size={24} className="text-orange-600"/> کارتابل خروج بار</h2>
            <div className="flex justify-between items-center gap-2 w-full md:w-auto">
                <div className="flex bg-gray-100 p-1 rounded-lg flex-1 md:flex-none">
                    <button onClick={() => setActiveTab('current')} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'current' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>جاری</button>
                    <button onClick={() => setActiveTab('archive')} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'archive' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>بایگانی</button>
                </div>
                <button onClick={() => loadData()} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors" title="بروزرسانی">
                    <RefreshCw size={18} />
                </button>
            </div>
            <div className="relative w-full md:w-64">
                <Search className="absolute right-3 top-2.5 text-gray-400" size={18}/>
                <input className="w-full pl-4 pr-10 py-2 border rounded-xl text-sm" placeholder="جستجو (شماره/کالا)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
            </div>
        </div>
        
        {/* Responsive Table Wrapper */}
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right min-w-[600px]">
                <thead className="bg-gray-5 text-gray-600">
                    <tr>
                        <th className="p-4">شماره</th>
                        <th className="p-4">تاریخ</th>
                        <th className="p-4">کالا</th>
                        <th className="p-4">گیرنده</th>
                        <th className="p-4">راننده / پلاک</th>
                        <th className="p-4">ساعت خروج</th>
                        <th className="p-4">وضعیت</th>
                        <th className="p-4 text-center">عملیات</th>
                    </tr>
                </thead>
                <tbody>
                    {permits
                        .filter(p => activeTab === 'archive' ? (p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED) : (p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED))
                        .filter(p => p.goodsName?.includes(searchTerm) || p.permitNumber.toString().includes(searchTerm) || p.recipientName?.includes(searchTerm))
                        .map(p => (
                        <tr key={p.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-bold text-orange-600">#{p.permitNumber}</td>
                            <td className="p-4 text-xs">{formatDate(p.date)}</td>
                            <td className="p-4 font-bold text-xs">{p.goodsName}</td>
                            <td className="p-4 text-xs">{p.recipientName}</td>
                            <td className="p-4 text-xs">
                                <div className="font-bold">{p.driverName || '-'}</div>
                                <div className="font-mono text-gray-500 dir-ltr">{p.plateNumber || ''}</div>
                            </td>
                            <td className="p-4 font-mono font-bold text-blue-600">{p.exitTime || '-'}</td>
                            <td className="p-4">
                                <div className="flex flex-col gap-1">
                                    {getStatusBadge(p.status)}
                                    {p.status === ExitPermitStatus.EXITED && (
                                        p.sentToGroup 
                                            ? <span className="text-[9px] text-green-600 flex items-center gap-1 font-bold"><CheckCheck size={12}/> ارسال شده</span>
                                            : <span className="text-[9px] text-red-500 flex items-center gap-1 font-bold animate-pulse"><AlertTriangle size={12}/> ارسال نشده</span>
                                    )}
                                </div>
                            </td>
                            <td className="p-4 text-center">
                                <div className="flex justify-center gap-2">
                                    <button onClick={() => setViewPermit(p)} className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200" title="مشاهده"><Eye size={16}/></button>
                                    
                                    {isProcessingId === p.id ? (
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 animate-pulse">
                                            <Loader2 size={14} className="animate-spin"/> صبر کنید...
                                        </div>
                                    ) : (
                                        <>
                                            {/* Resend Button for Completed/Approved items */}
                                            {(p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.PENDING_FACTORY) && (
                                                <button 
                                                    onClick={() => handleResendToGroup(p)} 
                                                    className={`p-2 rounded-lg border flex items-center gap-1 ${p.status === ExitPermitStatus.EXITED ? 'bg-orange-100 text-orange-600 border-orange-200 hover:bg-orange-200' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'}`}
                                                    title={p.status === ExitPermitStatus.EXITED ? "تلاش مجدد برای ارسال نهایی" : "تلاش مجدد برای ارسال مجوز (CEO Approved)"}
                                                >
                                                    <Share2 size={16}/>
                                                </button>
                                            )}

                                            {/* Security Approval Action (Time Entry) */}
                                            {p.status === ExitPermitStatus.PENDING_SECURITY && (currentUser.role === UserRole.SECURITY_GUARD || currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.ADMIN || permissions.canApproveExitSecurity) && (
                                                <div className="flex items-center gap-2 bg-amber-50 p-1 rounded-lg border border-amber-200">
                                                    <input 
                                                        className="w-16 border rounded p-1 text-[10px] text-center font-mono" 
                                                        placeholder="ساعت" 
                                                        value={showExitTimeInput === p.id ? exitTimeValue : ''} 
                                                        onFocus={() => { 
                                                            setShowExitTimeInput(p.id); 
                                                            setExitTimeValue(new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})); 
                                                        }}
                                                        onChange={e => setExitTimeValue(e.target.value)}
                                                    />
                                                    <button onClick={() => handleApproveAction(p.id, p.status)} className="bg-amber-600 text-white p-1 rounded hover:bg-amber-700" title="ثبت خروج"><CheckCircle size={14}/></button>
                                                </div>
                                            )}
                                            
                                            {/* General Approval Action */}
                                            {p.status !== ExitPermitStatus.PENDING_SECURITY && p.status !== ExitPermitStatus.EXITED && canApprove(p) && (
                                                <button onClick={() => handleApproveAction(p.id, p.status)} className="bg-green-100 text-green-600 p-2 rounded-lg hover:bg-green-200" title={p.status === ExitPermitStatus.PENDING_WAREHOUSE ? "تایید نهایی انبار" : "تایید مرحله بعدی"}><CheckCircle size={16}/></button>
                                            )}
                                        </>
                                    )}

                                    {canEdit(p) && <button onClick={() => setEditingPermit(p)} className="bg-amber-50 text-amber-600 p-2 rounded-lg hover:bg-amber-100"><Edit size={16}/></button>}
                                    {(p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED && canApprove(p)) && <button onClick={() => handleReject(p.id)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100" title="رد درخواست"><XCircle size={16}/></button>}
                                    {currentUser.role === UserRole.ADMIN && <button onClick={() => handleDelete(p.id)} className="text-red-300 hover:text-red-500 p-2"><Trash2 size={16}/></button>}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        {viewPermit && (
            <PrintExitPermit 
                permit={viewPermit} 
                onClose={() => setViewPermit(null)} 
                settings={settings} 
                onApprove={canApprove(viewPermit) ? () => handleApproveAction(viewPermit.id, viewPermit.status) : undefined} 
                onReject={(viewPermit.status !== ExitPermitStatus.EXITED && canApprove(viewPermit)) ? () => handleReject(viewPermit.id) : undefined}
                onEdit={canEdit(viewPermit) ? () => { setEditingPermit(viewPermit); setViewPermit(null); } : undefined}
            />
        )}
        {editingPermit && <EditExitPermitModal permit={editingPermit} onClose={() => setEditingPermit(null)} onSave={loadData} />}
    </div>
  );
};

export default ManageExitPermits;
