
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings, ExitPermitItem } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, editExitPermit } from '../services/storageService';
import { getRolePermissions, getUsers } from '../services/authService'; 
import { formatDate } from '../constants';
import { Eye, Trash2, Search, CheckCircle, Truck, XCircle, Edit, Loader2, RefreshCw, Share2, CheckCheck, AlertTriangle, Clock, MapPin, Package, Filter } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'ACTION' | 'ALL' | 'ARCHIVE'>('ACTION');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [viewPermit, setViewPermit] = useState<ExitPermit | null>(null);
  const [editPermit, setEditPermit] = useState<ExitPermit | null>(null);
  const [warehouseFinalize, setWarehouseFinalize] = useState<ExitPermit | null>(null);
  
  // Processing States
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
      setLoading(true);
      const data = await getExitPermits();
      // Sort by newest first
      setPermits(data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setLoading(false);
  };

  // --- LOGIC HELPERS --- //
  
  const getActionForUser = (status: ExitPermitStatus): string | null => {
      const role = currentUser.role;
      if (role === UserRole.ADMIN) return 'APPROVE_ANY';
      
      if (status === ExitPermitStatus.PENDING_CEO && role === UserRole.CEO) return 'APPROVE_CEO';
      if (status === ExitPermitStatus.PENDING_FACTORY && role === UserRole.FACTORY_MANAGER) return 'APPROVE_FACTORY';
      if (status === ExitPermitStatus.PENDING_WAREHOUSE && role === UserRole.WAREHOUSE_KEEPER) return 'APPROVE_WAREHOUSE';
      if (status === ExitPermitStatus.PENDING_SECURITY && (role === UserRole.SECURITY_HEAD || role === UserRole.SECURITY_GUARD)) return 'APPROVE_SECURITY';
      
      return null;
  };

  const isMyRequest = (p: ExitPermit) => p.requester === currentUser.fullName;

  const filteredPermits = permits.filter(p => {
      // 1. Search Filter
      const matchesSearch = 
        p.goodsName?.includes(searchTerm) || 
        p.recipientName?.includes(searchTerm) || 
        p.permitNumber.toString().includes(searchTerm);
      if (!matchesSearch) return false;

      // 2. Tab Filter
      if (filterMode === 'ARCHIVE') return p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED;
      if (filterMode === 'ACTION') return getActionForUser(p.status) !== null; // Only show what I can approve
      if (filterMode === 'ALL') return p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED; // Show all active
      
      return true;
  });

  // --- HANDLERS --- //

  const handleApprove = async (p: ExitPermit) => {
      const action = getActionForUser(p.status);
      if (!action) return;

      if (action === 'APPROVE_WAREHOUSE') {
          setWarehouseFinalize(p);
          return;
      }

      const isSecurity = action === 'APPROVE_SECURITY';
      const promptMsg = isSecurity ? 'ثبت خروج نهایی؟' : 'تایید مرحله؟';

      if (confirm(promptMsg)) {
          setProcessingId(p.id);
          try {
              let nextStatus = p.status;
              let extraData: any = {};

              // Calculate Next Status
              if (p.status === ExitPermitStatus.PENDING_CEO) nextStatus = ExitPermitStatus.PENDING_FACTORY;
              else if (p.status === ExitPermitStatus.PENDING_FACTORY) nextStatus = ExitPermitStatus.PENDING_WAREHOUSE;
              else if (p.status === ExitPermitStatus.PENDING_WAREHOUSE) nextStatus = ExitPermitStatus.PENDING_SECURITY;
              else if (p.status === ExitPermitStatus.PENDING_SECURITY) {
                  nextStatus = ExitPermitStatus.EXITED;
                  extraData.exitTime = new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
              }

              // Update Signatures based on who is approving
              if (action === 'APPROVE_CEO') extraData.approverCeo = currentUser.fullName;
              if (action === 'APPROVE_FACTORY') extraData.approverFactory = currentUser.fullName;
              if (action === 'APPROVE_SECURITY') extraData.approverSecurity = currentUser.fullName;

              await updateExitPermitStatus(p.id, nextStatus, currentUser, extraData);
              
              // Send Notification (Simplified)
              // Ideally this calls a backend function or robust frontend notifier
              // For brevity in this fix, we assume updateExitPermitStatus handles simple storage
              // and we refresh data.
              
              await loadData();
          } catch (e) {
              alert('خطا در عملیات');
          } finally {
              setProcessingId(null);
          }
      }
  };

  const handleWarehouseSubmit = async (items: ExitPermitItem[]) => {
      if (!warehouseFinalize) return;
      setProcessingId(warehouseFinalize.id);
      try {
          // 1. Update Permit Data
          const totalWeight = items.reduce((acc, i) => acc + (Number(i.weight) || 0), 0);
          const totalCartons = items.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0);
          
          await editExitPermit({ 
              ...warehouseFinalize, 
              items, 
              weight: totalWeight, 
              cartonCount: totalCartons,
              approverWarehouse: currentUser.fullName
          });

          // 2. Move Status Forward
          await updateExitPermitStatus(warehouseFinalize.id, ExitPermitStatus.PENDING_SECURITY, currentUser);
          
          setWarehouseFinalize(null);
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
          setProcessingId(null);
      }
  };

  const handleDelete = async (id: string) => {
      if (confirm('حذف شود؟')) {
          await deleteExitPermit(id);
          loadData();
      }
  };

  // --- UI COMPONENTS --- //
  
  const StatusBadge = ({ status }: { status: ExitPermitStatus }) => {
      const styles = {
          [ExitPermitStatus.PENDING_CEO]: 'bg-purple-100 text-purple-700 border-purple-200',
          [ExitPermitStatus.PENDING_FACTORY]: 'bg-blue-100 text-blue-700 border-blue-200',
          [ExitPermitStatus.PENDING_WAREHOUSE]: 'bg-orange-100 text-orange-700 border-orange-200',
          [ExitPermitStatus.PENDING_SECURITY]: 'bg-amber-100 text-amber-700 border-amber-200 animate-pulse',
          [ExitPermitStatus.EXITED]: 'bg-green-100 text-green-700 border-green-200',
          [ExitPermitStatus.REJECTED]: 'bg-red-100 text-red-700 border-red-200',
      };
      
      const labels = {
          [ExitPermitStatus.PENDING_CEO]: 'منتظر مدیرعامل',
          [ExitPermitStatus.PENDING_FACTORY]: 'منتظر کارخانه',
          [ExitPermitStatus.PENDING_WAREHOUSE]: 'منتظر انبار',
          [ExitPermitStatus.PENDING_SECURITY]: 'منتظر خروج',
          [ExitPermitStatus.EXITED]: 'خارج شده',
          [ExitPermitStatus.REJECTED]: 'رد شده',
      };

      return (
          <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${styles[status] || 'bg-gray-100'}`}>
              {labels[status] || status}
          </span>
      );
  };

  const PipelineBar = ({ status }: { status: ExitPermitStatus }) => {
      const steps = [ExitPermitStatus.PENDING_CEO, ExitPermitStatus.PENDING_FACTORY, ExitPermitStatus.PENDING_WAREHOUSE, ExitPermitStatus.PENDING_SECURITY, ExitPermitStatus.EXITED];
      const currentIdx = steps.indexOf(status);
      if (currentIdx === -1 && status === ExitPermitStatus.REJECTED) return <div className="h-1 bg-red-500 rounded-full w-full"></div>;
      
      return (
          <div className="flex gap-1 h-1.5 mt-2">
              {steps.map((s, idx) => (
                  <div key={s} className={`flex-1 rounded-full ${idx <= currentIdx ? 'bg-green-500' : 'bg-gray-200'}`}></div>
              ))}
          </div>
      );
  };

  return (
    <div className="space-y-6">
        {/* Header & Controls */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Truck className="text-orange-600"/> مدیریت خروج بار</h2>
            
            <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
                <button onClick={() => setFilterMode('ACTION')} className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterMode === 'ACTION' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>کارتابل من</button>
                <button onClick={() => setFilterMode('ALL')} className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterMode === 'ALL' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>همه فعال</button>
                <button onClick={() => setFilterMode('ARCHIVE')} className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterMode === 'ARCHIVE' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>بایگانی</button>
            </div>
            
            <div className="relative w-full md:w-64">
                <Search className="absolute right-3 top-2.5 text-gray-400" size={16}/>
                <input className="w-full pl-4 pr-10 py-2 border rounded-xl text-sm" placeholder="جستجو..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
            </div>
        </div>

        {/* Card List (Pipeline Style) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? <div className="col-span-full text-center py-10"><Loader2 className="animate-spin inline-block text-blue-600"/></div> : 
            filteredPermits.length === 0 ? <div className="col-span-full text-center py-10 text-gray-400">موردی یافت نشد.</div> :
            filteredPermits.map(p => {
                const canAct = getActionForUser(p.status) !== null;
                const isRejected = p.status === ExitPermitStatus.REJECTED;

                return (
                    <div key={p.id} className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group ${canAct ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'}`}>
                        {/* Background Status Indicator */}
                        <div className={`absolute top-0 right-0 w-1.5 h-full ${isRejected ? 'bg-red-500' : p.status === ExitPermitStatus.EXITED ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                        
                        <div className="flex justify-between items-start pl-2 mb-2">
                            <div>
                                <span className="text-xs font-mono text-gray-400">#{p.permitNumber}</span>
                                <h3 className="font-bold text-gray-800 text-sm line-clamp-1">{p.recipientName}</h3>
                            </div>
                            <StatusBadge status={p.status} />
                        </div>

                        <div className="space-y-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg mb-3">
                            <div className="flex items-center gap-1"><Package size={12}/> <span className="truncate">{p.goodsName}</span></div>
                            <div className="flex justify-between">
                                <span className="font-bold">{p.cartonCount} کارتن</span>
                                <span className="font-mono">{formatDate(p.date)}</span>
                            </div>
                        </div>

                        <PipelineBar status={p.status} />

                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setViewPermit(p)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-xs font-bold transition-colors">مشاهده</button>
                            
                            {/* Primary Action Button */}
                            {canAct && !processingId && (
                                <button onClick={() => handleApprove(p)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-bold shadow-lg shadow-blue-200 transition-colors flex items-center justify-center gap-1">
                                    <CheckCircle size={14}/> تایید
                                </button>
                            )}
                            
                            {/* Reject / Edit */}
                            {canAct && !processingId && (
                                <button onClick={() => handleReject(p)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><XCircle size={18}/></button>
                            )}
                            {(currentUser.role === UserRole.ADMIN || (isMyRequest(p) && p.status !== ExitPermitStatus.EXITED)) && (
                                <button onClick={() => setEditPermit(p)} className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg"><Edit size={18}/></button>
                            )}
                        </div>
                        
                        {processingId === p.id && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm">
                                <Loader2 className="animate-spin text-blue-600"/>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>

        {/* Modals */}
        {viewPermit && <PrintExitPermit permit={viewPermit} onClose={() => setViewPermit(null)} settings={settings} />}
        {editPermit && <EditExitPermitModal permit={editPermit} onClose={() => setEditPermit(null)} onSave={loadData} />}
        {warehouseFinalize && <WarehouseFinalizeModal permit={warehouseFinalize} onClose={() => setWarehouseFinalize(null)} onConfirm={handleWarehouseSubmit} />}
    </div>
  );
};

export default ManageExitPermits;
