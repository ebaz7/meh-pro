
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings } from '../types';
import { updateExitPermitStatus, deleteExitPermit, getExitPermits } from '../services/storageService';
import { formatDate } from '../constants';
import { Eye, Trash2, Search, Edit, X } from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import EditExitPermitModal from './EditExitPermitModal';
import { apiCall } from '../services/apiService';
import { getUsers } from '../services/authService';

interface Props {
  currentUser: User;
  settings?: SystemSettings | null;
  statusFilter?: ExitPermitStatus | 'pending' | null;
}

const ManageExitPermits: React.FC<Props> = ({ currentUser, settings, statusFilter }) => {
  const [permits, setPermits] = useState<ExitPermit[]>([]);
  const [filteredPermits, setFilteredPermits] = useState<ExitPermit[]>([]);
  const [viewPermit, setViewPermit] = useState<ExitPermit | null>(null);
  const [editingPermit, setEditingPermit] = useState<ExitPermit | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'current' | 'archive'>('current');

  const loadData = async () => {
      const data = await getExitPermits();
      setPermits(data || []);
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
      if (statusFilter) {
          setActiveTab('current'); 
      }
  }, [statusFilter]);

  useEffect(() => {
      let result = permits;

      if (activeTab === 'archive') {
          result = result.filter(p => p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED);
      } else {
          result = result.filter(p => p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED);
      }

      if (statusFilter && statusFilter !== 'pending') {
          result = result.filter(p => p.status === statusFilter);
      }

      if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          result = result.filter(p => 
              p.permitNumber.toString().includes(lower) || 
              p.recipientName?.toLowerCase().includes(lower) ||
              p.requester.toLowerCase().includes(lower) || 
              p.goodsName?.toLowerCase().includes(lower)
          );
      }

      setFilteredPermits(result.sort((a,b) => b.createdAt - a.createdAt));
  }, [permits, activeTab, searchTerm, statusFilter]);

  const canApprove = (permit: ExitPermit) => {
      const role = currentUser.role;
      if (permit.status === ExitPermitStatus.EXITED || permit.status === ExitPermitStatus.REJECTED) return false;
      
      if (permit.status === ExitPermitStatus.PENDING_CEO && (role === UserRole.CEO || role === UserRole.ADMIN)) return true;
      if (permit.status === ExitPermitStatus.PENDING_FACTORY && (role === UserRole.FACTORY_MANAGER || role === UserRole.ADMIN)) return true;
      if (permit.status === ExitPermitStatus.PENDING_WAREHOUSE && (role === UserRole.WAREHOUSE_KEEPER || role === UserRole.ADMIN)) return true;
      if (permit.status === ExitPermitStatus.PENDING_SECURITY && (role === UserRole.SECURITY_GUARD || role === UserRole.SECURITY_HEAD || role === UserRole.ADMIN)) return true;
      
      return false;
  };

  const getNextStatus = (current: ExitPermitStatus): ExitPermitStatus => {
      if (current === ExitPermitStatus.PENDING_CEO) return ExitPermitStatus.PENDING_FACTORY;
      if (current === ExitPermitStatus.PENDING_FACTORY) return ExitPermitStatus.PENDING_WAREHOUSE;
      if (current === ExitPermitStatus.PENDING_WAREHOUSE) return ExitPermitStatus.PENDING_SECURITY;
      if (current === ExitPermitStatus.PENDING_SECURITY) return ExitPermitStatus.EXITED;
      return current;
  };

  const generateFullCaption = (permit: ExitPermit, title: string, isFinal = false) => {
      let c = `${title}\n`;
      c += `🔢 شماره: ${permit.permitNumber}\n`;
      c += `👤 گیرنده: ${permit.recipientName}\n`;
      c += `📦 کالا: ${permit.goodsName}\n`;
      if (isFinal) c += `🕒 زمان خروج: ${new Date().toLocaleTimeString('fa-IR')}\n`;
      return c;
  };

  const sendWithRetry = async (payload: any, retries = 3): Promise<boolean> => {
      for (let i = 0; i < retries; i++) {
          try {
              await apiCall('/send-whatsapp', 'POST', payload);
              return true;
          } catch (e) {
              await new Promise(res => setTimeout(res, 1000));
          }
      }
      return false;
  };

  const handleApprove = async (permit: ExitPermit) => {
      const nextStatus = getNextStatus(permit.status);
      if (!confirm(`آیا تایید مرحله "${permit.status}" را انجام می‌دهید؟`)) return;

      try {
          const extra: any = {};
          if (nextStatus === ExitPermitStatus.EXITED) {
              extra.exitTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
          }

          // Optimistic update
          await updateExitPermitStatus(permit.id, nextStatus, currentUser, extra);
          
          // Auto Send Logic
          const updatedPermitMock = { ...permit, status: nextStatus, ...extra };
          const users = await getUsers();

          // We need the base64 image. Since we don't have the element rendered in list view,
          // we rely on the modal being open OR we skip image if closed. 
          // However, typically the user opens the modal to approve. 
          const element = document.getElementById(viewPermit ? `print-permit-${permit.id}` : `print-permit-list-${permit.id}`); 
          // Note: we'll render hidden ones in the list loop for this purpose if needed, 
          // or just assume viewPermit is active (since buttons are inside modal in some flows, but here they are in table).
          
          // If approved from table list:
          let base64 = '';
          if (element) {
             try {
                 // @ts-ignore
                 const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                 base64 = canvas.toDataURL('image/png').split(',')[1];
             } catch(e) {}
          }

          if (base64) {
              try {
                  // CASE A: CEO Approved -> Goes to Factory Manager
                  if (nextStatus === ExitPermitStatus.PENDING_FACTORY) {
                      const caption = generateFullCaption(updatedPermitMock, "✅ *تایید مدیرعامل انجام شد* (ارسال به کارخانه)");
                      const factoryUsers = users.filter(u => u.role === UserRole.FACTORY_MANAGER && u.phoneNumber);
                      for (const u of factoryUsers) {
                          await apiCall('/send-whatsapp', 'POST', { number: u.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                      }
                  }
                  // CASE B: Factory Approved -> Goes to Warehouse + GROUPS
                  else if (nextStatus === ExitPermitStatus.PENDING_WAREHOUSE) {
                      const caption = generateFullCaption(updatedPermitMock, "🏭 *تایید مدیر کارخانه انجام شد* (ارسال به انبار)");
                      
                      // 1. Warehouse Users
                      const warehouseUsers = users.filter(u => u.role === UserRole.WAREHOUSE_KEEPER && u.phoneNumber);
                      for (const u of warehouseUsers) {
                          await apiCall('/send-whatsapp', 'POST', { number: u.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                      }

                      // 2. Group 1
                      if (settings?.exitPermitNotificationGroup) {
                          await sendWithRetry({ number: settings.exitPermitNotificationGroup, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }, 2);
                      }
                      // 3. Group 2
                      if (settings?.exitPermitNotificationGroup2) {
                          await sendWithRetry({ number: settings.exitPermitNotificationGroup2, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }, 2);
                      }
                  }
                  // CASE C: Warehouse Approved -> Security
                  else if (nextStatus === ExitPermitStatus.PENDING_SECURITY) {
                      const caption = generateFullCaption(updatedPermitMock, "📦 *تایید انبار انجام شد* (ارسال به انتظامات)");
                      const securityUsers = users.filter(u => (u.role === UserRole.SECURITY_HEAD || u.role === UserRole.SECURITY_GUARD) && u.phoneNumber);
                      for (const u of securityUsers) {
                          await apiCall('/send-whatsapp', 'POST', { number: u.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                      }
                  }
                  // CASE D: Security Approved (Final) -> Archive + Groups
                  else if (nextStatus === ExitPermitStatus.EXITED) {
                      const caption = generateFullCaption(updatedPermitMock, "✅ *خروج نهایی بار ثبت شد*", true);
                      
                      // Requester
                      const requester = users.find(u => u.fullName === updatedPermitMock.requester && u.phoneNumber);
                      if (requester) {
                          await apiCall('/send-whatsapp', 'POST', { number: requester.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                      }

                      let groupSent = false;
                      if (settings?.exitPermitNotificationGroup) {
                          const s = await sendWithRetry({ number: settings.exitPermitNotificationGroup, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }, 3);
                          if(s) groupSent = true;
                      }
                      if (settings?.exitPermitNotificationGroup2) {
                          const s = await sendWithRetry({ number: settings.exitPermitNotificationGroup2, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }, 3);
                          if(s) groupSent = true;
                      }

                      if (groupSent) {
                          await updateExitPermitStatus(permit.id, ExitPermitStatus.EXITED, currentUser, { sentToGroup: true });
                      }
                  }
              } catch(e) { console.error("Notification Error", e); }
          }

          loadData();
          setViewPermit(null);

      } catch (e) {
          alert('خطا در عملیات');
      }
  };

  const handleReject = async (permit: ExitPermit) => {
      const reason = prompt("دلیل رد درخواست:");
      if (reason) {
          await updateExitPermitStatus(permit.id, ExitPermitStatus.REJECTED, currentUser, { rejectionReason: reason });
          loadData();
          setViewPermit(null);
      }
  };

  const handleDelete = async (id: string) => {
      if (confirm('آیا از حذف این مجوز اطمینان دارید؟')) {
          await deleteExitPermit(id);
          loadData();
      }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
        <div className="p-4 border-b border-gray-100 flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('current')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'current' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>جاری</button>
                    <button onClick={() => setActiveTab('archive')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'archive' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>بایگانی</button>
                </div>
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input type="text" placeholder="جستجو..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-4 pr-10 py-2 border rounded-xl text-sm outline-none w-64"/>
                </div>
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 text-gray-600">
                    <tr>
                        <th className="px-6 py-4">شماره</th>
                        <th className="px-6 py-4">تاریخ</th>
                        <th className="px-6 py-4">گیرنده</th>
                        <th className="px-6 py-4">کالا</th>
                        <th className="px-6 py-4">وضعیت</th>
                        <th className="px-6 py-4 text-center">عملیات</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredPermits.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-8 text-gray-400">موردی یافت نشد</td></tr>
                    ) : (
                        filteredPermits.map((permit) => (
                            <tr key={permit.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-mono font-bold text-orange-600">{permit.permitNumber}</td>
                                <td className="px-6 py-4">{formatDate(permit.date)}</td>
                                <td className="px-6 py-4 font-bold">{permit.recipientName}</td>
                                <td className="px-6 py-4 truncate max-w-[200px]">{permit.goodsName}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                                        permit.status === ExitPermitStatus.EXITED ? 'bg-green-50 text-green-700 border-green-200' : 
                                        permit.status === ExitPermitStatus.REJECTED ? 'bg-red-50 text-red-700 border-red-200' : 
                                        'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    }`}>
                                        {permit.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex justify-center items-center gap-2">
                                        <button onClick={() => setViewPermit(permit)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="مشاهده"><Eye size={18}/></button>
                                        {(currentUser.role === UserRole.ADMIN || (currentUser.role === UserRole.SALES_MANAGER && permit.status === ExitPermitStatus.PENDING_CEO)) && (
                                            <button onClick={() => setEditingPermit(permit)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="ویرایش"><Edit size={18}/></button>
                                        )}
                                        {(currentUser.role === UserRole.ADMIN || (currentUser.role === UserRole.SALES_MANAGER && permit.status === ExitPermitStatus.PENDING_CEO)) && (
                                            <button onClick={() => handleDelete(permit.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="حذف"><Trash2 size={18}/></button>
                                        )}
                                    </div>
                                    {/* Hidden element for auto-send functionality when triggered from list context */}
                                    <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                                        <div id={`print-permit-list-${permit.id}`}>
                                            <PrintExitPermit permit={permit} onClose={()=>{}} embed />
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>

        {/* View Modal */}
        {viewPermit && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white p-2 rounded-xl shadow-xl w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col relative">
                    <button onClick={() => setViewPermit(null)} className="absolute top-4 right-4 z-[110] bg-gray-100 p-2 rounded-full hover:bg-red-100 hover:text-red-600"><X size={20}/></button>
                    <div className="flex-1 overflow-y-auto">
                        <PrintExitPermit 
                            permit={viewPermit} 
                            onClose={() => setViewPermit(null)} 
                            onApprove={canApprove(viewPermit) ? () => handleApprove(viewPermit) : undefined}
                            onReject={canApprove(viewPermit) ? () => handleReject(viewPermit) : undefined}
                            settings={settings || undefined}
                            embed={true}
                        />
                    </div>
                </div>
            </div>
        )}

        {/* Edit Modal */}
        {editingPermit && (
            <EditExitPermitModal 
                permit={editingPermit} 
                onClose={() => setEditingPermit(null)} 
                onSave={loadData} 
            />
        )}
    </div>
  );
};

export default ManageExitPermits;
