
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings, ExitPermitItem } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, editExitPermit } from '../services/storageService';
import { getRolePermissions, getUsers } from '../services/authService'; 
import { formatDate } from '../constants';
import { Eye, Trash2, Search, CheckCircle, Truck, XCircle, Edit, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
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
  
  const permissions = getRolePermissions(currentUser.role, settings || null, currentUser);

  useEffect(() => { loadData(); }, []);
  
  useEffect(() => { 
      if (statusFilter === 'pending') setActiveTab('current'); 
  }, [statusFilter]);

  const loadData = async () => { setPermits(await getExitPermits()); };

  // --- ACCESS CONTROL ---
  const canApprove = (p: ExitPermit) => {
      // 1. Admin Override
      if (currentUser.role === UserRole.ADMIN) return true;

      // 2. Strict Workflow Steps
      // Step 1: CEO
      if (p.status === ExitPermitStatus.PENDING_CEO) {
          return currentUser.role === UserRole.CEO || permissions.canApproveExitCeo;
      }
      // Step 2: Factory Manager
      if (p.status === ExitPermitStatus.PENDING_FACTORY) {
          return currentUser.role === UserRole.FACTORY_MANAGER || permissions.canApproveExitFactory;
      }
      // Step 3: Warehouse Supervisor
      if (p.status === ExitPermitStatus.PENDING_WAREHOUSE) {
          return currentUser.role === UserRole.WAREHOUSE_KEEPER || permissions.canApproveExitWarehouse;
      }
      // Step 4: Security Supervisor
      if (p.status === ExitPermitStatus.PENDING_SECURITY) {
          return currentUser.role === UserRole.SECURITY_HEAD || permissions.canApproveExitSecurity;
      }

      return false;
  };

  const canEdit = (p: ExitPermit) => {
      if (currentUser.role === UserRole.ADMIN) return true;
      if (p.status === ExitPermitStatus.EXITED) return !!permissions.canEditExitArchive;
      if (permissions.canEditAll) return true;
      if (permissions.canEditOwn && p.requester === currentUser.fullName) return true;
      // Sales Manager can edit if rejected or pending
      if (currentUser.role === UserRole.SALES_MANAGER) return true;
      return false;
  };

  const isSecurityStep = (p: ExitPermit) => {
      return p.status === ExitPermitStatus.PENDING_SECURITY && canApprove(p);
  };

  // --- NOTIFICATION HELPERS ---
  const generateCaption = (permit: ExitPermit, title: string) => {
      let c = `${title}\n`;
      c += `🔢 شماره: ${permit.permitNumber}\n`;
      c += `📅 تاریخ: ${formatDate(permit.date)}\n`;
      c += `👤 گیرنده: ${permit.recipientName}\n`;
      if(permit.exitTime) c += `🕒 ساعت خروج: ${permit.exitTime}\n`;
      c += `----------------\n`;
      c += `📦 اقلام:\n${permit.goodsName}\n`;
      c += `تعداد نهایی: ${permit.cartonCount} کارتن | وزن: ${permit.weight} kg`;
      return c;
  };

  const sendToNumber = async (number: string, caption: string, imageBase64: string) => {
      if (!number) return;
      try {
          await apiCall('/send-whatsapp', 'POST', { 
              number: number, 
              message: caption, 
              mediaData: { data: imageBase64, mimeType: 'image/png' } 
          });
      } catch (e) { console.error("Failed to send to " + number, e); }
  };

  const handleApproveAction = async (id: string, currentStatus: ExitPermitStatus, dataOverride?: any) => {
      // WAREHOUSE SPECIAL STEP: NEEDS INPUT
      if (currentStatus === ExitPermitStatus.PENDING_WAREHOUSE && !dataOverride) {
          const p = permits.find(x => x.id === id);
          if (p) setWarehouseFinalizePermit(p);
          return;
      }

      // Determine Next Status
      let nextStatus = currentStatus;
      if (currentStatus === ExitPermitStatus.PENDING_CEO) nextStatus = ExitPermitStatus.PENDING_FACTORY;
      else if (currentStatus === ExitPermitStatus.PENDING_FACTORY) nextStatus = ExitPermitStatus.PENDING_WAREHOUSE;
      else if (currentStatus === ExitPermitStatus.PENDING_WAREHOUSE) nextStatus = ExitPermitStatus.PENDING_SECURITY;
      else if (currentStatus === ExitPermitStatus.PENDING_SECURITY) nextStatus = ExitPermitStatus.EXITED;

      const permitToApprove = permits.find(p => p.id === id);
      if (!permitToApprove) return;

      const confirmMsg = isSecurityStep(permitToApprove) ? `ثبت خروج نهایی و اطلاع‌رسانی؟` : 'آیا تایید می‌کنید؟';
      if (!dataOverride && !window.confirm(confirmMsg)) return;

      setIsProcessingId(id);
      
      try {
          const extraUpdate: any = {};
          if (currentStatus === ExitPermitStatus.PENDING_CEO) extraUpdate.approverCeo = currentUser.fullName;
          if (currentStatus === ExitPermitStatus.PENDING_FACTORY) extraUpdate.approverFactory = currentUser.fullName;
          if (currentStatus === ExitPermitStatus.PENDING_WAREHOUSE) extraUpdate.approverWarehouse = currentUser.fullName;
          if (currentStatus === ExitPermitStatus.PENDING_SECURITY) {
              extraUpdate.approverSecurity = currentUser.fullName;
              extraUpdate.exitTime = exitTimeValue || new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
          }

          const updatePayload = { ...extraUpdate, ...dataOverride };
          // Optimistically update locally
          const updatedPermitMock = { ...permitToApprove, status: nextStatus, ...updatePayload };
          
          await updateExitPermitStatus(id, nextStatus, currentUser, updatePayload);
          setPermitForAutoSend(updatedPermitMock);
          
          // Wait for render
          await new Promise(r => setTimeout(r, 2000));

          const element = document.getElementById(`print-permit-${updatedPermitMock.id}`);
          if (element) {
              // @ts-ignore
              const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
              const base64 = canvas.toDataURL('image/png').split(',')[1];
              const users = await getUsers();

              // --- NOTIFICATION LOGIC (5 Steps) ---
              const group1 = settings?.exitPermitGroup1; // Mgmt/Sales
              const group2 = settings?.exitPermitGroup2; // Ops/Warehouse

              // 1. CEO Approved -> Notify Group 1 & Factory Manager
              if (nextStatus === ExitPermitStatus.PENDING_FACTORY) {
                  const caption = generateCaption(updatedPermitMock, "📢 *تایید مدیرعامل انجام شد*");
                  if (group1) await sendToNumber(group1, caption, base64);
                  
                  const factoryMgr = users.find(u => u.role === UserRole.FACTORY_MANAGER && u.phoneNumber);
                  if (factoryMgr) await sendToNumber(factoryMgr.phoneNumber!, caption, base64);
              } 
              // 2. Factory Manager Approved -> Notify Group 2 & Warehouse Supervisor
              else if (nextStatus === ExitPermitStatus.PENDING_WAREHOUSE) {
                  const caption = generateCaption(updatedPermitMock, "🏭 *تایید مدیر کارخانه انجام شد*");
                  if (group2) await sendToNumber(group2, caption, base64);

                  const warehouseSup = users.find(u => u.role === UserRole.WAREHOUSE_KEEPER && u.phoneNumber);
                  if (warehouseSup) await sendToNumber(warehouseSup.phoneNumber!, caption, base64);
              }
              // 3. Warehouse Approved (Input Done) -> Notify Group 2 & Security Supervisor
              else if (nextStatus === ExitPermitStatus.PENDING_SECURITY) {
                  const caption = generateCaption(updatedPermitMock, "📦 *تایید انبار/توزین انجام شد*");
                  if (group2) await sendToNumber(group2, caption, base64);

                  const securitySup = users.find(u => u.role === UserRole.SECURITY_HEAD && u.phoneNumber);
                  if (securitySup) await sendToNumber(securitySup.phoneNumber!, caption, base64);
              }
              // 4. Security Approved (Exit Time) -> Notify Group 1 & Group 2 (FINAL)
              else if (nextStatus === ExitPermitStatus.EXITED) {
                  const caption = generateCaption(updatedPermitMock, "✅ *خروج نهایی کالا ثبت شد*");
                  if (group1) await sendToNumber(group1, caption, base64);
                  if (group2) await sendToNumber(group2, caption, base64);
              }
          }

          setPermitForAutoSend(null);
          loadData();
          setViewPermit(null);
          setExitTimeValue('');
          setShowExitTimeInput(null);

      } catch (e) {
          alert('خطا در انجام عملیات');
          console.error(e);
      } finally {
          setIsProcessingId(null);
      }
  };

  const handleWarehouseConfirm = async (updatedItems: ExitPermitItem[]) => {
      if (!warehouseFinalizePermit) return;
      const totalWeight = updatedItems.reduce((acc, i) => acc + (Number(i.weight) || 0), 0);
      const totalCartons = updatedItems.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0);
      
      const overrideData = { 
          items: updatedItems, 
          weight: totalWeight, 
          cartonCount: totalCartons 
      };
      
      // Update the permit data first
      await editExitPermit({ ...warehouseFinalizePermit, ...overrideData });
      
      const id = warehouseFinalizePermit.id;
      setWarehouseFinalizePermit(null);
      
      // Proceed to approve
      handleApproveAction(id, ExitPermitStatus.PENDING_WAREHOUSE, overrideData);
  };

  const handleDelete = async (id: string) => {
      if(!confirm('آیا از حذف این مجوز اطمینان دارید؟')) return;
      await deleteExitPermit(id);
      loadData();
  };

  const handleReject = async (id: string) => {
      const reason = prompt('دلیل رد درخواست:');
      if (reason) {
          await updateExitPermitStatus(id, ExitPermitStatus.REJECTED, currentUser, { rejectionReason: reason });
          loadData();
          setViewPermit(null);
      }
  };

  const getStatusBadge = (status: ExitPermitStatus) => { 
      switch(status) { 
          case ExitPermitStatus.PENDING_CEO: return <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-[10px] font-bold">انتظار مدیرعامل</span>; 
          case ExitPermitStatus.PENDING_FACTORY: return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold">انتظار مدیر کارخانه</span>; 
          case ExitPermitStatus.PENDING_WAREHOUSE: return <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-[10px] font-bold">انتظار انبار/توزین</span>; 
          case ExitPermitStatus.PENDING_SECURITY: return <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] font-bold">انتظار انتظامات</span>; 
          case ExitPermitStatus.EXITED: return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold">خارج شده</span>; 
          case ExitPermitStatus.REJECTED: return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold">رد شده</span>; 
      } 
  };

  const filteredPermits = permits
      .filter(p => activeTab === 'archive' 
          ? (p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED) 
          : (p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED)
      )
      .filter(p => 
          p.goodsName?.includes(searchTerm) || 
          p.permitNumber.toString().includes(searchTerm) || 
          p.recipientName?.includes(searchTerm)
      );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in relative">
        {isProcessingId && (<div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm cursor-wait"><div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6"><Loader2 size={40} className="text-orange-600 animate-spin" /><h3 className="text-xl font-bold">درحال پردازش و ارسال پیام...</h3></div></div>)}
        
        {permitForAutoSend && (
            <div className="hidden-print-export" style={{ position: 'fixed', top: -9999, left: -9999, width: '210mm' }}>
                <div id={`print-permit-${permitForAutoSend.id}`}>
                    <PrintExitPermit permit={permitForAutoSend} onClose={()=>{}} embed settings={settings} />
                </div>
            </div>
        )}
        
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
                <thead className="bg-gray-5 text-gray-600"><tr><th className="p-4">شماره</th><th className="p-4">تاریخ</th><th className="p-4">کالا</th><th className="p-4">گیرنده</th><th className="p-4">وضعیت</th><th className="p-4 text-center">عملیات</th></tr></thead>
                <tbody>
                    {filteredPermits.map(p => {
                        const showApprove = canApprove(p) && !isSecurityStep(p);
                        
                        return (
                        <tr key={p.id} className="border-b hover:bg-gray-50">
                            <td className="p-4 font-bold text-orange-600">#{p.permitNumber}</td>
                            <td className="p-4 text-xs">{formatDate(p.date)}</td>
                            <td className="p-4 font-bold text-xs max-w-[200px] truncate" title={p.goodsName}>{p.goodsName}</td>
                            <td className="p-4 text-xs">{p.recipientName}</td>
                            <td className="p-4">{getStatusBadge(p.status)}</td>
                            <td className="p-4 text-center">
                                <div className="flex justify-center gap-2">
                                    <button onClick={() => setViewPermit(p)} className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200"><Eye size={16}/></button>
                                    
                                    {showApprove && (
                                        <button onClick={() => handleApproveAction(p.id, p.status)} className="bg-green-100 text-green-600 p-2 rounded-lg hover:bg-green-200" title="تایید"><CheckCircle size={16}/></button>
                                    )}

                                    {isSecurityStep(p) && (
                                        <div className="flex items-center gap-1 bg-amber-50 p-1 rounded-lg border border-amber-200">
                                            <input 
                                                className="w-14 border rounded p-1 text-[12px] text-center font-bold font-mono bg-white" 
                                                placeholder="--:--" 
                                                value={showExitTimeInput === p.id ? exitTimeValue : ''} 
                                                onFocus={() => { setShowExitTimeInput(p.id); setExitTimeValue(new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})); }}
                                                onChange={e => setExitTimeValue(e.target.value)} 
                                            />
                                            <button onClick={() => handleApproveAction(p.id, p.status)} className="bg-amber-600 text-white p-1.5 rounded hover:bg-amber-700 shadow-sm"><CheckCircle size={16}/></button>
                                        </div>
                                    )}

                                    {canEdit(p) && <button onClick={() => setEditingPermit(p)} className="bg-amber-50 text-amber-600 p-2 rounded-lg hover:bg-amber-100"><Edit size={16}/></button>}
                                    {canApprove(p) && p.status !== ExitPermitStatus.EXITED && <button onClick={() => handleReject(p.id)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100"><XCircle size={16}/></button>}
                                    {currentUser.role === UserRole.ADMIN && <button onClick={() => handleDelete(p.id)} className="text-red-300 hover:text-red-500 p-2"><Trash2 size={16}/></button>}
                                </div>
                            </td>
                        </tr>
                    )})}
                    {filteredPermits.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">موردی یافت نشد.</td></tr>}
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
