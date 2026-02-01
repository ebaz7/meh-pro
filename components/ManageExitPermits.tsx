
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings, ExitPermitItem } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, editExitPermit } from '../services/storageService';
import { getRolePermissions, getUsers } from '../services/authService'; 
import { formatDate } from '../constants';
import { Eye, Trash2, Search, CheckCircle, Truck, XCircle, Edit, Loader2, RefreshCw, Share2, CheckCheck, AlertTriangle, Clock } from 'lucide-react';
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
  
  // Calculate permissions once
  const permissions = getRolePermissions(currentUser.role, settings || null, currentUser);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (statusFilter) setActiveStatusFilter(statusFilter); }, [statusFilter]);

  const loadData = async () => { setPermits(await getExitPermits()); };

  // --- APPROVAL CHECK LOGIC ---
  const canApprove = (p: ExitPermit) => {
      // 1. Admin always approves
      if (currentUser.role === UserRole.ADMIN) return true;

      // 2. Check Stage vs Permission
      if (p.status === ExitPermitStatus.PENDING_CEO) {
          return !!permissions.canApproveExitCeo;
      }
      
      if (p.status === ExitPermitStatus.PENDING_FACTORY) {
          return !!permissions.canApproveExitFactory;
      }
      
      if (p.status === ExitPermitStatus.PENDING_WAREHOUSE) {
          return !!permissions.canApproveExitWarehouse;
      }
      
      if (p.status === ExitPermitStatus.PENDING_SECURITY) {
          return !!permissions.canApproveExitSecurity;
      }
      
      return false;
  };

  const canEdit = (p: ExitPermit) => {
      if (currentUser.role === UserRole.ADMIN) return true;
      if ((p.status as any) === ExitPermitStatus.EXITED) return !!permissions.canEditExitArchive;
      if (permissions.canEditAll) return true;
      if (permissions.canEditOwn && p.requester === currentUser.fullName) return true;
      // Allow Sales Manager to edit pending permits
      if (currentUser.role === UserRole.SALES_MANAGER && (p.status as any) !== ExitPermitStatus.EXITED) return true;
      return false;
  };

  const canShare = (p: ExitPermit) => true; 

  // Security step logic
  const isSecurityStep = (p: ExitPermit) => {
      return p.status === ExitPermitStatus.PENDING_SECURITY && canApprove(p);
  };

  const handleSecurityClick = (permitId: string) => {
      const now = new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
      setExitTimeValue(now);
      setShowExitTimeInput(permitId);
  };

  const generateFullCaption = (permit: ExitPermit, header: string, emphasizeTime: boolean = false) => {
      let c = `${header}\n`;
      if (emphasizeTime && permit.exitTime) c += `\n🕒 *ساعت خروج: ${permit.exitTime}* 🕒\n\n`;
      c += `🔢 شماره مجوز: ${permit.permitNumber}\n`;
      c += `📅 تاریخ: ${formatDate(permit.date)}\n`;
      c += `👤 گیرنده: ${permit.recipientName}\n`;
      if (permit.driverName) c += `🚛 راننده: ${permit.driverName}\n`;
      if (permit.plateNumber) c += `🔢 پلاک: ${permit.plateNumber}\n`;
      c += `\n📦 *لیست اقلام:*\n`;
      if (permit.items && permit.items.length > 0) {
          permit.items.forEach((item, idx) => {
              const qty = item.cartonCount || 0;
              const w = item.weight || 0;
              const delQty = item.deliveredCartonCount ?? qty;
              const delW = item.deliveredWeight ?? w;
              c += `${idx + 1}. ${item.goodsName}\n   ▫️ تعداد: ${delQty} کارتن\n   ▫️ وزن: ${delW} کیلوگرم\n`;
          });
      } else { c += `▫️ ${permit.goodsName}\n`; }
      const totalDeliveredCartons = permit.items?.reduce((s, i) => s + (i.deliveredCartonCount ?? i.cartonCount), 0) || permit.cartonCount;
      const totalDeliveredWeight = permit.items?.reduce((s, i) => s + (i.deliveredWeight ?? i.weight), 0) || permit.weight;
      c += `\n----------------\n`;
      c += `📊 *جمع کل:*\n`;
      c += `تعداد: ${totalDeliveredCartons} کارتن\n`;
      c += `وزن: ${totalDeliveredWeight} کیلوگرم\n`;
      return c;
  };

  const handleWarehouseConfirm = async (updatedItems: ExitPermitItem[]) => {
      if (!warehouseFinalizePermit) return;
      const id = warehouseFinalizePermit.id;
      const totalWeight = updatedItems.reduce((acc, i) => acc + (Number(i.weight) || 0), 0);
      const totalCartons = updatedItems.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0);
      const updatedPermitData = { items: updatedItems, weight: totalWeight, cartonCount: totalCartons };
      try {
          await editExitPermit({ ...warehouseFinalizePermit, ...updatedPermitData, status: warehouseFinalizePermit.status });
          setWarehouseFinalizePermit(null);
          handleApproveAction(id, ExitPermitStatus.PENDING_WAREHOUSE, updatedPermitData);
      } catch (e) { alert('خطا در ثبت اطلاعات انبار'); }
  };

  const handleApproveAction = async (id: string, currentStatus: ExitPermitStatus, dataOverride?: any) => {
      const isCeoStage = currentStatus === ExitPermitStatus.PENDING_CEO;
      const isFactoryStage = currentStatus === ExitPermitStatus.PENDING_FACTORY;
      const isWarehouseStage = currentStatus === ExitPermitStatus.PENDING_WAREHOUSE;
      const isSecurityStage = currentStatus === ExitPermitStatus.PENDING_SECURITY;

      if (isWarehouseStage && !dataOverride) {
          const p = permits.find(x => x.id === id);
          if (p) setWarehouseFinalizePermit(p);
          return;
      }

      let nextStatus = currentStatus;
      let extra: any = {};
      if (isCeoStage) nextStatus = ExitPermitStatus.PENDING_FACTORY;
      else if (isFactoryStage) nextStatus = ExitPermitStatus.PENDING_WAREHOUSE; 
      else if (isWarehouseStage) nextStatus = ExitPermitStatus.PENDING_SECURITY; 
      else if (isSecurityStage) {
          nextStatus = ExitPermitStatus.EXITED;
          const finalTime = exitTimeValue || new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
          extra.exitTime = finalTime;
      }
      
      const permitToApprove = permits.find(p => p.id === id);
      if (!permitToApprove) return;

      const confirmMsg = isSecurityStage ? `ثبت خروج نهایی؟ ساعت: ${extra.exitTime}` : 'آیا تایید می‌کنید؟';

      if(dataOverride || window.confirm(confirmMsg)) {
          setIsProcessingId(id); 
          setAutoSendWatermark(null); 
          try {
              await updateExitPermitStatus(id, nextStatus, currentUser, extra);
              
              const updatedPermitMock = { ...permitToApprove, ...dataOverride, status: nextStatus, ...extra };
              // Signature Logic
              if (isCeoStage) updatedPermitMock.approverCeo = currentUser.fullName;
              if (isFactoryStage) { updatedPermitMock.approverCeo = permitToApprove.approverCeo || 'تایید شده'; updatedPermitMock.approverFactory = currentUser.fullName; }
              if (isWarehouseStage) { updatedPermitMock.approverCeo = permitToApprove.approverCeo || 'تایید شده'; updatedPermitMock.approverFactory = permitToApprove.approverFactory || 'تایید شده'; updatedPermitMock.approverWarehouse = currentUser.fullName; }
              if (isSecurityStage) { updatedPermitMock.approverCeo = permitToApprove.approverCeo || 'تایید شده'; updatedPermitMock.approverFactory = permitToApprove.approverFactory || 'تایید شده'; updatedPermitMock.approverWarehouse = permitToApprove.approverWarehouse || 'تایید شده'; updatedPermitMock.approverSecurity = currentUser.fullName; updatedPermitMock.exitTime = extra.exitTime; }

              setPermitForAutoSend(updatedPermitMock);
              await new Promise(resolve => setTimeout(resolve, 3000));

              const element = document.getElementById(`print-permit-${updatedPermitMock.id}`);
              if (element) {
                  try {
                      // @ts-ignore
                      const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
                      const base64 = canvas.toDataURL('image/png').split(',')[1];
                      const users = await getUsers();
                      const group1 = settings?.exitPermitNotificationGroup;
                      const group2 = settings?.exitPermitSecondGroupConfig?.groupId;

                      const send = async (num: string, msg: string) => {
                          try { await apiCall('/send-whatsapp', 'POST', { number: num, message: msg, mediaData: { data: base64, mimeType: 'image/png' } }); } catch(e){}
                      };

                      if (nextStatus === ExitPermitStatus.PENDING_FACTORY) {
                          const title = "📢 *مجوز تایید شد (توسط مدیرعامل)*";
                          const caption = generateFullCaption(updatedPermitMock, title);
                          users.filter(u => u.role === UserRole.FACTORY_MANAGER && u.phoneNumber).forEach(u => send(u.phoneNumber!, caption));
                          if (group1) send(group1, caption);
                      } else if (nextStatus === ExitPermitStatus.PENDING_WAREHOUSE) {
                          const caption = generateFullCaption(updatedPermitMock, "🏭 *تایید مدیر کارخانه انجام شد* (مجوز ورود به انبار)");
                          users.filter(u => u.role === UserRole.WAREHOUSE_KEEPER && u.phoneNumber).forEach(u => send(u.phoneNumber!, caption));
                      } else if (nextStatus === ExitPermitStatus.PENDING_SECURITY) {
                          const caption = generateFullCaption(updatedPermitMock, "📦 *تایید انبار و توزین انجام شد* (مجوز خروج انتظامات)");
                          if (group2) send(group2, caption);
                      } else if (nextStatus === ExitPermitStatus.EXITED) {
                          const caption = generateFullCaption(updatedPermitMock, "✅ *خروج نهایی بار از کارخانه ثبت شد*", true);
                          if (group1) { await send(group1, caption); await updateExitPermitStatus(id, ExitPermitStatus.EXITED, currentUser, { sentToGroup: true }); }
                          if (group2) send(group2, caption);
                      }
                  } catch (e) { console.error(e); }
              }
              setPermitForAutoSend(null); setExitTimeValue(''); setShowExitTimeInput(null); loadData(); setViewPermit(null);
          } catch (e) { alert("خطا در عملیات"); } finally { setIsProcessingId(null); }
      }
  };

  const handleResendToGroup = async (permit: ExitPermit) => { /* ...existing logic... */ if(!confirm('ارسال مجدد؟')) return; setIsProcessingId(permit.id); setPermitForAutoSend({ ...permit }); await new Promise(r => setTimeout(r, 3000)); const el = document.getElementById(`print-permit-${permit.id}`); if(el && settings?.exitPermitNotificationGroup) { // @ts-ignore
  try{ const c = await window.html2canvas(el, {scale:2,backgroundColor:'#fff'}); const b64 = c.toDataURL('image/png').split(',')[1]; let cap = permit.status===ExitPermitStatus.EXITED ? generateFullCaption(permit, "✅ *خروج نهایی (ارسال مجدد)*", true) : generateFullCaption(permit, "📢 *مجوز خروج (ارسال مجدد)*"); await apiCall('/send-whatsapp','POST',{number:settings.exitPermitNotificationGroup, message:cap, mediaData:{data:b64, mimeType:'image/png'}}); alert('ارسال شد'); } catch(e){alert('خطا');} } setIsProcessingId(null); setPermitForAutoSend(null); };
  const handleDelete = async (id: string) => { if(!confirm('حذف؟')) return; setIsProcessingId(id); setAutoSendWatermark('DELETED'); const p = permits.find(x=>x.id===id); if(p) { setPermitForAutoSend(p); await new Promise(r=>setTimeout(r,3000)); const el=document.getElementById(`print-permit-${p.id}`); if(el && settings?.exitPermitNotificationGroup) { // @ts-ignore
  try { const c = await window.html2canvas(el, {scale:2,backgroundColor:'#fff'}); const b64 = c.toDataURL('image/png').split(',')[1]; await apiCall('/send-whatsapp','POST',{number:settings.exitPermitNotificationGroup, message:`❌❌ *مجوز حذف شد* ❌❌\nشماره: ${p.permitNumber}`, mediaData:{data:b64, mimeType:'image/png'}}); } catch(e){} } } await deleteExitPermit(id); loadData(); setPermitForAutoSend(null); setIsProcessingId(null); setAutoSendWatermark(null); };
  const handleReject = async (id: string) => { const r = prompt('دلیل رد:'); if(r) { await updateExitPermitStatus(id, ExitPermitStatus.REJECTED, currentUser, {rejectionReason:r}); loadData(); setViewPermit(null); } };
  const getStatusBadge = (status: ExitPermitStatus) => { switch(status) { case ExitPermitStatus.PENDING_CEO: return <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-[10px] font-bold">انتظار مدیرعامل</span>; case ExitPermitStatus.PENDING_FACTORY: return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold">انتظار مدیر کارخانه</span>; case ExitPermitStatus.PENDING_WAREHOUSE: return <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-[10px] font-bold">انتظار انبار/توزین</span>; case ExitPermitStatus.PENDING_SECURITY: return <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] font-bold">انتظار انتظامات</span>; case ExitPermitStatus.EXITED: return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold">خارج شده</span>; case ExitPermitStatus.REJECTED: return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold">رد شده</span>; } };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in relative">
        {isProcessingId && (<div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm cursor-wait"><div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6"><Loader2 size={40} className="text-orange-600 animate-spin" /><h3 className="text-xl font-bold">درحال پردازش...</h3></div></div>)}
        {permitForAutoSend && (<div className="hidden-print-export" style={{ position: 'fixed', top: -9999, left: -9999, width: '210mm' }}><div id={`print-permit-${permitForAutoSend.id}`}><PrintExitPermit permit={permitForAutoSend} onClose={()=>{}} embed settings={settings} watermark={autoSendWatermark} /></div></div>)}
        {warehouseFinalizePermit && (<WarehouseFinalizeModal permit={warehouseFinalizePermit} onClose={() => setWarehouseFinalizePermit(null)} onConfirm={handleWarehouseConfirm} />)}

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
                    {permits
                        .filter(p => activeTab === 'archive' ? (p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED) : (p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED))
                        .filter(p => p.goodsName?.includes(searchTerm) || p.permitNumber.toString().includes(searchTerm))
                        .map(p => (
                        <tr key={p.id} className="border-b hover:bg-gray-50">
                            <td className="p-4 font-bold text-orange-600">#{p.permitNumber}</td>
                            <td className="p-4 text-xs">{formatDate(p.date)}</td>
                            <td className="p-4 font-bold text-xs">{p.goodsName}</td>
                            <td className="p-4 text-xs">{p.recipientName}</td>
                            <td className="p-4">{getStatusBadge(p.status)}</td>
                            <td className="p-4 text-center">
                                <div className="flex justify-center gap-2">
                                    <button onClick={() => setViewPermit(p)} className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200"><Eye size={16}/></button>
                                    
                                    {/* Action Buttons Logic - Using Auth Service Perms */}
                                    {canApprove(p) && !isSecurityStep(p) && (
                                        <button onClick={() => handleApproveAction(p.id, p.status)} className="bg-green-100 text-green-600 p-2 rounded-lg hover:bg-green-200" title="تایید"><CheckCircle size={16}/></button>
                                    )}

                                    {/* Security Step Logic */}
                                    {isSecurityStep(p) && (
                                        <div className="flex items-center gap-1 bg-amber-50 p-1 rounded-lg border border-amber-200">
                                            <input className="w-14 border rounded p-1 text-[12px] text-center font-bold font-mono bg-white" placeholder="--:--" value={showExitTimeInput === p.id ? exitTimeValue : ''} onFocus={() => handleSecurityClick(p.id)} onChange={e => setExitTimeValue(e.target.value)} />
                                            <button onClick={() => handleApproveAction(p.id, p.status)} className="bg-amber-600 text-white p-1.5 rounded hover:bg-amber-700 shadow-sm"><CheckCircle size={16}/></button>
                                        </div>
                                    )}

                                    {canShare(p) && <button onClick={() => handleResendToGroup(p)} className="p-2 rounded-lg border bg-blue-50 text-blue-600 hover:bg-blue-100"><Share2 size={16}/></button>}
                                    {canEdit(p) && <button onClick={() => setEditingPermit(p)} className="bg-amber-50 text-amber-600 p-2 rounded-lg hover:bg-amber-100"><Edit size={16}/></button>}
                                    {canApprove(p) && p.status !== ExitPermitStatus.EXITED && <button onClick={() => handleReject(p.id)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100"><XCircle size={16}/></button>}
                                    {currentUser.role === UserRole.ADMIN && <button onClick={() => handleDelete(p.id)} className="text-red-300 hover:text-red-500 p-2"><Trash2 size={16}/></button>}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        {viewPermit && (<PrintExitPermit permit={viewPermit} onClose={() => setViewPermit(null)} settings={settings} onApprove={canApprove(viewPermit) ? () => handleApproveAction(viewPermit.id, viewPermit.status) : undefined} onReject={(viewPermit.status !== ExitPermitStatus.EXITED && canApprove(viewPermit)) ? () => handleReject(viewPermit.id) : undefined} onEdit={canEdit(viewPermit) ? () => { setEditingPermit(viewPermit); setViewPermit(null); } : undefined} />)}
        {editingPermit && <EditExitPermitModal permit={editingPermit} onClose={() => setEditingPermit(null)} onSave={loadData} />}
    </div>
  );
};

export default ManageExitPermits;
