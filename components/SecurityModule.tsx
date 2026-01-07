
import React, { useState, useEffect, useRef } from 'react';
import { User, SecurityLog, PersonnelDelay, SecurityIncident, SecurityStatus, UserRole, DailySecurityMeta, SystemSettings } from '../types';
import { getSecurityLogs, saveSecurityLog, updateSecurityLog, deleteSecurityLog, getPersonnelDelays, savePersonnelDelay, updatePersonnelDelay, deletePersonnelDelay, getSecurityIncidents, saveSecurityIncident, updateSecurityIncident, deleteSecurityIncident, getSettings, saveSettings } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian, formatDate, getShamsiDateFromIso } from '../constants';
import { Shield, Plus, CheckCircle, XCircle, Clock, Truck, AlertTriangle, UserCheck, Calendar, Printer, Archive, FileSymlink, Edit, Trash2, Eye, FileText, CheckSquare, User as UserIcon, ListChecks, Activity, FileDown, Loader2, Pencil, ChevronDown, ChevronUp, FolderOpen, Folder, Save, X } from 'lucide-react';
import { PrintSecurityDailyLog, PrintPersonnelDelay, PrintIncidentReport } from './security/SecurityPrints';
import { getRolePermissions } from '../services/authService';
import { generatePdf } from '../utils/pdfGenerator';

interface Props {
    currentUser: User;
}

// --- HELPER FOR SCALING ---
const ScaledContainer: React.FC<{ children: React.ReactNode, isLandscape?: boolean }> = ({ children, isLandscape }) => {
    const [scale, setScale] = useState(1);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleResize = () => {
            const wrapper = wrapperRef.current;
            if (wrapper) {
                const wrapperWidth = wrapper.clientWidth;
                // A4 Landscape = 297mm (~1123px), Portrait = 210mm (~794px)
                const targetWidth = isLandscape ? 1123 : 794; 
                
                if (wrapperWidth < targetWidth + 40) {
                    const newScale = (wrapperWidth - 32) / targetWidth;
                    setScale(newScale);
                } else {
                    setScale(1);
                }
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isLandscape]);

    return (
        <div ref={wrapperRef} className="w-full flex justify-center pb-10">
            <div style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
                width: isLandscape ? '296mm' : '210mm',
                marginBottom: `${(1 - scale) * -100}px` 
            }}>
                {children}
            </div>
        </div>
    );
};

