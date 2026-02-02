
import React, { useState, useEffect, useRef } from 'react';
import { getSettings, saveSettings, uploadFile } from '../services/storageService';
import { SystemSettings, Company, Contact, CompanyBank, User, PrintTemplate } from '../types';
import { Settings as SettingsIcon, Save, Loader2, Database, Bell, Plus, Trash2, Building, ShieldCheck, Landmark, AppWindow, BellRing, BellOff, Send, Image as ImageIcon, Pencil, X, Check, MessageCircle, RefreshCw, Users, FolderSync, Smartphone, Link, Truck, DownloadCloud, UploadCloud, Warehouse, FileText, Container, LayoutTemplate, WifiOff, Info, Clock, CheckCircle2 } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { requestNotificationPermission, setNotificationPreference, isNotificationEnabledInApp } from '../services/notificationService';
import { getUsers } from '../services/authService';
import { generateUUID } from '../constants';
import PrintTemplateDesigner from './PrintTemplateDesigner';
import { FiscalYearManager } from './FiscalModule'; 
import SecondExitGroupSettings from './settings/SecondExitGroupSettings';
import RolePermissionsEditor from './settings/RolePermissionsEditor';

// Internal QRCode Component with Error Handling
const QRCode = ({ value, size }: { value: string, size: number }) => { 
    const [error, setError] = useState(false);
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center text-gray-400 text-xs border-2 border-dashed border-gray-300 rounded-lg p-2" style={{width: size, height: size}}>
                <WifiOff size={24} className="mb-2"/>
                <span className="text-center">امکان نمایش QR وجود ندارد (آفلاین)</span>
            </div>
        );
    }
    return (
        <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`} 
            alt="QR Code" 
            width={size} 
            height={size} 
            className="mix-blend-multiply" 
            onError={() => setError(true)}
        />
    ); 
};

const Settings: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'system' | 'fiscal' | 'data' | 'integrations' | 'whatsapp' | 'permissions' | 'warehouse' | 'commerce' | 'templates'>('system');
  const [settings, setSettings] = useState<SystemSettings>({ 
      currentTrackingNumber: 1000, 
      currentExitPermitNumber: 1000, 
      companyNames: [], 
      companies: [], 
      defaultCompany: '', 
      bankNames: [], 
      operatingBankNames: [], 
      commodityGroups: [], 
      rolePermissions: {}, 
      customRoles: [], 
      savedContacts: [], 
      pwaIcon: '', 
      telegramBotToken: '', 
      telegramAdminId: '', 
      baleBotToken: '', 
      smsApiKey: '', 
      smsSenderNumber: '', 
      googleCalendarId: '', 
      whatsappNumber: '', 
      geminiApiKey: '',
      warehouseSequences: {},
      companyNotifications: {},
      defaultWarehouseGroup: '',
      defaultSalesManager: '',
      insuranceCompanies: [],
      exitPermitNotificationGroup: '',
      printTemplates: [],
      fiscalYears: []
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [restoring, setRestoring] = useState(false);
  
  // Designer State
  const [showDesigner, setShowDesigner] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PrintTemplate | null>(null);

  // Local States for Form Inputs
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyLogo, setNewCompanyLogo] = useState('');
  const [newCompanyShowInWarehouse, setNewCompanyShowInWarehouse] = useState(true);
  const [newCompanyBanks, setNewCompanyBanks] = useState<CompanyBank[]>([]);
  const [newCompanyLetterhead, setNewCompanyLetterhead] = useState('');
  
  // New Company Fields
  const [newCompanyRegNum, setNewCompanyRegNum] = useState('');
  const [newCompanyNatId, setNewCompanyNatId] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');
  const [newCompanyFax, setNewCompanyFax] = useState('');
  const [newCompanyPostalCode, setNewCompanyPostalCode] = useState('');
  const [newCompanyEcoCode, setNewCompanyEcoCode] = useState('');

  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  
  // Local states for adding/editing banks
  const [tempBankName, setTempBankName] = useState('');
  const [tempAccountNum, setTempAccountNum] = useState('');
  const [tempBankSheba, setTempBankSheba] = useState('');
  const [tempBankLayout, setTempBankLayout] = useState<string>('');
  const [tempInternalLayout, setTempInternalLayout] = useState<string>('');
  const [tempInternalWithdrawalLayout, setTempInternalWithdrawalLayout] = useState<string>('');
  const [tempInternalDepositLayout, setTempInternalDepositLayout] = useState<string>('');
  const [tempDualPrint, setTempDualPrint] = useState(false);

  // Commerce Local States
  const [newInsuranceCompany, setNewInsuranceCompany] = useState('');

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingLetterhead, setIsUploadingLetterhead] = useState(false);
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const companyLetterheadInputRef = useRef<HTMLInputElement>(null);

  const [whatsappStatus, setWhatsappStatus] = useState<{ready: boolean, qr: string | null, user: string | null} | null>(null);
  const [refreshingWA, setRefreshingWA] = useState(false);
  
  // Contact States
  const [contactName, setContactName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [contactBaleId, setContactBaleId] = useState('');
  const [isGroupContact, setIsGroupContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null); 
  
  const [fetchingGroups, setFetchingGroups] = useState(false);
  const [newOperatingBank, setNewOperatingBank] = useState('');
  const [newCommodity, setNewCommodity] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const isSecure = window.isSecureContext;
  
  // App Users to merge into contacts list
  const [appUsers, setAppUsers] = useState<(Contact | User)[]>([]);

  useEffect(() => { 
      loadSettings(); 
      setNotificationsEnabled(isNotificationEnabledInApp()); 
      checkWhatsappStatus();
      loadAppUsers();
  }, []);

  const loadSettings = async () => { 
      try { 
          const data = await getSettings(); 
          let safeData = { ...data };
          // Ensure arrays exist
          safeData.currentExitPermitNumber = safeData.currentExitPermitNumber || 1000;
          safeData.companies = safeData.companies || [];
          safeData.operatingBankNames = safeData.operatingBankNames || [];
          safeData.insuranceCompanies = safeData.insuranceCompanies || [];
          if (safeData.companyNames?.length > 0 && safeData.companies.length === 0) {
              safeData.companies = safeData.companyNames.map(name => ({ id: generateUUID(), name, showInWarehouse: true, banks: [] }));
          }
          if(!safeData.warehouseSequences) safeData.warehouseSequences = {};
          if(!safeData.companyNotifications) safeData.companyNotifications = {};
          if(!safeData.customRoles) safeData.customRoles = [];
          if(!safeData.printTemplates) safeData.printTemplates = [];
          if(!safeData.fiscalYears) safeData.fiscalYears = [];
          if(!safeData.rolePermissions) safeData.rolePermissions = {}; 

          setSettings(safeData); 
      } catch (e) { console.error("Failed to load settings"); } 
  };

  const loadAppUsers = async () => {
      try {
          const users = await getUsers();
          const contacts = users
              .filter(u => u.phoneNumber)
              .map(u => ({
                  id: u.id,
                  name: `(کاربر) ${u.fullName}`,
                  number: u.phoneNumber!,
                  isGroup: false,
                  baleId: u.baleChatId
              }));
          setAppUsers(contacts);
      } catch (e) { console.error("Failed to load users"); }
  };

  const checkWhatsappStatus = async () => {
      setRefreshingWA(true);
      try {
          const status = await apiCall<{ready: boolean, qr: string | null, user: string | null}>('/whatsapp/status');
          setWhatsappStatus(status);
      } catch (e) { console.error("Failed to check WA status"); } finally { setRefreshingWA(false); }
  };

  const handleWhatsappLogout = async () => {
      if(!confirm('آیا مطمئن هستید؟')) return;
      try { await apiCall('/whatsapp/logout', 'POST'); setTimeout(checkWhatsappStatus, 2000); } catch (e) { alert('خطا'); }
  };

  const handleFetchGroups = async () => {
      if (!whatsappStatus?.ready) { alert("واتساپ متصل نیست."); return; }
      setFetchingGroups(true);
      try {
          const response = await apiCall<{success: boolean, groups: {id: string, name: string}[]}>('/whatsapp/groups');
          if (response.success && response.groups) {
              const existingIds = new Set((settings.savedContacts || []).map(c => c.number));
              const newGroups = response.groups.filter(g => !existingIds.has(g.id)).map(g => ({ id: generateUUID(), name: g.name, number: g.id, isGroup: true }));
              if (newGroups.length > 0) {
                  setSettings({ ...settings, savedContacts: [...(settings.savedContacts || []), ...newGroups] });
                  alert(`${newGroups.length} گروه اضافه شد.`);
              } else alert("گروه جدیدی یافت نشد.");
          }
      } catch (e) { alert("خطا در دریافت."); } finally { setFetchingGroups(false); }
  };

  useEffect(() => {
      let interval: any;
      if (activeCategory === 'whatsapp' && whatsappStatus && !whatsappStatus.ready) {
          interval = setInterval(checkWhatsappStatus, 3000); 
      }
      return () => clearInterval(interval);
  }, [activeCategory, whatsappStatus]);

  const handleSave = async (e: React.FormEvent) => { 
      e.preventDefault(); setLoading(true); 
      try { 
          let currentCompanies = [...(settings.companies || [])];
          
          if (activeCategory === 'data' && (newCompanyName.trim() || editingCompanyId)) {
              if (editingCompanyId) {
                  currentCompanies = currentCompanies.map(c =>
                      c.id === editingCompanyId
                          ? { 
                              ...c, 
                              name: newCompanyName.trim(), 
                              logo: newCompanyLogo, 
                              showInWarehouse: newCompanyShowInWarehouse,
                              banks: newCompanyBanks,
                              letterhead: newCompanyLetterhead,
                              registrationNumber: newCompanyRegNum,
                              nationalId: newCompanyNatId,
                              address: newCompanyAddress,
                              phone: newCompanyPhone,
                              fax: newCompanyFax,
                              postalCode: newCompanyPostalCode,
                              economicCode: newCompanyEcoCode
                            }
                          : c
                  );
              } else if (newCompanyName.trim()) {
                  currentCompanies = [...currentCompanies, {
                      id: generateUUID(),
                      name: newCompanyName.trim(),
                      logo: newCompanyLogo,
                      showInWarehouse: newCompanyShowInWarehouse,
                      banks: newCompanyBanks,
                      letterhead: newCompanyLetterhead,
                      registrationNumber: newCompanyRegNum,
                      nationalId: newCompanyNatId,
                      address: newCompanyAddress,
                      phone: newCompanyPhone,
                      fax: newCompanyFax,
                      postalCode: newCompanyPostalCode,
                      economicCode: newCompanyEcoCode
                  }];
              }
              resetCompanyForm();
          }

          const syncedSettings = { 
              ...settings, 
              companies: currentCompanies,
              companyNames: currentCompanies.map(c => c.name) 
          };

          await saveSettings(syncedSettings); 
          setSettings(syncedSettings);
          setMessage('ذخیره شد ✅'); setTimeout(() => setMessage(''), 3000); 
      } catch (e) { setMessage('خطا ❌'); } finally { setLoading(false); } 
  };

  const handleAddOrUpdateContact = () => { 
      if (!contactName.trim() || !contactNumber.trim()) return; 
      
      const newContactData: Contact = { 
          id: editingContactId || generateUUID(), 
          name: contactName.trim(), 
          number: contactNumber.trim(), 
          baleId: contactBaleId.trim(),
          isGroup: isGroupContact 
      }; 
      
      let updatedContacts;
      if (editingContactId) {
          updatedContacts = (settings.savedContacts || []).map(c => c.id === editingContactId ? newContactData : c);
      } else {
          updatedContacts = [...(settings.savedContacts || []), newContactData];
      }

      setSettings({ ...settings, savedContacts: updatedContacts }); 
      resetContactForm();
  };

  const handleEditContact = (c: Contact) => {
      setEditingContactId(c.id);
      setContactName(c.name);
      setContactNumber(c.number);
      setContactBaleId(c.baleId || '');
      setIsGroupContact(c.isGroup);
  };

  const handleDeleteContact = (id: string) => { 
      if(confirm('حذف شود؟')) {
        setSettings({ ...settings, savedContacts: (settings.savedContacts || []).filter(c => c.id !== id) }); 
        if(editingContactId === id) resetContactForm();
      }
  };

  const resetContactForm = () => {
      setContactName(''); 
      setContactNumber(''); 
      setContactBaleId('');
      setIsGroupContact(false); 
      setEditingContactId(null);
  };
  
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setIsUploadingLogo(true); const reader = new FileReader(); reader.onload = async (ev) => { try { const result = await uploadFile(file.name, ev.target?.result as string); setNewCompanyLogo(result.url); } catch (error) { alert('خطا در آپلود'); } finally { setIsUploadingLogo(false); } }; reader.readAsDataURL(file); };
  const handleLetterheadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setIsUploadingLetterhead(true); const reader = new FileReader(); reader.onload = async (ev) => { try { const result = await uploadFile(file.name, ev.target?.result as string); setNewCompanyLetterhead(result.url); } catch (error) { alert('خطا در آپلود'); } finally { setIsUploadingLetterhead(false); } }; reader.readAsDataURL(file); };

  const handleSaveCompany = () => { if (!newCompanyName.trim()) return; let updatedCompanies = settings.companies || []; const companyData = { id: editingCompanyId || generateUUID(), name: newCompanyName.trim(), logo: newCompanyLogo, showInWarehouse: newCompanyShowInWarehouse, banks: newCompanyBanks, letterhead: newCompanyLetterhead, registrationNumber: newCompanyRegNum, nationalId: newCompanyNatId, address: newCompanyAddress, phone: newCompanyPhone, fax: newCompanyFax, postalCode: newCompanyPostalCode, economicCode: newCompanyEcoCode }; if (editingCompanyId) { updatedCompanies = updatedCompanies.map(c => c.id === editingCompanyId ? companyData : c); } else { updatedCompanies = [...updatedCompanies, companyData]; } setSettings({ ...settings, companies: updatedCompanies, companyNames: updatedCompanies.map(c => c.name) }); resetCompanyForm(); };
  const handleEditCompany = (c: Company) => { setNewCompanyName(c.name); setNewCompanyLogo(c.logo || ''); setNewCompanyShowInWarehouse(c.showInWarehouse !== false); setNewCompanyBanks(c.banks || []); setNewCompanyLetterhead(c.letterhead || ''); setNewCompanyRegNum(c.registrationNumber || ''); setNewCompanyNatId(c.nationalId || ''); setNewCompanyAddress(c.address || ''); setNewCompanyPhone(c.phone || ''); setNewCompanyFax(c.fax || ''); setNewCompanyPostalCode(c.postalCode || ''); setNewCompanyEcoCode(c.economicCode || ''); setEditingCompanyId(c.id); };
  const resetCompanyForm = () => { setNewCompanyName(''); setNewCompanyLogo(''); setNewCompanyShowInWarehouse(true); setNewCompanyBanks([]); setNewCompanyLetterhead(''); setNewCompanyRegNum(''); setNewCompanyNatId(''); setNewCompanyAddress(''); setNewCompanyPhone(''); setNewCompanyFax(''); setNewCompanyPostalCode(''); setNewCompanyEcoCode(''); setEditingCompanyId(null); resetBankForm(); };
  const resetBankForm = () => { setTempBankName(''); setTempAccountNum(''); setTempBankSheba(''); setTempBankLayout(''); setTempInternalLayout(''); setTempInternalWithdrawalLayout(''); setTempInternalDepositLayout(''); setTempDualPrint(false); setEditingBankId(null); };
  const handleRemoveCompany = (id: string) => { if(confirm("حذف؟")) { const updated = (settings.companies || []).filter(c => c.id !== id); setSettings({ ...settings, companies: updated, companyNames: updated.map(c => c.name) }); } };
  const addOrUpdateCompanyBank = () => { if (!tempBankName) return; const bankData: CompanyBank = { id: editingBankId || generateUUID(), bankName: tempBankName, accountNumber: tempAccountNum, sheba: tempBankSheba, formLayoutId: tempBankLayout, internalTransferTemplateId: tempInternalLayout, enableDualPrint: tempDualPrint, internalWithdrawalTemplateId: tempInternalWithdrawalLayout, internalDepositTemplateId: tempInternalDepositLayout }; if (editingBankId) { setNewCompanyBanks(newCompanyBanks.map(b => b.id === editingBankId ? bankData : b)); } else { setNewCompanyBanks([...newCompanyBanks, bankData]); } resetBankForm(); };
  const editCompanyBank = (bank: CompanyBank) => { setTempBankName(bank.bankName); setTempAccountNum(bank.accountNumber); setTempBankSheba(bank.sheba || ''); setTempBankLayout(bank.formLayoutId || ''); setTempInternalLayout(bank.internalTransferTemplateId || ''); setTempDualPrint(bank.enableDualPrint || false); setTempInternalWithdrawalLayout(bank.internalWithdrawalTemplateId || ''); setTempInternalDepositLayout(bank.internalDepositTemplateId || ''); setEditingBankId(bank.id); };
  const removeCompanyBank = (id: string) => { setNewCompanyBanks(newCompanyBanks.filter(b => b.id !== id)); if (editingBankId === id) resetBankForm(); };

  const handleAddOperatingBank = () => { if (newOperatingBank.trim() && !(settings.operatingBankNames || []).includes(newOperatingBank.trim())) { setSettings({ ...settings, operatingBankNames: [...(settings.operatingBankNames || []), newOperatingBank.trim()] }); setNewOperatingBank(''); } };
  const handleRemoveOperatingBank = (name: string) => { setSettings({ ...settings, operatingBankNames: (settings.operatingBankNames || []).filter(b => b !== name) }); };
  const handleAddCommodity = () => { if (newCommodity.trim() && !settings.commodityGroups.includes(newCommodity.trim())) { setSettings({ ...settings, commodityGroups: [...settings.commodityGroups, newCommodity.trim()] }); setNewCommodity(''); } };
  const handleRemoveCommodity = (name: string) => { setSettings({ ...settings, commodityGroups: settings.commodityGroups.filter(c => c !== name) }); };
  const handleAddInsuranceCompany = () => { if (newInsuranceCompany.trim() && !(settings.insuranceCompanies || []).includes(newInsuranceCompany.trim())) { setSettings({ ...settings, insuranceCompanies: [...(settings.insuranceCompanies || []), newInsuranceCompany.trim()] }); setNewInsuranceCompany(''); } };
  const handleRemoveInsuranceCompany = (name: string) => { setSettings({ ...settings, insuranceCompanies: (settings.insuranceCompanies || []).filter(c => c !== name) }); };
  
  const handleIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingIcon(true); const reader = new FileReader(); reader.onload = async (ev) => { try { const res = await uploadFile(file.name, ev.target?.result as string); setSettings({ ...settings, pwaIcon: res.url }); } catch (error) { alert('خطا'); } finally { setUploadingIcon(false); } }; reader.readAsDataURL(file); };
  const handleToggleNotifications = async () => { if (!isSecure && window.location.hostname !== 'localhost') { alert("برای فعال‌سازی نوتیفیکیشن نیاز به HTTPS است."); return; } const granted = await requestNotificationPermission(); if (granted) { setNotificationPreference(true); setNotificationsEnabled(true); alert("نوتیفیکیشن فعال شد. اتصال به سرور بروزرسانی شد."); } else { alert("دسترسی به نوتیفیکیشن مسدود است یا پشتیبانی نمی‌شود."); } };
  const handleTestNotification = async () => { try { const userStr = localStorage.getItem('app_current_user'); const username = userStr ? JSON.parse(userStr).username : 'test'; await apiCall('/send-test-push', 'POST', { username }); alert("درخواست تست ارسال شد."); } catch (e: any) { let msg = "خطا در ارسال تست"; if (e.message && e.message.includes('404')) { if (confirm("اشتراک نوتیفیکیشن شما در سرور یافت نشد. آیا می‌خواهید مجدداً فعال‌سازی کنید؟")) { handleToggleNotifications(); return; } msg = "اشتراک یافت نشد."; } else if (e.message) { msg += `: ${e.message}`; } alert(msg); } };
  const handleDownloadBackup = (includeFiles: boolean) => { window.location.href = `/api/full-backup?includeFiles=${includeFiles}`; };
  const handleRestoreClick = () => { if (confirm('بازگردانی اطلاعات کامل (شامل عکس‌ها)؟ همه اطلاعات فعلی پاک می‌شود. \n\nنکته: در صورتی که بکاپ شما قدیمی است، سیستم به صورت هوشمند ساختار دیتابیس را به روز می‌کند تا مشکلی پیش نیاید.')) fileInputRef.current?.click(); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setRestoring(true); const reader = new FileReader(); reader.onload = async (ev) => { const base64 = ev.target?.result as string; try { const response = await apiCall<{success: boolean}>('/emergency-restore', 'POST', { fileData: base64 }); if (response.success) { alert('بازگردانی هوشمند با موفقیت انجام شد. سیستم رفرش می‌شود.'); window.location.reload(); } } catch (error) { alert('خطا در بازگردانی فایل'); } finally { setRestoring(false); } }; reader.readAsDataURL(file); };
  const handleSaveTemplate = (template: PrintTemplate) => { const existing = settings.printTemplates || []; const updated = editingTemplate ? existing.map(t => t.id === template.id ? template : t) : [...existing, template]; setSettings({ ...settings, printTemplates: updated }); setShowDesigner(false); setEditingTemplate(null); };
  const handleEditTemplate = (t: PrintTemplate) => { setEditingTemplate(t); setShowDesigner(true); };
  const handleDeleteTemplate = (id: string) => { if(!confirm('حذف قالب؟')) return; const updated = (settings.printTemplates || []).filter(t => t.id !== id); setSettings({ ...settings, printTemplates: updated }); };

  const handleUpdateSettings = (newSettings: SystemSettings) => {
      setSettings(newSettings);
  };

  if (showDesigner) {
      return <PrintTemplateDesigner onSave={handleSaveTemplate} onCancel={() => setShowDesigner(false)} initialTemplate={editingTemplate} />;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[600px] mb-20 animate-fade-in">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-l border-gray-200 p-4">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 px-2"><SettingsIcon size={24} className="text-blue-600"/> تنظیمات</h2>
            <nav className="space-y-1">
                <button onClick={() => setActiveCategory('system')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'system' ? 'bg-white shadow text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><AppWindow size={18}/> عمومی و سیستم</button>
                <button onClick={() => setActiveCategory('fiscal')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'fiscal' ? 'bg-white shadow text-emerald-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><FolderSync size={18}/> مدیریت سال مالی</button>
                <button onClick={() => setActiveCategory('data')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'data' ? 'bg-white shadow text-indigo-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Database size={18}/> اطلاعات پایه</button>
                <button onClick={() => setActiveCategory('templates')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'templates' ? 'bg-white shadow text-teal-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><LayoutTemplate size={18}/> قالب‌های چاپ</button>
                <button onClick={() => setActiveCategory('commerce')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'commerce' ? 'bg-white shadow text-rose-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Container size={18}/> تنظیمات بازرگانی</button>
                <button onClick={() => setActiveCategory('warehouse')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'warehouse' ? 'bg-white shadow text-orange-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Warehouse size={18}/> انبار</button>
                <button onClick={() => setActiveCategory('integrations')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'integrations' ? 'bg-white shadow text-purple-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Link size={18}/> اتصالات (API)</button>
                <button onClick={() => setActiveCategory('whatsapp')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'whatsapp' ? 'bg-white shadow text-green-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><MessageCircle size={18}/> پیام‌رسان‌ها</button>
                <button onClick={() => setActiveCategory('permissions')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'permissions' ? 'bg-white shadow text-gray-800 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><ShieldCheck size={18}/> نقش‌ها و دسترسی</button>
            </nav>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
            <form onSubmit={handleSave}>
                
                {/* --- SYSTEM SETTINGS (Including Backup) --- */}
                {activeCategory === 'system' && (
                    <div className="space-y-8 animate-slide-up">
                        {/* Backup & Restore Card */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5"><Database size={100}/></div>
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 relative z-10"><Database size={20} className="text-amber-500"/> پشتیبان‌گیری و بازیابی</h3>
                            
                            {/* Auto-Backup Status */}
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-3">
                                <Clock size={20} className="text-green-600 animate-pulse"/>
                                <div>
                                    <span className="text-sm font-bold text-green-800 block">پشتیبان‌گیری خودکار فعال است</span>
                                    <span className="text-xs text-green-600">سیستم هر ساعت یک نسخه پشتیبان تهیه می‌کند.</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                                <div className="space-y-2">
                                    <button type="button" onClick={() => handleDownloadBackup(false)} className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-xl text-sm font-bold transition-colors">
                                        <DownloadCloud size={18}/> دانلود دیتابیس (JSON)
                                    </button>
                                    <button type="button" onClick={() => handleDownloadBackup(true)} className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-xl text-sm font-bold transition-colors">
                                        <DownloadCloud size={18}/> دانلود نسخه کامل (با تصاویر)
                                    </button>
                                </div>
                                <div>
                                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                                    <button type="button" onClick={handleRestoreClick} disabled={restoring} className="w-full h-full flex flex-col items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border-2 border-dashed border-amber-200 px-4 py-3 rounded-xl text-sm font-bold transition-all">
                                        {restoring ? <Loader2 size={24} className="animate-spin"/> : <UploadCloud size={24}/>}
                                        {restoring ? 'در حال بازگردانی هوشمند...' : 'بازگردانی اطلاعات (Restore)'}
                                        <span className="text-[10px] opacity-70 font-normal">پشتیبانی از نسخه‌های قدیمی</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* App Customization */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Smartphone size={20} className="text-purple-600"/> شخصی‌سازی اپلیکیشن</h3>
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center overflow-hidden border border-gray-200">
                                    {settings.pwaIcon ? <img src={settings.pwaIcon} className="w-full h-full object-cover"/> : <ImageIcon size={24} className="text-gray-400"/>}
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">آیکون برنامه (PWA)</label>
                                    <div className="flex gap-2">
                                        <input type="file" ref={iconInputRef} className="hidden" accept="image/png" onChange={handleIconChange} />
                                        <button type="button" onClick={() => iconInputRef.current?.click()} disabled={uploadingIcon} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors">
                                            {uploadingIcon ? '...' : 'تغییر آیکون'}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-1">فرمت PNG، سایز پیشنهادی 512x512</p>
                                </div>
                            </div>
                        </div>

                        {/* Notifications */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Bell size={20} className="text-red-500"/> تنظیمات اعلان‌ها</h3>
                                <span className={`text-xs px-2 py-1 rounded-lg font-bold ${notificationsEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {notificationsEnabled ? 'فعال' : 'غیرفعال'}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={handleToggleNotifications} className="flex-1 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                                    {notificationsEnabled ? <BellRing size={16}/> : <BellOff size={16}/>}
                                    {notificationsEnabled ? 'غیرفعال‌سازی' : 'فعال‌سازی روی این دستگاه'}
                                </button>
                                <button type="button" onClick={handleTestNotification} className="flex-1 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                                    <Send size={16}/> ارسال تست
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* ... (Rest of tabs remain unchanged from original logic, just ensuring they render) ... */}
                {/* Fiscal Year Manager */}
                {activeCategory === 'fiscal' && (
                    <div className="animate-slide-up">
                        <FiscalYearManager />
                    </div>
                )}

                {/* Warehouse Settings */}
                {activeCategory === 'warehouse' && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><BellRing size={20} className="text-orange-500"/> تنظیمات اطلاع‌رسانی انبار</h3>
                            <div className="space-y-4">
                                {settings.companies?.map(company => {
                                    const notifConfig = settings.companyNotifications?.[company.name] || {};
                                    return (
                                        <div key={company.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                            <div className="font-bold text-sm text-gray-800 mb-3 border-b pb-2 flex items-center gap-2">
                                                <Building size={16}/> {company.name}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 block mb-1">شماره مدیر فروش (جهت تایید)</label>
                                                    <input 
                                                        className="w-full border rounded-lg p-2 text-sm dir-ltr" 
                                                        placeholder="98912..." 
                                                        value={notifConfig.salesManager || ''}
                                                        onChange={e => {
                                                            const newConfig = { ...settings.companyNotifications, [company.name]: { ...notifConfig, salesManager: e.target.value } };
                                                            setSettings({ ...settings, companyNotifications: newConfig });
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 block mb-1">شماره/گروه انبار (جهت ارسال بیجک)</label>
                                                    <input 
                                                        className="w-full border rounded-lg p-2 text-sm dir-ltr" 
                                                        placeholder="98912... or 12345678@g.us" 
                                                        value={notifConfig.warehouseGroup || ''}
                                                        onChange={e => {
                                                            const newConfig = { ...settings.companyNotifications, [company.name]: { ...notifConfig, warehouseGroup: e.target.value } };
                                                            setSettings({ ...settings, companyNotifications: newConfig });
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Second Group Settings for Exit Permits */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Truck size={20} className="text-blue-500"/> تنظیمات خروج بار</h3>
                            
                            <div className="mb-4">
                                <label className="text-sm font-bold text-gray-700 block mb-1">گروه اطلاع‌رسانی پیش‌فرض (مدیریت):</label>
                                <input 
                                    className="w-full border rounded-lg p-2 text-sm dir-ltr" 
                                    placeholder="شماره یا ID گروه واتساپ..." 
                                    value={settings.exitPermitNotificationGroup || ''}
                                    onChange={e => setSettings({ ...settings, exitPermitNotificationGroup: e.target.value })}
                                />
                                <p className="text-[10px] text-gray-500 mt-1">این گروه در تمامی مراحل تایید خروج، پیام دریافت می‌کند.</p>
                            </div>

                            <SecondExitGroupSettings 
                                settings={settings} 
                                setSettings={setSettings} 
                                contacts={settings.savedContacts || []}
                            />
                        </div>
                    </div>
                )}
                
                {/* Data Management (Companies, Banks, etc) */}
                {activeCategory === 'data' && (
                    <div className="space-y-6 animate-slide-up">
                        {/* Company Form */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">{editingCompanyId ? <Pencil size={20} className="text-amber-500"/> : <Plus size={20} className="text-green-500"/>} {editingCompanyId ? 'ویرایش شرکت' : 'افزودن شرکت جدید'}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-500">نام شرکت</label><input className="w-full border rounded-lg p-2 text-sm" value={newCompanyName} onChange={e=>setNewCompanyName(e.target.value)} placeholder="نام شرکت..."/></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-500">لوگو</label><div className="flex gap-2"><input type="file" ref={companyLogoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload}/><button type="button" onClick={()=>companyLogoInputRef.current?.click()} disabled={isUploadingLogo} className="w-full border rounded-lg p-2 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600">{isUploadingLogo ? 'در حال آپلود...' : (newCompanyLogo ? 'تغییر لوگو' : 'انتخاب فایل')}</button></div></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-500">سربرگ (A4)</label><div className="flex gap-2"><input type="file" ref={companyLetterheadInputRef} className="hidden" accept="image/*" onChange={handleLetterheadUpload}/><button type="button" onClick={()=>companyLetterheadInputRef.current?.click()} disabled={isUploadingLetterhead} className="w-full border rounded-lg p-2 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600">{isUploadingLetterhead ? 'در حال آپلود...' : (newCompanyLetterhead ? 'تغییر سربرگ' : 'انتخاب فایل')}</button></div></div>
                                <div className="flex items-center pt-6"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newCompanyShowInWarehouse} onChange={e=>setNewCompanyShowInWarehouse(e.target.checked)} className="w-4 h-4 text-blue-600 rounded"/> <span className="text-sm font-bold text-gray-700">نمایش در انبار</span></label></div>
                            </div>

                            {/* Detailed Info (Collapsible-ish) */}
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div><label className="text-[10px] font-bold text-gray-500">شماره ثبت</label><input className="w-full border rounded p-1.5 text-xs" value={newCompanyRegNum} onChange={e=>setNewCompanyRegNum(e.target.value)}/></div>
                                <div><label className="text-[10px] font-bold text-gray-500">شناسه ملی</label><input className="w-full border rounded p-1.5 text-xs" value={newCompanyNatId} onChange={e=>setNewCompanyNatId(e.target.value)}/></div>
                                <div><label className="text-[10px] font-bold text-gray-500">کد اقتصادی</label><input className="w-full border rounded p-1.5 text-xs" value={newCompanyEcoCode} onChange={e=>setNewCompanyEcoCode(e.target.value)}/></div>
                                <div><label className="text-[10px] font-bold text-gray-500">کد پستی</label><input className="w-full border rounded p-1.5 text-xs" value={newCompanyPostalCode} onChange={e=>setNewCompanyPostalCode(e.target.value)}/></div>
                                <div><label className="text-[10px] font-bold text-gray-500">تلفن</label><input className="w-full border rounded p-1.5 text-xs" value={newCompanyPhone} onChange={e=>setNewCompanyPhone(e.target.value)}/></div>
                                <div><label className="text-[10px] font-bold text-gray-500">فکس</label><input className="w-full border rounded p-1.5 text-xs" value={newCompanyFax} onChange={e=>setNewCompanyFax(e.target.value)}/></div>
                                <div className="col-span-2"><label className="text-[10px] font-bold text-gray-500">آدرس</label><input className="w-full border rounded p-1.5 text-xs" value={newCompanyAddress} onChange={e=>setNewCompanyAddress(e.target.value)}/></div>
                            </div>
                            
                            {/* Bank Accounts Sub-form */}
                            <div className="border-t pt-4 mt-4">
                                <h4 className="text-sm font-bold text-gray-600 mb-2">حساب‌های بانکی متصل</h4>
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 mb-3 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                                    <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500">نام بانک</label><input className="w-full border rounded p-1.5 text-xs" value={tempBankName} onChange={e=>setTempBankName(e.target.value)} placeholder="مثال: بانک ملی"/></div>
                                    <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500">شماره حساب / کارت</label><input className="w-full border rounded p-1.5 text-xs dir-ltr" value={tempAccountNum} onChange={e=>setTempAccountNum(e.target.value)}/></div>
                                    <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500">شماره شبا</label><input className="w-full border rounded p-1.5 text-xs dir-ltr" value={tempBankSheba} onChange={e=>setTempBankSheba(e.target.value)}/></div>
                                    
                                    <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500">قالب چاپ چک</label><select className="w-full border rounded p-1.5 text-xs bg-white" value={tempBankLayout} onChange={e=>setTempBankLayout(e.target.value)}><option value="">پیش‌فرض</option>{settings.printTemplates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                                    <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500">قالب فیش واریز (داخلی)</label><select className="w-full border rounded p-1.5 text-xs bg-white" value={tempInternalLayout} onChange={e=>setTempInternalLayout(e.target.value)}><option value="">پیش‌فرض</option>{settings.printTemplates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                                    
                                    <div className="flex flex-col gap-1">
                                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={tempDualPrint} onChange={e=>setTempDualPrint(e.target.checked)} className="w-3 h-3"/> <span className="text-[10px] font-bold">چاپ دو مرحله‌ای (برداشت/واریز)</span></label>
                                        {tempDualPrint && (
                                            <div className="grid grid-cols-2 gap-1">
                                                <select className="border rounded p-1 text-[10px]" value={tempInternalWithdrawalLayout} onChange={e=>setTempInternalWithdrawalLayout(e.target.value)}><option value="">قالب برداشت</option>{settings.printTemplates?.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
                                                <select className="border rounded p-1 text-[10px]" value={tempInternalDepositLayout} onChange={e=>setTempInternalDepositLayout(e.target.value)}><option value="">قالب واریز</option>{settings.printTemplates?.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
                                            </div>
                                        )}
                                    </div>

                                    <button type="button" onClick={addOrUpdateCompanyBank} className="bg-blue-500 text-white p-1.5 rounded text-xs font-bold hover:bg-blue-600 h-[30px]">{editingBankId ? 'ویرایش بانک' : 'افزودن بانک'}</button>
                                </div>
                                <div className="space-y-1">
                                    {newCompanyBanks.map(b => (
                                        <div key={b.id} className="flex justify-between items-center bg-white border p-2 rounded text-xs">
                                            <span>{b.bankName} - {b.accountNumber}</span>
                                            <div className="flex gap-1"><button type="button" onClick={()=>editCompanyBank(b)} className="text-amber-500"><Pencil size={14}/></button><button type="button" onClick={()=>removeCompanyBank(b.id)} className="text-red-500"><Trash2 size={14}/></button></div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2 mt-4 pt-4 border-t">
                                {editingCompanyId && <button type="button" onClick={resetCompanyForm} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-200">انصراف</button>}
                                <button type="button" onClick={handleSaveCompany} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 flex-1">{editingCompanyId ? 'ذخیره تغییرات' : 'افزودن شرکت'}</button>
                            </div>
                        </div>

                        {/* List Companies */}
                        <div className="space-y-2">
                            {settings.companies?.map(company => (
                                <div key={company.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border">{company.logo ? <img src={company.logo} className="w-full h-full object-cover"/> : <Building size={20} className="text-gray-400"/>}</div>
                                        <div><div className="font-bold text-gray-800">{company.name}</div><div className="text-xs text-gray-500">{company.banks?.length || 0} حساب بانکی</div></div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => handleEditCompany(company)} className="text-amber-500 hover:bg-amber-50 p-2 rounded-lg transition-colors"><Pencil size={18}/></button>
                                        <button type="button" onClick={() => handleRemoveCompany(company.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Saved Contacts */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mt-8">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Users size={20} className="text-indigo-600"/> مخاطبین ذخیره شده</h3>
                            <div className="flex gap-2 items-end mb-4 bg-gray-50 p-3 rounded-lg">
                                <div className="flex-1"><label className="text-xs font-bold text-gray-500 block mb-1">نام مخاطب</label><input className="w-full border rounded p-2 text-sm" value={contactName} onChange={e=>setContactName(e.target.value)} placeholder="نام..."/></div>
                                <div className="w-32"><label className="text-xs font-bold text-gray-500 block mb-1">شماره (واتساپ)</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={contactNumber} onChange={e=>setContactNumber(e.target.value)} placeholder="98912..."/></div>
                                <div className="w-32"><label className="text-xs font-bold text-gray-500 block mb-1">آیدی بله (اختیاری)</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={contactBaleId} onChange={e=>setContactBaleId(e.target.value)} placeholder="Bale ID"/></div>
                                <div className="flex items-center pb-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={isGroupContact} onChange={e=>setIsGroupContact(e.target.checked)} className="w-4 h-4"/> <span className="text-xs font-bold">گروه است؟</span></label></div>
                                <button type="button" onClick={handleAddOrUpdateContact} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 h-[38px] min-w-[40px] flex items-center justify-center">{editingContactId ? <Save size={18}/> : <Plus size={18}/>}</button>
                                {editingContactId && <button type="button" onClick={resetContactForm} className="bg-gray-200 text-gray-600 p-2 rounded-lg hover:bg-gray-300 h-[38px] min-w-[40px] flex items-center justify-center"><X size={18}/></button>}
                            </div>
                            <div className="space-y-1 max-h-60 overflow-y-auto">
                                {settings.savedContacts?.map(c => (
                                    <div key={c.id} className="flex justify-between items-center bg-white p-2 rounded border border-gray-100 hover:border-indigo-200 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${c.isGroup ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                                            <span className="font-bold text-sm">{c.name}</span>
                                            <span className="text-xs text-gray-400 font-mono">{c.number}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <button type="button" onClick={() => handleEditContact(c)} className="text-amber-500 hover:bg-amber-50 p-1 rounded"><Pencil size={14}/></button>
                                            <button type="button" onClick={() => handleDeleteContact(c.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Operating Banks */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mt-6">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Landmark size={20} className="text-teal-600"/> بانک‌های عامل (جهت بازرگانی)</h3>
                            <div className="flex gap-2 items-center mb-4">
                                <input className="flex-1 border rounded p-2 text-sm" value={newOperatingBank} onChange={e=>setNewOperatingBank(e.target.value)} placeholder="نام بانک..."/>
                                <button type="button" onClick={handleAddOperatingBank} className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-teal-700">افزودن</button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {settings.operatingBankNames?.map(b => (
                                    <div key={b} className="bg-teal-50 text-teal-800 px-3 py-1 rounded-full text-sm flex items-center gap-2 border border-teal-100">
                                        {b} <button type="button" onClick={() => handleRemoveOperatingBank(b)} className="hover:text-red-500"><X size={14}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Templates */}
                {activeCategory === 'templates' && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><LayoutTemplate size={20} className="text-teal-600"/> قالب‌های چاپ</h3>
                                <button type="button" onClick={() => setShowDesigner(true)} className="bg-teal-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-teal-700 shadow-lg shadow-teal-100">
                                    <Plus size={18}/> طراحی قالب جدید
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {settings.printTemplates?.map(t => (
                                    <div key={t.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all bg-white group relative">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-bold text-gray-800">{t.name}</div>
                                            <div className="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-500 uppercase">{t.pageSize}</div>
                                        </div>
                                        <div className="text-xs text-gray-500 mb-4">{t.fields.length} فیلد تعریف شده</div>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => handleEditTemplate(t)} className="flex-1 bg-blue-50 text-blue-600 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100">ویرایش</button>
                                            <button type="button" onClick={() => handleDeleteTemplate(t.id)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                ))}
                                {settings.printTemplates?.length === 0 && <div className="col-span-full text-center text-gray-400 py-10">هنوز قالبی طراحی نشده است.</div>}
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Permissions Editor */}
                {activeCategory === 'permissions' && (
                    <div className="animate-slide-up">
                        <RolePermissionsEditor settings={settings} onUpdateSettings={handleUpdateSettings}/>
                    </div>
                )}

                {/* Integrations */}
                {activeCategory === 'integrations' && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Send size={20} className="text-blue-500"/> تنظیمات تلگرام</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-500">توکن ربات</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.telegramBotToken} onChange={e=>setSettings({...settings, telegramBotToken:e.target.value})}/></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-500">آیدی عددی مدیر</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.telegramAdminId} onChange={e=>setSettings({...settings, telegramAdminId:e.target.value})}/></div>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Send size={20} className="text-blue-500"/> تنظیمات بله (Bale)</h3>
                            <div className="space-y-1"><label className="text-xs font-bold text-gray-500">توکن ربات بله</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.baleBotToken} onChange={e=>setSettings({...settings, baleBotToken:e.target.value})}/></div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Users size={20} className="text-blue-500"/> هوش مصنوعی</h3>
                            <div className="space-y-1"><label className="text-xs font-bold text-gray-500">کلید API جمنای (Gemini)</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.geminiApiKey} onChange={e=>setSettings({...settings, geminiApiKey:e.target.value})}/></div>
                        </div>
                    </div>
                )}
                
                {/* WhatsApp Status */}
                {activeCategory === 'whatsapp' && (
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm animate-slide-up">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2"><MessageCircle size={24} className="text-green-600"/> وضعیت واتساپ</h3>
                            <div className="flex gap-2">
                                <button type="button" onClick={handleFetchGroups} disabled={fetchingGroups} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 flex items-center gap-1">{fetchingGroups ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>} همگام‌سازی گروه‌ها</button>
                                <button type="button" onClick={checkWhatsappStatus} disabled={refreshingWA} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-bold hover:bg-gray-200">{refreshingWA ? '...' : 'بروزرسانی وضعیت'}</button>
                            </div>
                        </div>

                        {whatsappStatus ? (
                            whatsappStatus.ready ? (
                                <div className="flex flex-col items-center justify-center py-8 bg-green-50 rounded-xl border border-green-100">
                                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4"><Check size={32}/></div>
                                    <h4 className="text-lg font-black text-green-800">واتساپ متصل است</h4>
                                    <p className="text-sm text-green-600 mt-1">کاربر: {whatsappStatus.user}</p>
                                    <button type="button" onClick={handleWhatsappLogout} className="mt-6 text-xs text-red-500 hover:text-red-700 underline">خروج از حساب</button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    {whatsappStatus.qr ? (
                                        <div className="bg-white p-4 rounded-xl border-2 border-gray-200 shadow-inner">
                                            <QRCode value={whatsappStatus.qr} size={256} />
                                            <p className="text-center text-sm font-bold text-gray-500 mt-4">اسکن کنید تا متصل شوید</p>
                                        </div>
                                    ) : (
                                        <div className="text-center text-gray-500 py-10 flex flex-col items-center gap-2">
                                            <Loader2 size={32} className="animate-spin"/>
                                            <span>در حال دریافت QR Code...</span>
                                        </div>
                                    )}
                                </div>
                            )
                        ) : (
                            <div className="text-center text-gray-400 py-10">در حال بررسی وضعیت...</div>
                        )}
                        
                        <div className="mt-8 pt-6 border-t">
                            <label className="text-xs font-bold text-gray-500 block mb-1">شماره واتساپ پیش‌فرض (مدیر سیستم)</label>
                            <input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.whatsappNumber} onChange={e=>setSettings({...settings, whatsappNumber:e.target.value})} placeholder="98912..."/>
                        </div>
                    </div>
                )}

                {/* Commerce Settings */}
                {activeCategory === 'commerce' && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Container size={20} className="text-rose-500"/> تنظیمات بازرگانی</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-2">گروه‌های کالایی</label>
                                    <div className="flex gap-2 mb-2">
                                        <input className="flex-1 border rounded p-2 text-sm" value={newCommodity} onChange={e=>setNewCommodity(e.target.value)} placeholder="گروه جدید..."/>
                                        <button type="button" onClick={handleAddCommodity} className="bg-rose-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-rose-600">افزودن</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {settings.commodityGroups.map(c => (
                                            <div key={c} className="bg-rose-50 text-rose-800 px-3 py-1 rounded-full text-sm flex items-center gap-2 border border-rose-100">
                                                {c} <button type="button" onClick={()=>handleRemoveCommodity(c)} className="hover:text-red-600"><X size={14}/></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-2">شرکت‌های بیمه</label>
                                    <div className="flex gap-2 mb-2">
                                        <input className="flex-1 border rounded p-2 text-sm" value={newInsuranceCompany} onChange={e=>setNewInsuranceCompany(e.target.value)} placeholder="نام شرکت بیمه..."/>
                                        <button type="button" onClick={handleAddInsuranceCompany} className="bg-blue-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-600">افزودن</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {settings.insuranceCompanies?.map(c => (
                                            <div key={c} className="bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2 border border-blue-100">
                                                {c} <button type="button" onClick={()=>handleRemoveInsuranceCompany(c)} className="hover:text-red-600"><X size={14}/></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Floating Save Button */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex justify-end items-center gap-4 shadow-lg z-40 md:pl-72 safe-pb">
                    <span className="text-sm font-bold text-green-600">{message}</span>
                    <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-xl shadow-blue-200 flex items-center gap-2 disabled:opacity-70 transition-all">
                        {loading ? <Loader2 size={20} className="animate-spin"/> : <Save size={20}/>}
                        ذخیره تنظیمات
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};

export default Settings;
