
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings, ExitPermitItem } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, editExitPermit } from '../services/storageService';
import { getUsers, getRolePermissions } from '../services/authService'; 
import { formatDate } from '../constants';
import { Eye, Trash2, Search, CheckCircle, Truck, XCircle, Edit, Loader2, RefreshCw, Scale } from 'lucide-react';
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
  
  const [permitForAutoSend, setPermitForAutoSend] = useState<ExitPermit | null>(null);
  const [warehouseFinalizePermit, setWarehouseFinalizePermit] = useState<ExitPermit | null>(null);

  // Calculate Permissions
  const permissions = getRolePermissions(currentUser.role, settings || null, currentUser);
  const isAdmin = currentUser.role === UserRole.ADMIN; // Explicit Admin Check

  useEffect(() => { loadData(); }, []);

  const loadData = async () => { setPermits(await getExitPermits()); };

  // --- STRICT WORKFLOW ACTION RENDERER ---
  const renderActionButtons = (p: ExitPermit) => {
      const status = p.status;

      // 1. CEO APPROVAL
      if (status === ExitPermitStatus.PENDING_CEO) {
          if (isAdmin || currentUser.role === UserRole.CEO || permissions.canApproveExitCeo) {
              return (
                  <>
                      <button onClick={() => handleApproveAction(p.id, status)} className="bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 font-bold flex items-center gap-1 shadow-sm text-xs">
                          <CheckCircle size={16}/> تایید مدیرعامل
                      </button>
                      <button onClick={() => handleReject(p.id)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100"><XCircle size={16}/></button>
                  </>
              );
          }
      }

      // 2. FACTORY MANAGER APPROVAL
      if (status === ExitPermitStatus.PENDING_FACTORY) {
          if (isAdmin || currentUser.role === UserRole.FACTORY_MANAGER || permissions.canApproveExitFactory) {
              return (
                  <>
                      <button onClick={() => handleApproveAction(p.id, status)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-bold flex items-center gap-1 shadow-sm text-xs">
                          <CheckCircle size={16}/> تایید مدیر کارخانه
                      </button>
                      <button onClick={() => handleReject(p.id)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100"><XCircle size={16}/></button>
                  </>
              );
          }
      }

      // 3. WAREHOUSE APPROVAL & WEIGHING
      if (status === ExitPermitStatus.PENDING_WAREHOUSE) {
          if (isAdmin || currentUser.role === UserRole.WAREHOUSE_KEEPER || permissions.canApproveExitWarehouse) {
              return (
                  <>
                      <button onClick={() => initiateWarehouseApproval(p)} className="bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 font-bold flex items-center gap-1 shadow-sm text-xs">
                          <Scale size={16}/> تایید وزن و تحویل
                      </button>
                      <button onClick={() => handleReject(p.id)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100"><XCircle size={16}/></button>
                  </>
              );
          }
      }

      // 4. SECURITY APPROVAL / FINAL EXIT
      if (status === ExitPermitStatus.PENDING_SECURITY) {
          if (isAdmin || currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.SECURITY_GUARD || permissions.canApproveExitSecurity) {
              return (
                  <>
                      <div className="flex items-center gap-1 bg-amber-50 p-1 rounded-lg border border-amber-200">
                          <input className="w-16 border rounded p-1 text-[12px] text-center font-bold font-mono bg-white" placeholder="--:--" value={showExitTimeInput === p.id ? exitTimeValue : ''} onFocus={() => handleSecurityClick(p.id)} onChange={e => setExitTimeValue(e.target.value)} />
                          <button onClick={() => handleApproveAction(p.id, status)} className="bg-green-600 text-white p-1.5 rounded hover:bg-green-700 shadow-sm" title="تایید خروج"><CheckCircle size={16}/></button>
                      </div>
                      <button onClick={() => handleReject(p.id)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100"><XCircle size={16}/></button>
                  </>
              );
          }
      }

      // 5. GENERIC EDIT
      if (status !== ExitPermitStatus.EXITED) {
          if (isAdmin || permissions.canEditAll || (permissions.canCreateExitPermit && status === ExitPermitStatus.PENDING_CEO)) {
              return <button onClick={() => setEditingPermit(p)} className="text-amber-500 hover:bg-amber-50 p-2 rounded"><Edit size={16}/></button>;
          }
      }

      return null;
  };

  const handleSecurityClick = (permitId: string) => {
      const now = new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
      setExitTimeValue(now);
      setShowExitTimeInput(permitId);
  };

  const initiateWarehouseApproval = (permit: ExitPermit) => {
      setWarehouseFinalizePermit(permit);
  };

  const handleWarehouseConfirm = async (updatedItems: ExitPermitItem[]) => {
      if (!warehouseFinalizePermit) return;
      
      const totalWeight = updatedItems.reduce((acc, i) => acc + (Number(i.deliveredWeight ?? i.weight) || 0), 0);
      const totalCartons = updatedItems.reduce((acc, i) => acc + (Number(i.deliveredCartonCount ?? i.cartonCount) || 0), 0);
      
      const updatedPermitData = { 
          ...warehouseFinalizePermit, 
          items: updatedItems, 
          weight: totalWeight, 
          cartonCount: totalCartons 
      };
      
      await handleApproveAction(updatedPermitData.id, ExitPermitStatus.PENDING_WAREHOUSE, updatedPermitData);
      setWarehouseFinalizePermit(null);
  };

  // --- MAIN APPROVAL LOGIC REWRITTEN ---
  const handleApproveAction = async (id: string, currentStatus: ExitPermitStatus, dataOverride?: any) => {
      const permitToApprove = permits.find(p => p.id === id);
      if (!permitToApprove && !dataOverride) return;
      
      const basePermit = dataOverride || permitToApprove;
      const users = await getUsers(); // Needed for roles

      let nextStatus = currentStatus;
      let extraData: any = {};
      let confirmMessage = 'آیا تایید می‌کنید؟';
      let notificationCaption = '';
      
      // Target Lists
      let targetPhoneNumbers: string[] = [];

      // Groups from Settings
      const group1 = settings?.exitPermitNotificationGroup; // Group 1
      const group2 = settings?.exitPermitSecondGroupConfig?.groupId; // Group 2

      // --- STEP 2: CEO APPROVAL ---
      // Trigger: CEO Clicked
      // Action: Send to Group 1 AND Factory Manager
      if (currentStatus === ExitPermitStatus.PENDING_CEO) {
          nextStatus = ExitPermitStatus.PENDING_FACTORY;
          extraData.approverCeo = currentUser.fullName;
          notificationCaption = `📢 *تایید مدیرعامل انجام شد*\nمجوز شماره ${basePermit.permitNumber} جهت بررسی مدیر کارخانه ارسال شد.`;
          
          if (group1) targetPhoneNumbers.push(group1); // Group 1
          const factoryMgr = users.find(u => u.role === UserRole.FACTORY_MANAGER);
          if (factoryMgr?.phoneNumber) targetPhoneNumbers.push(factoryMgr.phoneNumber); // Factory Manager
      } 
      
      // --- STEP 3: FACTORY MANAGER APPROVAL ---
      // Trigger: Factory Mgr Clicked
      // Action: Send to Group 2 AND Warehouse Keeper
      else if (currentStatus === ExitPermitStatus.PENDING_FACTORY) {
          nextStatus = ExitPermitStatus.PENDING_WAREHOUSE;
          extraData.approverFactory = currentUser.fullName;
          notificationCaption = `🏭 *تایید مدیر کارخانه انجام شد*\nمجوز شماره ${basePermit.permitNumber} جهت صدور حواله به انبار ارسال شد.`;
          
          if (group2) targetPhoneNumbers.push(group2); // Group 2
          const warehouseKeeper = users.find(u => u.role === UserRole.WAREHOUSE_KEEPER);
          if (warehouseKeeper?.phoneNumber) targetPhoneNumbers.push(warehouseKeeper.phoneNumber); // Warehouse Keeper
      }
      
      // --- STEP 4: WAREHOUSE APPROVAL (AFTER WEIGHING) ---
      // Trigger: Warehouse Keeper Clicked & Entered Data
      // Action: Send to Group 2 AND Security Head
      else if (currentStatus === ExitPermitStatus.PENDING_WAREHOUSE) {
          nextStatus = ExitPermitStatus.PENDING_SECURITY;
          extraData.approverWarehouse = currentUser.fullName;
          notificationCaption = `📦 *تایید انبار و توزین انجام شد*\nمجوز شماره ${basePermit.permitNumber} آماده خروج (انتظامات).`;
          
          if (group2) targetPhoneNumbers.push(group2); // Group 2
          const securityHead = users.find(u => u.role === UserRole.SECURITY_HEAD);
          if (securityHead?.phoneNumber) targetPhoneNumbers.push(securityHead.phoneNumber); // Security Head
      }
      
      // --- STEP 5: SECURITY APPROVAL (FINAL EXIT) ---
      // Trigger: Security Head Clicked & Entered Time
      // Action: Send to Group 1 AND Group 2
      else if (currentStatus === ExitPermitStatus.PENDING_SECURITY) {
          const exitTime = exitTimeValue || new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
          confirmMessage = `ثبت خروج نهایی؟ ساعت: ${exitTime}`;
          nextStatus = ExitPermitStatus.EXITED;
          extraData.approverSecurity = currentUser.fullName;
          extraData.exitTime = exitTime;
          notificationCaption = `✅ *خروج نهایی ثبت شد*\nمجوز شماره ${basePermit.permitNumber}\n🕒 ساعت خروج: ${exitTime}`;
          
          if (group1) targetPhoneNumbers.push(group1); // Group 1
          if (group2) targetPhoneNumbers.push(group2); // Group 2
      }

      if (currentStatus !== ExitPermitStatus.PENDING_WAREHOUSE && !window.confirm(confirmMessage)) return;

      setIsProcessingId(id);

      try {
          // 1. Update Database
          const permitToSave = { ...basePermit, status: nextStatus, ...extraData };
          await editExitPermit(permitToSave);
          
          // 2. Prepare for Snapshot
          setPermitForAutoSend(permitToSave);

          // 3. Render, Snap, Send
          setTimeout(async () => {
              const elementId = `print-permit-${permitToSave.id}`;
              const element = document.getElementById(elementId);
              
              if (element) {
                  try {
                      // @ts-ignore
                      const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
                      const base64 = canvas.toDataURL('image/png').split(',')[1];
                      
                      // Filter duplicates
                      const uniqueTargets = [...new Set(targetPhoneNumbers)];

                      for (const target of uniqueTargets) {
                          await apiCall('/send-whatsapp', 'POST', { 
                              number: target, 
                              message: notificationCaption, 
                              mediaData: { data: base64, mimeType: 'image/png', filename: 'permit.png' } 
                          });
                      }

                  } catch (e) { console.error('Notification Error', e); }
              }
              
              setPermitForAutoSend(null);
              setExitTimeValue('');
              setShowExitTimeInput(null);
              setIsProcessingId(null);
              loadData();
              setViewPermit(null);

          }, 2500); 

      } catch (e) {
          alert('خطا در انجام عملیات');
          setIsProcessingId(null);
      }
  };

  const handleReject = async (id: string) => { 
      const r = prompt('دلیل رد:'); 
      if (r) { 
          await updateExitPermitStatus(id, ExitPermitStatus.REJECTED, currentUser, {rejectionReason:r}); 
          loadData(); 
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
        {/* Loading Overlay */}
        {isProcessingId && (<div className="absolute inset-0 bg-white/80 z-[50] flex items-center justify-center backdrop-blur-sm"><div className="flex flex-col items-center"><Loader2 size={40} className="text-blue-600 animate-spin" /><span className="mt-2 font-bold text-gray-700">درحال ارسال به مرحله بعد...</span></div></div>)}
        
        {/* Hidden Auto-Send Component */}
        {permitForAutoSend && (
            <div className="hidden-print-export" style={{ position: 'fixed', top: -9999, left: -9999, width: '210mm' }}>
                <div id={`print-permit-${permitForAutoSend.id}`}>
                    <PrintExitPermit permit={permitForAutoSend} onClose={()=>{}} embed settings={settings} />
                </div>
            </div>
        )}

        {/* Modal for Warehouse Finalization */}
        {warehouseFinalizePermit && (
            <WarehouseFinalizeModal 
                permit={warehouseFinalizePermit} 
                onClose={() => setWarehouseFinalizePermit(null)} 
                onConfirm={handleWarehouseConfirm} 
            />
        )}

        {/* Header */}
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
        
        {/* Table */}
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
                                    
                                    {/* --- MAIN RENDER LOGIC --- */}
                                    {renderActionButtons(p)}
                                    
                                    {(isAdmin || permissions.canDeleteAll) && <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-500 p-2"><Trash2 size={16}/></button>}
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