const SecurityModule: React.FC<Props> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<'logs' | 'delays' | 'incidents' | 'cartable' | 'archive' | 'in_progress'>('logs');
    const [subTab, setSubTab] = useState<'current' | 'archived'>('current');
    const [deletingItemKey, setDeletingItemKey] = useState<string | null>(null);
    const currentShamsi = getCurrentShamsiDate();
    const [selectedDate, setSelectedDate] = useState({ year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day });
    const [logs, setLogs] = useState<SecurityLog[]>([]);
    const [delays, setDelays] = useState<PersonnelDelay[]>([]);
    const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [printTarget, setPrintTarget] = useState<any>(null);
    const [viewCartableItem, setViewCartableItem] = useState<any>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null); 
    const [logForm, setLogForm] = useState<Partial<SecurityLog>>({});
    const [delayForm, setDelayForm] = useState<Partial<PersonnelDelay>>({});
    const [incidentForm, setPartialIncidentForm] = useState<Partial<SecurityIncident>>({});
    const [metaForm, setMetaForm] = useState<DailySecurityMeta>({});
    const permissions = settings ? getRolePermissions(currentUser.role, settings, currentUser) : null;

    useEffect(() => { loadData(); }, []);
    
    // Reset subTab when changing main tabs or date
    useEffect(() => {
        setSubTab('current');
    }, [activeTab, selectedDate]);

    const loadData = async () => {
        try {
            const [l, d, i, s] = await Promise.all([getSecurityLogs(), getPersonnelDelays(), getSecurityIncidents(), getSettings()]);
            setLogs(l || []); setDelays(d || []); setIncidents(i || []); setSettings(s);
        } catch(e) { console.error(e); }
    };

    const getIsoSelectedDate = (): string => { try { const d = jalaliToGregorian(selectedDate.year, selectedDate.month, selectedDate.day); return d.toISOString().split('T')[0]; } catch { return new Date().toISOString().split('T')[0]; } };
    
    useEffect(() => { const isoDate = getIsoSelectedDate(); if (settings?.dailySecurityMeta && settings.dailySecurityMeta[isoDate]) { setMetaForm(settings.dailySecurityMeta[isoDate]); } else { setMetaForm({ dailyDescription: '', morningGuard: { name: '', entry: '', exit: '' }, eveningGuard: { name: '', entry: '', exit: '' }, nightGuard: { name: '', entry: '', exit: '' } }); } }, [selectedDate, settings]);

    const handleJumpToEdit = (e: React.MouseEvent, type: 'log' | 'delay' | 'incident', item: any) => {
        e.stopPropagation();
        const dateParts = getShamsiDateFromIso(item.date);
        setSelectedDate(dateParts);
        setActiveTab(type === 'log' ? 'logs' : type === 'delay' ? 'delays' : 'incidents');
        handleEditItem(item, type);
    };

    const formatTime = (timeStr: string) => { if(!timeStr) return ''; const clean = timeStr.replace(/[^0-9]/g, ''); if(clean.length >= 4) return `${clean.slice(0,2)}:${clean.slice(2,4)}`; return clean; };
    const handleTimeChange = (field: string, val: string, setter: any, form: any) => { setter({ ...form, [field]: val }); };
    const handleTimeBlur = (field: string, val: string, setter: any, form: any) => { setter({ ...form, [field]: formatTime(val) }); };
    
    const setMyName = (field: string, setter: any, form: any) => { setter({ ...form, [field]: currentUser.fullName }); };

    const allDailyLogs = logs.filter(l => l.date.startsWith(getIsoSelectedDate()));
    const dailyLogsActive = allDailyLogs.filter(l => l.status !== SecurityStatus.ARCHIVED);
    const dailyLogsArchived = allDailyLogs.filter(l => l.status === SecurityStatus.ARCHIVED);
    const displayLogs = subTab === 'current' ? dailyLogsActive : dailyLogsArchived;

    const allDailyDelays = delays.filter(d => d.date.startsWith(getIsoSelectedDate()));
    const dailyDelaysActive = allDailyDelays.filter(d => d.status !== SecurityStatus.ARCHIVED);
    const dailyDelaysArchived = allDailyDelays.filter(d => d.status === SecurityStatus.ARCHIVED);
    const displayDelays = subTab === 'current' ? dailyDelaysActive : dailyDelaysArchived;

    const allDailyIncidents = incidents.filter(i => i.date.startsWith(getIsoSelectedDate()));

    const canEdit = (status: SecurityStatus) => {
        if (currentUser.role === UserRole.ADMIN) return true;
        if (status === SecurityStatus.ARCHIVED || status === SecurityStatus.PENDING_CEO) return false;
        return true; 
    };

    const canDelete = () => {
        return currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SECURITY_HEAD;
    };

    // Helper to see if we need to reset approvals when editing
    const resetDailyApprovalIfNeeded = (date: string) => {
        if (!settings) return;
        const meta = settings.dailySecurityMeta?.[date];
        if (meta && (meta.isFactoryDailyApproved || meta.isCeoDailyApproved)) {
            const updatedMeta = { ...meta, isFactoryDailyApproved: false, isCeoDailyApproved: false };
            const newSettings = { ...settings, dailySecurityMeta: { ...settings.dailySecurityMeta, [date]: updatedMeta } };
            saveSettings(newSettings);
            setSettings(newSettings);
            setMetaForm(updatedMeta);
        }
    };

    const getCartableItems = () => {
        let items: any[] = [];
        
        // 1. Logs Pending Factory (Daily Sheets)
        // Group logs by date
        const logsByDate: Record<string, SecurityLog[]> = {};
        logs.filter(l => l.status === SecurityStatus.PENDING_FACTORY).forEach(l => {
            if(!logsByDate[l.date]) logsByDate[l.date] = [];
            logsByDate[l.date].push(l);
        });

        // 2. Delays Pending Factory
        const delaysByDate: Record<string, PersonnelDelay[]> = {};
        delays.filter(d => d.status === SecurityStatus.PENDING_FACTORY).forEach(d => {
            if(!delaysByDate[d.date]) delaysByDate[d.date] = [];
            delaysByDate[d.date].push(d);
        });

        // FACTORY MANAGER CARTABLE
        if (currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN) {
             Object.keys(logsByDate).forEach(date => {
                 items.push({ type: 'daily_approval', category: 'log', date, count: logsByDate[date].length, status: SecurityStatus.PENDING_FACTORY });
             });
             Object.keys(delaysByDate).forEach(date => {
                 items.push({ type: 'daily_approval', category: 'delay', date, count: delaysByDate[date].length, status: SecurityStatus.PENDING_FACTORY });
             });
             // Incidents
             incidents.filter(i => i.status === SecurityStatus.PENDING_FACTORY).forEach(inc => {
                 items.push({ type: 'incident', ...inc });
             });
        }

        // CEO CARTABLE
        if (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN) {
            // Logs Pending CEO
            const logsCeo = logs.filter(l => l.status === SecurityStatus.PENDING_CEO);
            const logsCeoByDate: Record<string, SecurityLog[]> = {};
            logsCeo.forEach(l => { if(!logsCeoByDate[l.date]) logsCeoByDate[l.date]=[]; logsCeoByDate[l.date].push(l); });
            Object.keys(logsCeoByDate).forEach(date => {
                 items.push({ type: 'daily_approval', category: 'log', date, count: logsCeoByDate[date].length, status: SecurityStatus.PENDING_CEO });
            });

            // Delays Pending CEO
            const delaysCeo = delays.filter(d => d.status === SecurityStatus.PENDING_CEO);
            const delaysCeoByDate: Record<string, PersonnelDelay[]> = {};
            delaysCeo.forEach(d => { if(!delaysCeoByDate[d.date]) delaysCeoByDate[d.date]=[]; delaysCeoByDate[d.date].push(d); });
            Object.keys(delaysCeoByDate).forEach(date => {
                 items.push({ type: 'daily_approval', category: 'delay', date, count: delaysCeoByDate[date].length, status: SecurityStatus.PENDING_CEO });
            });

             // Incidents
             incidents.filter(i => i.status === SecurityStatus.PENDING_CEO).forEach(inc => {
                 items.push({ type: 'incident', ...inc });
             });
        }

        // SUPERVISOR CARTABLE (Incidents / Delays Pending Supervisor)
        if (currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.ADMIN) {
            // Delays Pending Supervisor
            const delaysSup = delays.filter(d => d.status === SecurityStatus.PENDING_SUPERVISOR);
            if (delaysSup.length > 0) {
                 // Group by date or show individually? Usually individual for delays
                 delaysSup.forEach(d => items.push({ type: 'delay', ...d }));
            }
            // Incidents Pending Supervisor
            incidents.filter(i => i.status === SecurityStatus.PENDING_SUPERVISOR).forEach(inc => {
                 items.push({ type: 'incident', ...inc });
            });
        }

        return items;
    };

    const getInProgressItems = () => {
        // Items that I (as Guard or Supervisor) have sent but are not yet Archived
        // Simplified: Show all pending items system-wide if Admin/Manager, else show items created by me
        const allPendingLogs = logs.filter(l => l.status !== SecurityStatus.ARCHIVED && l.status !== SecurityStatus.REJECTED);
        const allPendingDelays = delays.filter(d => d.status !== SecurityStatus.ARCHIVED && d.status !== SecurityStatus.REJECTED);
        const allPendingIncidents = incidents.filter(i => i.status !== SecurityStatus.ARCHIVED && i.status !== SecurityStatus.REJECTED);
        
        // Group logs/delays by date for cleaner view
        const grouped: any[] = [];
        const logsByDate = allPendingLogs.reduce((acc, l) => { acc[l.date] = (acc[l.date] || 0) + 1; return acc; }, {} as Record<string,number>);
        Object.entries(logsByDate).forEach(([date, count]) => grouped.push({ type: 'log_summary', date, count, status: 'در جریان' }));

        const delaysByDate = allPendingDelays.reduce((acc, d) => { acc[d.date] = (acc[d.date] || 0) + 1; return acc; }, {} as Record<string,number>);
        Object.entries(delaysByDate).forEach(([date, count]) => grouped.push({ type: 'delay_summary', date, count, status: 'در جریان' }));
        
        allPendingIncidents.forEach(i => grouped.push({ type: 'incident', ...i }));
        
        return grouped;
    };

    const getArchivedItems = () => {
        // Show daily archives
        const logsByDate = logs.filter(l => l.status === SecurityStatus.ARCHIVED).reduce((acc, l) => { acc[l.date] = true; return acc; }, {} as Record<string,boolean>);
        const delaysByDate = delays.filter(d => d.status === SecurityStatus.ARCHIVED).reduce((acc, d) => { acc[d.date] = true; return acc; }, {} as Record<string,boolean>);
        
        const items: any[] = [];
        Object.keys(logsByDate).forEach(date => items.push({ type: 'daily_archive', category: 'log', date }));
        Object.keys(delaysByDate).forEach(date => items.push({ type: 'daily_archive', category: 'delay', date }));
        
        incidents.filter(i => i.status === SecurityStatus.ARCHIVED).forEach(i => items.push({ type: 'incident', ...i }));
        
        return items.sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt));
    };

    const handleSaveLog = async () => {
        if (!logForm.origin || !logForm.driverName) return;
        const isoDate = getIsoSelectedDate();
        resetDailyApprovalIfNeeded(isoDate); // Reset approval if modifying
        if (editingId) {
            await updateSecurityLog({ ...logs.find(l => l.id === editingId)!, ...logForm } as SecurityLog);
        } else {
            await saveSecurityLog({
                id: generateUUID(),
                rowNumber: logs.filter(l => l.date === isoDate).length + 1,
                date: isoDate,
                shift: '', 
                origin: logForm.origin || '',
                entryTime: logForm.entryTime || '',
                exitTime: logForm.exitTime || '',
                driverName: logForm.driverName || '',
                plateNumber: logForm.plateNumber || '',
                goodsName: logForm.goodsName || '',
                quantity: logForm.quantity || '',
                destination: logForm.destination || '',
                receiver: logForm.receiver || '',
                workDescription: logForm.workDescription || '',
                permitProvider: logForm.permitProvider || '',
                registrant: currentUser.fullName,
                status: SecurityStatus.PENDING_FACTORY, // Direct to Factory for daily logs usually, or Supervisor? Let's assume Guard -> Supervisor check -> Factory
                // Actually daily logs usually batch approved. Let's set to PENDING_FACTORY as standard flow for daily sheet.
                // Or if you want supervisor check: PENDING_SUPERVISOR
                createdAt: Date.now()
            });
        }
        resetForms();
        loadData();
    };

    const handleSaveDelay = async () => {
        if (!delayForm.personnelName) return;
        const isoDate = getIsoSelectedDate();
        resetDailyApprovalIfNeeded(isoDate);
        if (editingId) {
            await updatePersonnelDelay({ ...delays.find(d => d.id === editingId)!, ...delayForm } as PersonnelDelay);
        } else {
            await savePersonnelDelay({
                id: generateUUID(),
                date: isoDate,
                personnelName: delayForm.personnelName || '',
                unit: delayForm.unit || '',
                arrivalTime: delayForm.arrivalTime || '',
                delayAmount: delayForm.delayAmount || '',
                repeatCount: delayForm.repeatCount || '0',
                instruction: delayForm.instruction || '',
                registrant: currentUser.fullName,
                status: SecurityStatus.PENDING_SUPERVISOR,
                createdAt: Date.now()
            });
        }
        resetForms();
        loadData();
    };

    const handleSaveIncident = async () => {
        if (!incidentForm.subject) return;
        const isoDate = getIsoSelectedDate();
        if (editingId) {
            await updateSecurityIncident({ ...incidents.find(i => i.id === editingId)!, ...incidentForm } as SecurityIncident);
        } else {
            await saveSecurityIncident({
                id: generateUUID(),
                reportNumber: incidentForm.reportNumber || Math.floor(Math.random()*1000).toString(),
                date: isoDate,
                subject: incidentForm.subject || '',
                description: incidentForm.description || '',
                shift: incidentForm.shift || 'صبح',
                witnesses: incidentForm.witnesses || '',
                registrant: currentUser.fullName,
                status: SecurityStatus.PENDING_SUPERVISOR,
                createdAt: Date.now()
            });
        }
        resetForms();
        loadData();
    };

    const resetForms = () => { setShowModal(false); setEditingId(null); setLogForm({}); setDelayForm({}); setPartialIncidentForm({}); };

    const handleEditItem = (item: any, type: 'log' | 'delay' | 'incident') => {
        setEditingId(item.id);
        if (type === 'log') setLogForm(item);
        if (type === 'delay') setDelayForm(item);
        if (type === 'incident') setPartialIncidentForm(item);
        setShowModal(true);
    };

    const handleApprove = async (item: any) => {
        if (item.type === 'incident') {
            let nextStatus = SecurityStatus.PENDING_FACTORY;
            let updates: any = {};
            
            if (item.status === SecurityStatus.PENDING_SUPERVISOR) {
                nextStatus = SecurityStatus.PENDING_FACTORY;
                updates.approverSupervisor = currentUser.fullName;
            } else if (item.status === SecurityStatus.PENDING_FACTORY) {
                nextStatus = SecurityStatus.PENDING_CEO;
                updates.approverFactory = currentUser.fullName;
            } else if (item.status === SecurityStatus.PENDING_CEO) {
                nextStatus = SecurityStatus.ARCHIVED;
                updates.approverCeo = currentUser.fullName;
            }

            await updateSecurityIncident({ ...item, status: nextStatus, ...updates });
        } else if (item.type === 'delay') {
            // Individual delay approval (if needed)
            await updatePersonnelDelay({ ...item, status: SecurityStatus.PENDING_FACTORY, approverSupervisor: currentUser.fullName });
        } else if (item.type === 'daily_approval') {
            // Batch Approve Logs or Delays for a Date
            const targetDate = item.date;
            if (item.category === 'log') {
                const logsToApprove = logs.filter(l => l.date === targetDate && l.status === item.status);
                let nextStatus = SecurityStatus.PENDING_CEO;
                let field = 'approverFactory';
                if (item.status === SecurityStatus.PENDING_CEO) { nextStatus = SecurityStatus.ARCHIVED; field = 'approverCeo'; }
                
                await Promise.all(logsToApprove.map(l => updateSecurityLog({ ...l, status: nextStatus, [field]: currentUser.fullName })));
                
                // Update Meta Checkboxes
                if (settings) {
                    const meta = settings.dailySecurityMeta?.[targetDate] || {};
                    if (item.status === SecurityStatus.PENDING_FACTORY) meta.isFactoryDailyApproved = true;
                    if (item.status === SecurityStatus.PENDING_CEO) meta.isCeoDailyApproved = true;
                    await saveSettings({ ...settings, dailySecurityMeta: { ...settings.dailySecurityMeta, [targetDate]: meta } });
                }
            } else if (item.category === 'delay') {
                const delaysToApprove = delays.filter(d => d.date === targetDate && d.status === item.status);
                let nextStatus = SecurityStatus.PENDING_CEO;
                let field = 'approverFactory';
                if (item.status === SecurityStatus.PENDING_CEO) { nextStatus = SecurityStatus.ARCHIVED; field = 'approverCeo'; }
                
                await Promise.all(delaysToApprove.map(d => updatePersonnelDelay({ ...d, status: nextStatus, [field]: currentUser.fullName })));
            }
        }
        loadData();
        setViewCartableItem(null);
    };

    const handleReject = async (item: any) => {
        const reason = prompt("دلیل رد:");
        if (!reason) return;
        if (item.type === 'incident') await updateSecurityIncident({ ...item, status: SecurityStatus.REJECTED, rejectionReason: reason });
        // ... Logic for batch reject ...
        loadData();
        setViewCartableItem(null);
    };

    const handleSaveShiftMeta = async () => {
        if (!settings) return;
        const isoDate = getIsoSelectedDate();
        const updatedMeta = { ...settings.dailySecurityMeta, [isoDate]: metaForm };
        await saveSettings({ ...settings, dailySecurityMeta: updatedMeta });
        setShowShiftModal(false);
    };

    const handleDeleteItem = async (id: string, type: 'log' | 'delay' | 'incident') => {
        setDeletingItemKey(id);
        if (type === 'log') await deleteSecurityLog(id);
        if (type === 'delay') await deletePersonnelDelay(id);
        if (type === 'incident') await deleteSecurityIncident(id);
        loadData();
        setDeletingItemKey(null);
    };

    const handleDownloadPDF = async () => {
        setIsGeneratingPdf(true);
        const elementId = 'printable-area-view';
        // Check if landscape based on type
        const isLandscape = (printTarget && (printTarget.type === 'daily_log')) || (viewCartableItem && (viewCartableItem.category === 'log' || viewCartableItem.type === 'log'));

        await generatePdf({
            elementId: elementId,
            filename: `Security_Report.pdf`,
            format: 'A4',
            orientation: isLandscape ? 'landscape' : 'portrait',
            onComplete: () => setIsGeneratingPdf(false),
            onError: () => { alert("خطا در ایجاد PDF"); setIsGeneratingPdf(false); }
        });
    };
    
    // --- SPECIAL HANDLERS FOR DAILY SUBMIT (Guard/Supervisor) ---
    const handleSupervisorDailySubmit = async () => {
        if (!confirm('آیا تایید می‌کنید؟ گزارش روزانه جهت بررسی به مدیر کارخانه ارسال می‌شود.')) return;
        const isoDate = getIsoSelectedDate();
        const pendingLogs = logs.filter(l => l.date === isoDate && (l.status === SecurityStatus.PENDING_SUPERVISOR || l.status === '')); // Assuming initial state
        // In this simplified model, logs are created as PENDING_FACTORY (skip supervisor for simple flow) or PENDING_SUPERVISOR
        // Let's assume we update all PENDING_SUPERVISOR to PENDING_FACTORY
        const targetLogs = logs.filter(l => l.date === isoDate && l.status === SecurityStatus.PENDING_SUPERVISOR);
        await Promise.all(targetLogs.map(l => updateSecurityLog({ ...l, status: SecurityStatus.PENDING_FACTORY, approverSupervisor: currentUser.fullName })));
        
        const targetDelays = delays.filter(d => d.date === isoDate && d.status === SecurityStatus.PENDING_SUPERVISOR);
        await Promise.all(targetDelays.map(d => updatePersonnelDelay({ ...d, status: SecurityStatus.PENDING_FACTORY, approverSupervisor: currentUser.fullName })));
        
        loadData();
        alert('گزارش ارسال شد.');
    };

    const handleFactoryDailySubmit = async () => {
         // This logic is handled inside cartable view usually
    };
    
    const handleDeleteDailyArchive = async (date: string, category: 'log'|'delay') => {
        if(!confirm('آیا از حذف کل آرشیو این روز اطمینان دارید؟')) return;
        if(category === 'log') {
            const targets = logs.filter(l => l.date === date && l.status === SecurityStatus.ARCHIVED);
            await Promise.all(targets.map(l => deleteSecurityLog(l.id)));
        } else {
            const targets = delays.filter(d => d.date === date && d.status === SecurityStatus.ARCHIVED);
            await Promise.all(targets.map(d => deletePersonnelDelay(d.id)));
        }
        loadData();
        setActiveTab('archive'); // Refresh view
    };

    const DateFilter = () => (
        <div className="flex gap-1 items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
            <Calendar size={16} className="text-gray-500 ml-1"/>
            <select className="bg-transparent text-sm p-1 outline-none" value={selectedDate.day} onChange={e=>setSelectedDate({...selectedDate, day: +e.target.value})}>{Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}</option>)}</select>
            <span className="text-gray-400">/</span>
            <select className="bg-transparent text-sm p-1 outline-none" value={selectedDate.month} onChange={e=>setSelectedDate({...selectedDate, month: +e.target.value})}>{Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}</option>)}</select>
            <span className="text-gray-400">/</span>
            <select className="bg-transparent text-sm p-1 outline-none" value={selectedDate.year} onChange={e=>setSelectedDate({...selectedDate, year: +e.target.value})}>{Array.from({length:5},(_,i)=>1402+i).map(y=><option key={y} value={y}>{y}</option>)}</select>
        </div>
    );
    
    // Determine landscape mode for wrapper
    const isLandscapeMode = (printTarget && (printTarget.type === 'daily_log')) || (viewCartableItem && (viewCartableItem.category === 'log' || viewCartableItem.type === 'log'));

    return (
        <div className="p-4 md:p-6 bg-gray-50 h-[calc(100vh-100px)] overflow-y-auto animate-fade-in relative">
            
            {/* Shift Meta Modal */}
            {showShiftModal && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5">
                        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">اطلاعات شیفت ({formatDate(getIsoSelectedDate())})</h3><button onClick={()=>setShowShiftModal(false)}><X/></button></div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-gray-600"><div>شیفت</div><div>نگهبان</div><div>ورود / خروج</div></div>
                            <div className="grid grid-cols-3 gap-2 items-center"><span className="text-sm font-bold">صبح</span><input className="border rounded p-1 text-sm" placeholder="نام" value={metaForm.morningGuard?.name} onChange={e=>setMetaForm({...metaForm, morningGuard:{...metaForm.morningGuard!, name:e.target.value}})}/><div className="flex gap-1"><input className="border rounded p-1 w-full text-center" placeholder="07:00" value={metaForm.morningGuard?.entry} onChange={e=>setMetaForm({...metaForm, morningGuard:{...metaForm.morningGuard!, entry:e.target.value}})}/><input className="border rounded p-1 w-full text-center" placeholder="15:00" value={metaForm.morningGuard?.exit} onChange={e=>setMetaForm({...metaForm, morningGuard:{...metaForm.morningGuard!, exit:e.target.value}})}/></div></div>
                            <div className="grid grid-cols-3 gap-2 items-center"><span className="text-sm font-bold">عصر</span><input className="border rounded p-1 text-sm" placeholder="نام" value={metaForm.eveningGuard?.name} onChange={e=>setMetaForm({...metaForm, eveningGuard:{...metaForm.eveningGuard!, name:e.target.value}})}/><div className="flex gap-1"><input className="border rounded p-1 w-full text-center" placeholder="15:00" value={metaForm.eveningGuard?.entry} onChange={e=>setMetaForm({...metaForm, eveningGuard:{...metaForm.eveningGuard!, entry:e.target.value}})}/><input className="border rounded p-1 w-full text-center" placeholder="23:00" value={metaForm.eveningGuard?.exit} onChange={e=>setMetaForm({...metaForm, eveningGuard:{...metaForm.eveningGuard!, exit:e.target.value}})}/></div></div>
                            <div className="grid grid-cols-3 gap-2 items-center"><span className="text-sm font-bold">شب</span><input className="border rounded p-1 text-sm" placeholder="نام" value={metaForm.nightGuard?.name} onChange={e=>setMetaForm({...metaForm, nightGuard:{...metaForm.nightGuard!, name:e.target.value}})}/><div className="flex gap-1"><input className="border rounded p-1 w-full text-center" placeholder="23:00" value={metaForm.nightGuard?.entry} onChange={e=>setMetaForm({...metaForm, nightGuard:{...metaForm.nightGuard!, entry:e.target.value}})}/><input className="border rounded p-1 w-full text-center" placeholder="07:00" value={metaForm.nightGuard?.exit} onChange={e=>setMetaForm({...metaForm, nightGuard:{...metaForm.nightGuard!, exit:e.target.value}})}/></div></div>
                            <div><label className="text-xs font-bold block mb-1">توضیحات کلی شیفت</label><textarea className="w-full border rounded p-2 text-sm h-20" value={metaForm.dailyDescription} onChange={e=>setMetaForm({...metaForm, dailyDescription:e.target.value})} /></div>
                            <button onClick={handleSaveShiftMeta} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold">ذخیره اطلاعات شیفت</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Preview Modal */}
            {showPrintModal && printTarget && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
                    <div className="bg-white p-4 rounded-xl shadow-lg mb-4 flex gap-4 no-print">
                        <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"><Printer size={16}/> چاپ</button>
                        <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="bg-red-600 text-white px-4 py-2 rounded flex items-center gap-2">{isGeneratingPdf ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>} دانلود PDF</button>
                        <button onClick={() => setShowPrintModal(false)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded">بستن</button>
                    </div>
                    
                    {/* SCALED CONTAINER WRAPPER */}
                    <div className="overflow-auto bg-gray-200 p-4 rounded shadow-inner max-h-[80vh] w-full flex justify-center">
                         <ScaledContainer isLandscape={printTarget.type === 'daily_log'}>
                            <div id="printable-area-view" className="bg-white shadow-lg">
                                {printTarget.type === 'daily_log' && <PrintSecurityDailyLog date={printTarget.date} logs={printTarget.logs} meta={printTarget.meta} />}
                                {printTarget.type === 'daily_delay' && <PrintPersonnelDelay delays={printTarget.delays} meta={printTarget.meta} />}
                                {printTarget.type === 'incident' && <PrintIncidentReport incident={printTarget.incident} />}
                            </div>
                        </ScaledContainer>
                    </div>
                </div>
            )}

            {/* Cartable Action Modal */}
            {viewCartableItem && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
                    <div className="bg-white p-4 rounded-xl shadow-lg mb-4 flex gap-4 no-print w-full max-w-2xl justify-between items-center">
                        <div className="font-bold text-lg text-gray-800">{viewCartableItem.type === 'daily_approval' || viewCartableItem.type === 'daily_archive' ? `گزارش روزانه - ${formatDate(viewCartableItem.date)}` : 'بررسی'}</div>
                        <div className="flex gap-2">
                             <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded font-bold shadow"><Printer size={18}/></button>
                             <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="bg-red-600 text-white px-4 py-2 rounded font-bold shadow">{isGeneratingPdf ? <Loader2 size={18} className="animate-spin"/> : <FileDown size={18}/>}</button>
                             {/* Only show Approve/Reject if it's an actionable item */}
                             {viewCartableItem.type !== 'daily_archive' && (
                                 <>
                                    <button onClick={() => handleApprove(viewCartableItem)} className="bg-green-600 text-white px-4 py-2 rounded font-bold shadow">تایید</button>
                                    <button onClick={() => handleReject(viewCartableItem)} className="bg-amber-500 text-white px-4 py-2 rounded font-bold shadow">رد / اصلاح</button>
                                 </>
                             )}
                             <button onClick={() => setViewCartableItem(null)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded font-bold">بستن</button>
                        </div>
                    </div>
                    
                    {/* SCALED CONTAINER WRAPPER */}
                    <div className="overflow-auto bg-gray-200 p-4 rounded shadow-inner max-h-[80vh] w-full flex justify-center">
                        <ScaledContainer isLandscape={isLandscapeMode}>
                            <div className="bg-white shadow-lg" id="printable-area-view">
                                {(viewCartableItem.type === 'daily_approval' || viewCartableItem.type === 'daily_archive') && viewCartableItem.category === 'log' && (
                                    <PrintSecurityDailyLog 
                                        date={viewCartableItem.date} 
                                        logs={logs.filter(l => l.date === viewCartableItem.date)} 
                                        meta={(settings?.dailySecurityMeta || {})[String(viewCartableItem.date)]}
                                    />
                                )}
                                {(viewCartableItem.type === 'daily_approval' || viewCartableItem.type === 'daily_archive') && viewCartableItem.category === 'delay' && (
                                    <PrintPersonnelDelay 
                                        delays={delays.filter(d => d.date === viewCartableItem.date)} 
                                        meta={(settings?.dailySecurityMeta || {})[String(viewCartableItem.date)]}
                                    />
                                )}
                                {viewCartableItem.type === 'log' && (
                                    <PrintSecurityDailyLog 
                                        date={viewCartableItem.date} 
                                        logs={logs.filter(l => l.date === viewCartableItem.date)} 
                                        meta={(settings?.dailySecurityMeta || {})[String(viewCartableItem.date)]}
                                    />
                                )}
                                {viewCartableItem.type === 'delay' && (
                                    <PrintPersonnelDelay 
                                        delays={delays.filter(d => d.date === viewCartableItem.date)} 
                                        meta={(settings?.dailySecurityMeta || {})[String(viewCartableItem.date)]}
                                    />
                                )}
                                {viewCartableItem.type === 'incident' && (
                                    <PrintIncidentReport incident={viewCartableItem} />
                                )}
                            </div>
                        </ScaledContainer>
                    </div>
                </div>
            )}

            {/* Input Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">{activeTab === 'logs' ? 'ثبت ورود و خروج' : activeTab === 'delays' ? 'ثبت تاخیر پرسنل' : 'ثبت وقایع'}</h3><button onClick={resetForms}><X size={20}/></button></div>
                        {activeTab === 'logs' && (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-xs font-bold block mb-1">مبدا بارگیری</label><input className="w-full border rounded p-2" value={logForm.origin} onChange={e=>setLogForm({...logForm, origin:e.target.value})}/></div>
                                    <div><label className="text-xs font-bold block mb-1">مقصد</label><input className="w-full border rounded p-2" value={logForm.destination} onChange={e=>setLogForm({...logForm, destination:e.target.value})}/></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-xs font-bold block mb-1">ساعت ورود</label><input className="w-full border rounded p-2 text-center" placeholder="00:00" value={logForm.entryTime} onChange={e=>handleTimeChange('entryTime', e.target.value, setLogForm, logForm)} onBlur={e=>handleTimeBlur('entryTime', e.target.value, setLogForm, logForm)}/></div>
                                    <div><label className="text-xs font-bold block mb-1">ساعت خروج</label><input className="w-full border rounded p-2 text-center" placeholder="00:00" value={logForm.exitTime} onChange={e=>handleTimeChange('exitTime', e.target.value, setLogForm, logForm)} onBlur={e=>handleTimeBlur('exitTime', e.target.value, setLogForm, logForm)}/></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-xs font-bold block mb-1">نام راننده</label><input className="w-full border rounded p-2" value={logForm.driverName} onChange={e=>setLogForm({...logForm, driverName:e.target.value})}/></div>
                                    <div><label className="text-xs font-bold block mb-1">شماره پلاک</label><input className="w-full border rounded p-2 dir-ltr" placeholder="12 A 345 67" value={logForm.plateNumber} onChange={e=>setLogForm({...logForm, plateNumber:e.target.value})}/></div>
                                </div>
                                <div><label className="text-xs font-bold block mb-1">مجوز دهنده</label><input className="w-full border rounded p-2" value={logForm.permitProvider} onChange={e=>setLogForm({...logForm, permitProvider:e.target.value})}/></div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-2"><label className="text-xs font-bold block mb-1">نام کالا</label><input className="w-full border rounded p-2" value={logForm.goodsName} onChange={e=>setLogForm({...logForm, goodsName:e.target.value})}/></div>
                                    <div><label className="text-xs font-bold block mb-1">تعداد</label><input className="w-full border rounded p-2" value={logForm.quantity} onChange={e=>setLogForm({...logForm, quantity:e.target.value})}/></div>
                                </div>
                                <div><label className="text-xs font-bold block mb-1">تحویل گیرنده</label><input className="w-full border rounded p-2" value={logForm.receiver} onChange={e=>setLogForm({...logForm, receiver:e.target.value})}/></div>
                                <div><label className="text-xs font-bold block mb-1">توضیحات</label><textarea className="w-full border rounded p-2 h-16" value={logForm.workDescription} onChange={e=>setLogForm({...logForm, workDescription:e.target.value})}/></div>
                                <button onClick={handleSaveLog} className="w-full bg-blue-600 text-white py-2 rounded font-bold">ثبت گزارش</button>
                            </div>
                        )}
                        {activeTab === 'delays' && (
                            <div className="space-y-3">
                                <div><label className="text-xs font-bold block mb-1">نام و نام خانوادگی</label><input className="w-full border rounded p-2" value={delayForm.personnelName} onChange={e=>setDelayForm({...delayForm, personnelName:e.target.value})}/></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-xs font-bold block mb-1">واحد / بخش</label><input className="w-full border rounded p-2" value={delayForm.unit} onChange={e=>setDelayForm({...delayForm, unit:e.target.value})}/></div>
                                    <div><label className="text-xs font-bold block mb-1">ساعت ورود</label><input className="w-full border rounded p-2 text-center" placeholder="00:00" value={delayForm.arrivalTime} onChange={e=>handleTimeChange('arrivalTime', e.target.value, setDelayForm, delayForm)} onBlur={e=>handleTimeBlur('arrivalTime', e.target.value, setDelayForm, delayForm)}/></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-xs font-bold block mb-1">مدت تاخیر (دقیقه)</label><input className="w-full border rounded p-2 text-center" value={delayForm.delayAmount} onChange={e=>setDelayForm({...delayForm, delayAmount:e.target.value})}/></div>
                                    <div><label className="text-xs font-bold block mb-1">تعداد تکرار در ماه</label><input className="w-full border rounded p-2 text-center" value={delayForm.repeatCount} onChange={e=>setDelayForm({...delayForm, repeatCount:e.target.value})}/></div>
                                </div>
                                <div><label className="text-xs font-bold block mb-1">اقدام انجام شده / توضیحات</label><input className="w-full border rounded p-2" value={delayForm.instruction} onChange={e=>setDelayForm({...delayForm, instruction:e.target.value})}/></div>
                                <button onClick={handleSaveDelay} className="w-full bg-blue-600 text-white py-2 rounded font-bold">ثبت تاخیر</button>
                            </div>
                        )}
                        {activeTab === 'incidents' && (
                            <div className="space-y-3">
                                <div className="flex gap-3">
                                    <div className="flex-1"><label className="text-xs font-bold block mb-1">موضوع گزارش</label><input className="w-full border rounded p-2" value={incidentForm.subject} onChange={e=>setPartialIncidentForm({...incidentForm, subject:e.target.value})}/></div>
                                    <div className="w-32"><label className="text-xs font-bold block mb-1">شماره گزارش</label><input className="w-full border rounded p-2 text-center" value={incidentForm.reportNumber} onChange={e=>setPartialIncidentForm({...incidentForm, reportNumber:e.target.value})}/></div>
                                </div>
                                <div><label className="text-xs font-bold block mb-1">شرح دقیق موضوع</label><textarea className="w-full border rounded p-2 h-32" value={incidentForm.description} onChange={e=>setPartialIncidentForm({...incidentForm, description:e.target.value})}/></div>
                                <div><label className="text-xs font-bold block mb-1">شهود</label><input className="w-full border rounded p-2" value={incidentForm.witnesses} onChange={e=>setPartialIncidentForm({...incidentForm, witnesses:e.target.value})}/></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-xs font-bold block mb-1">شیفت</label><select className="w-full border rounded p-2" value={incidentForm.shift} onChange={e=>setPartialIncidentForm({...incidentForm, shift:e.target.value})}><option>صبح</option><option>عصر</option><option>شب</option></select></div>
                                </div>
                                <button onClick={handleSaveIncident} className="w-full bg-blue-600 text-white py-2 rounded font-bold">ثبت واقعه</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Shield className="text-blue-600"/> واحد انتظامات</h1>
                <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
                    {(activeTab === 'logs' || activeTab === 'delays') && (<div className="flex gap-2"><button onClick={() => setShowShiftModal(true)} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1"><FileText size={16}/> شیفت</button><DateFilter /></div>)}
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border overflow-x-auto"><button onClick={() => setActiveTab('logs')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'logs' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>نگهبانی</button><button onClick={() => setActiveTab('delays')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'delays' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>تاخیر</button><button onClick={() => setActiveTab('incidents')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'incidents' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>وقایع</button><div className="w-px bg-gray-300 mx-1"></div><button onClick={() => setActiveTab('cartable')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'cartable' ? 'bg-orange-600 text-white' : 'text-gray-600'}`}>کارتابل</button><button onClick={() => setActiveTab('in_progress')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'in_progress' ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}>در جریان</button><button onClick={() => setActiveTab('archive')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'archive' ? 'bg-green-600 text-white' : 'text-gray-600'}`}>بایگانی</button></div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 min-h-[500px]">
                {activeTab === 'logs' && (
                    <>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <h2 className="font-bold text-gray-700">دفتر ثبت ورود و خروج کالا و خودرو</h2>
                            <div className="flex gap-2">
                                <button onClick={() => { setPrintTarget({ type: 'daily_log', date: getIsoSelectedDate(), logs: displayLogs, meta: metaForm }); setShowPrintModal(true); }} className="bg-white border text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-gray-100"><Printer size={14}/> چاپ روزانه</button>
                                {canEdit(SecurityStatus.PENDING_FACTORY) && <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-700"><Plus size={14}/> ثبت مورد جدید</button>}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-center border-collapse">
                                <thead className="bg-gray-100 text-gray-600"><tr><th className="p-3 border-b">ردیف</th><th className="p-3 border-b">مبدا</th><th className="p-3 border-b">ورود</th><th className="p-3 border-b">خروج</th><th className="p-3 border-b">راننده / پلاک</th><th className="p-3 border-b">کالا / تعداد</th><th className="p-3 border-b">مقصد / گیرنده</th><th className="p-3 border-b">وضعیت</th><th className="p-3 border-b">عملیات</th></tr></thead>
                                <tbody className="divide-y">
                                    {displayLogs.length === 0 ? <tr><td colSpan={9} className="p-8 text-gray-400">موردی برای این تاریخ ثبت نشده است.</td></tr> : displayLogs.map((log, idx) => (
                                        <tr key={log.id} className="hover:bg-gray-50">
                                            <td className="p-3">{log.rowNumber}</td>
                                            <td className="p-3 font-bold">{log.origin}</td>
                                            <td className="p-3 font-mono dir-ltr">{log.entryTime}</td>
                                            <td className="p-3 font-mono dir-ltr">{log.exitTime}</td>
                                            <td className="p-3"><div>{log.driverName}</div><div className="font-mono text-gray-500">{log.plateNumber}</div></td>
                                            <td className="p-3"><div>{log.goodsName}</div><div className="text-gray-500">{log.quantity}</div></td>
                                            <td className="p-3"><div>{log.destination}</div><div className="text-gray-500">{log.receiver}</div></td>
                                            <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] ${log.status === SecurityStatus.ARCHIVED ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{log.status}</span></td>
                                            <td className="p-3 flex justify-center gap-1">
                                                {canEdit(log.status) && <button onClick={(e) => handleJumpToEdit(e, 'log', log)} className="text-amber-500 hover:bg-amber-50 p-1 rounded"><Edit size={14}/></button>}
                                                {canDelete() && <button onClick={() => handleDeleteItem(log.id, 'log')} className="text-red-400 hover:bg-red-50 p-1 rounded"><Trash2 size={14}/></button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {activeTab === 'delays' && (
                     <>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <h2 className="font-bold text-gray-700">لیست تاخیر پرسنل</h2>
                            <div className="flex gap-2">
                                <button onClick={() => { setPrintTarget({ type: 'daily_delay', date: getIsoSelectedDate(), delays: displayDelays, meta: metaForm }); setShowPrintModal(true); }} className="bg-white border text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-gray-100"><Printer size={14}/> چاپ فرم تاخیر</button>
                                {canEdit(SecurityStatus.PENDING_FACTORY) && <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-700"><Plus size={14}/> ثبت تاخیر</button>}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-center">
                                <thead className="bg-gray-100 text-gray-600"><tr><th className="p-3 border-b">نام پرسنل</th><th className="p-3 border-b">واحد</th><th className="p-3 border-b">ساعت ورود</th><th className="p-3 border-b">میزان تاخیر</th><th className="p-3 border-b">تکرار</th><th className="p-3 border-b">توضیحات</th><th className="p-3 border-b">عملیات</th></tr></thead>
                                <tbody className="divide-y">
                                    {displayDelays.length === 0 ? <tr><td colSpan={7} className="p-8 text-gray-400">موردی ثبت نشده است.</td></tr> : displayDelays.map(d => (
                                        <tr key={d.id} className="hover:bg-gray-50">
                                            <td className="p-3 font-bold">{d.personnelName}</td>
                                            <td className="p-3">{d.unit}</td>
                                            <td className="p-3 font-mono">{d.arrivalTime}</td>
                                            <td className="p-3 font-bold text-red-600">{d.delayAmount}</td>
                                            <td className="p-3">{d.repeatCount}</td>
                                            <td className="p-3 text-gray-500">{d.instruction}</td>
                                            <td className="p-3 flex justify-center gap-1">
                                                {canEdit(d.status) && <button onClick={(e) => handleJumpToEdit(e, 'delay', d)} className="text-amber-500 hover:bg-amber-50 p-1 rounded"><Edit size={14}/></button>}
                                                {canDelete() && <button onClick={() => handleDeleteItem(d.id, 'delay')} className="text-red-400 hover:bg-red-50 p-1 rounded"><Trash2 size={14}/></button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                     </>
                )}

                {activeTab === 'incidents' && (
                    <>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <h2 className="font-bold text-gray-700">لیست وقایع و گزارشات</h2>
                            <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-700"><Plus size={14}/> ثبت واقعه جدید</button>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {allDailyIncidents.map(inc => (
                                <div key={inc.id} className="border rounded-xl p-4 hover:shadow-md transition-shadow bg-white relative">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded font-bold">گزارش #{inc.reportNumber}</span>
                                        <span className="text-[10px] text-gray-400">{new Date(inc.createdAt).toLocaleTimeString('fa-IR')}</span>
                                    </div>
                                    <h3 className="font-bold text-sm mb-1">{inc.subject}</h3>
                                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">{inc.description}</p>
                                    <div className="flex justify-between items-center mt-2 border-t pt-2">
                                        <span className={`text-[10px] px-2 py-0.5 rounded ${inc.status === SecurityStatus.ARCHIVED ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>{inc.status}</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => { setPrintTarget({ type: 'incident', incident: inc }); setShowPrintModal(true); }} className="text-gray-500 hover:text-blue-600 p-1"><Printer size={14}/></button>
                                            {canEdit(inc.status) && <button onClick={(e) => handleJumpToEdit(e, 'incident', inc)} className="text-amber-500 hover:text-amber-700 p-1"><Edit size={14}/></button>}
                                            {canDelete() && <button onClick={() => handleDeleteItem(inc.id, 'incident')} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14}/></button>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {activeTab === 'cartable' && (
                    <div className="p-6">
                        {getCartableItems().length === 0 ? <div className="text-center text-gray-400 py-10">کارتابل شما خالی است.</div> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {getCartableItems().map((item, idx) => (
                                    <div key={idx} onClick={() => setViewCartableItem(item)} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer transition-all border-l-4 border-l-orange-500">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-bold text-sm text-gray-800">{item.type === 'daily_approval' ? 'تایید گزارش روزانه' : item.type === 'incident' ? 'تایید واقعه' : 'تایید تاخیر'}</span>
                                            <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded animate-pulse">اقدام فوری</span>
                                        </div>
                                        <div className="text-xs text-gray-600 space-y-1">
                                            {item.date && <div>📅 تاریخ: {formatDate(item.date)}</div>}
                                            {item.count && <div>🔢 تعداد موارد: {item.count}</div>}
                                            {item.subject && <div>📝 موضوع: {item.subject}</div>}
                                            {item.personnelName && <div>👤 پرسنل: {item.personnelName}</div>}
                                        </div>
                                        <button className="mt-3 w-full bg-blue-50 text-blue-600 text-xs py-2 rounded font-bold hover:bg-blue-100">بررسی و اقدام</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                
                {activeTab === 'archive' && (
                    <div className="p-4">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Archive size={18}/> آرشیو گزارشات</h3>
                        <div className="space-y-2">
                            {getArchivedItems().map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border hover:bg-gray-50">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${item.category === 'log' ? 'bg-blue-100 text-blue-600' : item.category === 'delay' ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-600'}`}>
                                            {item.category === 'log' ? <ListChecks size={16}/> : item.category === 'delay' ? <Clock size={16}/> : <AlertTriangle size={16}/>}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-gray-800">
                                                {item.type === 'daily_archive' ? (item.category === 'log' ? 'گزارش روزانه نگهبانی' : 'گزارش تاخیرات روزانه') : item.subject}
                                            </div>
                                            <div className="text-xs text-gray-500">{formatDate(item.date)}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setViewCartableItem(item)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"><Eye size={16}/></button>
                                        {canDelete() && <button onClick={() => handleDeleteDailyArchive(item.date, item.category)} className="text-red-400 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SecurityModule;
