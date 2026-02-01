
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings, ExitPermitItem } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, editExitPermit } from '../services/storageService';
import { getRolePermissions } from '../services/authService'; 
import { formatDate } from '../constants';
import { Eye, Trash2, Search, CheckCircle, Truck, XCircle, Edit, Loader2, Package, Archive, ListChecks, Filter, AlertTriangle } from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import EditExitPermitModal from './EditExitPermitModal';
import WarehouseFinalizeModal from './WarehouseFinalizeModal'; 

interface Props {
  currentUser: User;
  settings?: SystemSettings;
  statusFilter?: 'pending' | null;
}

const ManageExitPermits: React.FC<Props> = ({ currentUser, settings, statusFilter }) => {
  const [permits, setPermits] = useState<ExitPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'ACTION' | 'ALL' | 'ARCHIVE'>('ACTION');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [viewPermit, setViewPermit] = useState<ExitPermit | null>(null);
  const [editPermit, setEditPermit] = useState<ExitPermit | null>(null);
  const [warehouseFinalize, setWarehouseFinalize] = useState<ExitPermit | null>(null);
  
  // Processing States
  const [processingId, setProcessingId] = useState<string | null>(null);

  const permissions = getRolePermissions(currentUser.role, settings || null, currentUser);

  useEffect(() => { 
      loadData(); 
      // Default views
      if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) {
          setFilterMode('ALL');
      } else {
          setFilterMode('ACTION');
      }
  }, []);

  const loadData = async () => {
      setLoading(true);
      const data = await getExitPermits();
      setPermits(data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setLoading(false);
  };

  // --- HARDCORE ROLE TO ACTION MAPPING ---
  const getActionForUser = (status: ExitPermitStatus): string | null => {
      const role = currentUser.role;
      const isAdmin = role === UserRole.ADMIN;

      // 1. CEO STEP
      if (status === ExitPermitStatus.PENDING_CEO) {
          if (isAdmin || role === UserRole.CEO || permissions.canApproveExitCeo) return 'APPROVE_CEO';
      }
      
      // 2. FACTORY MANAGER STEP
      if (status === ExitPermitStatus.PENDING_FACTORY) {
          if (isAdmin || role === UserRole.FACTORY_MANAGER || permissions.canApproveExitFactory) return 'APPROVE_FACTORY';
      }
      
      // 3. WAREHOUSE STEP (TOWZIN)
      if (status === ExitPermitStatus.PENDING_WAREHOUSE) {
          if (isAdmin || role === UserRole.WAREHOUSE_KEEPER || permissions.canApproveExitWarehouse) return 'APPROVE_WAREHOUSE';
      }
      
      // 4. SECURITY STEP (EXIT)
      if (status === ExitPermitStatus.PENDING_SECURITY) {
          if (isAdmin || role === UserRole.SECURITY_HEAD || role === UserRole.SECURITY_GUARD || permissions.canApproveExitSecurity) return 'APPROVE_SECURITY';
      }
      
      return null;
  };

  const isMyRequest = (p: ExitPermit) => p.requester === currentUser.fullName;
  const isArchived = (status: string) => status === ExitPermitStatus.EXITED || status === ExitPermitStatus.REJECTED;

  const filteredPermits = permits.filter(p => {
      const matchesSearch = 
        p.goodsName?.includes(searchTerm) || 
        p.recipientName?.includes(searchTerm) || 
        p.permitNumber.toString().includes(searchTerm) ||
        p.requester?.includes(searchTerm);
      
      if (!matchesSearch) return false;

      const isArchivedStatus = isArchived(p.status);

      if (filterMode === 'ARCHIVE') return isArchivedStatus;
      
      if (filterMode === 'ACTION') {
          // IMPORTANT: If user is Admin/CEO, Action tab shows everything pending
          if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) {
              return !isArchivedStatus;
          }
          // For others, only show if it's their turn to approve
          return getActionForUser(p.status) !== null;
      }
      
      if (filterMode === 'ALL') return !isArchivedStatus;
      
      return true;
  });

  const handleApprove = async (p: ExitPermit) => {
      const action = getActionForUser(p.status);
      if (!action) {
          alert('در حال حاضر نوبت تایید شما نیست.');
          return;
      }

      if (action === 'APPROVE_WAREHOUSE') {
          setWarehouseFinalize(p);
          return;
      }

      let exitTime = '';
      if (action === 'APPROVE_SECURITY') {
          const defaultTime = new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
          const userInput = prompt('ساعت دقیق خروج:', defaultTime);
          if (userInput === null) return;
          exitTime = userInput || defaultTime;
      }

      if (confirm('آیا این مرحله را تایید می‌کنید؟')) {
          setProcessingId(p.id);
          try {
              let nextStatus = p.status;
              if (p.status === ExitPermitStatus.PENDING_CEO) nextStatus = ExitPermitStatus.PENDING_FACTORY;
              else if (p.status === ExitPermitStatus.PENDING_FACTORY) nextStatus = ExitPermitStatus.PENDING_WAREHOUSE;
              else if (p.status === ExitPermitStatus.PENDING_WAREHOUSE) nextStatus = ExitPermitStatus.PENDING_SECURITY;
              else if (p.status === ExitPermitStatus.PENDING_SECURITY) nextStatus = ExitPermitStatus.EXITED;

              await updateExitPermitStatus(p.id, nextStatus, currentUser, { exitTime });
              await loadData();
              setViewPermit(null);
          } catch (e) {
              alert('خطا در تایید');
          } finally {
              setProcessingId(null);
          }
      }
  };

  const handleWarehouseSubmit = async (items: ExitPermitItem[]) => {
      if (!warehouseFinalize) return;
      setProcessingId(warehouseFinalize.id);
      try {
          const totalWeight = items.reduce((acc, i) => acc + (Number(i.weight) || 0), 0);
          const totalCartons = items.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0);
          
          await editExitPermit({ 
              ...warehouseFinalize, 
              items, 
              weight: totalWeight, 
              cartonCount: totalCartons,
              approverWarehouse: currentUser.fullName,
              goodsName: items.map(i => i.goodsName).join('، ')
          });

          await updateExitPermitStatus(warehouseFinalize.id, ExitPermitStatus.PENDING_SECURITY, currentUser);
          
          setWarehouseFinalize(null);
          setViewPermit(null); 
          await loadData();
      } catch (e) {
          alert('خطا در ثبت انبار');
      } finally {
          setProcessingId(null);
      }
  };

  const handleReject = async (p: ExitPermit) => {
      const reason = prompt('دلیل رد درخواست:');
      if (reason) {
          setProcessingId(p.id);
          await updateExitPermitStatus(p.id, ExitPermitStatus.REJECTED, currentUser, { rejectionReason: reason });
          await loadData();
          setViewPermit(null);
          setProcessingId(null);
      }
  };

  const handleDelete = async (id: string) => {
      if (confirm('آیا از حذف کامل این بیجک اطمینان دارید؟')) {
          await deleteExitPermit(id);
          loadData();
      }
  };

  const StatusBadge = ({ status }: { status: ExitPermitStatus }) => {
      let colorClass = 'bg-gray-100 text-gray-700 border-gray-200';
      if (status === ExitPermitStatus.PENDING_CEO) colorClass = 'bg-purple-100 text-purple-700 border-purple-200';
      else if (status === ExitPermitStatus.PENDING_FACTORY) colorClass = 'bg-blue-100 text-blue-700 border-blue-200';
      else if (status === ExitPermitStatus.PENDING_WAREHOUSE) colorClass = 'bg-orange-100 text-orange-700 border-orange-200';
      else if (status === ExitPermitStatus.PENDING_SECURITY) colorClass = 'bg-amber-100 text-amber-700 border-amber-200 animate-pulse';
      else if (status === ExitPermitStatus.EXITED) colorClass = 'bg-green-100 text-green-700 border-green-200';
      else if (status === ExitPermitStatus.REJECTED) colorClass = 'bg-red-100 text-red-700 border-red-200';

      return <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${colorClass}`}>{status}</span>;
  };

  return (
    <div className="space-y-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Truck className="text-orange-600"/> مدیریت خروج بار</h2>
            <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
                <button onClick={() => setFilterMode('ACTION')} className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterMode === 'ACTION' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
                    <ListChecks size={16} className="inline mr-1"/> کارتابل من
                </button>
                <button onClick={() => setFilterMode('ALL')} className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterMode === 'ALL' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
                    همه فعال
                </button>
                <button onClick={() => setFilterMode('ARCHIVE')} className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterMode === 'ARCHIVE' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>
                    <Archive size={16} className="inline mr-1"/> بایگانی
                </button>
            </div>
            <div className="relative w-full md:w-64">
                <Search className="absolute right-3 top-2.5 text-gray-400" size={16}/>
                <input className="w-full pl-4 pr-10 py-2 border rounded-xl text-sm" placeholder="جستجو (شماره، کالا)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? <div className="col-span-full text-center py-10"><Loader2 className="animate-spin inline-block text-blue-600"/></div> : 
            filteredPermits.length === 0 ? (
                <div className="col-span-full text-center py-12 flex flex-col items-center text-gray-400 bg-white rounded-2xl border border-dashed">
                    <Filter size={48} className="opacity-20 mb-2"/>
                    <span>موردی در کارتابل شما نیست.</span>
                </div>
            ) :
            filteredPermits.map(p => {
                const canAct = getActionForUser(p.status) !== null;
                const canDeleteBijak = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO || (isMyRequest(p) && p.status === ExitPermitStatus.PENDING_CEO);

                return (
                    <div key={p.id} className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group ${canAct ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'}`}>
                        <div className={`absolute top-0 right-0 w-1.5 h-full ${p.status === ExitPermitStatus.REJECTED ? 'bg-red-500' : p.status === ExitPermitStatus.EXITED ? 'bg-green-500' : canAct ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                        
                        <div className="flex justify-between items-start pl-2 mb-3">
                            <div>
                                <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded">#{p.permitNumber}</span>
                                <h3 className="font-bold text-gray-800 text-sm mt-1 line-clamp-1">{p.recipientName}</h3>
                            </div>
                            <StatusBadge status={p.status} />
                        </div>

                        <div className="space-y-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg mb-3 border border-gray-100">
                            <div className="flex items-center gap-1 font-bold"><Package size={12}/> <span className="truncate">{p.goodsName}</span></div>
                            <div className="flex justify-between mt-1">
                                <span>{p.cartonCount} کارتن</span>
                                <span className="font-mono">{formatDate(p.date)}</span>
                            </div>
                            <div className="text-[10px] text-gray-400">درخواست: {p.requester}</div>
                        </div>

                        <div className="flex gap-2 mt-4 pt-2 border-t border-gray-100">
                            <button onClick={() => setViewPermit(p)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                                <Eye size={14}/> مشاهده
                            </button>
                            {canAct && !processingId && (
                                <button onClick={() => handleApprove(p)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-1">
                                    <CheckCircle size={14}/> تایید
                                </button>
                            )}
                            {canAct && !processingId && (
                                <button onClick={() => handleReject(p)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="رد"><XCircle size={18}/></button>
                            )}
                            {(currentUser.role === UserRole.ADMIN || (isMyRequest(p) && !isArchived(p.status))) && (
                                <button onClick={() => setEditPermit(p)} className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg" title="ویرایش"><Edit size={18}/></button>
                            )}
                            {canDeleteBijak && (
                                <button onClick={() => handleDelete(p.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="حذف">
                                    <Trash2 size={18}/>
                                </button>
                            )}
                        </div>
                        {processingId === p.id && <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm z-10"><Loader2 className="animate-spin text-blue-600"/></div>}
                    </div>
                );
            })}
        </div>

        {viewPermit && (
            <PrintExitPermit 
                permit={viewPermit} 
                onClose={() => setViewPermit(null)} 
                settings={settings} 
                onApprove={getActionForUser(viewPermit.status) ? () => handleApprove(viewPermit) : undefined}
                onReject={getActionForUser(viewPermit.status) ? () => handleReject(viewPermit) : undefined}
                onEdit={(isMyRequest(viewPermit) || currentUser.role === UserRole.ADMIN) && !isArchived(viewPermit.status) ? () => { setEditPermit(viewPermit); setViewPermit(null); } : undefined}
            />
        )}
        {editPermit && <EditExitPermitModal permit={editPermit} onClose={() => setEditPermit(null)} onSave={loadData} />}
        {warehouseFinalize && <WarehouseFinalizeModal permit={warehouseFinalize} onClose={() => setWarehouseFinalize(null)} onConfirm={handleWarehouseSubmit} />}
    </div>
  );
};

export default ManageExitPermits;
