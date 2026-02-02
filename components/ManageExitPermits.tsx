
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings, ExitPermitItem } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, editExitPermit } from '../services/storageService';
import { formatDate } from '../constants';
import { 
    Eye, Trash2, Search, CheckCircle, Truck, XCircle, Edit, Loader2, 
    Package, Archive, ListChecks, Filter, AlertTriangle, FastForward,
    ChevronLeft, UserCheck, ShieldCheck, MapPin, MoreVertical, RefreshCw
} from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import WarehouseFinalizeModal from './WarehouseFinalizeModal'; 

const ManageExitPermits: React.FC<{ currentUser: User, settings?: SystemSettings, statusFilter?: any }> = ({ currentUser, settings }) => {
    const [permits, setPermits] = useState<ExitPermit[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'MY_TURN' | 'ALL_ACTIVE' | 'ARCHIVE'>('MY_TURN');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewPermit, setViewPermit] = useState<ExitPermit | null>(null);
    const [warehouseFinalize, setWarehouseFinalize] = useState<ExitPermit | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getExitPermits();
            const safeData = Array.isArray(data) ? data : [];
            setPermits(safeData.sort((a, b) => b.createdAt - a.createdAt));
        } catch (e) {
            console.error("Failed to load permits", e);
            setPermits([]);
        } finally {
            setLoading(false);
        }
    };

    const getActionRequired = (p: ExitPermit): string | null => {
        const role = currentUser.role;
        const isAdmin = role === UserRole.ADMIN;

        switch (p.status) {
            case ExitPermitStatus.PENDING_CEO:
                if (isAdmin || role === UserRole.CEO) return 'تایید مدیرعامل';
                break;
            case ExitPermitStatus.PENDING_FACTORY:
                if (isAdmin || role === UserRole.FACTORY_MANAGER) return 'تایید مدیر کارخانه';
                break;
            case ExitPermitStatus.PENDING_WAREHOUSE:
                if (isAdmin || role === UserRole.WAREHOUSE_KEEPER) return 'توزین و تایید انبار';
                break;
            case ExitPermitStatus.PENDING_SECURITY:
                if (isAdmin || role === UserRole.SECURITY_GUARD || role === UserRole.SECURITY_HEAD) return 'ثبت خروج نهایی';
                break;
        }
        return null;
    };

    const handleApprove = async (p: ExitPermit) => {
        if (p.status === ExitPermitStatus.PENDING_WAREHOUSE) {
            setWarehouseFinalize(p);
            return;
        }

        if (!confirm(`آیا از تایید مرحله "${getActionRequired(p)}" اطمینان دارید؟`)) return;

        setProcessingId(p.id);
        try {
            let nextStatus: ExitPermitStatus = p.status;
            let extra: any = {};

            if (p.status === ExitPermitStatus.PENDING_CEO) nextStatus = ExitPermitStatus.PENDING_FACTORY;
            else if (p.status === ExitPermitStatus.PENDING_FACTORY) nextStatus = ExitPermitStatus.PENDING_WAREHOUSE;
            else if (p.status === ExitPermitStatus.PENDING_SECURITY) {
                nextStatus = ExitPermitStatus.EXITED;
                extra.exitTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
            }

            await updateExitPermitStatus(p.id, nextStatus, currentUser, extra);
            await loadData();
            setViewPermit(null);
        } catch (e) {
            alert('خطا در تایید سند');
        } finally {
            setProcessingId(null);
        }
    };

    const handleWarehouseSubmit = async (finalItems: ExitPermitItem[]) => {
        if (!warehouseFinalize) return;
        setProcessingId(warehouseFinalize.id);
        try {
            const totalWeight = finalItems.reduce((acc, i) => acc + (Number(i.weight) || 0), 0);
            const totalCartons = finalItems.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0);
            
            await editExitPermit({ 
                ...warehouseFinalize, 
                items: finalItems, 
                weight: totalWeight, 
                cartonCount: totalCartons,
                approverWarehouse: currentUser.fullName
            });

            await updateExitPermitStatus(warehouseFinalize.id, ExitPermitStatus.PENDING_SECURITY, currentUser);
            setWarehouseFinalize(null);
            setViewPermit(null);
            await loadData();
        } catch (e) {
            alert('خطا در ثبت توزین انبار');
        } finally {
            setProcessingId(null);
        }
    };

    const handleQuickArchive = async (p: ExitPermit) => {
        if (!confirm('⚠️ بایگانی سریع برای داده‌های قدیمی است. ادامه می‌دهید؟')) return;
        setProcessingId(p.id);
        try {
            await updateExitPermitStatus(p.id, ExitPermitStatus.EXITED, currentUser, { exitTime: 'بایگانی سریع' });
            await loadData();
        } finally {
            setProcessingId(null);
        }
    };

    const safePermits = Array.isArray(permits) ? permits : [];
    const filteredPermits = safePermits.filter(p => {
        const searchStr = `${p.permitNumber} ${p.recipientName} ${p.goodsName}`.toLowerCase();
        if (searchTerm && !searchStr.includes(searchTerm.toLowerCase())) return false;
        const isArchived = p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED;
        if (activeTab === 'ARCHIVE') return isArchived;
        if (activeTab === 'MY_TURN') return !isArchived && getActionRequired(p) !== null;
        if (activeTab === 'ALL_ACTIVE') return !isArchived;
        return true;
    });

    const getStatusConfig = (status: ExitPermitStatus) => {
        switch(status) {
            case ExitPermitStatus.PENDING_CEO: return { color: 'text-purple-600', bg: 'bg-purple-50', label: 'مدیرعامل' };
            case ExitPermitStatus.PENDING_FACTORY: return { color: 'text-orange-600', bg: 'bg-orange-50', label: 'کارخانه' };
            case ExitPermitStatus.PENDING_WAREHOUSE: return { color: 'text-blue-600', bg: 'bg-blue-50', label: 'انبار' };
            case ExitPermitStatus.PENDING_SECURITY: return { color: 'text-pink-600', bg: 'bg-pink-50', label: 'انتظامات' };
            case ExitPermitStatus.EXITED: return { color: 'text-green-600', bg: 'bg-green-50', label: 'خارج شده' };
            case ExitPermitStatus.REJECTED: return { color: 'text-red-600', bg: 'bg-red-50', label: 'رد شده' };
            default: return { color: 'text-gray-600', bg: 'bg-gray-50', label: status };
        }
    };

    return (
        <div className="space-y-4 pb-20 md:pb-0 animate-fade-in">
            {/* Sticky Header */}
            <div className="sticky top-0 bg-gray-50/95 backdrop-blur-sm pt-2 pb-2 z-30 space-y-3">
                <div className="flex justify-between items-center px-1">
                    <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                        <div className="bg-white p-2 rounded-xl shadow-sm"><Truck size={20} className="text-orange-600"/></div>
                        مدیریت خروج
                    </h2>
                    <button onClick={loadData} className="p-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-blue-600">
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""}/>
                    </button>
                </div>

                {/* Tabs - Horizontal Scroll */}
                <div className="flex gap-2 overflow-x-auto pb-1 px-1 no-scrollbar">
                    <button onClick={() => setActiveTab('MY_TURN')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${activeTab === 'MY_TURN' ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-white text-gray-600 border border-gray-100'}`}>
                        نوبت من ({safePermits.filter(p => !isArchived(p.status) && getActionRequired(p)).length})
                    </button>
                    <button onClick={() => setActiveTab('ALL_ACTIVE')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${activeTab === 'ALL_ACTIVE' ? 'bg-orange-600 text-white shadow-orange-200' : 'bg-white text-gray-600 border border-gray-100'}`}>
                        جریان فعال
                    </button>
                    <button onClick={() => setActiveTab('ARCHIVE')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${activeTab === 'ARCHIVE' ? 'bg-green-600 text-white shadow-green-200' : 'bg-white text-gray-600 border border-gray-100'}`}>
                        بایگانی
                    </button>
                </div>

                {/* Search */}
                <div className="relative mx-1">
                    <input 
                        className="w-full pl-10 pr-4 py-3 bg-white border-none rounded-2xl text-sm shadow-sm focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-400" 
                        placeholder="جستجو شماره، گیرنده، کالا..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                    <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
                </div>
            </div>

            {/* Content List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-1">
                {loading && filteredPermits.length === 0 ? (
                    <div className="col-span-full py-10 flex flex-col items-center gap-3 text-gray-400">
                        <Loader2 className="animate-spin text-blue-500" size={32} />
                        <span className="text-xs font-medium">در حال دریافت اطلاعات...</span>
                    </div>
                ) : filteredPermits.length === 0 ? (
                    <div className="col-span-full py-16 flex flex-col items-center gap-4 text-gray-400 bg-white/50 rounded-3xl border-2 border-dashed border-gray-200 m-2">
                        <Filter size={48} className="opacity-20" />
                        <span className="font-bold text-sm">موردی یافت نشد</span>
                    </div>
                ) : (
                    filteredPermits.map(p => {
                        const action = getActionRequired(p);
                        const statusConfig = getStatusConfig(p.status);
                        
                        return (
                            <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden transition-transform active:scale-[0.99]">
                                {/* Status Indicator Strip */}
                                <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${statusConfig.bg.replace('bg-', 'bg-').replace('50', '500')}`}></div>
                                
                                <div className="pl-3">
                                    {/* Header: ID & Status */}
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded-lg">#{p.permitNumber}</span>
                                            <span className="text-[10px] text-gray-400">{formatDate(p.date)}</span>
                                        </div>
                                        <div className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${statusConfig.bg} ${statusConfig.color}`}>
                                            {statusConfig.label}
                                        </div>
                                    </div>

                                    {/* Main Info */}
                                    <div className="mb-3">
                                        <h3 className="font-bold text-gray-800 text-base line-clamp-1 mb-1">{p.recipientName}</h3>
                                        <div className="text-xs text-gray-500 flex items-center gap-1">
                                            <Package size={12} className="text-blue-500"/>
                                            <span className="truncate max-w-[200px]">{(Array.isArray(p.items) && p.items.length > 0) ? p.items.map(i=>i.goodsName).join(', ') : p.goodsName}</span>
                                        </div>
                                    </div>

                                    {/* Details Grid */}
                                    <div className="grid grid-cols-2 gap-2 mb-4 bg-gray-50 rounded-xl p-2.5">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-gray-400">تعداد کل</span>
                                            <span className="text-xs font-bold text-gray-700">{p.cartonCount || 0} <span className="text-[9px] font-normal">کارتن</span></span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-gray-400">وزن کل</span>
                                            <span className="text-xs font-bold text-gray-700">{p.weight || 0} <span className="text-[9px] font-normal">KG</span></span>
                                        </div>
                                        {p.driverName && (
                                            <div className="col-span-2 flex items-center gap-1 border-t border-gray-200 pt-2 mt-1">
                                                <Truck size={12} className="text-gray-400"/>
                                                <span className="text-[10px] font-bold text-gray-600 truncate">{p.driverName} - {p.plateNumber}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 items-center">
                                        <button onClick={() => setViewPermit(p)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors">
                                            <Eye size={14} /> مشاهده
                                        </button>
                                        
                                        {action && !processingId && (
                                            <button onClick={() => handleApprove(p)} className="flex-[1.5] bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-xs font-bold shadow-md shadow-blue-200 flex items-center justify-center gap-1 transition-colors animate-pulse">
                                                <CheckCircle size={14} /> {action.replace('تایید', '')}
                                            </button>
                                        )}

                                        {currentUser.role === UserRole.ADMIN && !isArchived(p.status) && (
                                            <button onClick={() => handleQuickArchive(p)} className="p-2.5 bg-gray-100 text-gray-400 hover:text-green-600 rounded-xl transition-colors">
                                                <FastForward size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {processingId === p.id && (
                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex items-center justify-center z-20">
                                        <Loader2 className="animate-spin text-blue-600" size={24} />
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modals */}
            {viewPermit && (
                <PrintExitPermit 
                    permit={viewPermit} 
                    onClose={() => setViewPermit(null)} 
                    settings={settings}
                    onApprove={getActionRequired(viewPermit) ? () => handleApprove(viewPermit) : undefined}
                    onReject={getActionRequired(viewPermit) ? async () => {
                        const reason = prompt('علت رد سند خروج:');
                        if (reason) {
                            await updateExitPermitStatus(viewPermit.id, ExitPermitStatus.REJECTED, currentUser, { rejectionReason: reason });
                            loadData();
                            setViewPermit(null);
                        }
                    } : undefined}
                />
            )}

            {warehouseFinalize && (
                <WarehouseFinalizeModal 
                    permit={warehouseFinalize} 
                    onClose={() => setWarehouseFinalize(null)} 
                    onConfirm={handleWarehouseSubmit} 
                />
            )}
        </div>
    );
};

const isArchived = (status: string) => status === ExitPermitStatus.EXITED || status === ExitPermitStatus.REJECTED;

export default ManageExitPermits;
