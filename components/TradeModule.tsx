
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, TradeRecord, TradeStage, TradeItem, SystemSettings, InsuranceEndorsement, CurrencyPurchaseData, TradeTransaction, CurrencyTranche, TradeStageData, ShippingDocument, ShippingDocType, DocStatus, InvoiceItem, InspectionData, InspectionPayment, InspectionCertificate, ClearanceData, WarehouseReceipt, ClearancePayment, GreenLeafData, GreenLeafCustomsDuty, GreenLeafGuarantee, GreenLeafTax, GreenLeafRoadToll, InternalShippingData, ShippingPayment, AgentData, AgentPayment, PackingItem, UserRole } from '../types';
import { getTradeRecords, saveTradeRecord, updateTradeRecord, deleteTradeRecord, getSettings, uploadFile } from '../services/storageService';
import { generateUUID, formatCurrency, formatNumberString, deformatNumberString, parsePersianDate, formatDate, calculateDaysDiff, getStatusLabel } from '../constants';
import { Container, Plus, Search, CheckCircle2, Save, Trash2, X, Package, ArrowRight, History, Banknote, Coins, Wallet, FileSpreadsheet, Shield, LayoutDashboard, Printer, FileDown, Paperclip, Building2, FolderOpen, Home, Calculator, FileText, Microscope, ListFilter, Warehouse, Calendar as CalendarIcon, PieChart, BarChart, Clock, Leaf, Scale, ShieldCheck, Percent, Truck, CheckSquare, Square, ToggleLeft, ToggleRight, DollarSign, UserCheck, Check, Archive, AlertCircle, RefreshCw, Box, Loader2, Share2, ChevronLeft, ChevronRight, ExternalLink, CalendarDays, Info, ArrowLeftRight, Edit2, Edit, Undo2 } from 'lucide-react';
import { apiCall } from '../services/apiService';
import AllocationReport from './AllocationReport';
import CurrencyReport from './reports/CurrencyReport';
import CompanyPerformanceReport from './reports/CompanyPerformanceReport';
import PrintFinalCostReport from './print/PrintFinalCostReport';
import PrintClearanceDeclaration from './print/PrintClearanceDeclaration';
import InsuranceLedgerReport from './reports/InsuranceLedgerReport';
import GuaranteeReport from './reports/GuaranteeReport';
import InsuranceTab from './InsuranceTab';
import CurrencyGuaranteeSection from './trade/CurrencyGuaranteeSection';

// ... (Interface definitions remain same) ...
interface TradeModuleProps {
    currentUser: User;
}

const STAGES = Object.values(TradeStage);
const CURRENCIES = [
    { code: 'EUR', label: 'یورو (€)' },
    { code: 'USD', label: 'دلار ($)' },
    { code: 'AED', label: 'درهم (AED)' },
    { code: 'CNY', label: 'یوان (¥)' },
    { code: 'TRY', label: 'لیر (₺)' },
];

type ReportType = 'general' | 'allocation_queue' | 'allocated' | 'currency' | 'insurance' | 'shipping' | 'inspection' | 'clearance' | 'green_leaf' | 'company_performance' | 'insurance_ledger' | 'guarantee';

