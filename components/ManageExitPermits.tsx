
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, getSettings } from '../services/storageService';
import { formatDate } from '../constants';
import { Truck, CheckCircle, XCircle, Search, Filter, Trash2, Eye, Edit, ListChecks, Archive, RefreshCw, X, FileClock, Clock } from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import EditExitPermitModal from './EditExitPermitModal';
import { apiCall } from '../services/apiService';
import { getUsers } from '../services/authService';

interface Props {
  currentUser: User;
  settings?: SystemSettings;
  statusFilter?: 'pending' | null;
}

const ManageExitPermits: React.FC<Props> = ({ currentUser, settings: propSettings, statusFilter }) => {
  const [activeTab, setActiveTab] = useState<'cartable' | 'archive' | 'all'>('cartable');
  const [permits, setPermits] = useState<ExitPermit[]>([]);
  const [viewPermit, setViewPermit] = useState<ExitPermit | null>(null);
  const [editingPermit, setEditingPermit] = useState<ExitPermit | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(propSettings || null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Loading users once
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
      if (!propSettings) getSettings().then(setSettings);
      getUsers().then(setUsers);
      loadData();
  }, []);

  const loadData = async () => {
      const data = await getExitPermits();
      setPermits(data);
  };

  const getFilteredPermits = () => {
      let list = permits;
      
      // Tab Filtering
      if (activeTab === 'cartable') {
          // Logic for Cartable based on Role
          if (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN) {
              list = list.filter(p => p.status === ExitPermitStatus.PENDING_CEO);
          } else if (currentUser.role === UserRole.FACTORY_MANAGER) {
              list = list.filter(p => p.status === ExitPermitStatus.PENDING_FACTORY);
          } else if (currentUser.role === UserRole.WAREHOUSE_KEEPER) {
              list = list.filter(p => p.status === ExitPermitStatus.PENDING_WAREHOUSE);
          } else if (currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.SECURITY_GUARD) {
              list = list.filter(p => p.status === ExitPermitStatus.PENDING_SECURITY);
          } else {
              // Sales manager or User: see their own pending requests
              list = list.filter(p => p.requester === currentUser.fullName && p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED);
          }
      } else if (activeTab === 'archive') {
          list = list.filter(p => p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED);
      }
      
      // Search Filter
      if (searchTerm) {
          const term = searchTerm.toLowerCase();
          list = list.filter(p => 
              p.permitNumber.toString().includes(term) || 
              p.recipientName?.toLowerCase().includes(term) ||
              p.goodsName?.toLowerCase().includes(term)
          );
      }

      return list.sort((a, b) => b.createdAt - a.createdAt);
  };

  const filteredPermits = getFilteredPermits();

  // --- ACTIONS ---

  const canApprove = (permit: ExitPermit) => {
      if (permit.status === ExitPermitStatus.PENDING_CEO && (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN)) return true;
      if (permit.status === ExitPermitStatus.PENDING_FACTORY && (currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN)) return true;
      if (permit.status === ExitPermitStatus.PENDING_WAREHOUSE && (currentUser.role === UserRole.WAREHOUSE_KEEPER || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.FACTORY_MANAGER)) return true;
      if (permit.status === ExitPermitStatus.PENDING_SECURITY && (currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.SECURITY_GUARD || currentUser.role === UserRole.ADMIN)) return true;
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
      let caption = `${title}\n`;
      caption += `🔢 شماره مجوز: ${permit.permitNumber}\n`;
      caption += `👤 گیرنده: ${permit.recipientName}\n`;
      caption += `📦 کالا: ${permit.goodsName}\n`;
      caption += `📅 تاریخ: ${formatDate(permit.date)}\n`;
      if (isFinal) caption += `✅ وضعیت: خارج شده (بایگانی)`;
      return caption;
  };

  const sendWithRetry = async (payload: any, retries = 3) => {
      for (let i = 0; i < retries; i++) {
          try {
              await apiCall('/send-whatsapp', 'POST', payload);
              return true;
          } catch (e) { console.error(`Retry ${i+1} failed`); await new Promise(r => setTimeout(r, 1000)); }
      }
      return false;
  };

  const handleApprove = async (permit: ExitPermit) => {
      if (!confirm('آیا تایید می‌کنید؟')) return;
      
      const nextStatus = getNextStatus(permit.status);
      let exitTime = undefined;
      
      if (nextStatus === ExitPermitStatus.EXITED) {
          exitTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      }

      try {
          // 1. Update DB
          const updatedList = await updateExitPermitStatus(permit.id, nextStatus, currentUser, { exitTime });
          const updatedPermit = updatedList.find(p => p.id === permit.id);
          
          if (updatedPermit) {
              // 2. Generate Image for Notification
              setTimeout(async () => {
                  const elementId = `print-permit-${updatedPermit.id}`; // Must exist in DOM (via hidden render or modal)
                  // If modal is closed, we need a hidden render mechanism. 
                  // Since `handleApprove` might be called from list, we can't rely on Modal DOM.
                  // Solution: We will rely on View Modal being open OR we need a hidden rendering strategy.
                  // For now, assume View Modal is open if this is called from there. If called from list, we skip image gen or handle differently.
                  // Let's assume we open the view modal or use a hidden container.
                  // To simplify: we'll only send notification if element exists.
                  
                  const element = document.getElementById(elementId) || document.getElementById('print-area-exit'); 
                  
                  if (element) {
                      try {
                          // @ts-ignore
                          const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                          const base64 = canvas.toDataURL('image/png').split(',')[1];
                          
                          // NOTIFICATION LOGIC
                          
                          // CASE A: CEO Approved -> Goes to Factory Manager
                          if (nextStatus === ExitPermitStatus.PENDING_FACTORY) {
                              const caption = generateFullCaption(updatedPermit, "✅ *تایید مدیرعامل انجام شد* (ارسال به کارخانه)");
                              const factoryUsers = users.filter(u => u.role === UserRole.FACTORY_MANAGER && u.phoneNumber);
                              for (const u of factoryUsers) {
                                  await sendWithRetry({ number: u.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                              }
                          }
                          // CASE B: Factory Approved -> Goes to Warehouse Supervisor + GROUPS
                          else if (nextStatus === ExitPermitStatus.PENDING_WAREHOUSE) {
                              const caption = generateFullCaption(updatedPermit, "🏭 *تایید مدیر کارخانه انجام شد* (ارسال به سرپرست انبار)");
                              const warehouseUsers = users.filter(u => u.role === UserRole.WAREHOUSE_KEEPER && u.phoneNumber);
                              for (const whUser of warehouseUsers) {
                                try { await apiCall('/send-whatsapp', 'POST', { number: whUser.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }); } catch (err) {}
                              }

                              // Send to Group 1
                              if (settings?.exitPermitNotificationGroup) {
                                  await sendWithRetry({
                                      number: settings.exitPermitNotificationGroup, 
                                      message: caption, 
                                      mediaData: { data: base64, mimeType: 'image/png' }
                                  }, 2);
                              }

                              // Send to Group 2
                              if (settings?.exitPermitNotificationGroup2) {
                                  await sendWithRetry({
                                      number: settings.exitPermitNotificationGroup2, 
                                      message: caption, 
                                      mediaData: { data: base64, mimeType: 'image/png' }
                                  }, 2);
                              }
                          }
                          // CASE C: Warehouse Approved -> Goes to Security
                          else if (nextStatus === ExitPermitStatus.PENDING_SECURITY) {
                              const caption = generateFullCaption(updatedPermit, "📦 *تایید انبار انجام شد* (ارسال به انتظامات)");
                              // Notify Security Head
                              const securityUsers = users.filter(u => u.role === UserRole.SECURITY_HEAD && u.phoneNumber);
                              for (const secUser of securityUsers) {
                                  await sendWithRetry({ number: secUser.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                              }
                          }
                          // CASE D: Security Approved (Final Exit) -> Archive
                          else if (nextStatus === ExitPermitStatus.EXITED) {
                              const caption = generateFullCaption(updatedPermit, "✅ *خروج نهایی بار از کارخانه ثبت شد*", true);
                              
                              // Send to Requester
                              const target = users.find(u => u.fullName === updatedPermit.requester && u.phoneNumber);
                              if (target) { try { await apiCall('/send-whatsapp', 'POST', { number: target.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }); } catch(e) {} }
                              
                              let groupSent = false;

                              // Send to Group 1
                              if (settings?.exitPermitNotificationGroup) {
                                  const success = await sendWithRetry({ 
                                      number: settings.exitPermitNotificationGroup, 
                                      message: caption, 
                                      mediaData: { data: base64, mimeType: 'image/png' } 
                                  }, 3);
                                  if (success) groupSent = true;
                              }

                              // Send to Group 2
                              if (settings?.exitPermitNotificationGroup2) {
                                  const success = await sendWithRetry({ 
                                      number: settings.exitPermitNotificationGroup2, 
                                      message: caption, 
                                      mediaData: { data: base64, mimeType: 'image/png' } 
                                  }, 3);
                                  if (success) groupSent = true;
                              }
                                  
                              if (groupSent) {
                                  // Update success flag
                                  await updateExitPermitStatus(permit.id, ExitPermitStatus.EXITED, currentUser, { sentToGroup: true });
                              }
                          }
                      } catch (e) { console.error("Error in auto-send logic", e); }
                  }
                  
                  setViewPermit(null);
                  loadData();
              }, 1500);
          }
      } catch (e) { alert('خطا در عملیات'); }
  };

  const handleReject = async (permit: ExitPermit) => {
      const reason = prompt('دلیل رد درخواست:');
      if (reason) {
          await updateExitPermitStatus(permit.id, ExitPermitStatus.REJECTED, currentUser, { rejectionReason: reason });
          setViewPermit(null);
          loadData();
      }
  };

  const handleDelete = async (id: string) => {
      if (confirm('آیا از حذف این مجوز اطمینان دارید؟')) {
          await deleteExitPermit(id);
          loadData();
      }
  };

  const getStatusBadge = (status: ExitPermitStatus) => {
      switch (status) {
          case ExitPermitStatus.PENDING_CEO: return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">منتظر تایید مدیرعامل</span>;
          case ExitPermitStatus.PENDING_FACTORY: return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">منتظر تایید کارخانه</span>;
          case ExitPermitStatus.PENDING_WAREHOUSE: return <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">منتظر تایید انبار</span>;
          case ExitPermitStatus.PENDING_SECURITY: return <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">منتظر خروج (انتظامات)</span>;
          case ExitPermitStatus.EXITED: return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">خارج شده (بایگانی)</span>;
          case ExitPermitStatus.REJECTED: return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">رد شده</span>;
          default: return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">{status}</span>;
      }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in flex flex-col h-[calc(100vh-100px)]">
        
        {/* Header Tabs */}
        <div className="flex border-b">
            <button onClick={() => setActiveTab('cartable')} className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'cartable' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>
                <ListChecks size={18}/> کارتابل جاری
            </button>
            <button onClick={() => setActiveTab('all')} className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'all' ? 'border-orange-600 text-orange-600 bg-orange-50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>
                <FileClock size={18}/> پیگیری همه
            </button>
            <button onClick={() => setActiveTab('archive')} className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'archive' ? 'border-green-600 text-green-600 bg-green-50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>
                <Archive size={18}/> بایگانی
            </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b flex flex-col md:flex-row gap-4 items-center bg-gray-50">
            <div className="relative flex-1 w-full">
                <Search size={18} className="absolute right-3 top-3 text-gray-400"/>
                <input 
                    className="w-full pl-4 pr-10 py-2.5 border rounded-xl text-sm" 
                    placeholder="جستجو (شماره مجوز، گیرنده، کالا...)" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex gap-2 text-sm font-bold text-gray-500">
                <Filter size={18}/>
                <span>{filteredPermits.length} مورد یافت شد</span>
            </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredPermits.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
                    <Archive size={48} className="opacity-20"/>
                    <span>هیچ مجوزی یافت نشد.</span>
                </div>
            ) : (
                filteredPermits.map(permit => (
                    <div key={permit.id} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative group">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-lg font-bold text-blue-700 bg-blue-50 px-2 rounded">#{permit.permitNumber}</span>
                                <span className="text-xs text-gray-500">{formatDate(permit.date)}</span>
                            </div>
                            {getStatusBadge(permit.status)}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700 mb-3">
                            <div><span className="font-bold">گیرنده:</span> {permit.recipientName}</div>
                            <div><span className="font-bold">کالا:</span> {permit.goodsName}</div>
                            <div><span className="font-bold">درخواست:</span> {permit.requester}</div>
                            {permit.exitTime && <div className="text-green-700 font-bold"><Clock size={14} className="inline ml-1"/> خروج: {permit.exitTime}</div>}
                        </div>

                        <div className="flex justify-end gap-2 border-t pt-3 mt-2">
                            <button onClick={() => setViewPermit(permit)} className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-200 flex items-center gap-1">
                                <Eye size={14}/> مشاهده
                            </button>
                            
                            {(currentUser.role === UserRole.ADMIN || permit.requester === currentUser.fullName) && permit.status !== ExitPermitStatus.EXITED && (
                                <button onClick={() => setEditingPermit(permit)} className="bg-amber-100 text-amber-700 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-200 flex items-center gap-1">
                                    <Edit size={14}/> ویرایش
                                </button>
                            )}

                            {canApprove(permit) && (
                                <button onClick={() => handleApprove(permit)} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 flex items-center gap-1 shadow-sm">
                                    <CheckCircle size={14}/> تایید
                                </button>
                            )}
                            
                            {canApprove(permit) && (
                                <button onClick={() => handleReject(permit)} className="bg-red-100 text-red-700 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-red-200 flex items-center gap-1">
                                    <XCircle size={14}/> رد
                                </button>
                            )}

                            {(currentUser.role === UserRole.ADMIN || (permit.requester === currentUser.fullName && permit.status === ExitPermitStatus.PENDING_CEO)) && (
                                <button onClick={() => handleDelete(permit.id)} className="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors" title="حذف">
                                    <Trash2 size={16}/>
                                </button>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* Modals */}
        {viewPermit && (
            <PrintExitPermit 
                permit={viewPermit} 
                onClose={() => setViewPermit(null)} 
                settings={settings || undefined}
                onApprove={canApprove(viewPermit) ? () => handleApprove(viewPermit) : undefined}
                onReject={canApprove(viewPermit) ? () => handleReject(viewPermit) : undefined}
                onEdit={(currentUser.role === UserRole.ADMIN || viewPermit.requester === currentUser.fullName) && viewPermit.status !== ExitPermitStatus.EXITED ? () => { setEditingPermit(viewPermit); setViewPermit(null); } : undefined}
            />
        )}

        {editingPermit && (
            <EditExitPermitModal 
                permit={editingPermit} 
                onClose={() => setEditingPermit(null)} 
                onSave={() => { setEditingPermit(null); loadData(); }} 
            />
        )}
    </div>
  );
};

export default ManageExitPermits;
    