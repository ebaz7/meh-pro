import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings, ExitPermitItem } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, editExitPermit } from '../services/storageService';
import { formatDate } from '../constants';
import { 
    Eye, Trash2, Search, CheckCircle, Truck, XCircle, Edit, Loader2, 
    Package, Archive, ListChecks, Filter, AlertTriangle, FastForward,
    ChevronLeft, UserCheck, ShieldCheck, MapPin
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
        const data = await getExitPermits();
        setPermits(data.sort((a, b) => b.createdAt - a.createdAt));
        setLoading(false);
    };

    // منطق تاییدات طبق اولویت
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
            // FIX: Explicitly typing nextStatus as ExitPermitStatus to avoid narrowing issues
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
        if (!confirm('⚠️ بایگانی سریع برای داده‌های قدیمی است. این سند مستقیماً بدون تاییدات دیگر به بایگانی می‌رود. ادامه می‌دهید؟')) return;
        setProcessingId(p.id);
        try {
            await updateExitPermitStatus(p.id, ExitPermitStatus.EXITED, currentUser, { exitTime: 'بایگانی سریع' });
            await loadData();
            alert('سند با موفقیت بایگانی شد.');
        } finally {
            setProcessingId(null);
        }
    };

    const filteredPermits = permits.filter(p => {
        const searchStr = `${p.permitNumber} ${p.recipientName} ${p.goodsName}`.toLowerCase();
        if (searchTerm && !searchStr.includes(searchTerm.toLowerCase())) return false;

        const isArchived = p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED;

        if (activeTab === 'ARCHIVE') return isArchived;
        if (activeTab === 'MY_TURN') return !isArchived && getActionRequired(p) !== null;
        if (activeTab === 'ALL_ACTIVE') return !isArchived;

        return true;
    });

    const getStepProgress = (status: ExitPermitStatus) => {
        const steps = [ExitPermitStatus.PENDING_CEO, ExitPermitStatus.PENDING_FACTORY, ExitPermitStatus.PENDING_WAREHOUSE, ExitPermitStatus.PENDING_SECURITY, ExitPermitStatus.EXITED];
        const currentIndex = steps.indexOf(status);
        return ((currentIndex) / (steps.length - 1)) * 100;
    };

    return (
        <div className="space-y-6 animate-fade-in pb-24">
            {/* Header & Tabs */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-orange-100 p-2.5 rounded-2xl text-orange-600 shadow-inner">
                        <Truck size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-800">سیستم خروج بار</h2>
                        <p className="text-xs text-gray-500">تاییدات زنجیره‌ای و هوشمند</p>
                    </div>
                </div>

                <div className="flex bg-gray-100 p-1.5 rounded-2xl w-full md:w-auto">
                    <button onClick={() => setActiveTab('MY_TURN')} className={`flex-1 md:flex-none px-5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'MY_TURN' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}>
                        نوبت تایید من
                    </button>
                    <button onClick={() => setActiveTab('ALL_ACTIVE')} className={`flex-1 md:flex-none px-5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'ALL_ACTIVE' ? 'bg-white shadow-md text-gray-800' : 'text-gray-500 hover:bg-gray-200'}`}>
                        همه فعال
                    </button>
                    <button onClick={() => setActiveTab('ARCHIVE')} className={`flex-1 md:flex-none px-5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'ARCHIVE' ? 'bg-white shadow-md text-green-600' : 'text-gray-500 hover:bg-gray-200'}`}>
                        بایگانی نهایی
                    </button>
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all" placeholder="جستجو شماره یا گیرنده..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            {/* Content List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 flex flex-col items-center gap-4 text-gray-400">
                        <Loader2 className="animate-spin" size={48} />
                        <span className="font-bold">در حال بارگذاری لیست...</span>
                    </div>
                ) : filteredPermits.length === 0 ? (
                    <div className="col-span-full py-20 flex flex-col items-center gap-4 text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                        <Filter size={64} className="opacity-10" />
                        <span className="font-bold text-lg">سندی یافت نشد</span>
                        <p className="text-sm">موردی برای نمایش در این بخش وجود ندارد.</p>
                    </div>
                ) : (
                    filteredPermits.map(p => {
                        const action = getActionRequired(p);
                        const progress = getStepProgress(p.status);
                        
                        return (
                            <div key={p.id} className={`bg-white rounded-3xl border-2 p-5 shadow-sm transition-all group relative overflow-hidden ${action ? 'border-blue-500 ring-4 ring-blue-50' : 'border-gray-100 hover:border-blue-200'}`}>
                                {/* Header of card */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-gray-400 font-mono tracking-tighter bg-gray-50 px-2 py-0.5 rounded-full w-fit">#{p.permitNumber}</span>
                                        <h3 className="font-black text-gray-800 text-lg mt-1 line-clamp-1">{p.recipientName}</h3>
                                    </div>
                                    <div className={`px-3 py-1 rounded-xl text-[10px] font-black border ${p.status === ExitPermitStatus.EXITED ? 'bg-green-50 text-green-700 border-green-200' : p.status === ExitPermitStatus.REJECTED ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                        {p.status}
                                    </div>
                                </div>

                                {/* Items summary */}
                                <div className="bg-gray-50 rounded-2xl p-3 mb-4 space-y-2 border border-gray-100">
                                    <div className="flex items-center gap-2 text-gray-700 font-bold text-xs">
                                        <Package size={14} className="text-blue-500" />
                                        <span className="truncate">{p.goodsName}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-gray-500 border-t border-gray-200 pt-2">
                                        <div className="flex items-center gap-1"><UserCheck size={10}/> <span>{p.requester}</span></div>
                                        <div className="font-mono">{formatDate(p.date)}</div>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="mb-6 px-1">
                                    <div className="flex justify-between text-[8px] font-black text-gray-400 mb-1 px-1">
                                        <span>ثبت</span>
                                        <span>مدیرعامل</span>
                                        <span>توزین</span>
                                        <span>خروج</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                                        <div className={`h-full transition-all duration-700 ${p.status === ExitPermitStatus.REJECTED ? 'bg-red-500 w-full' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2 relative z-10">
                                    <button onClick={() => setViewPermit(p)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95">
                                        <Eye size={16} /> مشاهده
                                    </button>
                                    
                                    {action && !processingId && (
                                        <button onClick={() => handleApprove(p)} className="flex-[1.5] bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl text-xs font-black shadow-lg shadow-blue-200 flex items-center justify-center gap-1.5 transition-all active:scale-95 animate-pulse">
                                            <CheckCircle size={16} /> {action}
                                        </button>
                                    )}

                                    {currentUser.role === UserRole.ADMIN && !isArchived(p.status) && (
                                        <button onClick={() => handleQuickArchive(p)} className="p-3 bg-green-50 text-green-600 hover:bg-green-100 rounded-2xl transition-all" title="بایگانی سریع (برای داده‌های قدیمی)">
                                            <FastForward size={18} />
                                        </button>
                                    )}
                                </div>

                                {processingId === p.id && (
                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-20">
                                        <Loader2 className="animate-spin text-blue-600" size={32} />
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