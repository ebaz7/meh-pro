
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
  
  // Initialize with current time for easier input
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

  // --- STRICT & SIMPLE APPROVAL LOGIC (UPDATED WITH DIRECT ROLE CHECK) ---
  const canApprove = (p: ExitPermit) => {
      // 0. Admin always can
      if (currentUser.role === UserRole.ADMIN) return true;

      const role = currentUser.role;
      const status = p.status;

      // 1. CEO Step (Start)
      if (status === ExitPermitStatus.PENDING_CEO) {
          return role === UserRole.CEO || !!permissions.canApproveExitCeo;
      }
      
      // 2. Factory Manager Step (After CEO)
      if (status === ExitPermitStatus.PENDING_FACTORY) {
          return role === UserRole.FACTORY_MANAGER || role === UserRole.CEO || !!permissions.canApproveExitFactory;
      }
      
      // 3. Warehouse Step (After Factory)
      if (status === ExitPermitStatus.PENDING_WAREHOUSE) {
          return role === UserRole.WAREHOUSE_KEEPER || role === UserRole.CEO || role === UserRole.FACTORY_MANAGER || !!permissions.canApproveExitWarehouse;
      }
      
      // 4. Security Step (Final Exit)
      if (status === ExitPermitStatus.PENDING_SECURITY) {
          return role === UserRole.SECURITY_GUARD || role === UserRole.SECURITY_HEAD || role === UserRole.ADMIN || !!permissions.canApproveExitSecurity;
      }
      
      return false;
  };

  const canEdit = (p: ExitPermit) => {
      if (currentUser.role === UserRole.ADMIN) return true;
      if ((p.status as any) === ExitPermitStatus.EXITED) return !!permissions.canEditExitArchive;
      if (permissions.canEditAll) return true;
      if (permissions.canEditOwn && p.requester === currentUser.fullName) return true;
      // Sales Manager creates it, so they should be able to edit if rejected/pending
      if (currentUser.role === UserRole.SALES_MANAGER && (p.status as any) !== ExitPermitStatus.EXITED) return true;
      return false;
  };

  const canShare = (p: ExitPermit) => true; 

  // Is this the final security step?
  const isSecurityStep = (p: ExitPermit) => {
      return p.status === ExitPermitStatus.PENDING_SECURITY && canApprove(p);
  };

  const handleSecurityClick = (permitId: string) => {
      // Pre-fill time when clicking
      const now = new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
      setExitTimeValue(now);
      setShowExitTimeInput(permitId);
  };

  // ... (Rest of the component remains largely unchanged, just ensuring canApprove is used correctly) ...
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
              c += `${idx + 1}. ${item.goodsName}\n   ▫️ تعداد: ${qty} کارتن\n   ▫️ وزن: ${w} کیلوگرم\n`;
          });
      } else {
          c += `▫️ ${permit.goodsName}\n`;
      }

      c += `\n----------------\n`;
      c += `📊 *جمع کل:*\n`;
      c += `تعداد: ${permit.cartonCount || 0} کارتن\n`;
      c += `وزن: ${permit.weight || 0} کیلوگرم\n`;

      return c;
  };

  const sendWithRetry = async (payload: any, retries = 3) => {
      for (let i = 0; i < retries; i++) {
          try {
              await apiCall('/send-whatsapp', 'POST', payload);
              return true;
          } catch (e) {
              await new Promise(r => setTimeout(r, 2000));
          }
      }
      return false;
  };

  const handleWarehouseConfirm = async (updatedItems: ExitPermitItem[]) => {
      if (!warehouseFinalizePermit) return;
      const id = warehouseFinalizePermit.id;
      const totalWeight = updatedItems.reduce((acc, i) => acc + (Number(i.weight) || 0), 0);
      const totalCartons = updatedItems.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0);
      
      const updatedPermitData = {
          items: updatedItems,
          weight: totalWeight,
          cartonCount: totalCartons
      };

      try {
          await editExitPermit({ ...warehouseFinalizePermit, ...updatedPermitData, status: warehouseFinalizePermit.status });
          setWarehouseFinalizePermit(null);
          // Proceed to approve after saving details
          handleApproveAction(id, ExitPermitStatus.PENDING_WAREHOUSE, updatedPermitData);
      } catch (e) {
          alert('خطا در ثبت اطلاعات انبار');
      }
  };

  const handleApproveAction = async (id: string, currentStatus: ExitPermitStatus, dataOverride?: any) => {
      // Warehouse Check - Open Modal First
      if (currentStatus === ExitPermitStatus.PENDING_WAREHOUSE && !dataOverride) {
          const p = permits.find(x => x.id === id);
          if (p) setWarehouseFinalizePermit(p);
          return;
      }

      let nextStatus = currentStatus;
      let extra: any = {};

      // --- WORKFLOW TRANSITIONS (Linear) ---
      if (currentStatus === ExitPermitStatus.PENDING_CEO) nextStatus = ExitPermitStatus.PENDING_FACTORY;
      else if (currentStatus === ExitPermitStatus.PENDING_FACTORY) nextStatus = ExitPermitStatus.PENDING_WAREHOUSE; 
      else if (currentStatus === ExitPermitStatus.PENDING_WAREHOUSE) nextStatus = ExitPermitStatus.PENDING_SECURITY; 
      
      // --- SECURITY EXIT LOGIC ---
      else if (currentStatus === ExitPermitStatus.PENDING_SECURITY) {
          nextStatus = ExitPermitStatus.EXITED;
          const finalTime = exitTimeValue || new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
          extra.exitTime = finalTime;
      }
      
      const permitToApprove = permits.find(p => p.id === id);
      if (!permitToApprove) return;

      const confirmMsg = currentStatus === ExitPermitStatus.PENDING_SECURITY 
          ? `ثبت خروج نهایی؟ ساعت: ${extra.exitTime}` 
          : 'آیا تایید می‌کنید؟';

      if(dataOverride || window.confirm(confirmMsg)) {
          setIsProcessingId(id); 
          setAutoSendWatermark(null); 
          try {
              // 1. Update Status
              await updateExitPermitStatus(id, nextStatus, currentUser, extra);
              
              // 2. Prepare Mock Data for Image Generation (to reflect new state immediately)
              const updatedPermitMock = { ...permitToApprove, ...dataOverride, status: nextStatus, ...extra };
              
              // Apply Signatures Locally for Image
              if (currentStatus === ExitPermitStatus.PENDING_CEO) updatedPermitMock.approverCeo = currentUser.fullName;
              if (currentStatus === ExitPermitStatus.PENDING_FACTORY) {
                  updatedPermitMock.approverCeo = permitToApprove.approverCeo || 'تایید شده';
                  updatedPermitMock.approverFactory = currentUser.fullName;
              }
              if (currentStatus === ExitPermitStatus.PENDING_WAREHOUSE) {
                   updatedPermitMock.approverCeo = permitToApprove.approverCeo || 'تایید شده';
                   updatedPermitMock.approverFactory = permitToApprove.approverFactory || 'تایید شده';
                   updatedPermitMock.approverWarehouse = currentUser.fullName;
              }
              if (currentStatus === ExitPermitStatus.PENDING_SECURITY) {
                   updatedPermitMock.approverCeo = permitToApprove.approverCeo || 'تایید شده';
                   updatedPermitMock.approverFactory = permitToApprove.approverFactory || 'تایید شده';
                   updatedPermitMock.approverWarehouse = permitToApprove.approverWarehouse || 'تایید شده';
                   updatedPermitMock.approverSecurity = currentUser.fullName;
                   updatedPermitMock.exitTime = extra.exitTime;
              }

              // Mount hidden component for screenshot
              setPermitForAutoSend(updatedPermitMock);
              
              // 3. Wait for Render
              await new Promise(resolve => setTimeout(resolve, 3000));

              // 4. Capture & Send Notifications
              const element = document.getElementById(`print-permit-${updatedPermitMock.id}`);
              if (element) {
                  try {
                      // @ts-ignore
                      const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
                      const base64 = canvas.toDataURL('image/png').split(',')[1];
                      const users = await getUsers();
                      
                      const group1 = settings?.exitPermitNotificationGroup;
                      const group2 = settings?.exitPermitSecondGroupConfig?.groupId;

                      // --- NOTIFICATIONS PER STEP ---

                      // A. CEO Approved -> Send to Factory Manager
                      if (nextStatus === ExitPermitStatus.PENDING_FACTORY) {
                          const title = "📢 *مجوز تایید شد (توسط مدیرعامل)*";
                          const caption = generateFullCaption(updatedPermitMock, title);
                          
                          const factoryUsers = users.filter(u => u.role === UserRole.FACTORY_MANAGER && u.phoneNumber);
                          for (const fm of factoryUsers) {
                              try { await apiCall('/send-whatsapp', 'POST', { number: fm.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }); } catch (err) {}
                          }
                          // Notify Secondary Group if configured for this step
                          if (settings?.exitPermitSecondGroupConfig?.activeStatuses?.includes(ExitPermitStatus.PENDING_FACTORY) && group2) {
                               await sendWithRetry({ number: group2, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }, 2);
                          }
                      } 
                      
                      // B. Factory Manager Approved -> Send to Warehouse
                      else if (nextStatus === ExitPermitStatus.PENDING_WAREHOUSE) {
                          const caption = generateFullCaption(updatedPermitMock, "🏭 *تایید مدیر کارخانه انجام شد* (مجوز ورود به انبار)");
                          const warehouseUsers = users.filter(u => u.role === UserRole.WAREHOUSE_KEEPER && u.phoneNumber);
                          for (const whUser of warehouseUsers) { 
                              try { await apiCall('/send-whatsapp', 'POST', { number: whUser.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }); } catch (err) {} 
                          }
                          // Notify Secondary Group
                          if (settings?.exitPermitSecondGroupConfig?.activeStatuses?.includes(ExitPermitStatus.PENDING_WAREHOUSE) && group2) {
                               await sendWithRetry({ number: group2, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }, 2);
                          }
                      }
                      
                      // C. Warehouse Approved -> Send to Security
                      else if (nextStatus === ExitPermitStatus.PENDING_SECURITY) {
                          const caption = generateFullCaption(updatedPermitMock, "📦 *تایید انبار و توزین انجام شد* (مجوز خروج انتظامات)");
                          const securityUsers = users.filter(u => (u.role === UserRole.SECURITY_GUARD || u.role === UserRole.SECURITY_HEAD) && u.phoneNumber);
                          for (const sec of securityUsers) { 
                              try { await apiCall('/send-whatsapp', 'POST', { number: sec.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }); } catch (err) {} 
                          }
                          // Notify Secondary Group
                          if (settings?.exitPermitSecondGroupConfig?.activeStatuses?.includes(ExitPermitStatus.PENDING_SECURITY) && group2) {
                               await sendWithRetry({ number: group2, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }, 2);
                          }
                      }
                      
                      // D. Security Approved -> Final Exit
                      else if (nextStatus === ExitPermitStatus.EXITED) {
                          const caption = generateFullCaption(updatedPermitMock, "✅ *خروج نهایی بار از کارخانه ثبت شد*", true);
                          // Send to Main Group (Warehouse/Logistics)
                          if (group1) {
                              const success = await sendWithRetry({ number: group1, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }, 3);
                              if (success) { await updateExitPermitStatus(id, ExitPermitStatus.EXITED, currentUser, { sentToGroup: true }); }
                          }
                          // Notify Secondary Group
                          if (settings?.exitPermitSecondGroupConfig?.activeStatuses?.includes(ExitPermitStatus.EXITED) && group2) {
                               await sendWithRetry({ number: group2, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }, 2);
                          }
                      }

                  } catch (e) { console.error("Error in auto-send logic", e); }
              }
              
              setPermitForAutoSend(null);
              setExitTimeValue('');
              setShowExitTimeInput(null);
              loadData();
              setViewPermit(null);

          } catch (e) {
              alert("خطا در عملیات");
          } finally {
              setIsProcessingId(null);
          }
      }
  };

  const handleResendToGroup = async (permit: ExitPermit) => {
      if(!confirm('آیا مطمئن هستید که می‌خواهید مجوز را مجدداً به گروه ارسال کنید؟')) return;
      
      setIsProcessingId(permit.id);
      setAutoSendWatermark(null);
      setPermitForAutoSend({ ...permit }); 
      
      await new Promise(resolve => setTimeout(resolve, 3500)); 

      const element = document.getElementById(`print-permit-${permit.id}`);
      
      if (element && settings?.exitPermitNotificationGroup) {
          try {
              // @ts-ignore
              const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 1200 });
              const base64 = canvas.toDataURL('image/png').split(',')[1];
              
              let caption = "";
              if (permit.status === ExitPermitStatus.EXITED) caption = generateFullCaption(permit, "✅ *خروج نهایی بار از کارخانه ثبت شد* (ارسال مجدد)", true);
              else caption = generateFullCaption(permit, "📢 *اطلاعیه: مجوز خروج صادر شد (ارسال مجدد)*");
              
              await apiCall('/send-whatsapp', 'POST', { number: settings.exitPermitNotificationGroup, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
              alert('با موفقیت به گروه ارسال شد.');
          } catch (e: any) { 
              alert('خطا در ارسال به واتساپ'); 
          }
      } else { 
          alert('تنظیمات گروه واتساپ یافت نشد.'); 
      }
      
      setPermitForAutoSend(null);
      setIsProcessingId(null);
  };

  const handleDelete = async (id: string) => {
      if(!confirm('آیا از حذف این مجوز خروج اطمینان دارید؟')) return;
      const permitToDelete = permits.find(p => p.id === id);
      if (!permitToDelete) return;
      
      setIsProcessingId(id);
      setAutoSendWatermark('DELETED');
      setPermitForAutoSend(permitToDelete);
      
      await new Promise(resolve => setTimeout(resolve, 3500));
      
      const element = document.getElementById(`print-permit-${permitToDelete.id}`);
      if (element && settings?.exitPermitNotificationGroup) {
          try {
              // @ts-ignore
              const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 1200 });
              const base64 = canvas.toDataURL('image/png').split(',')[1];
              const caption = `❌❌ *مجوز خروج حذف شد* ❌❌\n` + `🔢 شماره مجوز: ${permitToDelete.permitNumber}\n` + `🗑️ حذف کننده: ${currentUser.fullName}`;
              
              await apiCall('/send-whatsapp', 'POST', { number: settings.exitPermitNotificationGroup, message: caption, mediaData: { data: base64, mimeType: 'image/png', filename: `DELETED_PERMIT.png` } });
          } catch (e) { }
      }
      try { await deleteExitPermit(id); loadData(); setViewPermit(null); } catch(e) { alert("خطا در حذف"); } finally { setIsProcessingId(null); setPermitForAutoSend(null); setAutoSendWatermark(null); }
  };

  const handleReject = async (id: string) => {
      const reason = prompt('دلیل رد درخواست:');
      if (reason) { await updateExitPermitStatus(id, ExitPermitStatus.REJECTED, currentUser, { rejectionReason: reason }); loadData(); setViewPermit(null); }
  };

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
        {isProcessingId && (<div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm cursor-wait"><div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 animate-scale-in max-w-sm text-center border-4 border-orange-100"><div className="relative w-24 h-24"><div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div><div className="absolute inset-0 border-4 border-t-orange-600 border-r-orange-600 rounded-full animate-spin"></div><div className="absolute inset-0 flex items-center justify-center"><Truck size={40} className="text-orange-600 animate-pulse" /></div></div><div><h3 className="text-xl font-black text-gray-800 mb-2">درحال پردازش و ارسال...</h3><div className="space-y-1 text-sm text-gray-500 font-medium"><p>سیستم در حال تولید تصویر مجوز و ارسال به واتساپ است.</p><p className="text-orange-600 font-bold animate-pulse">لطفا صبر کنید تا عملیات کاملاً تمام شود.</p></div></div></div></div>)}
        
        {/* HIDDEN PRINT CONTAINER FOR AUTO-SEND */}
        {permitForAutoSend && (
            <div className="hidden-print-export" style={{ position: 'fixed', top: 0, left: 0, zIndex: -1000, opacity: 0, width: '210mm', height: '297mm', overflow: 'hidden' }}>
                <div id={`print-permit-${permitForAutoSend.id}`}>
                    <PrintExitPermit permit={permitForAutoSend} onClose={()=>{}} embed settings={settings} watermark={autoSendWatermark} />
                </div>
            </div>
        )}
        
        {warehouseFinalizePermit && (<WarehouseFinalizeModal permit={warehouseFinalizePermit} onClose={() => setWarehouseFinalizePermit(null)} onConfirm={handleWarehouseConfirm} />)}

        <div className="p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Truck size={24} className="text-orange-600"/> کارتابل خروج بار</h2>
            <div className="flex justify-between items-center gap-2">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('current')} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'current' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>جاری</button>
                    <button onClick={() => setActiveTab('archive')} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'archive' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>بایگانی</button>
                </div>
                <button onClick={() => loadData()} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors" title="بروزرسانی"><RefreshCw size={18} /></button>
            </div>
            <div className="relative w-full md:w-64"><Search className="absolute right-3 top-2.5 text-gray-400" size={18}/><input className="w-full pl-4 pr-10 py-2 border rounded-xl text-sm" placeholder="جستجو (شماره/کالا)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
                <thead className="bg-gray-5 text-gray-600"><tr><th className="p-4">شماره</th><th className="p-4">تاریخ</th><th className="p-4">کالا</th><th className="p-4">گیرنده</th><th className="p-4">راننده / پلاک</th><th className="p-4">ساعت خروج</th><th className="p-4">وضعیت</th><th className="p-4 text-center">عملیات</th></tr></thead>
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
                            <td className="p-4 text-xs"><div className="font-bold">{p.driverName || '-'}</div><div className="font-mono text-gray-500 dir-ltr">{p.plateNumber || ''}</div></td>
                            <td className="p-4 font-mono font-bold text-blue-600">{p.exitTime || '-'}</td>
                            <td className="p-4"><div className="flex flex-col gap-1">{getStatusBadge(p.status)}{p.status === ExitPermitStatus.EXITED && (p.sentToGroup ? <span className="text-[9px] text-green-600 flex items-center gap-1 font-bold"><CheckCheck size={12}/> ارسال شده</span> : <span className="text-[9px] text-red-500 flex items-center gap-1 font-bold animate-pulse"><AlertTriangle size={12}/> ارسال نشده</span>)}</div></td>
                            <td className="p-4 text-center">
                                <div className="flex justify-center gap-2">
                                    <button onClick={() => setViewPermit(p)} className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200" title="مشاهده"><Eye size={16}/></button>
                                    
                                    {/* ACTIONS */}
                                    {isProcessingId === p.id ? (<div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 animate-pulse"><Loader2 size={14} className="animate-spin"/> صبر کنید...</div>) : (
                                        <>
                                            {canShare(p) && (
                                                <button onClick={() => handleResendToGroup(p)} className={`p-2 rounded-lg border flex items-center gap-1 ${p.status === ExitPermitStatus.EXITED ? 'bg-orange-100 text-orange-600 border-orange-200 hover:bg-orange-200' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'}`} title="ارسال مجدد"><Share2 size={16}/></button>
                                            )}

                                            {/* SECURITY ACTION (Auto/Manual Time) */}
                                            {isSecurityStep(p) && (
                                                <div className="flex items-center gap-1 bg-amber-50 p-1 rounded-lg border border-amber-200">
                                                    <input 
                                                        className="w-14 border rounded p-1 text-[12px] text-center font-bold font-mono bg-white" 
                                                        placeholder="--:--" 
                                                        value={showExitTimeInput === p.id ? exitTimeValue : ''} 
                                                        onFocus={() => handleSecurityClick(p.id)} 
                                                        onChange={e => setExitTimeValue(e.target.value)} 
                                                    />
                                                    <button onClick={() => handleApproveAction(p.id, p.status)} className="bg-amber-600 text-white p-1.5 rounded hover:bg-amber-700 shadow-sm" title="ثبت خروج نهایی">
                                                        <CheckCircle size={16}/>
                                                    </button>
                                                </div>
                                            )}
                                            
                                            {/* GENERAL APPROVE - Shown if user role matches status requirement */}
                                            {canApprove(p) && !isSecurityStep(p) && (
                                                <button onClick={() => handleApproveAction(p.id, p.status)} className="bg-green-100 text-green-600 p-2 rounded-lg hover:bg-green-200" title="تایید"><CheckCircle size={16}/></button>
                                            )}
                                        </>
                                    )}

                                    {canEdit(p) && <button onClick={() => setEditingPermit(p)} className="bg-amber-50 text-amber-600 p-2 rounded-lg hover:bg-amber-100"><Edit size={16}/></button>}
                                    {(p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED && canApprove(p)) && <button onClick={() => handleReject(p.id)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100" title="رد"><XCircle size={16}/></button>}
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
