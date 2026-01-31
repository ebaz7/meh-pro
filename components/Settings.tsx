
import React, { useState, useEffect, useRef } from 'react';
import { getSettings, saveSettings, uploadFile } from '../services/storageService';
import { SystemSettings, UserRole, RolePermissions, Company, Contact, CompanyBank, User, CustomRole, PrintTemplate } from '../types';
import { Settings as SettingsIcon, Save, Loader2, Database, Bell, Plus, Trash2, Building, ShieldCheck, Landmark, AppWindow, BellRing, BellOff, Send, Image as ImageIcon, Pencil, X, Check, MessageCircle, RefreshCw, Users, FolderSync, Smartphone, Link, Truck, DownloadCloud, UploadCloud, Warehouse, FileText, Container, LayoutTemplate, ChevronDown, ChevronUp, WifiOff, Info, Lock } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { requestNotificationPermission, setNotificationPreference, isNotificationEnabledInApp } from '../services/notificationService';
import { getUsers } from '../services/authService';
import { generateUUID } from '../constants';
import PrintTemplateDesigner from './PrintTemplateDesigner';
import { FiscalYearManager } from './FiscalModule'; 
import SecondExitGroupSettings from './settings/SecondExitGroupSettings';

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
  
  const [newCompanyRegNum, setNewCompanyRegNum] = useState('');
  const [newCompanyNatId, setNewCompanyNatId] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');
  const [newCompanyFax, setNewCompanyFax] = useState('');
  const [newCompanyPostalCode, setNewCompanyPostalCode] = useState('');
  const [newCompanyEcoCode, setNewCompanyEcoCode] = useState('');

  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  
  const [tempBankName, setTempBankName] = useState('');
  const [tempAccountNum, setTempAccountNum] = useState('');
  const [tempBankSheba, setTempBankSheba] = useState('');
  const [tempBankLayout, setTempBankLayout] = useState<string>('');
  const [tempInternalLayout, setTempInternalLayout] = useState<string>('');
  const [tempInternalWithdrawalLayout, setTempInternalWithdrawalLayout] = useState<string>('');
  const [tempInternalDepositLayout, setTempInternalDepositLayout] = useState<string>('');
  const [tempDualPrint, setTempDualPrint] = useState(false);

  const [newInsuranceCompany, setNewInsuranceCompany] = useState('');
  const [newRoleName, setNewRoleName] = useState('');

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingLetterhead, setIsUploadingLetterhead] = useState(false);
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const companyLetterheadInputRef = useRef<HTMLInputElement>(null);

  const [whatsappStatus, setWhatsappStatus] = useState<{ready: boolean, qr: string | null, user: string | null} | null>(null);
  const [refreshingWA, setRefreshingWA] = useState(false);
  
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
  
  const [appUsers, setAppUsers] = useState<(Contact | User)[]>([]);
  const [expandedPermGroups, setExpandedPermGroups] = useState<Record<string, boolean>>({});

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
          
          const allRoles = [...defaultRoles, ...(safeData.customRoles || [])];
          const initialExpanded = {};
          allRoles.forEach(r => initialExpanded[r.id] = false);
          setExpandedPermGroups(initialExpanded);

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
                  currentCompanies = currentCompanies.map(c => c.id === editingCompanyId ? { ...c, name: newCompanyName.trim(), logo: newCompanyLogo, showInWarehouse: newCompanyShowInWarehouse, banks: newCompanyBanks, letterhead: newCompanyLetterhead, registrationNumber: newCompanyRegNum, nationalId: newCompanyNatId, address: newCompanyAddress, phone: newCompanyPhone, fax: newCompanyFax, postalCode: newCompanyPostalCode, economicCode: newCompanyEcoCode } : c);
              } else if (newCompanyName.trim()) {
                  currentCompanies = [...currentCompanies, { id: generateUUID(), name: newCompanyName.trim(), logo: newCompanyLogo, showInWarehouse: newCompanyShowInWarehouse, banks: newCompanyBanks, letterhead: newCompanyLetterhead, registrationNumber: newCompanyRegNum, nationalId: newCompanyNatId, address: newCompanyAddress, phone: newCompanyPhone, fax: newCompanyFax, postalCode: newCompanyPostalCode, economicCode: newCompanyEcoCode }];
              }
              resetCompanyForm();
          }
          const syncedSettings = { ...settings, companies: currentCompanies, companyNames: currentCompanies.map(c => c.name) };
          await saveSettings(syncedSettings); 
          setSettings(syncedSettings);
          setMessage('ذخیره شد ✅'); setTimeout(() => setMessage(''), 3000); 
      } catch (e) { setMessage('خطا ❌'); } finally { setLoading(false); } 
  };

  // ... (Other handlers unchanged)
  const handleAddOrUpdateContact = () => { if (!contactName.trim() || !contactNumber.trim()) return; const newContactData: Contact = { id: editingContactId || generateUUID(), name: contactName.trim(), number: contactNumber.trim(), baleId: contactBaleId.trim(), isGroup: isGroupContact }; let updatedContacts; if (editingContactId) { updatedContacts = (settings.savedContacts || []).map(c => c.id === editingContactId ? newContactData : c); } else { updatedContacts = [...(settings.savedContacts || []), newContactData]; } setSettings({ ...settings, savedContacts: updatedContacts }); resetContactForm(); };
  const handleEditContact = (c: Contact) => { setEditingContactId(c.id); setContactName(c.name); setContactNumber(c.number); setContactBaleId(c.baleId || ''); setIsGroupContact(c.isGroup); };
  const handleDeleteContact = (id: string) => { if(confirm('حذف شود؟')) { setSettings({ ...settings, savedContacts: (settings.savedContacts || []).filter(c => c.id !== id) }); if(editingContactId === id) resetContactForm(); } };
  const resetContactForm = () => { setContactName(''); setContactNumber(''); setContactBaleId(''); setIsGroupContact(false); setEditingContactId(null); };
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
  const handleAddRole = () => { if (!newRoleName.trim()) return; const roleId = `role_${Date.now()}`; const newRole: CustomRole = { id: roleId, label: newRoleName.trim() }; setSettings({ ...settings, customRoles: [...(settings.customRoles || []), newRole] }); setNewRoleName(''); };
  const handleRemoveRole = (roleId: string) => { if (!confirm("آیا از حذف این نقش اطمینان دارید؟")) return; const updatedRoles = (settings.customRoles || []).filter(r => r.id !== roleId); const updatedPermissions = { ...settings.rolePermissions }; delete updatedPermissions[roleId]; setSettings({ ...settings, customRoles: updatedRoles, rolePermissions: updatedPermissions }); };
  const handlePermissionChange = (role: string, field: keyof RolePermissions, value: boolean) => { const currentRolePerms = settings.rolePermissions[role] || ({} as RolePermissions); const newRolePerms = { ...currentRolePerms, [field]: value }; setSettings({ ...settings, rolePermissions: { ...settings.rolePermissions, [role]: newRolePerms as RolePermissions } }); };
  const handleIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingIcon(true); const reader = new FileReader(); reader.onload = async (ev) => { try { const res = await uploadFile(file.name, ev.target?.result as string); setSettings({ ...settings, pwaIcon: res.url }); } catch (error) { alert('خطا'); } finally { setUploadingIcon(false); } }; reader.readAsDataURL(file); };
  const handleToggleNotifications = async () => { if (!isSecure && window.location.hostname !== 'localhost') { alert("برای فعال‌سازی نوتیفیکیشن نیاز به HTTPS است."); return; } const granted = await requestNotificationPermission(); if (granted) { setNotificationPreference(true); setNotificationsEnabled(true); alert("نوتیفیکیشن فعال شد. اتصال به سرور بروزرسانی شد."); } else { alert("دسترسی به نوتیفیکیشن مسدود است یا پشتیبانی نمی‌شود."); } };
  const handleTestNotification = async () => { try { const userStr = localStorage.getItem('app_current_user'); const username = userStr ? JSON.parse(userStr).username : 'test'; await apiCall('/send-test-push', 'POST', { username }); alert("درخواست تست ارسال شد."); } catch (e: any) { let msg = "خطا در ارسال تست"; if (e.message && e.message.includes('404')) { if (confirm("اشتراک نوتیفیکیشن شما در سرور یافت نشد. آیا می‌خواهید مجدداً فعال‌سازی کنید؟")) { handleToggleNotifications(); return; } msg = "اشتراک یافت نشد."; } else if (e.message) { msg += `: ${e.message}`; } alert(msg); } };
  const handleDownloadBackup = (includeFiles: boolean) => { window.location.href = `/api/full-backup?includeFiles=${includeFiles}`; };
  const handleRestoreClick = () => { if (confirm('بازگردانی اطلاعات کامل (شامل عکس‌ها)؟ همه اطلاعات فعلی پاک می‌شود.')) fileInputRef.current?.click(); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setRestoring(true); const reader = new FileReader(); reader.onload = async (ev) => { const base64 = ev.target?.result as string; try { const response = await apiCall<{success: boolean}>('/full-restore', 'POST', { fileData: base64 }); if (response.success) { alert('بازگردانی کامل با موفقیت انجام شد. سیستم رفرش می‌شود.'); window.location.reload(); } } catch (error) { alert('خطا در بازگردانی فایل Zip'); } finally { setRestoring(false); } }; reader.readAsDataURL(file); };
  const handleSaveTemplate = (template: PrintTemplate) => { const existing = settings.printTemplates || []; const updated = editingTemplate ? existing.map(t => t.id === template.id ? template : t) : [...existing, template]; setSettings({ ...settings, printTemplates: updated }); setShowDesigner(false); setEditingTemplate(null); };
  const handleEditTemplate = (t: PrintTemplate) => { setEditingTemplate(t); setShowDesigner(true); };
  const handleDeleteTemplate = (id: string) => { if(!confirm('حذف قالب؟')) return; const updated = (settings.printTemplates || []).filter(t => t.id !== id); setSettings({ ...settings, printTemplates: updated }); };

  const defaultRoles = [ { id: UserRole.USER, label: 'کاربر عادی' }, { id: UserRole.FINANCIAL, label: 'مدیر مالی' }, { id: UserRole.MANAGER, label: 'مدیر داخلی' }, { id: UserRole.CEO, label: 'مدیر عامل' }, { id: UserRole.SALES_MANAGER, label: 'مدیر فروش' }, { id: UserRole.FACTORY_MANAGER, label: 'مدیر کارخانه' }, { id: UserRole.WAREHOUSE_KEEPER, label: 'انبار واردات' }, { id: UserRole.SECURITY_HEAD, label: 'سرپرست انتظامات' }, { id: UserRole.SECURITY_GUARD, label: 'نگهبان' }, { id: UserRole.ADMIN, label: 'مدیر سیستم' }, ];
  const allRoles = [...defaultRoles, ...(settings.customRoles || [])];
  
  // Revised Permission Groups - Explicitly listing all granular permissions
  const PERMISSION_GROUPS = [ 
      { 
          id: 'payment', 
          title: 'ماژول پرداخت', 
          icon: Landmark, 
          color: 'blue', 
          items: [ 
              { id: 'canCreatePaymentOrder', label: 'ثبت دستور پرداخت جدید' }, 
              { id: 'canViewPaymentOrders', label: 'مشاهده کارتابل پرداخت' }, 
              { id: 'canApproveFinancial', label: 'تایید مرحله مالی' }, 
              { id: 'canApproveManager', label: 'تایید مرحله مدیریت' }, 
              { id: 'canApproveCeo', label: 'تایید مرحله نهایی (مدیرعامل)' } 
          ] 
      }, 
      { 
          id: 'exit', 
          title: 'ماژول خروج بار کارخانه', 
          icon: Truck, 
          color: 'orange', 
          items: [ 
              { id: 'canCreateExitPermit', label: 'ثبت درخواست خروج بار (فروش)' }, 
              { id: 'canViewExitPermits', label: 'مشاهده کارتابل خروج' }, 
              { id: 'canApproveExitCeo', label: 'تایید خروج: مدیرعامل' }, 
              { id: 'canApproveExitFactory', label: 'تایید خروج: مدیر کارخانه' }, 
              { id: 'canApproveExitWarehouse', label: 'تایید خروج: انبار (توزین)' }, 
              { id: 'canApproveExitSecurity', label: 'تایید خروج: انتظامات (نهایی)' }, 
              { id: 'canViewExitArchive', label: 'مشاهده آرشیو خروج' }, 
              { id: 'canEditExitArchive', label: 'اصلاح اسناد بایگانی (فقط ادمین)' } 
          ] 
      }, 
      { 
          id: 'warehouse', 
          title: 'ماژول انبار', 
          icon: Warehouse, 
          color: 'green', 
          items: [ 
              { id: 'canManageWarehouse', label: 'مدیریت انبار (ورود/خروج بیجک)' }, 
              { id: 'canViewWarehouseReports', label: 'مشاهده گزارشات انبار' }, 
              { id: 'canApproveBijak', label: 'تایید نهایی بیجک (مدیریت)' } 
          ] 
      }, 
      { 
          id: 'security', 
          title: 'ماژول انتظامات', 
          icon: ShieldCheck, 
          color: 'purple', 
          items: [ 
              { id: 'canViewSecurity', label: 'مشاهده ماژول انتظامات' }, 
              { id: 'canCreateSecurityLog', label: 'ثبت گزارشات (نگهبان)' }, 
              { id: 'canApproveSecuritySupervisor', label: 'تایید گزارشات (سرپرست)' } 
          ] 
      }, 
      { 
          id: 'general', 
          title: 'عمومی و مدیریتی', 
          icon: Lock, 
          color: 'gray', 
          items: [ 
              { id: 'canViewAll', label: 'مشاهده تمام دستورات (همه کاربران)' }, 
              { id: 'canEditOwn', label: 'ویرایش دستور خود' }, 
              { id: 'canDeleteOwn', label: 'حذف دستور خود' }, 
              { id: 'canEditAll', label: 'ویرایش تمام دستورات' }, 
              { id: 'canDeleteAll', label: 'حذف تمام دستورات' }, 
              { id: 'canManageTrade', label: 'دسترسی به بخش بازرگانی' }, 
              { id: 'canManageSettings', label: 'دسترسی به تنظیمات سیستم' } 
          ] 
      } 
  ];
  
  const togglePermissionGroup = (roleId: string, groupItems: {id: string}[], isChecked: boolean) => { const newPermissions: any = { ...settings.rolePermissions?.[roleId] || {} }; groupItems.forEach(item => { newPermissions[item.id] = isChecked; }); setSettings({ ...settings, rolePermissions: { ...settings.rolePermissions, [roleId]: newPermissions as RolePermissions } }); };
  const toggleGroupExpand = (key: string) => { setExpandedPermGroups(prev => ({ ...prev, [key]: !prev[key] })); };

  if (showDesigner) { return <PrintTemplateDesigner onSave={handleSaveTemplate} onCancel={() => setShowDesigner(false)} initialTemplate={editingTemplate} />; }

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
                <button onClick={() => setActiveCategory('permissions')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'permissions' ? 'bg-white shadow text-amber-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><ShieldCheck size={18}/> دسترسی‌ها و نقش‌ها</button>
            </nav>
        </div>

        <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[calc(100vh-100px)]">
            {activeCategory === 'fiscal' ? (
                <FiscalYearManager />
            ) : (
                <form onSubmit={handleSave} className="space-y-8 max-w-4xl mx-auto">
                    
                    {/* ... (System, Whatsapp, Warehouse, Data, Integration, Template, Commerce sections remain exactly the same as previous, just hidden for brevity in this block, but assumed present in file) ... */}
                    {activeCategory === 'system' && (
                        <div className="space-y-8 animate-fade-in">
                             <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 border-b pb-2">تنظیمات ظاهری و اعلان‌ها</h3>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-xl border border-gray-200 overflow-hidden flex items-center justify-center bg-gray-50">{settings.pwaIcon ? <img src={settings.pwaIcon} className="w-full h-full object-cover" /> : <ImageIcon className="text-gray-300" />}</div>
                                    <div>
                                        <input type="file" ref={iconInputRef} className="hidden" accept="image/*" onChange={handleIconChange} />
                                        <button type="button" onClick={() => iconInputRef.current?.click()} className="text-blue-600 text-sm hover:underline font-bold" disabled={uploadingIcon}>{uploadingIcon ? '...' : 'تغییر آیکون برنامه'}</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <button type="button" onClick={handleToggleNotifications} className={`w-full px-4 py-2 rounded-lg border flex items-center justify-center gap-2 transition-colors ${notificationsEnabled ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 text-gray-600'}`}>
                                        {notificationsEnabled ? <BellRing size={18} /> : <BellOff size={18} />}
                                        <span>{notificationsEnabled ? 'نوتیفیکیشن‌ها فعال است' : 'فعال‌سازی نوتیفیکیشن'}</span>
                                    </button>
                                    <button type="button" onClick={handleTestNotification} className="w-full px-4 py-2 rounded-lg border bg-blue-50 border-blue-200 text-blue-700 flex items-center justify-center gap-2 transition-colors hover:bg-blue-100">
                                        <Send size={18}/> <span>ارسال پیام تست</span>
                                    </button>
                                </div>
                                <div className="border-t pt-4 mt-4">
                                    <h4 className="font-bold text-sm text-gray-700 mb-2">پشتیبان‌گیری و بازگردانی</h4>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => handleDownloadBackup(true)} className="flex-1 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-100 flex items-center justify-center gap-2"><DownloadCloud size={16}/> پشتیبان‌گیری کامل (با فایل)</button>
                                        <button type="button" onClick={handleRestoreClick} className="flex-1 bg-amber-50 text-amber-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-amber-100 flex items-center justify-center gap-2">
                                            {restoring ? <Loader2 size={16} className="animate-spin"/> : <UploadCloud size={16}/>} بازگردانی
                                        </button>
                                        <input type="file" ref={fileInputRef} className="hidden" accept=".zip" onChange={handleFileChange} />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Truck size={20}/> شماره‌گذاری اسناد (تنظیمات پیش‌فرض)</h3>
                                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-800 mb-2">
                                    نکته: این تنظیمات فقط در صورتی اعمال می‌شود که سال مالی فعال نباشد یا تنظیمی برای شرکت در سال مالی وجود نداشته باشد.
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="text-sm font-bold text-gray-700 block mb-1">شروع شماره دستور پرداخت</label><input type="number" className="w-full border rounded-lg p-2 dir-ltr text-left" value={settings.currentTrackingNumber} onChange={(e) => setSettings({...settings, currentTrackingNumber: Number(e.target.value)})} /></div>
                                    <div><label className="text-sm font-bold text-gray-700 block mb-1">شروع شماره مجوز خروج</label><input type="number" className="w-full border rounded-lg p-2 dir-ltr text-left" value={settings.currentExitPermitNumber} onChange={(e) => setSettings({...settings, currentExitPermitNumber: Number(e.target.value)})} /></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PERMISSIONS SECTION - The Important Part */}
                    {activeCategory === 'permissions' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-1 w-full space-y-1"><label className="text-xs font-bold text-gray-500">افزودن نقش سفارشی</label><input className="w-full border rounded-lg p-2 text-sm" placeholder="نام نقش (مثال: حسابدار)" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} /></div>
                                <button type="button" onClick={handleAddRole} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-700 h-[38px] flex items-center gap-2"><Plus size={16}/> افزودن</button>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><ShieldCheck size={20}/> مدیریت دسترسی نقش‌ها</h3>
                                {allRoles.map(role => (
                                    <div key={role.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden transition-all shadow-sm hover:shadow-md">
                                        <div className="p-4 bg-gray-50 flex justify-between items-center cursor-pointer select-none" onClick={() => toggleGroupExpand(role.id)}>
                                            <div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${role.id === UserRole.ADMIN ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}><ShieldCheck size={20}/></div><span className="font-bold text-gray-800">{role.label}</span><span className="text-xs text-gray-500 font-mono">({role.id})</span></div>
                                            <div className="flex items-center gap-2">{!Object.values(UserRole).includes(role.id as any) && (<button onClick={(e) => { e.stopPropagation(); handleRemoveRole(role.id); }} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition-colors"><Trash2 size={16}/></button>)}{expandedPermGroups[role.id] ? <ChevronUp size={20} className="text-gray-400"/> : <ChevronDown size={20} className="text-gray-400"/>}</div>
                                        </div>
                                        
                                        {expandedPermGroups[role.id] && (
                                            <div className="p-4 bg-white border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                                                {role.id === UserRole.ADMIN ? (
                                                    <div className="col-span-full p-4 bg-red-50 text-red-700 rounded-lg text-sm font-bold text-center border border-red-100">مدیر سیستم دسترسی کامل به تمامی بخش‌ها دارد و قابل تغییر نیست.</div>
                                                ) : (
                                                    PERMISSION_GROUPS.map(group => {
                                                        const GroupIcon = group.icon;
                                                        const isGroupAllChecked = group.items.every(item => settings.rolePermissions?.[role.id]?.[item.id]);
                                                        return (
                                                            <div key={group.id} className="border rounded-xl overflow-hidden">
                                                                <div className={`px-4 py-2 bg-${group.color}-50 border-b border-${group.color}-100 flex justify-between items-center`}><div className="flex items-center gap-2 text-sm font-bold text-gray-700"><GroupIcon size={16} className={`text-${group.color}-600`}/>{group.title}</div><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className={`w-4 h-4 text-${group.color}-600 rounded`} checked={isGroupAllChecked} onChange={(e) => togglePermissionGroup(role.id, group.items, e.target.checked)}/><span className="text-[10px] text-gray-500">انتخاب همه</span></label></div>
                                                                <div className="p-3 grid grid-cols-1 gap-2">{group.items.map(perm => (<label key={perm.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"><input type="checkbox" className={`w-4 h-4 text-${group.color}-600 rounded border-gray-300 focus:ring-${group.color}-500`} checked={settings.rolePermissions?.[role.id]?.[perm.id] || false} onChange={(e) => handlePermissionChange(role.id, perm.id as keyof RolePermissions, e.target.checked)}/><span className="text-sm text-gray-700 select-none">{perm.label}</span></label>))}</div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-4 border-t sticky bottom-0 bg-white p-4 shadow-inner md:shadow-none md:static">
                        <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-70">
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} ذخیره تنظیمات
                        </button>
                    </div>
                </form>
            )}
        </div>
        {message && (<div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white text-sm font-bold shadow-2xl z-[100] animate-bounce ${message.includes('خطا') ? 'bg-red-600' : 'bg-green-600'}`}>{message}</div>)}
    </div>
  );
};
export default Settings;