const TradeModule: React.FC<TradeModuleProps> = ({ currentUser }) => {
    // ... (All state variables and effects remain same) ...
    const [records, setRecords] = useState<TradeRecord[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<TradeRecord | null>(null);
    const [commodityGroups, setCommodityGroups] = useState<string[]>([]);
    const [availableBanks, setAvailableBanks] = useState<string[]>([]);
    const [operatingBanks, setOperatingBanks] = useState<string[]>([]);
    const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
    const [settings, setSettingsData] = useState<SystemSettings | null>(null);

    const [navLevel, setNavLevel] = useState<'ROOT' | 'COMPANY' | 'GROUP'>('ROOT');
    const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [showArchived, setShowArchived] = useState(false);

    const [viewMode, setViewMode] = useState<'dashboard' | 'details' | 'reports'>('dashboard');
    const [activeReport, setActiveReport] = useState<ReportType>('general');
    const [reportFilterCompany, setReportFilterCompany] = useState<string>('');
    const [reportSearchTerm, setReportSearchTerm] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal & Form States
    const [showNewModal, setShowNewModal] = useState(false);
    const [newFileNumber, setNewFileNumber] = useState('');
    const [newGoodsName, setNewGoodsName] = useState('');
    const [newSellerName, setNewSellerName] = useState('');
    const [newCommodityGroup, setNewCommodityGroup] = useState('');
    const [newMainCurrency, setNewMainCurrency] = useState('EUR');
    const [newRecordCompany, setNewRecordCompany] = useState('');
    
    const [activeTab, setActiveTab] = useState<'timeline' | 'proforma' | 'insurance' | 'currency_purchase' | 'shipping_docs' | 'inspection' | 'clearance_docs' | 'green_leaf' | 'internal_shipping' | 'agent_fees' | 'final_calculation'>('timeline');
    
    const [showEditMetadataModal, setShowEditMetadataModal] = useState(false);
    const [editMetadataForm, setEditMetadataForm] = useState<Partial<TradeRecord>>({});

    const [editingStage, setEditingStage] = useState<TradeStage | null>(null);
    const [stageFormData, setStageFormData] = useState<Partial<TradeStageData>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingStageFile, setUploadingStageFile] = useState(false);

    const [newItem, setNewItem] = useState<Partial<TradeItem> & { weightStr?: string, unitPriceStr?: string }>({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, hsCode: '', weightStr: '', unitPriceStr: '' });
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    const [insuranceForm, setInsuranceForm] = useState<NonNullable<TradeRecord['insuranceData']>>({ policyNumber: '', company: '', cost: 0, bank: '', endorsements: [], isPaid: false, paymentDate: '' });
    const [newEndorsement, setNewEndorsement] = useState<Partial<InsuranceEndorsement>>({ amount: 0, description: '', date: '' });
    const [endorsementType, setEndorsementType] = useState<'increase' | 'refund'>('increase');
    
    const [inspectionForm, setInspectionForm] = useState<InspectionData>({ certificates: [], payments: [] });
    const [newInspectionCertificate, setNewInspectionCertificate] = useState<Partial<InspectionCertificate>>({ part: '', company: '', certificateNumber: '', amount: 0 });
    const [newInspectionPayment, setNewInspectionPayment] = useState<Partial<InspectionPayment>>({ part: '', amount: 0, date: '', bank: '' });

    const [clearanceForm, setClearanceForm] = useState<ClearanceData>({ receipts: [], payments: [] });
    const [newWarehouseReceipt, setNewWarehouseReceipt] = useState<Partial<WarehouseReceipt>>({ number: '', part: '', issueDate: '' });
    const [newClearancePayment, setNewClearancePayment] = useState<Partial<ClearancePayment>>({ amount: 0, part: '', bank: '', date: '', payingBank: '' });

    const [greenLeafForm, setGreenLeafForm] = useState<GreenLeafData>({ duties: [], guarantees: [], taxes: [], roadTolls: [] });
    const [newCustomsDuty, setNewCustomsDuty] = useState<Partial<GreenLeafCustomsDuty>>({ cottageNumber: '', part: '', amount: 0, paymentMethod: 'Bank', bank: '', date: '' });
    const [newGuaranteeDetails, setNewGuaranteeDetails] = useState<Partial<GreenLeafGuarantee>>({ guaranteeNumber: '', chequeNumber: '', chequeBank: '', chequeDate: '', cashAmount: 0, cashBank: '', cashDate: '', chequeAmount: 0 });
    const [selectedDutyForGuarantee, setSelectedDutyForGuarantee] = useState<string>('');
    const [newTax, setNewTax] = useState<Partial<GreenLeafTax>>({ part: '', amount: 0, bank: '', date: '' });
    const [newRoadToll, setNewRoadToll] = useState<Partial<GreenLeafRoadToll>>({ part: '', amount: 0, bank: '', date: '' });

    const [internalShippingForm, setInternalShippingForm] = useState<InternalShippingData>({ payments: [] });
    const [newShippingPayment, setNewShippingPayment] = useState<Partial<ShippingPayment>>({ part: '', amount: 0, date: '', bank: '', description: '' });

    const [agentForm, setAgentForm] = useState<AgentData>({ payments: [] });
    const [newAgentPayment, setNewAgentPayment] = useState<Partial<AgentPayment>>({ agentName: '', amount: 0, bank: '', date: '', part: '', description: '' });

    const [newLicenseTx, setNewLicenseTx] = useState<Partial<TradeTransaction>>({ amount: 0, bank: '', date: '', description: 'هزینه ثبت سفارش' });

    const [currencyForm, setCurrencyForm] = useState<CurrencyPurchaseData>({
        payments: [], purchasedAmount: 0, purchasedCurrencyType: '', purchaseDate: '', brokerName: '', exchangeName: '', deliveredAmount: 0, deliveredCurrencyType: '', deliveryDate: '', recipientName: '', remittedAmount: 0, isDelivered: false, tranches: [], guaranteeCheque: undefined
    });
    
    // Using Omit to avoid type conflict with returnAmount (number vs string for input)
    const [newCurrencyTranche, setNewCurrencyTranche] = useState<Omit<Partial<CurrencyTranche>, 'returnAmount'> & { returnAmount?: string, returnDate?: string, amountStr?: string, rialAmountStr?: string, receivedAmountStr?: string, currencyFeeStr?: string }>({ 
        amount: 0, 
        currencyType: 'EUR', 
        date: '', 
        exchangeName: '', 
        brokerName: '', 
        isDelivered: false, 
        deliveryDate: '',
        returnAmount: '',
        returnDate: '',
        receivedAmount: 0,
        amountStr: '',
        rialAmountStr: '',
        receivedAmountStr: '',
        currencyFeeStr: ''
    });
    const [editingTrancheId, setEditingTrancheId] = useState<string | null>(null);
    const [currencyGuarantee, setCurrencyGuarantee] = useState<{amount: string, bank: string, number: string, date: string, isDelivered: boolean}>({amount: '', bank: '', number: '', date: '', isDelivered: false});

    const [activeShippingSubTab, setActiveShippingSubTab] = useState<ShippingDocType>('Commercial Invoice');
    const [shippingDocForm, setShippingDocForm] = useState<Partial<ShippingDocument>>({
        status: 'Draft',
        documentNumber: '',
        documentDate: '',
        attachments: [],
        invoiceItems: [],
        packingItems: [],
        freightCost: 0
    });
    const [newInvoiceItem, setNewInvoiceItem] = useState<Partial<InvoiceItem>>({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, part: '' });
    const [newPackingItem, setNewPackingItem] = useState<Partial<PackingItem>>({ description: '', netWeight: 0, grossWeight: 0, packageCount: 0, part: '' });
    const [uploadingDocFile, setUploadingDocFile] = useState(false);
    const docFileInputRef = useRef<HTMLInputElement>(null);

    const [calcExchangeRate, setCalcExchangeRate] = useState<number>(0);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [showFinalReportPrint, setShowFinalReportPrint] = useState(false);
    
    const [showClearancePrint, setShowClearancePrint] = useState(false);

    const companySpecificBanks = useMemo(() => {
        if (!selectedRecord || !settings) return [];
        const targetCompany = settings.companies?.find(c => c.name === selectedRecord.company);
        if (targetCompany && targetCompany.banks && targetCompany.banks.length > 0) {
            return targetCompany.banks.map(b => b.bankName);
        }
        return availableBanks;
    }, [selectedRecord, settings, availableBanks]);

    useEffect(() => {
        loadRecords();
        getSettings().then(s => {
            setSettingsData(s);
            setCommodityGroups(s.commodityGroups || []);
            setAvailableBanks(s.bankNames || []);
            setOperatingBanks(s.operatingBankNames || []);
            setAvailableCompanies(s.companyNames || []);
            setNewRecordCompany(s.defaultCompany || '');
        });
    }, []);

    useEffect(() => {
        // ... (Effect logic unchanged) ...
        if (selectedRecord) {
            const insData = selectedRecord.insuranceData || { policyNumber: '', company: '', cost: 0, bank: '', endorsements: [], isPaid: false, paymentDate: '' };
            setInsuranceForm({
                policyNumber: insData.policyNumber || '',
                company: insData.company || '',
                cost: insData.cost || 0,
                bank: insData.bank || '',
                endorsements: insData.endorsements || [],
                isPaid: !!insData.isPaid,
                paymentDate: insData.paymentDate || ''
            });

            const inspData = selectedRecord.inspectionData || { certificates: [], payments: [] };
            const certificates = inspData.certificates || [];
            if (certificates.length === 0 && inspData.certificateNumber) {
                 certificates.push({ id: generateUUID(), part: 'Original', certificateNumber: inspData.certificateNumber, company: inspData.inspectionCompany || '', amount: inspData.totalInvoiceAmount || 0 });
            }
            setInspectionForm({
                certificates: certificates,
                payments: inspData.payments || []
            });

            const clrData = selectedRecord.clearanceData || { receipts: [], payments: [] };
            setClearanceForm({
                receipts: clrData.receipts || [],
                payments: clrData.payments || []
            });

            const glData = selectedRecord.greenLeafData || { duties: [], guarantees: [], taxes: [], roadTolls: [] };
            setGreenLeafForm({
                duties: glData.duties || [],
                guarantees: glData.guarantees || [],
                taxes: glData.taxes || [],
                roadTolls: glData.roadTolls || []
            });

            const isData = selectedRecord.internalShippingData || { payments: [] };
            setInternalShippingForm({
                payments: isData.payments || []
            });

            const agData = selectedRecord.agentData || { payments: [] };
            setAgentForm({
                payments: agData.payments || []
            });

            const curData = (selectedRecord.currencyPurchaseData || {}) as CurrencyPurchaseData;
            setCurrencyForm({
                payments: curData.payments || [],
                purchasedAmount: curData.purchasedAmount || 0,
                purchasedCurrencyType: curData.purchasedCurrencyType || selectedRecord.mainCurrency || 'EUR',
                tranches: curData.tranches || [],
                isDelivered: !!curData.isDelivered,
                deliveredAmount: curData.deliveredAmount || 0,
                remittedAmount: curData.remittedAmount || 0,
                guaranteeCheque: curData.guaranteeCheque,
                purchaseDate: curData.purchaseDate || '',
                brokerName: curData.brokerName || '',
                exchangeName: curData.exchangeName || '',
                deliveryDate: curData.deliveryDate || '',
                recipientName: curData.recipientName || '',
                deliveredCurrencyType: curData.deliveredCurrencyType || ''
            });

            if (curData.guaranteeCheque) {
                setCurrencyGuarantee({
                    amount: formatNumberString(curData.guaranteeCheque.amount),
                    bank: curData.guaranteeCheque.bank,
                    number: curData.guaranteeCheque.chequeNumber,
                    date: curData.guaranteeCheque.dueDate,
                    isDelivered: curData.guaranteeCheque.isDelivered || false
                });
            } else {
                setCurrencyGuarantee({amount: '', bank: '', number: '', date: '', isDelivered: false});
            }
            
            setCalcExchangeRate(selectedRecord.exchangeRate || 0);
            
            setNewLicenseTx({ amount: 0, bank: '', date: '', description: 'هزینه ثبت سفارش' });
            setNewCurrencyTranche({ amount: 0, currencyType: selectedRecord.mainCurrency || 'EUR', date: '', exchangeName: '', brokerName: '', isDelivered: false, returnAmount: '', returnDate: '', receivedAmount: 0, amountStr: '', rialAmountStr: '', receivedAmountStr: '', currencyFeeStr: '' });
            setEditingTrancheId(null);
            setNewItem({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, hsCode: '', weightStr: '', unitPriceStr: '' });
            setEditingItemId(null);
            setNewInspectionPayment({ part: '', amount: 0, date: '', bank: '' });
            setNewInspectionCertificate({ part: '', company: '', certificateNumber: '', amount: 0 });
            setNewWarehouseReceipt({ number: '', part: '', issueDate: '' });
            setNewClearancePayment({ amount: 0, part: '', bank: '', date: '', payingBank: '' });
            setNewCustomsDuty({ cottageNumber: '', part: '', amount: 0, paymentMethod: 'Bank', bank: '', date: '' });
            setNewGuaranteeDetails({ guaranteeNumber: '', chequeNumber: '', chequeBank: '', chequeDate: '', cashAmount: 0, cashBank: '', cashDate: '', chequeAmount: 0 });
            setNewTax({ part: '', amount: 0, bank: '', date: '' });
            setNewRoadToll({ part: '', amount: 0, bank: '', date: '' });
            setNewShippingPayment({ part: '', amount: 0, date: '', bank: '', description: '' });
            setNewAgentPayment({ agentName: '', amount: 0, bank: '', date: '', part: '', description: '' });
            setShippingDocForm({ status: 'Draft', documentNumber: '', documentDate: '', attachments: [], currency: selectedRecord.mainCurrency || 'EUR', invoiceItems: [], packingItems: [], freightCost: 0 });
            setNewInvoiceItem({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, part: '' });
            setNewPackingItem({ description: '', netWeight: 0, grossWeight: 0, packageCount: 0, part: '' });
        }
    }, [selectedRecord]);

    const loadRecords = async () => { 
        try {
            const data = await getTradeRecords(); 
            setRecords(Array.isArray(data) ? data : []); 
        } catch (e) {
            console.error("Error loading trade records", e);
            setRecords([]);
        }
    };

    const goRoot = () => { setNavLevel('ROOT'); setSelectedCompany(null); setSelectedGroup(null); setSearchTerm(''); };
    const goCompany = (company: string) => { setSelectedCompany(company); setNavLevel('COMPANY'); setSelectedGroup(null); setSearchTerm(''); };
    const goGroup = (group: string) => { setSelectedGroup(group); setNavLevel('GROUP'); setSearchTerm(''); };

    const safeRecords = Array.isArray(records) ? records : [];

    const groupedData = useMemo(() => {
        const currentRecords = safeRecords.filter(r => showArchived ? r.isArchived : !r.isArchived);
        if (navLevel === 'ROOT') {
            const companies: Record<string, number> = {};
            currentRecords.forEach(r => { const c = r.company || 'بدون شرکت'; companies[c] = (companies[c] || 0) + 1; });
            return Object.entries(companies).map(([name, count]) => ({ name, count, type: 'company' }));
        } else if (navLevel === 'COMPANY') {
            const groups: Record<string, number> = {};
            currentRecords.filter(r => (r.company || 'بدون شرکت') === selectedCompany).forEach(r => { const g = r.commodityGroup || 'سایر'; groups[g] = (groups[g] || 0) + 1; });
            return Object.entries(groups).map(([name, count]) => ({ name, count, type: 'group' }));
        }
        return [];
    }, [safeRecords, showArchived, navLevel, selectedCompany]);

    const getStageData = (record: TradeRecord | null, stage: TradeStage): TradeStageData => {
        if (!record || !record.stages) return { stage, isCompleted: false, description: '', costRial: 0, costCurrency: 0, currencyType: 'EUR', attachments: [], updatedAt: 0, updatedBy: '' };
        return record.stages[stage] || { stage, isCompleted: false, description: '', costRial: 0, costCurrency: 0, currencyType: 'EUR', attachments: [], updatedAt: 0, updatedBy: '' };
    };

    // --- HANDLERS (kept identical) ---
    const handleCreateRecord = async () => { if (!newFileNumber || !newGoodsName) return; const newRecord: TradeRecord = { id: generateUUID(), company: newRecordCompany, fileNumber: newFileNumber, orderNumber: newFileNumber, goodsName: newGoodsName, registrationNumber: '', sellerName: newSellerName, commodityGroup: newCommodityGroup, mainCurrency: newMainCurrency, items: [], freightCost: 0, startDate: new Date().toISOString(), status: 'Active', stages: {}, createdAt: Date.now(), createdBy: currentUser.fullName, licenseData: { transactions: [] }, shippingDocuments: [] }; STAGES.forEach(stage => { newRecord.stages[stage] = { stage, isCompleted: false, description: '', costRial: 0, costCurrency: 0, currencyType: newMainCurrency, attachments: [], updatedAt: Date.now(), updatedBy: '' }; }); await saveTradeRecord(newRecord); await loadRecords(); setShowNewModal(false); setNewFileNumber(''); setNewGoodsName(''); setSelectedRecord(newRecord); setActiveTab('proforma'); setViewMode('details'); };
    const handleDeleteRecord = async (id: string, e: React.MouseEvent) => { e.stopPropagation(); if (confirm("آیا از حذف این پرونده بازرگانی اطمینان دارید؟")) { await deleteTradeRecord(id); if (selectedRecord?.id === id) setSelectedRecord(null); loadRecords(); } };
    const handleUpdateProforma = async (field: keyof TradeRecord, value: string | number) => { if (!selectedRecord) return; const updatedRecord = { ...selectedRecord, [field]: value }; setSelectedRecord(updatedRecord); await updateTradeRecord(updatedRecord); setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r)); };
    // ... (All other handlers from original file kept identical to ensure NO logic change, only UI) ...
    // ... [Copy all handlers: handleAddItem, handleEditItem, handleRemoveItem, handleAddLicenseTx, etc...] ...
    
    // Placeholder to keep code short here, assume all logic handlers are preserved exactly as in the original file
    // I will include necessary ones used in render
    const handleAddItem = async () => { if (!selectedRecord || !newItem.name) return; const weightVal = newItem.weightStr ? deformatNumberString(newItem.weightStr) : 0; const unitPriceVal = newItem.unitPriceStr ? deformatNumberString(newItem.unitPriceStr) : 0; const item: TradeItem = { id: editingItemId || generateUUID(), name: newItem.name, weight: weightVal, unitPrice: unitPriceVal, totalPrice: newItem.totalPrice || (weightVal * unitPriceVal), hsCode: newItem.hsCode }; let updatedItems = []; if (editingItemId) { updatedItems = selectedRecord.items.map(i => i.id === editingItemId ? item : i); } else { updatedItems = [...selectedRecord.items, item]; } const updatedRecord = { ...selectedRecord, items: updatedItems }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r)); setNewItem({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, hsCode: '', weightStr: '', unitPriceStr: '' }); setEditingItemId(null); };
    const handleEditItem = (item: TradeItem) => { setNewItem({ name: item.name, weight: item.weight, weightStr: formatNumberString(item.weight), unitPrice: item.unitPrice, unitPriceStr: formatNumberString(item.unitPrice), totalPrice: item.totalPrice, hsCode: item.hsCode || '' }); setEditingItemId(item.id); };
    const handleRemoveItem = async (id: string) => { if (!selectedRecord) return; const updatedItems = selectedRecord.items.filter(i => i.id !== id); const updatedRecord = { ...selectedRecord, items: updatedItems }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    // ... [Continue keeping handlers exactly as they were] ...
    const handleAddLicenseTx = async () => { if (!selectedRecord || !newLicenseTx.amount) return; const tx: TradeTransaction = { id: generateUUID(), date: newLicenseTx.date || '', amount: Number(newLicenseTx.amount), bank: newLicenseTx.bank || '', description: newLicenseTx.description || '' }; const currentLicenseData = selectedRecord.licenseData || { transactions: [] }; const updatedTransactions = [...(currentLicenseData.transactions || []), tx]; const updatedRecord = { ...selectedRecord, licenseData: { ...currentLicenseData, transactions: updatedTransactions } }; const totalCost = updatedTransactions.reduce((acc, t) => acc + t.amount, 0); if (!updatedRecord.stages[TradeStage.LICENSES]) updatedRecord.stages[TradeStage.LICENSES] = getStageData(updatedRecord, TradeStage.LICENSES); updatedRecord.stages[TradeStage.LICENSES].costRial = totalCost; updatedRecord.stages[TradeStage.LICENSES].isCompleted = totalCost > 0; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); setNewLicenseTx({ amount: 0, bank: '', date: '', description: 'هزینه ثبت سفارش' }); };
    const handleRemoveLicenseTx = async (id: string) => { if (!selectedRecord) return; const currentLicenseData = selectedRecord.licenseData || { transactions: [] }; const updatedTransactions = (currentLicenseData.transactions || []).filter(t => t.id !== id); const updatedRecord = { ...selectedRecord, licenseData: { ...currentLicenseData, transactions: updatedTransactions } }; const totalCost = updatedTransactions.reduce((acc, t) => acc + t.amount, 0); if (!updatedRecord.stages[TradeStage.LICENSES]) updatedRecord.stages[TradeStage.LICENSES] = getStageData(updatedRecord, TradeStage.LICENSES); updatedRecord.stages[TradeStage.LICENSES].costRial = totalCost; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleSaveInsurance = async () => { if (!selectedRecord) return; const updatedRecord = { ...selectedRecord, insuranceData: insuranceForm }; const totalCost = (Number(insuranceForm.cost) || 0) + (insuranceForm.endorsements || []).reduce((acc, e) => acc + e.amount, 0); if (!updatedRecord.stages[TradeStage.INSURANCE]) updatedRecord.stages[TradeStage.INSURANCE] = getStageData(updatedRecord, TradeStage.INSURANCE); updatedRecord.stages[TradeStage.INSURANCE].costRial = totalCost; updatedRecord.stages[TradeStage.INSURANCE].isCompleted = !!insuranceForm.policyNumber; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); alert("اطلاعات بیمه ذخیره شد."); };
    const handleAddEndorsement = () => { if (!newEndorsement.amount) return; const amount = endorsementType === 'increase' ? Number(newEndorsement.amount) : -Number(newEndorsement.amount); const endorsement: InsuranceEndorsement = { id: generateUUID(), date: newEndorsement.date || '', amount: amount, description: newEndorsement.description || '' }; const updatedEndorsements = [...(insuranceForm.endorsements || []), endorsement]; setInsuranceForm({ ...insuranceForm, endorsements: updatedEndorsements }); setNewEndorsement({ amount: 0, description: '', date: '' }); };
    const handleDeleteEndorsement = (id: string) => { setInsuranceForm({ ...insuranceForm, endorsements: insuranceForm.endorsements?.filter(e => e.id !== id) }); };
    const handleAddInspectionCertificate = async () => { if (!selectedRecord || !newInspectionCertificate.amount) return; const cert: InspectionCertificate = { id: generateUUID(), part: newInspectionCertificate.part || 'Part', company: newInspectionCertificate.company || '', certificateNumber: newInspectionCertificate.certificateNumber || '', amount: Number(newInspectionCertificate.amount), description: '' }; const updatedCertificates = [...(inspectionForm.certificates || []), cert]; const updatedData = { ...inspectionForm, certificates: updatedCertificates }; setInspectionForm(updatedData); setNewInspectionCertificate({ part: '', company: '', certificateNumber: '', amount: 0 }); const updatedRecord = { ...selectedRecord, inspectionData: updatedData }; if (!updatedRecord.stages[TradeStage.INSPECTION]) updatedRecord.stages[TradeStage.INSPECTION] = getStageData(updatedRecord, TradeStage.INSPECTION); updatedRecord.stages[TradeStage.INSPECTION].isCompleted = updatedCertificates.length > 0; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteInspectionCertificate = async (id: string) => { if (!selectedRecord) return; const updatedCertificates = (inspectionForm.certificates || []).filter(c => c.id !== id); const updatedData = { ...inspectionForm, certificates: updatedCertificates }; setInspectionForm(updatedData); const updatedRecord = { ...selectedRecord, inspectionData: updatedData }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddInspectionPayment = async () => { if (!selectedRecord || !newInspectionPayment.amount) return; const payment: InspectionPayment = { id: generateUUID(), part: newInspectionPayment.part || 'Part', amount: Number(newInspectionPayment.amount), date: newInspectionPayment.date || '', bank: newInspectionPayment.bank || '', description: '' }; const updatedPayments = [...(inspectionForm.payments || []), payment]; const updatedData = { ...inspectionForm, payments: updatedPayments }; setInspectionForm(updatedData); setNewInspectionPayment({ part: '', amount: 0, date: '', bank: '' }); const updatedRecord = { ...selectedRecord, inspectionData: updatedData }; if (!updatedRecord.stages[TradeStage.INSPECTION]) updatedRecord.stages[TradeStage.INSPECTION] = getStageData(updatedRecord, TradeStage.INSPECTION); updatedRecord.stages[TradeStage.INSPECTION].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteInspectionPayment = async (id: string) => { if (!selectedRecord) return; const updatedPayments = (inspectionForm.payments || []).filter(p => p.id !== id); const updatedData = { ...inspectionForm, payments: updatedPayments }; setInspectionForm(updatedData); const updatedRecord = { ...selectedRecord, inspectionData: updatedData }; if (!updatedRecord.stages[TradeStage.INSPECTION]) updatedRecord.stages[TradeStage.INSPECTION] = getStageData(updatedRecord, TradeStage.INSPECTION); updatedRecord.stages[TradeStage.INSPECTION].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddWarehouseReceipt = async () => { if (!selectedRecord || !newWarehouseReceipt.number) return; const receipt: WarehouseReceipt = { id: generateUUID(), number: newWarehouseReceipt.number || '', part: newWarehouseReceipt.part || '', issueDate: newWarehouseReceipt.issueDate || '' }; const updatedReceipts = [...(clearanceForm.receipts || []), receipt]; const updatedData = { ...clearanceForm, receipts: updatedReceipts }; setClearanceForm(updatedData); setNewWarehouseReceipt({ number: '', part: '', issueDate: '' }); const updatedRecord = { ...selectedRecord, clearanceData: updatedData }; if (!updatedRecord.stages[TradeStage.CLEARANCE_DOCS]) updatedRecord.stages[TradeStage.CLEARANCE_DOCS] = getStageData(updatedRecord, TradeStage.CLEARANCE_DOCS); updatedRecord.stages[TradeStage.CLEARANCE_DOCS].isCompleted = updatedReceipts.length > 0; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteWarehouseReceipt = async (id: string) => { if (!selectedRecord) return; const updatedReceipts = (clearanceForm.receipts || []).filter(r => r.id !== id); const updatedData = { ...clearanceForm, receipts: updatedReceipts }; setClearanceForm(updatedData); const updatedRecord = { ...selectedRecord, clearanceData: updatedData }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddClearancePayment = async () => { if (!selectedRecord || !newClearancePayment.amount) return; const payment: ClearancePayment = { id: generateUUID(), amount: Number(newClearancePayment.amount), part: newClearancePayment.part || '', bank: newClearancePayment.bank || '', date: newClearancePayment.date || '', payingBank: newClearancePayment.payingBank }; const updatedPayments = [...(clearanceForm.payments || []), payment]; const updatedData = { ...clearanceForm, payments: updatedPayments }; setClearanceForm(updatedData); setNewClearancePayment({ amount: 0, part: '', bank: '', date: '', payingBank: '' }); const totalCost = updatedPayments.reduce((acc, p) => acc + p.amount, 0); const updatedRecord = { ...selectedRecord, clearanceData: updatedData }; if (!updatedRecord.stages[TradeStage.CLEARANCE_DOCS]) updatedRecord.stages[TradeStage.CLEARANCE_DOCS] = getStageData(updatedRecord, TradeStage.CLEARANCE_DOCS); updatedRecord.stages[TradeStage.CLEARANCE_DOCS].costRial = totalCost; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteClearancePayment = async (id: string) => { if (!selectedRecord) return; const updatedPayments = (clearanceForm.payments || []).filter(p => p.id !== id); const updatedData = { ...clearanceForm, payments: updatedPayments }; setClearanceForm(updatedData); const totalCost = updatedPayments.reduce((acc, p) => acc + p.amount, 0); const updatedRecord = { ...selectedRecord, clearanceData: updatedData }; if (!updatedRecord.stages[TradeStage.CLEARANCE_DOCS]) updatedRecord.stages[TradeStage.CLEARANCE_DOCS] = getStageData(updatedRecord, TradeStage.CLEARANCE_DOCS); updatedRecord.stages[TradeStage.CLEARANCE_DOCS].costRial = totalCost; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const calculateGreenLeafTotal = (data: GreenLeafData) => { let total = 0; total += data.duties.filter(d => d.paymentMethod === 'Bank').reduce((acc, d) => acc + d.amount, 0); total += data.guarantees.reduce((acc, g) => acc + (g.cashAmount || 0) + (g.chequeAmount || 0), 0); total += data.taxes.reduce((acc, t) => acc + t.amount, 0); total += data.roadTolls.reduce((acc, r) => acc + r.amount, 0); return total; };
    const updateGreenLeafRecord = async (newData: GreenLeafData) => { if (!selectedRecord) return; setGreenLeafForm(newData); const totalCost = calculateGreenLeafTotal(newData); const updatedRecord = { ...selectedRecord, greenLeafData: newData }; if (!updatedRecord.stages[TradeStage.GREEN_LEAF]) updatedRecord.stages[TradeStage.GREEN_LEAF] = getStageData(updatedRecord, TradeStage.GREEN_LEAF); updatedRecord.stages[TradeStage.GREEN_LEAF].costRial = totalCost; updatedRecord.stages[TradeStage.GREEN_LEAF].isCompleted = (newData.duties.length > 0); await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddCustomsDuty = async () => { if (!newCustomsDuty.cottageNumber || !newCustomsDuty.amount) return; const duty: GreenLeafCustomsDuty = { id: generateUUID(), cottageNumber: newCustomsDuty.cottageNumber, part: newCustomsDuty.part || '', amount: Number(newCustomsDuty.amount), paymentMethod: (newCustomsDuty.paymentMethod as 'Bank' | 'Guarantee') || 'Bank', bank: newCustomsDuty.bank, date: newCustomsDuty.date }; const updatedDuties = [...greenLeafForm.duties, duty]; await updateGreenLeafRecord({ ...greenLeafForm, duties: updatedDuties }); setNewCustomsDuty({ cottageNumber: '', part: '', amount: 0, paymentMethod: 'Bank', bank: '', date: '' }); };
    const handleDeleteCustomsDuty = async (id: string) => { const updatedDuties = greenLeafForm.duties.filter(d => d.id !== id); const updatedGuarantees = greenLeafForm.guarantees.filter(g => g.relatedDutyId !== id); await updateGreenLeafRecord({ ...greenLeafForm, duties: updatedDuties, guarantees: updatedGuarantees }); };
    const handleAddGuarantee = async () => { if (!selectedDutyForGuarantee || !newGuaranteeDetails.guaranteeNumber) return; const duty = greenLeafForm.duties.find(d => d.id === selectedDutyForGuarantee); const guarantee: GreenLeafGuarantee = { id: generateUUID(), relatedDutyId: selectedDutyForGuarantee, guaranteeNumber: newGuaranteeDetails.guaranteeNumber, chequeNumber: newGuaranteeDetails.chequeNumber, chequeBank: newGuaranteeDetails.chequeBank, chequeDate: newGuaranteeDetails.chequeDate, chequeAmount: Number(newGuaranteeDetails.chequeAmount) || 0, isDelivered: false, cashAmount: Number(newGuaranteeDetails.cashAmount) || 0, cashBank: newGuaranteeDetails.cashBank, cashDate: newGuaranteeDetails.cashDate, part: duty?.part }; const updatedGuarantees = [...greenLeafForm.guarantees, guarantee]; await updateGreenLeafRecord({ ...greenLeafForm, guarantees: updatedGuarantees }); setNewGuaranteeDetails({ guaranteeNumber: '', chequeNumber: '', chequeBank: '', chequeDate: '', cashAmount: 0, cashBank: '', cashDate: '', chequeAmount: 0 }); setSelectedDutyForGuarantee(''); };
    const handleDeleteGuarantee = async (id: string) => { const updatedGuarantees = greenLeafForm.guarantees.filter(g => g.id !== id); await updateGreenLeafRecord({ ...greenLeafForm, guarantees: updatedGuarantees }); };
    const handleToggleGuaranteeDelivery = async (id: string) => { const updatedGuarantees = greenLeafForm.guarantees.map(g => g.id === id ? { ...g, isDelivered: !g.isDelivered } : g); await updateGreenLeafRecord({ ...greenLeafForm, guarantees: updatedGuarantees }); };
    const handleAddTax = async () => { if (!newTax.amount) return; const tax: GreenLeafTax = { id: generateUUID(), amount: Number(newTax.amount), part: newTax.part || '', bank: newTax.bank || '', date: newTax.date || '' }; const updatedTaxes = [...greenLeafForm.taxes, tax]; await updateGreenLeafRecord({ ...greenLeafForm, taxes: updatedTaxes }); setNewTax({ part: '', amount: 0, bank: '', date: '' }); };
    const handleDeleteTax = async (id: string) => { const updatedTaxes = greenLeafForm.taxes.filter(t => t.id !== id); await updateGreenLeafRecord({ ...greenLeafForm, taxes: updatedTaxes }); };
    const handleAddRoadToll = async () => { if (!newRoadToll.amount) return; const toll: GreenLeafRoadToll = { id: generateUUID(), amount: Number(newRoadToll.amount), part: newRoadToll.part || '', bank: newRoadToll.bank || '', date: newRoadToll.date || '' }; const updatedTolls = [...greenLeafForm.roadTolls, toll]; await updateGreenLeafRecord({ ...greenLeafForm, roadTolls: updatedTolls }); setNewRoadToll({ part: '', amount: 0, bank: '', date: '' }); };
    const handleDeleteRoadToll = async (id: string) => { const updatedTolls = greenLeafForm.roadTolls.filter(t => t.id !== id); await updateGreenLeafRecord({ ...greenLeafForm, roadTolls: updatedTolls }); };
    const handleAddShippingPayment = async () => { if (!selectedRecord || !newShippingPayment.amount) return; const payment: ShippingPayment = { id: generateUUID(), part: newShippingPayment.part || '', amount: Number(newShippingPayment.amount), date: newShippingPayment.date || '', bank: newShippingPayment.bank || '', description: newShippingPayment.description || '' }; const updatedPayments = [...(internalShippingForm.payments || []), payment]; const updatedData = { ...internalShippingForm, payments: updatedPayments }; setInternalShippingForm(updatedData); setNewShippingPayment({ part: '', amount: 0, date: '', bank: '', description: '' }); const updatedRecord = { ...selectedRecord, internalShippingData: updatedData }; if (!updatedRecord.stages[TradeStage.INTERNAL_SHIPPING]) updatedRecord.stages[TradeStage.INTERNAL_SHIPPING] = getStageData(updatedRecord, TradeStage.INTERNAL_SHIPPING); updatedRecord.stages[TradeStage.INTERNAL_SHIPPING].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); updatedRecord.stages[TradeStage.INTERNAL_SHIPPING].isCompleted = updatedPayments.length > 0; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteShippingPayment = async (id: string) => { if (!selectedRecord) return; const updatedPayments = (internalShippingForm.payments || []).filter(p => p.id !== id); const updatedData = { ...internalShippingForm, payments: updatedPayments }; setInternalShippingForm(updatedData); const updatedRecord = { ...selectedRecord, internalShippingData: updatedData }; if (!updatedRecord.stages[TradeStage.INTERNAL_SHIPPING]) updatedRecord.stages[TradeStage.INTERNAL_SHIPPING] = getStageData(updatedRecord, TradeStage.INTERNAL_SHIPPING); updatedRecord.stages[TradeStage.INTERNAL_SHIPPING].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddAgentPayment = async () => { if (!selectedRecord || !newAgentPayment.amount || !newAgentPayment.agentName) return; const payment: AgentPayment = { id: generateUUID(), agentName: newAgentPayment.agentName, amount: Number(newAgentPayment.amount), bank: newAgentPayment.bank || '', date: newAgentPayment.date || '', part: newAgentPayment.part || '', description: newAgentPayment.description || '' }; const updatedPayments = [...(agentForm.payments || []), payment]; const updatedData = { ...agentForm, payments: updatedPayments }; setAgentForm(updatedData); setNewAgentPayment({ agentName: newAgentPayment.agentName, amount: 0, bank: '', date: '', part: '', description: '' }); const updatedRecord = { ...selectedRecord, agentData: updatedData }; if (!updatedRecord.stages[TradeStage.AGENT_FEES]) updatedRecord.stages[TradeStage.AGENT_FEES] = getStageData(updatedRecord, TradeStage.AGENT_FEES); updatedRecord.stages[TradeStage.AGENT_FEES].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); updatedRecord.stages[TradeStage.AGENT_FEES].isCompleted = updatedPayments.length > 0; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteAgentPayment = async (id: string) => { if (!selectedRecord) return; const updatedPayments = (agentForm.payments || []).filter(p => p.id !== id); const updatedData = { ...agentForm, payments: updatedPayments }; setAgentForm(updatedData); const updatedRecord = { ...selectedRecord, agentData: updatedData }; if (!updatedRecord.stages[TradeStage.AGENT_FEES]) updatedRecord.stages[TradeStage.AGENT_FEES] = getStageData(updatedRecord, TradeStage.AGENT_FEES); updatedRecord.stages[TradeStage.AGENT_FEES].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddCurrencyTranche = async () => { if (!selectedRecord || !newCurrencyTranche.amountStr || !newCurrencyTranche.rialAmountStr) return; let updatedTranches = [...(currencyForm.tranches || [])]; const rawAmount = parseFloat(newCurrencyTranche.amountStr); const rawRialAmount = deformatNumberString(newCurrencyTranche.rialAmountStr); const rawCurrencyFee = newCurrencyTranche.currencyFeeStr ? parseFloat(newCurrencyTranche.currencyFeeStr) : 0; const rawReceived = newCurrencyTranche.receivedAmountStr ? parseFloat(newCurrencyTranche.receivedAmountStr) : 0; const trancheData: any = { date: newCurrencyTranche.date || '', amount: rawAmount, currencyType: newCurrencyTranche.currencyType || selectedRecord.mainCurrency || 'EUR', brokerName: newCurrencyTranche.brokerName || '', exchangeName: newCurrencyTranche.exchangeName || '', rate: 0, rialAmount: rawRialAmount, currencyFee: rawCurrencyFee, isDelivered: newCurrencyTranche.isDelivered, deliveryDate: newCurrencyTranche.deliveryDate, returnAmount: newCurrencyTranche.returnAmount ? deformatNumberString(newCurrencyTranche.returnAmount.toString()) : undefined, returnDate: newCurrencyTranche.returnDate, receivedAmount: rawReceived }; if (editingTrancheId) { updatedTranches = updatedTranches.map(t => t.id === editingTrancheId ? { ...t, ...trancheData } : t); } else { updatedTranches.push({ ...trancheData, id: generateUUID() }); } const totalPurchased = updatedTranches.reduce((acc, t) => acc + t.amount, 0); const totalDelivered = updatedTranches.reduce((acc, t) => acc + (t.receivedAmount || (t.isDelivered ? t.amount : 0)), 0); const totalRialCost = updatedTranches.reduce((acc, t) => { return acc + ((t.rialAmount || 0) - (t.returnAmount || 0)); }, 0); const updatedForm = { ...currencyForm, tranches: updatedTranches, purchasedAmount: totalPurchased, deliveredAmount: totalDelivered }; setCurrencyForm(updatedForm); const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm }; if (!updatedRecord.stages[TradeStage.CURRENCY_PURCHASE]) updatedRecord.stages[TradeStage.CURRENCY_PURCHASE] = getStageData(updatedRecord, TradeStage.CURRENCY_PURCHASE); updatedRecord.stages[TradeStage.CURRENCY_PURCHASE].costCurrency = totalPurchased; updatedRecord.stages[TradeStage.CURRENCY_PURCHASE].costRial = totalRialCost; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); setNewCurrencyTranche({ amount: 0, currencyType: selectedRecord.mainCurrency || 'EUR', date: '', exchangeName: '', brokerName: '', isDelivered: false, returnAmount: '', returnDate: '', receivedAmount: 0, amountStr: '', rialAmountStr: '', receivedAmountStr: '', currencyFeeStr: '' }); setEditingTrancheId(null); };
    const handleEditTranche = (tranche: any) => { setNewCurrencyTranche({ amount: tranche.amount, amountStr: tranche.amount.toString(), currencyType: tranche.currencyType, date: tranche.date, exchangeName: tranche.exchangeName, brokerName: tranche.brokerName, isDelivered: tranche.isDelivered, deliveryDate: tranche.deliveryDate, rate: tranche.rate, rialAmountStr: formatNumberString(tranche.rialAmount || 0), currencyFeeStr: tranche.currencyFee ? tranche.currencyFee.toString() : '', returnAmount: tranche.returnAmount ? formatNumberString(tranche.returnAmount) : '', returnDate: tranche.returnDate, receivedAmount: tranche.receivedAmount, receivedAmountStr: tranche.receivedAmount ? tranche.receivedAmount.toString() : '' }); setEditingTrancheId(tranche.id); };
    const handleCancelEditTranche = () => { setNewCurrencyTranche({ amount: 0, currencyType: selectedRecord?.mainCurrency || 'EUR', date: '', exchangeName: '', brokerName: '', isDelivered: false, returnAmount: '', returnDate: '', receivedAmount: 0, amountStr: '', rialAmountStr: '', receivedAmountStr: '', currencyFeeStr: '' }); setEditingTrancheId(null); };
    const handleRemoveTranche = async (id: string) => { if (!selectedRecord) return; if (!confirm('آیا از حذف این پارت مطمئن هستید؟')) return; const updatedTranches = (currencyForm.tranches || []).filter(t => t.id !== id); const totalPurchased = updatedTranches.reduce((acc, t) => acc + t.amount, 0); const totalDelivered = updatedTranches.reduce((acc, t) => acc + (t.receivedAmount || (t.isDelivered ? t.amount : 0)), 0); const totalRialCost = updatedTranches.reduce((acc, t) => { return acc + ((t.rialAmount || 0) - (t.returnAmount || 0)); }, 0); const updatedForm = { ...currencyForm, tranches: updatedTranches, purchasedAmount: totalPurchased, deliveredAmount: totalDelivered }; setCurrencyForm(updatedForm); const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm }; if (!updatedRecord.stages[TradeStage.CURRENCY_PURCHASE]) updatedRecord.stages[TradeStage.CURRENCY_PURCHASE] = getStageData(updatedRecord, TradeStage.CURRENCY_PURCHASE); updatedRecord.stages[TradeStage.CURRENCY_PURCHASE].costCurrency = totalPurchased; updatedRecord.stages[TradeStage.CURRENCY_PURCHASE].costRial = totalRialCost; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleToggleTrancheDelivery = async (id: string) => { if (!selectedRecord) return; const updatedTranches = (currencyForm.tranches || []).map(t => { if (t.id === id) return { ...t, isDelivered: !t.isDelivered }; return t; }); const totalPurchased = updatedTranches.reduce((acc, t) => acc + t.amount, 0); const totalDelivered = updatedTranches.reduce((acc, t) => acc + (t.receivedAmount || (t.isDelivered ? t.amount : 0)), 0); const updatedForm = { ...currencyForm, tranches: updatedTranches, purchasedAmount: totalPurchased, deliveredAmount: totalDelivered }; setCurrencyForm(updatedForm); const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleSaveCurrencyGuarantee = async () => { if (!selectedRecord) return; const gCheck = { amount: deformatNumberString(currencyGuarantee.amount), bank: currencyGuarantee.bank, chequeNumber: currencyGuarantee.number, dueDate: currencyGuarantee.date, isDelivered: currencyGuarantee.isDelivered }; const updatedForm = { ...currencyForm, guaranteeCheque: gCheck }; setCurrencyForm(updatedForm); const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); alert("اطلاعات چک ضمانت ارزی ذخیره شد."); };
    const handleToggleCurrencyGuaranteeDelivery = async () => { if (!selectedRecord || !selectedRecord.currencyPurchaseData?.guaranteeCheque) return; const currentStatus = selectedRecord.currencyPurchaseData.guaranteeCheque.isDelivered || false; setCurrencyGuarantee(prev => ({ ...prev, isDelivered: !currentStatus })); const updatedForm = { ...currencyForm, guaranteeCheque: { ...currencyForm.guaranteeCheque!, isDelivered: !currentStatus } }; setCurrencyForm(updatedForm); const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddInvoiceItem = () => { if (!newInvoiceItem.name) return; const newItem: InvoiceItem = { id: generateUUID(), name: newInvoiceItem.name, weight: Number(newInvoiceItem.weight), unitPrice: Number(newInvoiceItem.unitPrice), totalPrice: Number(newInvoiceItem.totalPrice) || (Number(newInvoiceItem.weight) * Number(newInvoiceItem.unitPrice)), part: newInvoiceItem.part || '' }; setShippingDocForm(prev => ({ ...prev, invoiceItems: [...(prev.invoiceItems || []), newItem] })); setNewInvoiceItem({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, part: '' }); };
    const handleRemoveInvoiceItem = (id: string) => { setShippingDocForm(prev => ({ ...prev, invoiceItems: (prev.invoiceItems || []).filter(i => i.id !== id) })); };
    const handleAddPackingItem = () => { if (!newPackingItem.description) return; const item: PackingItem = { id: generateUUID(), description: newPackingItem.description, netWeight: Number(newPackingItem.netWeight), grossWeight: Number(newPackingItem.grossWeight), packageCount: Number(newPackingItem.packageCount), part: newPackingItem.part || '' }; setShippingDocForm(prev => ({ ...prev, packingItems: [...(prev.packingItems || []), item] })); setNewPackingItem({ description: '', netWeight: 0, grossWeight: 0, packageCount: 0, part: '' }); };
    const handleRemovePackingItem = (id: string) => { setShippingDocForm(prev => ({ ...prev, packingItems: (prev.packingItems || []).filter(i => i.id !== id) })); };
    const handleDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingDocFile(true); const reader = new FileReader(); reader.onload = async (ev) => { const base64 = ev.target?.result as string; try { const result = await uploadFile(file.name, base64); setShippingDocForm(prev => ({ ...prev, attachments: [...(prev.attachments || []), { fileName: result.fileName, data: result.url }] })); } catch (error) { alert('خطا در آپلود فایل'); } finally { setUploadingDocFile(false); } }; reader.readAsDataURL(file); e.target.value = ''; };
    const handleSaveShippingDoc = async () => { if (!selectedRecord || !shippingDocForm.documentNumber) return; let totalNet = shippingDocForm.netWeight; let totalGross = shippingDocForm.grossWeight; let totalPackages = shippingDocForm.packagesCount; if (activeShippingSubTab === 'Packing List' && shippingDocForm.packingItems && shippingDocForm.packingItems.length > 0) { totalNet = shippingDocForm.packingItems.reduce((acc, i) => acc + i.netWeight, 0); totalGross = shippingDocForm.packingItems.reduce((acc, i) => acc + i.grossWeight, 0); totalPackages = shippingDocForm.packingItems.reduce((acc, i) => acc + i.packageCount, 0); } const newDoc: ShippingDocument = { id: generateUUID(), type: activeShippingSubTab, status: shippingDocForm.status || 'Draft', documentNumber: shippingDocForm.documentNumber, documentDate: shippingDocForm.documentDate || '', createdAt: Date.now(), createdBy: currentUser.fullName, attachments: shippingDocForm.attachments || [], invoiceItems: activeShippingSubTab === 'Commercial Invoice' ? shippingDocForm.invoiceItems : undefined, packingItems: activeShippingSubTab === 'Packing List' ? shippingDocForm.packingItems : undefined, freightCost: activeShippingSubTab === 'Commercial Invoice' ? Number(shippingDocForm.freightCost) : undefined, currency: shippingDocForm.currency, netWeight: totalNet, grossWeight: totalGross, packagesCount: totalPackages, vesselName: shippingDocForm.vesselName, portOfLoading: shippingDocForm.portOfLoading, portOfDischarge: shippingDocForm.portOfDischarge, description: shippingDocForm.description }; const updatedDocs = [...(selectedRecord.shippingDocuments || []), newDoc]; const updatedRecord = { ...selectedRecord, shippingDocuments: updatedDocs }; if (!updatedRecord.stages[TradeStage.SHIPPING_DOCS]) updatedRecord.stages[TradeStage.SHIPPING_DOCS] = getStageData(updatedRecord, TradeStage.SHIPPING_DOCS); if (activeShippingSubTab === 'Commercial Invoice') { updatedRecord.stages[TradeStage.SHIPPING_DOCS].costCurrency = updatedDocs.filter(d => d.type === 'Commercial Invoice').reduce((acc, d) => acc + (d.invoiceItems?.reduce((sum, i) => sum + i.totalPrice, 0) || 0) + (d.freightCost || 0), 0); } await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); setShippingDocForm({ status: 'Draft', documentNumber: '', documentDate: '', attachments: [], invoiceItems: [], packingItems: [], freightCost: 0 }); };
    const handleDeleteShippingDoc = async (id: string) => { if (!selectedRecord) return; const updatedDocs = (selectedRecord.shippingDocuments || []).filter(d => d.id !== id); const updatedRecord = { ...selectedRecord, shippingDocuments: updatedDocs }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleSyncInvoiceToProforma = async () => { if (!selectedRecord) return; if (!confirm('آیا مطمئن هستید؟ این عملیات اقلام و هزینه حمل پروفرما را با مقادیر این اینویس جایگزین می‌کند. اقلام هم‌نام (از پارت‌های مختلف) تجمیع خواهند شد.')) return; const invoiceItems = shippingDocForm.invoiceItems || []; const aggregatedMap = new Map<string, { weight: number, totalPrice: number }>(); for (const item of invoiceItems) { const name = item.name.trim(); const current = aggregatedMap.get(name) || { weight: 0, totalPrice: 0 }; aggregatedMap.set(name, { weight: current.weight + item.weight, totalPrice: current.totalPrice + item.totalPrice }); } const newItems: TradeItem[] = []; aggregatedMap.forEach((val, name) => { newItems.push({ id: generateUUID(), name: name, weight: val.weight, unitPrice: val.weight > 0 ? val.totalPrice / val.weight : 0, totalPrice: val.totalPrice, hsCode: '' }); }); const updatedRecord = { ...selectedRecord, items: newItems, freightCost: Number(shippingDocForm.freightCost) || 0 }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); alert('پروفرما با موفقیت بروزرسانی شد (تجمیع بر اساس نام کالا).'); };
    const handleStageClick = (stage: TradeStage) => { const data = getStageData(selectedRecord, stage); setEditingStage(stage); setStageFormData(data); };
    const handleStageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingStageFile(true); const reader = new FileReader(); reader.onload = async (ev) => { const base64 = ev.target?.result as string; try { const result = await uploadFile(file.name, base64); setStageFormData(prev => ({ ...prev, attachments: [...(prev.attachments || []), { fileName: result.fileName, url: result.url }] })); } catch (error) { alert('خطا در آپلود'); } finally { setUploadingStageFile(false); } }; reader.readAsDataURL(file); e.target.value = ''; };
    const handleSaveStage = async () => { if (!selectedRecord || !editingStage) return; const updatedRecord = { ...selectedRecord }; updatedRecord.stages[editingStage] = { ...getStageData(selectedRecord, editingStage), ...stageFormData, updatedAt: Date.now(), updatedBy: currentUser.fullName }; if (editingStage === TradeStage.ALLOCATION_QUEUE && stageFormData.queueDate) { updatedRecord.stages[TradeStage.ALLOCATION_QUEUE].queueDate = stageFormData.queueDate; } if (editingStage === TradeStage.ALLOCATION_APPROVED) { updatedRecord.stages[TradeStage.ALLOCATION_APPROVED].allocationDate = stageFormData.allocationDate; updatedRecord.stages[TradeStage.ALLOCATION_APPROVED].allocationCode = stageFormData.allocationCode; updatedRecord.stages[TradeStage.ALLOCATION_APPROVED].allocationExpiry = stageFormData.allocationExpiry; } await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); setEditingStage(null); };
    const toggleCommitment = async () => { if (!selectedRecord) return; const updatedRecord = { ...selectedRecord, isCommitmentFulfilled: !selectedRecord.isCommitmentFulfilled }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleArchiveRecord = async () => { if (!selectedRecord) return; if (!confirm('آیا از انتقال این پرونده به بایگانی (ترخیص شده) اطمینان دارید؟')) return; const updatedRecord = { ...selectedRecord, isArchived: true, status: 'Completed' as const }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); alert('پرونده با موفقیت بایگانی شد.'); setViewMode('dashboard'); loadRecords(); };
    const handleUnarchiveRecord = async () => { if (!selectedRecord) return; if (!confirm('آیا از بازگرداندن این پرونده به جریان کاری اطمینان دارید؟')) return; const updatedRecord = { ...selectedRecord, isArchived: false, status: 'Active' as const }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); alert('پرونده بازیابی شد.'); };
    const getAllGuarantees = () => { const list = []; if (selectedRecord && selectedRecord.currencyPurchaseData?.guaranteeCheque) { list.push({ id: 'currency_g', type: 'ارزی', number: selectedRecord.currencyPurchaseData.guaranteeCheque.chequeNumber, bank: selectedRecord.currencyPurchaseData.guaranteeCheque.bank, amount: selectedRecord.currencyPurchaseData.guaranteeCheque.amount, isDelivered: selectedRecord.currencyPurchaseData.guaranteeCheque.isDelivered, toggleFunc: handleToggleCurrencyGuaranteeDelivery }); } if (selectedRecord && selectedRecord.greenLeafData?.guarantees) { selectedRecord.greenLeafData.guarantees.forEach(g => { list.push({ id: g.id, type: 'گمرکی', number: g.guaranteeNumber + (g.chequeNumber ? ` / چک: ${g.chequeNumber}` : ''), bank: g.chequeBank, amount: g.chequeAmount, isDelivered: g.isDelivered, toggleFunc: () => handleToggleGuaranteeDelivery(g.id) }); }); } return list; };

    const openEditMetadata = () => {
        if (!selectedRecord) return;
        setEditMetadataForm({
            fileNumber: selectedRecord.fileNumber,
            goodsName: selectedRecord.goodsName,
            sellerName: selectedRecord.sellerName,
            mainCurrency: selectedRecord.mainCurrency,
            commodityGroup: selectedRecord.commodityGroup,
            company: selectedRecord.company,
            registrationNumber: selectedRecord.registrationNumber,
            operatingBank: selectedRecord.operatingBank
        });
        setShowEditMetadataModal(true);
    };

    const saveMetadata = async () => {
        if (!selectedRecord) return;
        const updatedRecord = { ...selectedRecord, ...editMetadataForm };
        await updateTradeRecord(updatedRecord);
        setSelectedRecord(updatedRecord);
        setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
        setShowEditMetadataModal(false);
        alert('مشخصات پرونده بروزرسانی شد.');
    };

    const handlePrintReport = () => {
        window.print();
    };

    const handlePrintTrade = () => {
        setShowFinalReportPrint(true);
    };

    const handleDownloadFinalReportPDF = () => {
        setShowFinalReportPrint(true);
    };

    const renderReportContent = useMemo(() => {
        const safeSettings = settings || { currentTrackingNumber: 1000, currentExitPermitNumber: 1000, companyNames: [], companies: [], defaultCompany: '', bankNames: [], operatingBankNames: [], commodityGroups: [], rolePermissions: {}, savedContacts: [], warehouseSequences: {}, companyNotifications: {}, insuranceCompanies: [] };

        const currentList = Array.isArray(records) ? records : [];

        switch (activeReport) {
            case 'general':
                return (
                    <div className="bg-white p-6 rounded-xl shadow-sm border overflow-x-auto">
                        <table className="w-full text-sm text-right min-w-[600px]">
                            <thead className="bg-gray-100 text-gray-700">
                                <tr>
                                    <th className="p-3">شماره پرونده</th>
                                    <th className="p-3">کالا</th>
                                    <th className="p-3">شرکت</th>
                                    <th className="p-3">فروشنده</th>
                                    <th className="p-3">ارز</th>
                                    <th className="p-3">وضعیت</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentList
                                    .filter(r => (!reportFilterCompany || r.company === reportFilterCompany) && (
                                        r.fileNumber.includes(reportSearchTerm) || 
                                        r.goodsName.includes(reportSearchTerm)
                                    ))
                                    .map(r => (
                                    <tr key={r.id} className="border-b hover:bg-gray-50">
                                        <td className="p-3 font-bold">{r.fileNumber}</td>
                                        <td className="p-3">{r.goodsName}</td>
                                        <td className="p-3">{r.company}</td>
                                        <td className="p-3">{r.sellerName}</td>
                                        <td className="p-3 font-mono">{r.mainCurrency}</td>
                                        <td className="p-3"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{getStatusLabel(r.status as any) || r.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            case 'allocation_queue':
                return <AllocationReport records={currentList.filter(r => !reportFilterCompany || r.company === reportFilterCompany)} onUpdateRecord={async (r, u) => { const updated = {...r, ...u}; await updateTradeRecord(updated); setRecords(prev => prev.map(rec => rec.id === updated.id ? updated : rec)); }} settings={safeSettings} />;
            case 'currency':
                return <CurrencyReport records={currentList.filter(r => !reportFilterCompany || r.company === reportFilterCompany)} />;
            case 'company_performance':
                return <CompanyPerformanceReport records={currentList} />;
            case 'insurance_ledger':
                return <InsuranceLedgerReport records={currentList.filter(r => !reportFilterCompany || r.company === reportFilterCompany)} settings={safeSettings} />; 
            case 'guarantee':
                return <GuaranteeReport records={currentList.filter(r => !reportFilterCompany || r.company === reportFilterCompany)} />;
            default:
                return <div className="p-8 text-center text-gray-500">گزارش در حال تکمیل است...</div>;
        }
    }, [activeReport, records, reportFilterCompany, reportSearchTerm, settings]);

    if (viewMode === 'reports') {
        return (
            <div className="flex flex-col h-[calc(100vh-100px)] bg-gray-50 rounded-2xl overflow-hidden border">
                
                {/* --- RESPONSIVE HEADER NAV FOR MOBILE --- */}
                <div className="md:hidden bg-white border-b p-3 flex gap-2 overflow-x-auto whitespace-nowrap shadow-sm z-20 hide-scrollbar">
                    <button onClick={() => setViewMode('dashboard')} className="p-2 bg-gray-100 rounded-lg"><ChevronRight size={20}/></button>
                    <button onClick={() => setActiveReport('general')} className={`px-3 py-1.5 rounded-lg text-xs border ${activeReport === 'general' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>لیست کلی</button>
                    <button onClick={() => setActiveReport('allocation_queue')} className={`px-3 py-1.5 rounded-lg text-xs border ${activeReport === 'allocation_queue' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>صف تخصیص</button>
                    <button onClick={() => setActiveReport('currency')} className={`px-3 py-1.5 rounded-lg text-xs border ${activeReport === 'currency' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>خرید ارز</button>
                    <button onClick={() => setActiveReport('guarantee')} className={`px-3 py-1.5 rounded-lg text-xs border ${activeReport === 'guarantee' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>تضامین</button>
                    <button onClick={() => setActiveReport('insurance_ledger')} className={`px-3 py-1.5 rounded-lg text-xs border ${activeReport === 'insurance_ledger' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>بیمه</button>
                    <button onClick={() => setActiveReport('company_performance')} className={`px-3 py-1.5 rounded-lg text-xs border ${activeReport === 'company_performance' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>عملکرد</button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Desktop Sidebar (Hidden on Mobile) */}
                    <div className="hidden md:flex w-64 bg-white border-l p-4 flex-col gap-2 flex-shrink-0 h-full overflow-y-auto z-10">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><FileSpreadsheet size={20}/> گزارشات بازرگانی</h3>
                        
                        <div className="mb-2 relative">
                            <input 
                                className="w-full border rounded p-2 text-sm pl-8" 
                                placeholder="جستجو..." 
                                value={reportSearchTerm} 
                                onChange={e => setReportSearchTerm(e.target.value)}
                            />
                            <Search size={16} className="absolute left-2 top-2.5 text-gray-400"/>
                        </div>

                        <div className="mb-4"><label className="text-xs font-bold text-gray-500 mb-1 block">فیلتر شرکت</label><select className="w-full border rounded p-1 text-sm" value={reportFilterCompany} onChange={e => setReportFilterCompany(e.target.value)}><option value="">همه شرکت‌ها</option>{availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                        <div className="flex flex-col gap-2">
                            <button onClick={() => setActiveReport('general')} className={`p-2 rounded text-right text-sm ${activeReport === 'general' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>📄 لیست کلی پرونده‌ها</button>
                            <button onClick={() => setActiveReport('allocation_queue')} className={`p-2 rounded text-right text-sm ${activeReport === 'allocation_queue' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>⏳ در صف تخصیص</button>
                            <button onClick={() => setActiveReport('currency')} className={`p-2 rounded text-right text-sm ${activeReport === 'currency' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>💰 وضعیت خرید ارز</button>
                            <button onClick={() => setActiveReport('guarantee')} className={`p-2 rounded text-right text-sm ${activeReport === 'guarantee' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>🛡️ گزارش چک‌های تضمین</button>
                            <button onClick={() => setActiveReport('insurance_ledger')} className={`p-2 rounded text-right text-sm ${activeReport === 'insurance_ledger' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>📑 صورتحساب بیمه</button>
                            <button onClick={() => setActiveReport('company_performance')} className={`p-2 rounded text-right text-sm ${activeReport === 'company_performance' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>📊 عملکرد شرکت‌ها</button>
                        </div>
                        <div className="mt-auto pt-4">
                            <button onClick={handlePrintReport} className="w-full flex items-center justify-center gap-2 border p-2 rounded hover:bg-gray-50 text-gray-600"><Printer size={16}/> چاپ گزارش</button>
                            <button onClick={() => setViewMode('dashboard')} className="w-full mt-2 flex items-center justify-center gap-2 bg-gray-800 text-white p-2 rounded hover:bg-gray-900">بازگشت به داشبورد</button>
                        </div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 p-2 md:p-6 overflow-hidden flex flex-col w-full min-h-0 bg-gray-50">
                        <h2 className="text-xl font-bold mb-4 hidden md:block">
                            {activeReport === 'general' ? 'لیست کلی پرونده‌ها' : 
                            activeReport === 'allocation_queue' ? 'گزارش صف تخصیص' : 
                            activeReport === 'currency' ? 'گزارش وضعیت خرید ارز' : 
                            activeReport === 'company_performance' ? 'خلاصه عملکرد شرکت‌ها' : 
                            activeReport === 'insurance_ledger' ? 'صورتحساب و مانده بیمه' :
                            activeReport === 'guarantee' ? 'گزارش جامع چک‌های تضمین' :
                            'گزارش'}
                        </h2>
                        {renderReportContent}
                    </div>
                </div>
            </div>
        );
    }

    if (selectedRecord && viewMode === 'details') {
        const totalItemsCurrency = selectedRecord.items.reduce((a, b) => a + b.totalPrice, 0);
        const totalFreightCurrency = selectedRecord.freightCost || 0;
        const totalProformaCurrency = totalItemsCurrency + totalFreightCurrency;

        const currencyTranches = selectedRecord.currencyPurchaseData?.tranches || [];
        const netCurrencyRialCost = currencyTranches.reduce((acc, t) => {
            const paid = t.rialAmount || 0;
            const ret = t.returnAmount || 0;
            return acc + (paid - ret);
        }, 0);

        const overheadStages = [
            TradeStage.LICENSES, TradeStage.INSURANCE, TradeStage.INSPECTION,
            TradeStage.CLEARANCE_DOCS, TradeStage.GREEN_LEAF,
            TradeStage.INTERNAL_SHIPPING, TradeStage.AGENT_FEES
        ];
        const totalOverheadsRial = overheadStages.reduce((sum, stage) => 
            sum + (selectedRecord.stages[stage]?.costRial || 0), 0);

        const grandTotalRialProject = netCurrencyRialCost + totalOverheadsRial;
        const totalWeight = selectedRecord.items.reduce((sum, item) => sum + item.weight, 0);
        const effectiveRate = totalProformaCurrency > 0 ? grandTotalRialProject / totalProformaCurrency : 0;
        const freightPerKgCurrency = totalWeight > 0 ? totalFreightCurrency / totalWeight : 0;
        const costPerKg = totalWeight > 0 ? grandTotalRialProject / totalWeight : 0;

        return (
            <div className="flex flex-col h-[calc(100vh-100px)] animate-fade-in relative">
                
                {/* Final Cost Report Print Overlay */}
                {showFinalReportPrint && (
                    <PrintFinalCostReport 
                        record={selectedRecord} 
                        totalRial={totalOverheadsRial} 
                        totalCurrency={totalProformaCurrency} 
                        exchangeRate={effectiveRate}
                        grandTotalRial={grandTotalRialProject}
                        onClose={() => setShowFinalReportPrint(false)} 
                    />
                )}

                {/* Clearance Declaration Print Overlay (NEW) */}
                {showClearancePrint && (
                    <PrintClearanceDeclaration 
                        record={selectedRecord}
                        settings={settings || { companies: [] } as any}
                        onClose={() => setShowClearancePrint(false)}
                    />
                )}

                {/* EDIT METADATA MODAL */}
                {showEditMetadataModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-xl text-gray-800">ویرایش مشخصات پرونده</h3>
                                <button onClick={() => setShowEditMetadataModal(false)}><X size={24} className="text-gray-400 hover:text-red-500"/></button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">شماره پرونده</label>
                                    <input className="w-full border rounded-xl p-3 bg-gray-50 font-mono text-left dir-ltr" value={editMetadataForm.fileNumber || ''} onChange={e => setEditMetadataForm({...editMetadataForm, fileNumber: e.target.value})} />
                                </div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">نام کالا (شرح کلی)</label><input className="w-full border rounded-xl p-3 bg-white" value={editMetadataForm.goodsName || ''} onChange={e => setEditMetadataForm({...editMetadataForm, goodsName: e.target.value})} /></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">فروشنده</label><input className="w-full border rounded-xl p-3 bg-white" value={editMetadataForm.sellerName || ''} onChange={e => setEditMetadataForm({...editMetadataForm, sellerName: e.target.value})} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">ارز پایه</label><select className="w-full border rounded-xl p-3 bg-white" value={editMetadataForm.mainCurrency || ''} onChange={e => setEditMetadataForm({...editMetadataForm, mainCurrency: e.target.value})}>{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select></div></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">گروه کالایی</label><select className="w-full border rounded-xl p-3 bg-white" value={editMetadataForm.commodityGroup || ''} onChange={e => setEditMetadataForm({...editMetadataForm, commodityGroup: e.target.value})}><option value="">انتخاب...</option>{commodityGroups.map(g => <option key={g} value={g}>{g}</option>)}</select></div><div><label className="block text-sm font-bold text-gray-700 mb-1">شرکت</label><select className="w-full border rounded-xl p-3 bg-white" value={editMetadataForm.company || ''} onChange={e => setEditMetadataForm({...editMetadataForm, company: e.target.value})}><option value="">انتخاب...</option>{availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}</select></div></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">شماره ثبت سفارش</label><input className="w-full border rounded-xl p-3 bg-white" value={editMetadataForm.registrationNumber || ''} onChange={e => setEditMetadataForm({...editMetadataForm, registrationNumber: e.target.value})} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">بانک عامل</label><select className="w-full border rounded-xl p-3 bg-white" value={editMetadataForm.operatingBank || ''} onChange={e => setEditMetadataForm({...editMetadataForm, operatingBank: e.target.value})}><option value="">انتخاب...</option>{operatingBanks.map(b => <option key={b} value={b}>{b}</option>)}</select></div></div>
                                <button onClick={saveMetadata} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 mt-4">ذخیره تغییرات</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stage Edit Modal */}
                {editingStage && (
                    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">ویرایش مرحله: {editingStage}</h3><button onClick={() => setEditingStage(null)}><X size={20}/></button></div>
                            <div className="space-y-4">
                                <label className="flex items-center gap-2"><input type="checkbox" checked={stageFormData.isCompleted} onChange={e => setStageFormData({...stageFormData, isCompleted: e.target.checked})} className="w-5 h-5"/> <span className="font-bold">مرحله تکمیل شده است</span></label>
                                {editingStage === TradeStage.ALLOCATION_QUEUE && (<div className="bg-amber-50 p-3 rounded border border-amber-200 space-y-2"><div><label className="text-xs font-bold block">تاریخ ورود به صف</label><input type="text" className="w-full border rounded p-2 text-sm" placeholder="1403/01/01" value={stageFormData.queueDate || ''} onChange={e => setStageFormData({...stageFormData, queueDate: e.target.value})} /></div>{stageFormData.queueDate && <div className="text-xs text-amber-700 font-bold">مدت انتظار: {calculateDaysDiff(stageFormData.queueDate)} روز</div>}</div>)}
                                {editingStage === TradeStage.ALLOCATION_APPROVED && (<div className="bg-green-50 p-3 rounded border border-green-200 space-y-2"><div><label className="text-xs font-bold block">شماره فیش/تخصیص</label><input type="text" className="w-full border rounded p-2 text-sm" value={stageFormData.allocationCode || ''} onChange={e => setStageFormData({...stageFormData, allocationCode: e.target.value})} /></div><div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold block">تاریخ تخصیص</label><input type="text" className="w-full border rounded p-2 text-sm" placeholder="1403/01/01" value={stageFormData.allocationDate || ''} onChange={e => setStageFormData({...stageFormData, allocationDate: e.target.value})} /></div><div><label className="text-xs font-bold block">مهلت انقضا</label><input type="text" className="w-full border rounded p-2 text-sm" placeholder="1403/02/01" value={stageFormData.allocationExpiry || ''} onChange={e => setStageFormData({...stageFormData, allocationExpiry: e.target.value})} /></div></div></div>)}
                                <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold block">هزینه ریالی</label><input type="text" className="w-full border rounded p-2 text-sm" value={formatNumberString(stageFormData.costRial)} onChange={e => setStageFormData({...stageFormData, costRial: deformatNumberString(e.target.value)})} /></div><div><label className="text-xs font-bold block">هزینه ارزی</label><input type="text" className="w-full border rounded p-2 text-sm" value={formatNumberString(stageFormData.costCurrency)} onChange={e => setStageFormData({...stageFormData, costCurrency: deformatNumberString(e.target.value)})} /></div></div>
                                <div><label className="text-xs font-bold block">توضیحات</label><textarea className="w-full border rounded p-2 text-sm h-24" value={stageFormData.description || ''} onChange={e => setStageFormData({...stageFormData, description: e.target.value})} /></div>
                                <div><label className="text-xs font-bold block mb-1">فایل‌های ضمیمه</label><div className="flex items-center gap-2 mb-2"><input type="file" ref={fileInputRef} className="hidden" onChange={handleStageFileChange} /><button onClick={() => fileInputRef.current?.click()} disabled={uploadingStageFile} className="bg-gray-100 border px-3 py-1 rounded text-xs hover:bg-gray-200">{uploadingStageFile ? 'در حال آپلود...' : 'افزودن فایل'}</button></div><div className="space-y-1">{stageFormData.attachments?.map((att, i) => (<div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded text-xs"><a href={att.url} target="_blank" className="text-blue-600 truncate max-w-[200px]">{att.fileName}</a><button onClick={() => setStageFormData({...stageFormData, attachments: stageFormData.attachments?.filter((_, idx) => idx !== i)})} className="text-red-500"><X size={14}/></button></div>))}</div></div>
                                <button onClick={handleSaveStage} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700">ذخیره تغییرات</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="bg-white border-b p-4 flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm z-10 gap-3">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <button onClick={() => setViewMode('dashboard')} className="p-2 hover:bg-gray-100 rounded-full"><ArrowRight /></button>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2 flex-wrap">
                                {selectedRecord.goodsName}
                                <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{selectedRecord.fileNumber}</span>
                                <button onClick={openEditMetadata} className="text-gray-400 hover:text-blue-600 transition-colors p-1" title="ویرایش مشخصات پرونده"><Edit size={16}/></button>
                            </h1>
                            <p className="text-xs text-gray-500">{selectedRecord.company} | {selectedRecord.sellerName}</p>
                        </div>
                    </div>
                    {/* SCROLLABLE STAGE NAV */}
                    <div className="flex gap-2 overflow-x-auto pb-1 w-full md:w-auto hide-scrollbar">
                        <button onClick={() => setActiveTab('timeline')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'timeline' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>تایم‌لاین</button>
                        <button onClick={() => setActiveTab('proforma')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'proforma' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>پروفرما</button>
                        <button onClick={() => setActiveTab('insurance')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'insurance' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>بیمه</button>
                        <button onClick={() => setActiveTab('currency_purchase')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'currency_purchase' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>خرید ارز</button>
                        <button onClick={() => setActiveTab('shipping_docs')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'shipping_docs' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>اسناد حمل</button>
                        <button onClick={() => setActiveTab('inspection')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'inspection' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>بازرسی</button>
                        <button onClick={() => setActiveTab('clearance_docs')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'clearance_docs' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>ترخیصیه و انبار</button>
                        <button onClick={() => setActiveTab('green_leaf')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'green_leaf' ? 'bg-green-100 text-green-700' : 'hover:bg-gray-100'}`}>برگ سبز</button>
                        <button onClick={() => setActiveTab('internal_shipping')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'internal_shipping' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'}`}>حمل داخلی</button>
                        <button onClick={() => setActiveTab('agent_fees')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'agent_fees' ? 'bg-teal-100 text-teal-700' : 'hover:bg-gray-100'}`}>هزینه‌های ترخیص</button>
                        <button onClick={() => setActiveTab('final_calculation')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'final_calculation' ? 'bg-rose-100 text-rose-700' : 'hover:bg-gray-100'}`}>محاسبه نهایی</button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-gray-50">
                    
                    {activeTab === 'timeline' && (
                        <div className="p-6 max-w-4xl mx-auto">
                            <div className="relative border-r-2 border-gray-200 mr-4 space-y-8 pr-8">
                                {STAGES.map((stage, idx) => {
                                    const data = getStageData(selectedRecord, stage);
                                    return (
                                        <div key={stage} className="relative">
                                            <div className={`absolute -right-[41px] top-0 w-6 h-6 rounded-full border-4 ${data.isCompleted ? 'bg-green-500 border-green-100' : 'bg-gray-300 border-gray-100'}`}></div>
                                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleStageClick(stage)}>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-bold text-gray-800 text-sm">{stage}</h3>
                                                        <p className="text-xs text-gray-500 mt-1">{data.description || 'بدون توضیحات'}</p>
                                                    </div>
                                                    {data.isCompleted && <CheckCircle2 size={16} className="text-green-500"/>}
                                                </div>
                                                <div className="mt-3 flex gap-2 text-xs">
                                                    {data.costRial > 0 && <span className="bg-gray-100 px-2 py-1 rounded">هزینه ریالی: {formatCurrency(data.costRial)}</span>}
                                                    {data.costCurrency > 0 && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">هزینه ارزی: {formatNumberString(data.costCurrency)} {selectedRecord.mainCurrency}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ... (Proforma and other tabs - Ensuring mobile responsiveness for inputs) ... */}
                    {activeTab === 'proforma' && (
                        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
                            {/* Proforma Content */}
                            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border">
                                <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">اطلاعات کلی پروفرما</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">شماره پرونده</label><input className="w-full border rounded p-3 text-sm" value={selectedRecord.fileNumber} onChange={e => handleUpdateProforma('fileNumber', e.target.value)}/></div>
                                    {/* ... rest of inputs with p-3 for touch friendly ... */}
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">شماره ثبت سفارش</label><input className="w-full border rounded p-3 text-sm" value={selectedRecord.registrationNumber || ''} onChange={e => handleUpdateProforma('registrationNumber', e.target.value)}/></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">فروشنده</label><input className="w-full border rounded p-3 text-sm" value={selectedRecord.sellerName} onChange={e => handleUpdateProforma('sellerName', e.target.value)}/></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">ارز پایه</label><select className="w-full border rounded p-3 text-sm bg-white" value={selectedRecord.mainCurrency} onChange={e => handleUpdateProforma('mainCurrency', e.target.value)}>{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">تاریخ ثبت سفارش</label><input className="w-full border rounded p-3 text-sm dir-ltr" placeholder="1403/01/01" value={selectedRecord.registrationDate || ''} onChange={e => handleUpdateProforma('registrationDate', e.target.value)}/></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">تاریخ انقضا</label><input className="w-full border rounded p-3 text-sm dir-ltr" placeholder="1403/06/01" value={selectedRecord.registrationExpiry || ''} onChange={e => handleUpdateProforma('registrationExpiry', e.target.value)}/></div>
                                    
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-700">منشا ارز</label>
                                        <select 
                                            className="w-full border rounded p-3 text-sm bg-white" 
                                            value={selectedRecord.currencyAllocationType || ''} 
                                            onChange={e => handleUpdateProforma('currencyAllocationType', e.target.value)}
                                        >
                                            <option value="">انتخاب کنید...</option>
                                            <option value="Bank">بانکی</option>
                                            <option value="Export">ارز حاصل از صادرات خود</option>
                                            <option value="ExportOther">ارز حاصل از صادرات دیگران</option>
                                            <option value="Free">متقاضی (آزاد)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-700">نوع ارز (رتبه)</label>
                                        <select 
                                            className="w-full border rounded p-3 text-sm bg-white" 
                                            value={selectedRecord.allocationCurrencyRank || ''} 
                                            onChange={e => handleUpdateProforma('allocationCurrencyRank', e.target.value as any)}
                                        >
                                            <option value="">انتخاب کنید...</option>
                                            <option value="Type1">نوع اول</option>
                                            <option value="Type2">نوع دوم</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-700">بانک عامل</label>
                                        <select 
                                            className="w-full border rounded p-3 text-sm bg-white" 
                                            value={selectedRecord.operatingBank || ''} 
                                            onChange={e => handleUpdateProforma('operatingBank', e.target.value)}
                                        >
                                            <option value="">انتخاب کنید...</option>
                                            {operatingBanks.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border">
                                <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">اقلام پروفرما</h3>
                                <div className="flex flex-col md:flex-row gap-2 items-end mb-4 bg-gray-50 p-3 rounded-lg">
                                    <div className="w-full md:flex-1 space-y-1"><label className="text-xs text-gray-500">شرح کالا</label><input className="w-full border rounded p-3 text-sm" placeholder="نام کالا" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})}/></div>
                                    <div className="w-full md:w-32 space-y-1"><label className="text-xs text-gray-500">HS Code</label><input className="w-full border rounded p-3 text-sm dir-ltr" placeholder="کد تعرفه" value={newItem.hsCode || ''} onChange={e => setNewItem({...newItem, hsCode: e.target.value})}/></div>
                                    <div className="flex w-full md:w-auto gap-2">
                                        <div className="flex-1 space-y-1"><label className="text-xs text-gray-500">وزن (KG)</label><input type="text" className="w-full border rounded p-3 text-sm dir-ltr" placeholder="0" value={newItem.weightStr} onChange={e => setNewItem({...newItem, weightStr: e.target.value, weight: parseFloat(e.target.value) || 0})}/></div>
                                        <div className="flex-1 space-y-1"><label className="text-xs text-gray-500">فی (Unit)</label><input type="text" className="w-full border rounded p-3 text-sm dir-ltr" placeholder="0" value={newItem.unitPriceStr} onChange={e => setNewItem({...newItem, unitPriceStr: e.target.value, unitPrice: parseFloat(e.target.value) || 0})}/></div>
                                    </div>
                                    <div className="w-full md:w-32 space-y-1"><label className="text-xs text-gray-500">قیمت کل</label><input type="number" step="0.01" className="w-full border rounded p-3 text-sm dir-ltr bg-gray-100" placeholder="Auto" value={newItem.totalPrice || (Number(newItem.weight) * Number(newItem.unitPrice))} readOnly/></div>
                                    <button onClick={handleAddItem} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 h-[46px] w-full md:w-[46px] flex items-center justify-center">{editingItemId ? <Save size={18}/> : <Plus size={18}/>}</button>
                                    {editingItemId && <button onClick={() => { setEditingItemId(null); setNewItem({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, hsCode: '', weightStr: '', unitPriceStr: '' }); }} className="bg-gray-200 text-gray-700 p-2 rounded-lg hover:bg-gray-300 h-[46px] w-full md:w-[46px] flex items-center justify-center"><X size={18}/></button>}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-right min-w-[600px]">
                                        <thead className="bg-gray-100 text-gray-700"><tr><th className="p-3">شرح</th><th className="p-3">HS Code</th><th className="p-3">وزن</th><th className="p-3">فی</th><th className="p-3">قیمت کل</th><th className="p-3">عملیات</th></tr></thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {selectedRecord.items.map((item) => (
                                                <tr key={item.id} className={editingItemId === item.id ? 'bg-blue-50' : ''}>
                                                    <td className="p-3">{item.name}</td>
                                                    <td className="p-3 font-mono">{item.hsCode || '-'}</td>
                                                    <td className="p-3 font-mono">{formatNumberString(item.weight)}</td>
                                                    <td className="p-3 font-mono">{formatNumberString(item.unitPrice)}</td>
                                                    <td className="p-3 font-mono font-bold">{formatNumberString(item.totalPrice)}</td>
                                                    <td className="p-3 flex gap-2">
                                                        <button onClick={() => handleEditItem(item)} className="text-amber-500 hover:text-amber-700"><Edit size={16}/></button>
                                                        <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-blue-50 font-bold">
                                                <td className="p-3">جمع کل</td>
                                                <td></td>
                                                <td className="p-3 font-mono">{formatNumberString(selectedRecord.items.reduce((a,b)=>a+b.weight,0))}</td>
                                                <td></td>
                                                <td className="p-3 font-mono text-blue-700">{formatNumberString(selectedRecord.items.reduce((a,b)=>a+b.totalPrice,0))} {selectedRecord.mainCurrency}</td>
                                                <td></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                {/* ... (Freight Cost Input) ... */}
                            </div>
                            {/* ... (License Tx Section) ... */}
                        </div>
                    )}
                    
                    {/* ... (Other Tabs with similar responsive fixes for inputs) ... */}
                    {activeTab === 'insurance' && (
                        <InsuranceTab 
                            form={insuranceForm} 
                            setForm={setInsuranceForm} 
                            companies={settings?.insuranceCompanies || []} 
                            banks={availableBanks} 
                            onSave={handleSaveInsurance}
                            newEndorsement={newEndorsement}
                            setNewEndorsement={setNewEndorsement}
                            endorsementType={endorsementType}
                            setEndorsementType={setEndorsementType}
                            onAddEndorsement={handleAddEndorsement}
                            onDeleteEndorsement={handleDeleteEndorsement}
                        />
                    )}

                    {/* ... (Continue ensuring other tabs use grid-cols-1 on mobile for inputs) ... */}
                </div>
            </div>
        );
    }

    // Default Dashboard View
    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Container className="text-blue-600" /> پرونده‌های بازرگانی
                    </h1>
                    <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                        <button onClick={goRoot} className="hover:text-blue-600 flex items-center gap-1"><Home size={14}/> خانه</button>
                        {selectedCompany && <><ChevronRight size={14}/> <button onClick={() => goCompany(selectedCompany)} className="hover:text-blue-600">{selectedCompany}</button></>}
                        {selectedGroup && <><ChevronRight size={14}/> <span>{selectedGroup}</span></>}
                    </div>
                </div>
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <input className="border rounded-xl pl-8 pr-3 py-3 md:py-2 text-sm w-full md:w-48 focus:w-full md:focus:w-64 transition-all" placeholder="جستجو..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <Search className="absolute left-2 top-3 md:top-2.5 text-gray-400" size={16} />
                    </div>
                    {/* ADDED BUTTON HERE */}
                    <button 
                        onClick={() => setShowArchived(!showArchived)} 
                        className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-colors border text-sm w-full md:w-auto justify-center ${showArchived ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                    >
                        <Archive size={18} />
                        {showArchived ? 'جاری' : 'بایگانی'}
                    </button>
                    {/* END ADDED BUTTON */}
                    <button onClick={() => setViewMode('reports')} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-gray-50 font-bold transition-colors text-sm w-full md:w-auto justify-center">
                        <FileSpreadsheet size={18} /> گزارشات
                    </button>
                    <button onClick={() => setShowNewModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-colors shadow-lg shadow-blue-600/20 text-sm w-full md:w-auto justify-center">
                        <Plus size={18} /> ثبت جدید
                    </button>
                </div>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {navLevel !== 'GROUP' ? (
                    groupedData.map((item: any) => (
                        <div key={item.name} onClick={() => item.type === 'company' ? goCompany(item.name) : goGroup(item.name)} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-2 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex justify-between items-center mb-4">
                                <div className="bg-blue-50 p-3 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
                                    {item.type === 'company' ? <Building2 size={24} /> : <Package size={24} />}
                                </div>
                                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">{item.count} پرونده</span>
                            </div>
                            <h3 className="font-bold text-gray-800 text-lg mb-1">{item.name}</h3>
                            <p className="text-xs text-gray-500">کلیک برای مشاهده جزئیات</p>
                        </div>
                    ))
                ) : (
                    safeRecords
                        .filter(r => (showArchived ? r.isArchived : !r.isArchived) && (r.company === selectedCompany) && (r.commodityGroup === selectedGroup) && (r.goodsName.includes(searchTerm) || r.fileNumber.includes(searchTerm)))
                        .map(record => (
                            <div key={record.id} onClick={() => { setSelectedRecord(record); setViewMode('details'); setActiveTab('timeline'); }} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group border-l-4 border-l-transparent hover:border-l-blue-500 relative">
                                {/* DELETE BUTTON */}
                                <button 
                                    onClick={(e) => handleDeleteRecord(record.id, e)} 
                                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-100 md:opacity-0 group-hover:opacity-100 transition-all z-10"
                                    title="حذف پرونده"
                                >
                                    <Trash2 size={18}/>
                                </button>

                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-bold text-gray-800 line-clamp-1 pr-8" title={record.goodsName}>{record.goodsName}</h3>
                                    <span className={`text-[10px] px-2 py-1 rounded-lg ${record.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'}`}>{record.status === 'Completed' ? 'تکمیل' : 'جاری'}</span>
                                </div>
                                <div className="space-y-1.5 text-xs text-gray-500">
                                    <div className="flex items-center gap-1"><FolderOpen size={12} /> پرونده: <span className="font-mono text-gray-700 font-bold">{record.fileNumber}</span></div>
                                    <div className="flex items-center gap-1"><Building2 size={12} /> فروشنده: <span className="text-gray-700">{record.sellerName}</span></div>
                                    <div className="flex items-center gap-1"><History size={12} /> شروع: <span>{new Date(record.startDate).toLocaleDateString('fa-IR')}</span></div>
                                </div>
                            </div>
                        ))
                )}
            </div>
            
            {/* New Record Modal */}
            {showNewModal && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-gray-800">ثبت پرونده جدید</h3>
                            <button onClick={() => setShowNewModal(false)}><X size={24} className="text-gray-400 hover:text-red-500" /></button>
                        </div>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">شماره پرونده</label><input className="w-full border rounded-xl p-3 bg-gray-50 font-mono text-left dir-ltr" value={newFileNumber} onChange={e => setNewFileNumber(e.target.value)} placeholder="File No..." /></div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">نام کالا (شرح کلی)</label><input className="w-full border rounded-xl p-3" value={newGoodsName} onChange={e => setNewGoodsName(e.target.value)} placeholder="مثال: قطعات یدکی..." /></div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">فروشنده</label><input className="w-full border rounded-xl p-3" value={newSellerName} onChange={e => setNewSellerName(e.target.value)} placeholder="Seller Name..." /></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">گروه کالایی</label><input list="commodity-groups" className="w-full border rounded-xl p-3" value={newCommodityGroup} onChange={e => setNewCommodityGroup(e.target.value)} placeholder="انتخاب..." /><datalist id="commodity-groups">{commodityGroups.map(g => <option key={g} value={g} />)}</datalist></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">ارز پایه</label><select className="w-full border rounded-xl p-3 bg-white" value={newMainCurrency} onChange={e => setNewMainCurrency(e.target.value)}>{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select></div>
                            </div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">شرکت</label><select className="w-full border rounded-xl p-3 bg-white" value={newRecordCompany} onChange={e => setNewRecordCompany(e.target.value)}><option value="">انتخاب شرکت...</option>{availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            <button onClick={handleCreateRecord} disabled={!newFileNumber || !newGoodsName || !newRecordCompany} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 mt-4 disabled:opacity-50 transition-all">ایجاد پرونده</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TradeModule;
