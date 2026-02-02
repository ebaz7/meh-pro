
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, SystemSettings, WarehouseItem, WarehouseTransaction, WarehouseTransactionItem, UserRole } from '../types';
import { getWarehouseItems, saveWarehouseItem, deleteWarehouseItem, getWarehouseTransactions, saveWarehouseTransaction, deleteWarehouseTransaction, updateWarehouseTransaction, getNextBijakNumber, updateWarehouseItem } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian, formatNumberString, deformatNumberString, formatDate, parsePersianDate, getShamsiDateFromIso } from '../constants';
import { Package, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, FileText, BarChart3, Eye, Loader2, AlertTriangle, Settings, ArrowLeftRight, Search, FileClock, Printer, FileDown, Share2, LayoutGrid, Archive, Edit, Save, X, Container, CheckCircle, XCircle } from 'lucide-react';
import PrintBijak from './PrintBijak';
import { apiCall } from '../services/apiService';
import { getUsers } from '../services/authService';

interface Props { 
    currentUser: User; 
    settings?: SystemSettings; 
    initialTab?: 'dashboard' | 'items' | 'entry' | 'exit' | 'reports' | 'stock_report' | 'archive' | 'entry_archive' | 'approvals';
}

const WarehouseModule: React.FC<Props> = ({ currentUser, settings, initialTab = 'dashboard' }) => {
    const [loadingData, setLoadingData] = useState(true);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [items, setItems] = useState<WarehouseItem[]>([]);
    const [transactions, setTransactions] = useState<WarehouseTransaction[]>([]);
    
    // ... سایر استیت‌ها ...
    const [viewBijak, setViewBijak] = useState<WarehouseTransaction | null>(null);
    const [approvedTxForAutoSend, setApprovedTxForAutoSend] = useState<WarehouseTransaction | null>(null);
    const [deletedTxForAutoSend, setDeletedTxForAutoSend] = useState<WarehouseTransaction | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => { setLoadingData(true); try { const [i, t] = await Promise.all([getWarehouseItems(), getWarehouseTransactions()]); setItems(i || []); setTransactions(t || []); } catch (e) { console.error(e); } finally { setLoadingData(false); } };

    const handleApproveBijak = async (tx: WarehouseTransaction) => {
        if (!confirm('آیا تایید می‌کنید؟')) return;
        
        try {
            const updatedTx = { ...tx, status: 'APPROVED' as const, approvedBy: currentUser.fullName };
            await updateWarehouseTransaction(updatedTx);
            setApprovedTxForAutoSend(updatedTx);
            
            setTimeout(async () => {
                const managerElement = document.getElementById(`print-bijak-${updatedTx.id}-price`);
                const warehouseElement = document.getElementById(`print-bijak-${updatedTx.id}-noprice`);
                
                let commonDetails = `🏭 *شرکت: ${updatedTx.company}*\n`;
                commonDetails += `🧾 *بیجک تایید شده #${updatedTx.number}*\n`;
                commonDetails += `👤 گیرنده: ${updatedTx.recipientName}\n`;
                commonDetails += `✅ تایید: ${currentUser.fullName}\n`;
                
                if (settings?.companyNotifications) {
                    const companyConfig = settings.companyNotifications[updatedTx.company];
                    
                    // ارسال به مدیر (با فی) -> از طریق API مرکزی که تلگرام را هم پوشش می‌دهد
                    if (companyConfig?.salesManager && managerElement) {
                        // @ts-ignore
                        const canvas = await window.html2canvas(managerElement, { scale: 2, backgroundColor: '#ffffff' });
                        const base64 = canvas.toDataURL('image/png').split(',')[1];
                        await apiCall('/send-whatsapp', 'POST', { 
                            number: companyConfig.salesManager, 
                            message: commonDetails, 
                            mediaData: { data: base64, mimeType: 'image/png', filename: `Bijak_${updatedTx.number}.png` } 
                        });
                    }

                    // ارسال به انبار (بدون فی)
                    if (companyConfig?.warehouseGroup && warehouseElement) {
                        // @ts-ignore
                        const canvas = await window.html2canvas(warehouseElement, { scale: 2, backgroundColor: '#ffffff' });
                        const base64 = canvas.toDataURL('image/png').split(',')[1];
                        await apiCall('/send-whatsapp', 'POST', { 
                            number: companyConfig.warehouseGroup, 
                            message: `📦 *نسخه انبار*\n${commonDetails}`, 
                            mediaData: { data: base64, mimeType: 'image/png', filename: `Bijak_WH_${updatedTx.number}.png` } 
                        });
                    }
                }
                
                setApprovedTxForAutoSend(null);
                loadData();
                setViewBijak(null);
                alert("تایید و در شبکه‌های اجتماعی اطلاع‌رسانی شد.");
            }, 2000); 

        } catch (e) { alert("خطا"); }
    };

    // ... باقی مانده کامپوننت ...
    return (
        <div className="bg-white rounded-2xl shadow-sm border h-[calc(100vh-100px)] flex flex-col overflow-hidden relative">
            <div className="hidden-print-export" style={{position:'absolute', top:'-9999px', left:'-9999px'}}>
                {approvedTxForAutoSend && (
                    <>
                        <div id={`print-bijak-${approvedTxForAutoSend.id}-price`} style={{ width: '210mm' }}><PrintBijak tx={approvedTxForAutoSend} onClose={()=>{}} settings={settings} forceHidePrices={false} embed /></div>
                        <div id={`print-bijak-${approvedTxForAutoSend.id}-noprice`} style={{ width: '210mm' }}><PrintBijak tx={approvedTxForAutoSend} onClose={()=>{}} settings={settings} forceHidePrices={true} embed /></div>
                    </>
                )}
            </div>
            {/* UI رندرینگ */}
            <div className="p-4 border-b bg-gray-50 flex gap-2">
                <button onClick={() => setActiveTab('approvals')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'approvals' ? 'bg-white shadow text-orange-600' : 'text-gray-600'}`}>کارتابل تایید</button>
                <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'dashboard' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}>داشبورد</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'approvals' && (
                    <div className="space-y-4">
                        {transactions.filter(t => t.type === 'OUT' && t.status === 'PENDING').map(tx => (
                            <div key={tx.id} className="p-4 border rounded-xl flex justify-between items-center bg-orange-50/30">
                                <div><span className="font-bold">بیجک #{tx.number}</span> - {tx.recipientName}</div>
                                <div className="flex gap-2">
                                    <button onClick={() => setViewBijak(tx)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">مشاهده</button>
                                    <button onClick={() => handleApproveBijak(tx)} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">تایید و ارسال اعلان</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {viewBijak && <PrintBijak tx={viewBijak} onClose={() => setViewBijak(null)} settings={settings} />}
        </div>
    );
};

export default WarehouseModule;
