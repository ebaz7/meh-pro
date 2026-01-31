
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings, ExitPermitItem } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, editExitPermit } from '../services/storageService';
import { getRolePermissions, getUsers } from '../services/authService'; 
import { formatDate } from '../constants';
import { Eye, Trash2, Search, CheckCircle, Truck, XCircle, Edit, Loader2, RefreshCw, Share2, CheckCheck, AlertTriangle, Clock, Scale } from 'lucide-react';
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
  
  const [showExitTimeInput, setShowExitTimeInput] = useState<string | null>(null); 
  const [exitTimeValue, setExitTimeValue] = useState('');
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  
  // For Auto-Send: We render the Permit in a hidden div with Updated Data
  const [permitForAutoSend, setPermitForAutoSend] = useState<ExitPermit | null>(null);
  const [autoSendWatermark, setAutoSendWatermark] = useState<'DELETED' | 'EDITED' | null>(null);
  
  // Warehouse Modal
  const [warehouseFinalizePermit, setWarehouseFinalizePermit] = useState<ExitPermit | null>(null);
  
  // Permissions
  const permissions = getRolePermissions(currentUser.role, settings || null, currentUser);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => { setPermits(await getExitPermits()); };

  // --- STRICT APPROVAL LOGIC ---
  const canApprove = (p: ExitPermit) => {
      if (currentUser.role === UserRole.ADMIN) return true; // Admin creates god-mode

      if (p.status === ExitPermitStatus.PENDING_CEO && permissions.canApproveExitCeo) return true;
      if (p.status === ExitPermitStatus.PENDING_FACTORY && permissions.canApproveExitFactory) return true;
      if (p.status === ExitPermitStatus.PENDING_WAREHOUSE && permissions.canApproveExitWarehouse) return true;
      if (p.status === ExitPermitStatus.PENDING_SECURITY && permissions.canApproveExitSecurity) return true;
      
      return false;
  };

  const isSecurityStep = (p: ExitPermit) => p.status === ExitPermitStatus.PENDING_SECURITY && canApprove(p);

  const handleSecurityClick = (permitId: string) => {
      const now = new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
      setExitTimeValue(now);
      setShowExitTimeInput(permitId);
  };

  // --- WORKFLOW ACTIONS ---

  // 1. Warehouse Step: Open Modal First
  const initiateWarehouseApproval = (permit: ExitPermit) => {
      setWarehouseFinalizePermit(permit);
  };

  // 2. Warehouse Confirm: Save Data & Proceed
  const handleWarehouseConfirm = async (updatedItems: ExitPermitItem[]) => {
      if (!warehouseFinalizePermit) return;
      
      const totalWeight = updatedItems.reduce((acc, i) => acc + (Number(i.deliveredWeight ?? i.weight) || 0), 0);
      const totalCartons = updatedItems.reduce((acc, i) => acc + (Number(i.deliveredCartonCount ?? i.cartonCount) || 0), 0);
      
      // Update DB with Warehouse Data but KEEP Status PENDING_WAREHOUSE temporarily
      const updatedPermit = { 
          ...warehouseFinalizePermit, 
          items: updatedItems, 
          weight: totalWeight, 
          cartonCount: totalCartons 
      };
      
      try {
          // Save changes first
          await editExitPermit(updatedPermit);
          setWarehouseFinalizePermit(null);
          // Then Trigger Approval
          handleApproveAction(updatedPermit.id, ExitPermitStatus.PENDING_WAREHOUSE, updatedPermit);
      } catch (e) { 
          alert('خطا در ثبت اطلاعات انبار'); 
      }
  };

  // 3. MAIN APPROVE HANDLER
  const handleApproveAction = async (id: string, currentStatus: ExitPermitStatus, dataOverride?: any) => {
      const permitToApprove = permits.find(p => p.id === id);
      if (!permitToApprove && !dataOverride) return;
      const basePermit = dataOverride || permitToApprove;

      let nextStatus = currentStatus;
      let targetGroups: ('GROUP1' | 'GROUP2')[] = [];
      let extraData: any = {};
      let confirmMessage = 'آیا تایید می‌کنید؟';

      // --- LOGIC MAP ---
      if (currentStatus === ExitPermitStatus.PENDING_CEO) {
          // Step 2: CEO -> Factory
          nextStatus = ExitPermitStatus.PENDING_FACTORY;
          targetGroups = ['GROUP1']; // Send to Main Group
          extraData.approverCeo = currentUser.fullName;
      } 
      else if (currentStatus === ExitPermitStatus.PENDING_FACTORY) {
          // Step 3: Factory -> Warehouse
          nextStatus = ExitPermitStatus.PENDING_WAREHOUSE;
          targetGroups = ['GROUP2']; // Send to Warehouse Group
          extraData.approverFactory = currentUser.fullName;
      }
      else if (currentStatus === ExitPermitStatus.PENDING_WAREHOUSE) {
          // Step 4: Warehouse -> Security
          // (Data already updated via Modal)
          nextStatus = ExitPermitStatus.PENDING_SECURITY;
          targetGroups = ['GROUP2']; // Send result to Warehouse Group
          extraData.approverWarehouse = currentUser.fullName;
      }
      else if (currentStatus === ExitPermitStatus.PENDING_SECURITY) {
          // Step 5: Security -> EXITED
          confirmMessage = `ثبت خروج نهایی؟ ساعت: ${exitTimeValue || '---'}`;
          nextStatus = ExitPermitStatus.EXITED;
          targetGroups = ['GROUP1', 'GROUP2']; // Send to BOTH
          extraData.approverSecurity = currentUser.fullName;
          extraData.exitTime = exitTimeValue || new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
      }

      if (window.confirm(confirmMessage)) {
          setIsProcessingId(id);
          try {
              // 1. Update Status in DB
              await updateExitPermitStatus(id, nextStatus, currentUser, extraData);
              
              // 2. Prepare Mock for Image Generation (Merge all updates)
              const updatedPermitForImage = { 
                  ...basePermit, 
                  status: nextStatus, 
                  ...extraData 
              };
              
              setPermitForAutoSend(updatedPermitForImage);

              // 3. Wait for Render & Capture
              setTimeout(async () => {
                  const elementId = `print-permit-${updatedPermitForImage.id}`;
                  const element = document.getElementById(elementId);
                  
                  if (element) {
                      try {
                          // @ts-ignore
                          const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
                          const base64 = canvas.toDataURL('image/png').split(',')[1];
                          
                          // Determine Groups
                          const group1 = settings?.exitPermitNotificationGroup;
                          const group2 = settings?.exitPermitSecondGroupConfig?.groupId;

                          const send = async (target: string | undefined, caption: string) => {
                              if (target) {
                                  await apiCall('/send-whatsapp', 'POST', { 
                                      number: target, 
                                      message: caption, 
                                      mediaData: { data: base64, mimeType: 'image/png', filename: 'permit.png' } 
                                  });
                              }
                          };

                          let caption = '';
                          if (nextStatus === ExitPermitStatus.PENDING_FACTORY) {
                              caption = `📢 *تایید مدیرعامل انجام شد*\nمجوز شماره ${updatedPermitForImage.permitNumber} جهت بررسی مدیر کارخانه ارسال شد.`;
                          } else if (nextStatus === ExitPermitStatus.PENDING_WAREHOUSE) {
                              caption = `🏭 *تایید مدیر کارخانه انجام شد*\nمجوز شماره ${updatedPermitForImage.permitNumber} جهت صدور حواله به انبار ارسال شد.`;
                          } else if (nextStatus === ExitPermitStatus.PENDING_SECURITY) {
                              caption = `📦 *تایید انبار و توزین انجام شد*\nمجوز شماره ${updatedPermitForImage.permitNumber} آماده خروج (انتظامات).`;
                          } else if (nextStatus === ExitPermitStatus.EXITED) {
                              caption = `✅ *خروج نهایی ثبت شد*\nمجوز شماره ${updatedPermitForImage.permitNumber}\n🕒 ساعت خروج: ${extraData.exitTime}`;
                          }

                          // Send based on Logic Map
                          if (targetGroups.includes('GROUP1')) await send(group1, caption);
                          if (targetGroups.includes('GROUP2')) await send(group2, caption);

                          // Also notify Factory Manager personally if moving to Factory
                          if (nextStatus === ExitPermitStatus.PENDING_FACTORY) {
                              const users = await getUsers();
                              users.filter(u => u.role === UserRole.FACTORY_MANAGER && u.phoneNumber).forEach(u => send(u.phoneNumber, caption));
                          }

                      } catch (e) { console.error('Notification Error', e); }
                  }
                  
                  // Cleanup
                  setPermitForAutoSend(null);
                  setExitTimeValue('');
                  setShowExitTimeInput(null);
                  setIsProcessingId(null);
                  loadData();
                  setViewPermit(null);

              }, 2500); // 2.5s Delay

          } catch (e) {
              alert('خطا در انجام عملیات');
              setIsProcessingId(null);
          }
      }
  };

  const handleReject = async (id: string) => { 
      const r = prompt('دلیل رد:'); 
      if (r) { 
          await updateExitPermitStatus(id, ExitPermitStatus.REJECTED, currentUser, {rejectionReason:r}); 
          loadData(); 
          setViewPermit(null); 
      } 
  };

  const handleDelete = async (id: string) => { 
      if(!confirm('حذف؟')) return; 
      await deleteExitPermit(id); 
      loadData(); 
  };

  const getStatusBadge = (status: ExitPermitStatus) => {
      const badges = {
          [ExitPermitStatus.PENDING_CEO]: { color: 'bg-purple-100 text-purple-800', text: 'انتظار مدیرعامل' },
          [ExitPermitStatus.PENDING_FACTORY]: { color: 'bg-blue-100 text-blue-800', text: 'انتظار مدیر کارخانه' },
          [ExitPermitStatus.PENDING_WAREHOUSE]: { color: 'bg-orange-100 text-orange-800', text: 'انتظار انبار' },
          [ExitPermitStatus.PENDING_SECURITY]: { color: 'bg-amber-100 text-amber-800', text: 'انتظار خروج' },
          [ExitPermitStatus.EXITED]: { color: 'bg-green-100 text-green-800', text: 'خارج شده' },
          [ExitPermitStatus.REJECTED]: { color: 'bg-red-100 text-red-800', text: 'رد شده' },
      };
      const b = badges[status] || badges[ExitPermitStatus.PENDING_CEO];
      return <span className={`${b.color} px-2 py-1 rounded text-[10px] font-bold`}>{b.text}</span>;
  };

  const filteredPermits = permits
      .filter(p => activeTab === 'archive' ? (p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED) : (p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED))
      .filter(p => p.goodsName?.includes(searchTerm) || p.permitNumber.toString().includes(searchTerm))
      .sort((a,b) => b.createdAt! - a.createdAt!);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in relative min-h-[500px]">
        {isProcessingId && (<div className="absolute inset-0 bg-white/80 z-[50] flex items-center justify-center backdrop-blur-sm"><div className="flex flex-col items-center"><Loader2 size={40} className="text-blue-600 animate-spin" /><span className="mt-2 font-bold text-gray-700">درحال پردازش و ارسال...</span></div></div>)}
        
        {/* Hidden Render Area for Auto-Send */}
        {permitForAutoSend && (
            <div className="hidden-print-export" style={{ position: 'fixed', top: -9999, left: -9999, width: '210mm' }}>
                <div id={`print-permit-${permitForAutoSend.id}`}>
                    <PrintExitPermit permit={permitForAutoSend} onClose={()=>{}} embed settings={settings} />
                </div>
            </div>
        )}

        {/* Warehouse Modal */}
        {warehouseFinalizePermit && (
            <WarehouseFinalizeModal 
                permit={warehouseFinalizePermit} 
                onClose={() => setWarehouseFinalizePermit(null)} 
                onConfirm={handleWarehouseConfirm} 
            />
        )}

        <div className="p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Truck size={24} className="text-orange-600"/> کارتابل خروج بار</h2>
            <div className="flex gap-2">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('current')} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'current' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>جاری</button>
                    <button onClick={() => setActiveTab('archive')} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'archive' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>بایگانی</button>
                </div>
                <button onClick={loadData} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600"><RefreshCw size={18}/></button>
            </div>
            <div className="relative w-full md:w-64"><Search className="absolute right-3 top-2.5 text-gray-400" size={18}/><input className="w-full pl-4 pr-10 py-2 border rounded-xl text-sm" placeholder="جستجو..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 text-gray-600"><tr><th className="p-4">شماره</th><th className="p-4">تاریخ</th><th className="p-4">کالا</th><th className="p-4">گیرنده</th><th className="p-4">وضعیت</th><th className="p-4 text-center">عملیات</th></tr></thead>
                <tbody>
                    {filteredPermits.map(p => (
                        <tr key={p.id} className="border-b hover:bg-gray-50">
                            <td className="p-4 font-bold text-orange-600">#{p.permitNumber}</td>
                            <td className="p-4 text-xs">{formatDate(p.date)}</td>
                            <td className="p-4 font-bold text-xs max-w-[150px] truncate" title={p.goodsName}>{p.goodsName}</td>
                            <td className="p-4 text-xs">{p.recipientName}</td>
                            <td className="p-4">{getStatusBadge(p.status)}</td>
                            <td className="p-4 text-center">
                                <div className="flex justify-center gap-2 items-center">
                                    <button onClick={() => setViewPermit(p)} className="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-100" title="مشاهده"><Eye size={16}/></button>
                                    
                                    {/* Action Button Logic */}
                                    {canApprove(p) && (
                                        <>
                                            {/* Special Case: Warehouse needs Modal */}
                                            {p.status === ExitPermitStatus.PENDING_WAREHOUSE ? (
                                                <button onClick={() => initiateWarehouseApproval(p)} className="bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 font-bold flex items-center gap-1 shadow-sm">
                                                    <Scale size={16}/> تایید انبار
                                                </button>
                                            ) : 
                                            /* Special Case: Security needs Time Input */
                                            p.status === ExitPermitStatus.PENDING_SECURITY ? (
                                                <div className="flex items-center gap-1 bg-amber-50 p-1 rounded-lg border border-amber-200">
                                                    <input className="w-16 border rounded p-1 text-[12px] text-center font-bold font-mono bg-white" placeholder="--:--" value={showExitTimeInput === p.id ? exitTimeValue : ''} onFocus={() => handleSecurityClick(p.id)} onChange={e => setExitTimeValue(e.target.value)} />
                                                    <button onClick={() => handleApproveAction(p.id, p.status)} className="bg-amber-600 text-white p-1.5 rounded hover:bg-amber-700 shadow-sm"><CheckCircle size={16}/></button>
                                                </div>
                                            ) : (
                                                /* Standard Approval */
                                                <button onClick={() => handleApproveAction(p.id, p.status)} className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-bold flex items-center gap-1 shadow-sm">
                                                    <CheckCircle size={16}/> تایید
                                                </button>
                                            )}
                                            
                                            <button onClick={() => handleReject(p.id)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100"><XCircle size={16}/></button>
                                        </>
                                    )}

                                    {/* Edit / Delete */}
                                    {currentUser.role === UserRole.ADMIN && <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-500 p-2"><Trash2 size={16}/></button>}
                                    {p.status !== ExitPermitStatus.EXITED && <button onClick={() => setEditingPermit(p)} className="text-amber-500 hover:bg-amber-50 p-2 rounded"><Edit size={16}/></button>}
                                </div>
                            </td>
                        </tr>
                    ))}
                    {filteredPermits.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">موردی یافت نشد</td></tr>}
                </tbody>
            </table>
        </div>
        
        {/* Modals */}
        {viewPermit && (<PrintExitPermit permit={viewPermit} onClose={() => setViewPermit(null)} settings={settings} />)}
        {editingPermit && <EditExitPermitModal permit={editingPermit} onClose={() => setEditingPermit(null)} onSave={loadData} />}
    </div>
  );
};

export default ManageExitPermits;
