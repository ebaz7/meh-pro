
import React, { useState, useEffect, useRef } from 'react';
import { getSettings, saveSettings, restoreSystemData, uploadFile } from '../services/storageService';
import { SystemSettings, UserRole, RolePermissions, Company, Contact, CompanyBank, User, CustomRole, PrintTemplate } from '../types';
import { Settings as SettingsIcon, Save, Loader2, Database, Bell, Plus, Trash2, Building, ShieldCheck, Landmark, Package, AppWindow, BellRing, BellOff, Send, Image as ImageIcon, Pencil, X, Check, MessageCircle, Calendar, Phone, LogOut, RefreshCw, Users, FolderSync, BrainCircuit, Smartphone, Link, Truck, MessageSquare, DownloadCloud, UploadCloud, Warehouse, FileDigit, Briefcase, FileText, Container, Printer, LayoutTemplate, ChevronDown, ChevronRight, Lock, ChevronUp, WifiOff } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { requestNotificationPermission, setNotificationPreference, isNotificationEnabledInApp } from '../services/notificationService';
import { getUsers, updateUser } from '../services/authService';
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
  // ... (Component logic remains the same, only the QRCode usage inside is affected by the change above) ...
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
      baleBotToken: '', // Added
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
  // ... (rest of state variables) ...
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [restoring, setRestoring] = useState(false);
  
  // Designer State
  const [showDesigner, setShowDesigner] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PrintTemplate | null>(null);

  // ... (All other state variables maintained) ...
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
  
  // ... (Local states for adding/editing banks) ...
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

  // Custom Role Local State
  const [newRoleName, setNewRoleName] = useState('');

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingLetterhead, setIsUploadingLetterhead] = useState(false);
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const companyLetterheadInputRef = useRef<HTMLInputElement>(null);

  const [whatsappStatus, setWhatsappStatus] = useState<{ready: boolean, qr: string | null, user: string | null} | null>(null);
  const [refreshingWA, setRefreshingWA] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [isGroupContact, setIsGroupContact] = useState(false);
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
  
  // Collapsed state for permission groups
  const [expandedPermGroups, setExpandedPermGroups] = useState<Record<string, boolean>>({});

  // ... (useEffect, loadSettings, handlers maintained exactly as is) ...
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
          // ... (existing load logic) ...
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
                  isGroup: false
              }));
          setAppUsers(contacts);
      } catch (e) { console.error("Failed to load users"); }
  };

  // ... (All other handlers: checkWhatsappStatus, handleSave, etc. maintained) ...
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

  const handleAddContact = () => { if (!contactName.trim() || !contactNumber.trim()) return; const newContact: Contact = { id: generateUUID(), name: contactName.trim(), number: contactNumber.trim(), isGroup: isGroupContact }; setSettings({ ...settings, savedContacts: [...(settings.savedContacts || []), newContact] }); setContactName(''); setContactNumber(''); setIsGroupContact(false); };
  const handleDeleteContact = (id: string) => { setSettings({ ...settings, savedContacts: (settings.savedContacts || []).filter(c => c.id !== id) }); };
  
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setIsUploadingLogo(true); const reader = new FileReader(); reader.onload = async (ev) => { try { const result = await uploadFile(file.name, ev.target?.result as string); setNewCompanyLogo(result.url); } catch (error) { alert('خطا در آپلود'); } finally { setIsUploadingLogo(false); } }; reader.readAsDataURL(file); };
  const handleLetterheadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setIsUploadingLetterhead(true); const reader = new FileReader(); reader.onload = async (ev) => { try { const result = await uploadFile(file.name, ev.target?.result as string); setNewCompanyLetterhead(result.url); } catch (error) { alert('خطا در آپلود'); } finally { setIsUploadingLetterhead(false); } }; reader.readAsDataURL(file); };

  const handleSaveCompany = () => { 
      if (!newCompanyName.trim()) return; 
      let updatedCompanies = settings.companies || []; 
      const companyData = { 
          id: editingCompanyId || generateUUID(), 
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
      };

      if (editingCompanyId) {
          updatedCompanies = updatedCompanies.map(c => c.id === editingCompanyId ? companyData : c); 
      } else {
          updatedCompanies = [...updatedCompanies, companyData]; 
      }
      setSettings({ ...settings, companies: updatedCompanies, companyNames: updatedCompanies.map(c => c.name) }); 
      resetCompanyForm();
  };

  const handleEditCompany = (c: Company) => { 
      setNewCompanyName(c.name); 
      setNewCompanyLogo(c.logo || ''); 
      setNewCompanyShowInWarehouse(c.showInWarehouse !== false);
      setNewCompanyBanks(c.banks || []);
      setNewCompanyLetterhead(c.letterhead || '');
      setNewCompanyRegNum(c.registrationNumber || '');
      setNewCompanyNatId(c.nationalId || '');
      setNewCompanyAddress(c.address || '');
      setNewCompanyPhone(c.phone || '');
      setNewCompanyFax(c.fax || '');
      setNewCompanyPostalCode(c.postalCode || '');
      setNewCompanyEcoCode(c.economicCode || '');
      setEditingCompanyId(c.id); 
  };

  const resetCompanyForm = () => {
      setNewCompanyName(''); 
      setNewCompanyLogo(''); 
      setNewCompanyShowInWarehouse(true);
      setNewCompanyBanks([]);
      setNewCompanyLetterhead('');
      setNewCompanyRegNum('');
      setNewCompanyNatId('');
      setNewCompanyAddress('');
      setNewCompanyPhone('');
      setNewCompanyFax('');
      setNewCompanyPostalCode('');
      setNewCompanyEcoCode('');
      setEditingCompanyId(null); 
      
      resetBankForm();
  };

  const resetBankForm = () => {
      setTempBankName('');
      setTempAccountNum('');
      setTempBankSheba('');
      setTempBankLayout('');
      setTempInternalLayout('');
      setTempInternalWithdrawalLayout('');
      setTempInternalDepositLayout('');
      setTempDualPrint(false);
      setEditingBankId(null);
  };

  const handleRemoveCompany = (id: string) => { if(confirm("حذف؟")) { const updated = (settings.companies || []).filter(c => c.id !== id); setSettings({ ...settings, companies: updated, companyNames: updated.map(c => c.name) }); } };
  
  const addOrUpdateCompanyBank = () => {
      if (!tempBankName) return;
      const bankData: CompanyBank = { 
          id: editingBankId || generateUUID(), 
          bankName: tempBankName, 
          accountNumber: tempAccountNum,
          sheba: tempBankSheba,
          formLayoutId: tempBankLayout,
          internalTransferTemplateId: tempInternalLayout, // Keep for backward compat
          enableDualPrint: tempDualPrint,
          internalWithdrawalTemplateId: tempInternalWithdrawalLayout,
          internalDepositTemplateId: tempInternalDepositLayout
      };

      if (editingBankId) {
          setNewCompanyBanks(newCompanyBanks.map(b => b.id === editingBankId ? bankData : b));
      } else {
          setNewCompanyBanks([...newCompanyBanks, bankData]);
      }
      resetBankForm();
  };

  const editCompanyBank = (bank: CompanyBank) => {
      setTempBankName(bank.bankName);
      setTempAccountNum(bank.accountNumber);
      setTempBankSheba(bank.sheba || '');
      setTempBankLayout(bank.formLayoutId || '');
      setTempInternalLayout(bank.internalTransferTemplateId || '');
      setTempDualPrint(bank.enableDualPrint || false);
      setTempInternalWithdrawalLayout(bank.internalWithdrawalTemplateId || '');
      setTempInternalDepositLayout(bank.internalDepositTemplateId || '');
      setEditingBankId(bank.id);
  };

  const removeCompanyBank = (id: string) => {
      setNewCompanyBanks(newCompanyBanks.filter(b => b.id !== id));
      if (editingBankId === id) resetBankForm();
  };

  const handleAddOperatingBank = () => { if (newOperatingBank.trim() && !(settings.operatingBankNames || []).includes(newOperatingBank.trim())) { setSettings({ ...settings, operatingBankNames: [...(settings.operatingBankNames || []), newOperatingBank.trim()] }); setNewOperatingBank(''); } };
  const handleRemoveOperatingBank = (name: string) => { setSettings({ ...settings, operatingBankNames: (settings.operatingBankNames || []).filter(b => b !== name) }); };

  const handleAddCommodity = () => { if (newCommodity.trim() && !settings.commodityGroups.includes(newCommodity.trim())) { setSettings({ ...settings, commodityGroups: [...settings.commodityGroups, newCommodity.trim()] }); setNewCommodity(''); } };
  const handleRemoveCommodity = (name: string) => { setSettings({ ...settings, commodityGroups: settings.commodityGroups.filter(c => c !== name) }); };
  
  const handleAddInsuranceCompany = () => { if (newInsuranceCompany.trim() && !(settings.insuranceCompanies || []).includes(newInsuranceCompany.trim())) { setSettings({ ...settings, insuranceCompanies: [...(settings.insuranceCompanies || []), newInsuranceCompany.trim()] }); setNewInsuranceCompany(''); } };
  const handleRemoveInsuranceCompany = (name: string) => { setSettings({ ...settings, insuranceCompanies: (settings.insuranceCompanies || []).filter(c => c !== name) }); };

  const handleAddRole = () => {
      if (!newRoleName.trim()) return;
      const roleId = `role_${Date.now()}`;
      const newRole: CustomRole = { id: roleId, label: newRoleName.trim() };
      setSettings({
          ...settings,
          customRoles: [...(settings.customRoles || []), newRole]
      });
      setNewRoleName('');
  };

  const handleRemoveRole = (roleId: string) => {
      if (!confirm("آیا از حذف این نقش اطمینان دارید؟")) return;
      const updatedRoles = (settings.customRoles || []).filter(r => r.id !== roleId);
      const updatedPermissions = { ...settings.rolePermissions };
      delete updatedPermissions[roleId];
      
      setSettings({
          ...settings,
          customRoles: updatedRoles,
          rolePermissions: updatedPermissions
      });
  };

  const handlePermissionChange = (role: string, field: keyof RolePermissions, value: boolean) => {
      const currentRolePerms = settings.rolePermissions[role] || ({} as RolePermissions);
      const newRolePerms = { ...currentRolePerms, [field]: value };
      setSettings({ 
          ...settings, 
          rolePermissions: { 
              ...settings.rolePermissions, 
              [role]: newRolePerms as RolePermissions
          } 
      }); 
  };
  const handleIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingIcon(true); const reader = new FileReader(); reader.onload = async (ev) => { try { const res = await uploadFile(file.name, ev.target?.result as string); setSettings({ ...settings, pwaIcon: res.url }); } catch (error) { alert('خطا'); } finally { setUploadingIcon(false); } }; reader.readAsDataURL(file); };
  
  const handleToggleNotifications = async () => { 
      if (!isSecure && window.location.hostname !== 'localhost') { 
          alert("برای فعال‌سازی نوتیفیکیشن نیاز به HTTPS است."); 
          return; 
      }
      
      const granted = await requestNotificationPermission(); 
      if (granted) { 
          setNotificationPreference(true); 
          setNotificationsEnabled(true); 
          alert("نوتیفیکیشن فعال شد. اتصال به سرور بروزرسانی شد.");
      } else {
          alert("دسترسی به نوتیفیکیشن مسدود است یا پشتیبانی نمی‌شود.");
      }
  };

  const handleTestNotification = async () => {
      try {
          const userStr = localStorage.getItem('app_current_user');
          const username = userStr ? JSON.parse(userStr).username : 'test';
          await apiCall('/send-test-push', 'POST', { username });
          alert("درخواست تست ارسال شد.");
      } catch (e: any) {
          let msg = "خطا در ارسال تست";
          if (e.message && e.message.includes('404')) {
              if (confirm("اشتراک نوتیفیکیشن شما در سرور یافت نشد. آیا می‌خواهید مجدداً فعال‌سازی کنید؟")) {
                  handleToggleNotifications();
                  return;
              }
              msg = "اشتراک یافت نشد.";
          } else if (e.message) {
              msg += `: ${e.message}`;
          }
          alert(msg);
      }
  };

  const handleDownloadBackup = (includeFiles: boolean) => { 
      window.location.href = `/api/full-backup?includeFiles=${includeFiles}`; 
  };
  
  const handleRestoreClick = () => { if (confirm('بازگردانی اطلاعات کامل (شامل عکس‌ها)؟ همه اطلاعات فعلی پاک می‌شود.')) fileInputRef.current?.click(); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setRestoring(true); const reader = new FileReader(); reader.onload = async (ev) => { const base64 = ev.target?.result as string; try { const response = await apiCall<{success: boolean}>('/full-restore', 'POST', { fileData: base64 }); if (response.success) { alert('بازگردانی کامل با موفقیت انجام شد. سیستم رفرش می‌شود.'); window.location.reload(); } } catch (error) { alert('خطا در بازگردانی فایل Zip'); } finally { setRestoring(false); } }; reader.readAsDataURL(file); };

  const handleSaveTemplate = (template: PrintTemplate) => {
      const existing = settings.printTemplates || [];
      const updated = editingTemplate 
          ? existing.map(t => t.id === template.id ? template : t)
          : [...existing, template];
      
      setSettings({ ...settings, printTemplates: updated });
      setShowDesigner(false);
      setEditingTemplate(null);
  };

  const handleEditTemplate = (t: PrintTemplate) => {
      setEditingTemplate(t);
      setShowDesigner(true);
  };

  const handleDeleteTemplate = (id: string) => {
      if(!confirm('حذف قالب؟')) return;
      const updated = (settings.printTemplates || []).filter(t => t.id !== id);
      setSettings({ ...settings, printTemplates: updated });
  };

  const defaultRoles = [ 
      { id: UserRole.USER, label: 'کاربر عادی' }, 
      { id: UserRole.FINANCIAL, label: 'مدیر مالی' }, 
      { id: UserRole.MANAGER, label: 'مدیر داخلی' }, 
      { id: UserRole.CEO, label: 'مدیر عامل' }, 
      { id: UserRole.SALES_MANAGER, label: 'مدیر فروش' },
      { id: UserRole.FACTORY_MANAGER, label: 'مدیر کارخانه' },
      { id: UserRole.WAREHOUSE_KEEPER, label: 'انبار واردات' },
      { id: UserRole.SECURITY_HEAD, label: 'سرپرست انتظامات' },
      { id: UserRole.SECURITY_GUARD, label: 'نگهبان' },
      { id: UserRole.ADMIN, label: 'مدیر سیستم' }, 
  ];

  const allRoles = [...defaultRoles, ...(settings.customRoles || [])];
  
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
          title: 'ماژول خروج کارخانه',
          icon: Truck,
          color: 'orange',
          items: [
              { id: 'canCreateExitPermit', label: 'ثبت درخواست خروج بار' },
              { id: 'canViewExitPermits', label: 'مشاهده کارتابل خروج' },
              { id: 'canApproveExitCeo', label: 'تایید خروج (مدیرعامل)' },
              { id: 'canApproveExitFactory', label: 'تایید خروج (مدیر کارخانه)' },
              { id: 'canApproveExitWarehouse', label: 'تایید خروج (سرپرست انبار)' },
              { id: 'canApproveExitSecurity', label: 'تایید خروج (انتظامات - نهایی)' }, 
              { id: 'canViewExitArchive', label: 'مشاهده بایگانی خروج' },
              { id: 'canEditExitArchive', label: 'اصلاح اسناد بایگانی (Admin)' }
          ]
      },
      {
          id: 'warehouse',
          title: 'ماژول انبار',
          icon: Warehouse,
          color: 'green',
          items: [
              { id: 'canManageWarehouse', label: 'مدیریت انبار (ورود/خروج)' },
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

  const togglePermissionGroup = (roleId: string, groupItems: {id: string}[], isChecked: boolean) => {
      const newPermissions: any = { ...settings.rolePermissions?.[roleId] || {} };
      groupItems.forEach(item => {
          newPermissions[item.id] = isChecked;
      });
      setSettings({
          ...settings,
          rolePermissions: { ...settings.rolePermissions, [roleId]: newPermissions as RolePermissions }
      });
  };

  const getMergedContactOptions = () => {
      return [...(settings.savedContacts || []), ...appUsers as Contact[]];
  };

  const toggleGroupExpand = (key: string) => {
      setExpandedPermGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (showDesigner) {
      return <PrintTemplateDesigner onSave={handleSaveTemplate} onCancel={() => setShowDesigner(false)} initialTemplate={editingTemplate} />;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[600px] mb-20 animate-fade-in">
        
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
                            </div>
                            {/* ... (Existing System Settings sections like Document Numbering etc) ... */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Truck size={20}/> شماره‌گذاری اسناد (تنظیمات پیش‌فرض)</h3>
                                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-800 mb-2">
                                    نکته: این تنظیمات فقط در صورتی اعمال می‌شود که سال مالی فعال نباشد یا تنظیمی برای شرکت در سال مالی وجود نداشته باشد. برای تنظیم دقیق شماره‌ها بر اساس سال و شرکت، از تب «مدیریت سال مالی» استفاده کنید.
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="text-sm font-bold text-gray-700 block mb-1">شروع شماره دستور پرداخت</label><input type="number" className="w-full border rounded-lg p-2 dir-ltr text-left" value={settings.currentTrackingNumber} onChange={(e) => setSettings({...settings, currentTrackingNumber: Number(e.target.value)})} /></div>
                                    <div><label className="text-sm font-bold text-gray-700 block mb-1">شروع شماره مجوز خروج</label><input type="number" className="w-full border rounded-lg p-2 dir-ltr text-left" value={settings.currentExitPermitNumber} onChange={(e) => setSettings({...settings, currentExitPermitNumber: Number(e.target.value)})} /></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* WHATSAPP & MESSENGERS TAB */}
                    {activeCategory === 'whatsapp' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex justify-between items-center border-b pb-2">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><MessageCircle size={20}/> مدیریت پیام‌رسان‌ها (واتساپ و بله)</h3>
                                <div className="flex gap-2">
                                    <button type="button" onClick={handleFetchGroups} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-indigo-100">
                                        {fetchingGroups ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>} بروزرسانی گروه‌ها
                                    </button>
                                </div>
                            </div>

                            {/* WhatsApp Status Box (Existing) */}
                            <div className={`bg-${whatsappStatus?.ready ? 'green' : 'amber'}-50 border border-${whatsappStatus?.ready ? 'green' : 'amber'}-200 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6`}>
                                {refreshingWA ? (
                                    <div className="flex flex-col items-center gap-2 text-gray-500"><Loader2 size={32} className="animate-spin"/><span className="text-sm">در حال بررسی وضعیت...</span></div>
                                ) : whatsappStatus?.ready ? (
                                    <>
                                        <div className="bg-green-100 p-4 rounded-full text-green-600"><Check size={32}/></div>
                                        <div className="flex-1 text-center md:text-right">
                                            <h3 className="font-bold text-lg text-green-800 mb-1">واتساپ متصل است</h3>
                                            <p className="text-sm text-green-700">شماره متصل: {whatsappStatus.user ? `+${whatsappStatus.user}` : 'ناشناس'}</p>
                                        </div>
                                        <button type="button" onClick={handleWhatsappLogout} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors">خروج از حساب</button>
                                    </>
                                ) : (
                                    <>
                                        <div className="bg-white p-2 rounded-lg border shadow-sm">
                                            {whatsappStatus?.qr ? <QRCode value={whatsappStatus.qr} size={160} /> : <div className="w-40 h-40 flex items-center justify-center text-gray-400 text-xs">در حال دریافت QR...</div>}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-lg text-amber-800 mb-2">اتصال به واتساپ</h3>
                                            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                                                <li>واتساپ را در گوشی خود باز کنید</li>
                                                <li>به تنظیمات و سپس Linked Devices بروید</li>
                                                <li>دکمه Link a Device را بزنید</li>
                                                <li>کد QR روبرو را اسکن کنید</li>
                                            </ol>
                                            <button type="button" onClick={checkWhatsappStatus} className="mt-4 text-blue-600 text-xs font-bold hover:underline">بروزرسانی وضعیت</button>
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            {/* NEW: Bale Integration Box */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mt-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                                    <Send size={20} className="text-blue-500"/>
                                    اتصال به پیام‌رسان بله (Bale)
                                </h3>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">توکن ربات بله (Bot Token)</label>
                                    <input 
                                        type="password" 
                                        className="w-full border rounded-lg p-2 dir-ltr text-left font-mono text-sm" 
                                        placeholder="123456:ABC-DEF..." 
                                        value={settings.baleBotToken || ''} 
                                        onChange={(e) => setSettings({...settings, baleBotToken: e.target.value})} 
                                    />
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        برای استفاده از ارسال خودکار در بله:
                                        <br/>1. یک ربات در بله بسازید (@BotFather).
                                        <br/>2. توکن ربات را در اینجا وارد کنید.
                                        <br/>3. کاربران باید ربات را Start کنند و آیدی عددی خود را در پروفایل کاربری وارد نمایند.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 border-b pb-2">دفترچه تلفن هوشمند (گروه‌ها و اشخاص)</h3>
                                <div className="flex gap-2 items-end bg-gray-50 p-3 rounded-lg border border-gray-200 flex-wrap">
                                    <div className="flex-1 min-w-[150px] space-y-1"><label className="text-xs text-gray-500">نام مخاطب / گروه</label><input className="w-full border rounded-lg p-2 text-sm" placeholder="نام..." value={contactName} onChange={(e) => setContactName(e.target.value)} /></div>
                                    <div className="flex-1 min-w-[150px] space-y-1"><label className="text-xs text-gray-500">شماره / شناسه گروه</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr text-left" placeholder="98912..." value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} /></div>
                                    <div className="flex items-center gap-2 mb-2"><input type="checkbox" checked={isGroupContact} onChange={e => setIsGroupContact(e.target.checked)} className="w-4 h-4 text-blue-600"/><span className="text-sm">گروه است؟</span></div>
                                    <button type="button" onClick={handleAddContact} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 h-[38px]"><Plus size={20} /></button>
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {settings.savedContacts?.map(c => (
                                        <div key={c.id} className="flex justify-between items-center p-3 bg-white border rounded-lg hover:bg-gray-50">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${c.isGroup ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>{c.isGroup ? <Users size={16} /> : <Smartphone size={16} />}</div>
                                                <div><div className="font-bold text-sm text-gray-800">{c.name}</div><div className="text-xs text-gray-500 font-mono">{c.number}</div></div>
                                            </div>
                                            <button type="button" onClick={() => handleDeleteContact(c.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                                        </div>
                                    ))}
                                    {(!settings.savedContacts || settings.savedContacts.length === 0) && <div className="text-center text-gray-400 py-4 text-sm">مخاطبی ثبت نشده است.</div>}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* ... (Rest of tabs remain same) ... */}
                    {/* TEMPLATES TAB, PERMISSIONS TAB, etc. */}
                    {/* DATA TAB - Make sure to render if active */}
                    {activeCategory === 'data' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="space-y-4">
                            <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Building size={20}/> مدیریت شرکت‌ها و بانک‌ها</h3>
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                {/* ... Company editing UI ... */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div><label className="text-xs font-bold block mb-1 text-gray-500">نام شرکت</label><input type="text" className="w-full border rounded-lg p-2 text-sm" placeholder="نام شرکت..." value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} /></div>
                                    <div className="flex items-end gap-2">
                                        <div className="w-10 h-10 border rounded bg-white flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => companyLogoInputRef.current?.click()} title="لوگو">{newCompanyLogo ? <img src={newCompanyLogo} className="w-full h-full object-cover"/> : <ImageIcon size={16} className="text-gray-300"/>}</div>
                                        <div className={`flex items-center gap-2 bg-white px-2 py-2 rounded border cursor-pointer flex-1 h-[42px] ${newCompanyShowInWarehouse ? 'border-green-200 bg-green-50 text-green-700' : ''}`} onClick={() => setNewCompanyShowInWarehouse(!newCompanyShowInWarehouse)}><input type="checkbox" checked={newCompanyShowInWarehouse} onChange={e => setNewCompanyShowInWarehouse(e.target.checked)} className="w-4 h-4"/><span className="text-xs font-bold select-none">نمایش در انبار</span></div>
                                        <input type="file" ref={companyLogoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload}/>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div><label className="text-xs font-bold block mb-1 text-gray-500">شماره ثبت</label><input className="w-full border rounded-lg p-2 text-sm" value={newCompanyRegNum} onChange={e => setNewCompanyRegNum(e.target.value)} /></div>
                                    <div><label className="text-xs font-bold block mb-1 text-gray-500">شناسه ملی</label><input className="w-full border rounded-lg p-2 text-sm" value={newCompanyNatId} onChange={e => setNewCompanyNatId(e.target.value)} /></div>
                                    <div><label className="text-xs font-bold block mb-1 text-gray-500">کد اقتصادی</label><input className="w-full border rounded-lg p-2 text-sm" value={newCompanyEcoCode} onChange={e => setNewCompanyEcoCode(e.target.value)} /></div>
                                    <div className="md:col-span-3"><label className="text-xs font-bold block mb-1 text-gray-500">آدرس</label><input className="w-full border rounded-lg p-2 text-sm" value={newCompanyAddress} onChange={e => setNewCompanyAddress(e.target.value)} /></div>
                                    <div><label className="text-xs font-bold block mb-1 text-gray-500">کد پستی</label><input className="w-full border rounded-lg p-2 text-sm" value={newCompanyPostalCode} onChange={e => setNewCompanyPostalCode(e.target.value)} /></div>
                                    <div><label className="text-xs font-bold block mb-1 text-gray-500">تلفن</label><input className="w-full border rounded-lg p-2 text-sm" value={newCompanyPhone} onChange={e => setNewCompanyPhone(e.target.value)} /></div>
                                    <div><label className="text-xs font-bold block mb-1 text-gray-500">فکس</label><input className="w-full border rounded-lg p-2 text-sm" value={newCompanyFax} onChange={e => setNewCompanyFax(e.target.value)} /></div>
                                </div>
                                <div className="bg-white border rounded-xl p-3 mb-4">
                                    <label className="text-xs font-bold block mb-2 text-blue-600 flex items-center gap-1"><Landmark size={14}/> تعریف بانک‌های این شرکت</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2 items-end">
                                        <input className="border rounded p-1.5 text-sm" placeholder="نام بانک" value={tempBankName} onChange={e => setTempBankName(e.target.value)} />
                                        <input className="border rounded p-1.5 text-sm dir-ltr text-left" placeholder="شماره حساب" value={tempAccountNum} onChange={e => setTempAccountNum(e.target.value)} />
                                        <select className="border rounded p-1.5 text-xs" value={tempBankLayout} onChange={e => setTempBankLayout(e.target.value)}>
                                            <option value="">قالب پیش‌فرض (چک)</option>
                                            {settings.printTemplates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                        <select className="border rounded p-1.5 text-xs" value={tempInternalLayout} onChange={e => setTempInternalLayout(e.target.value)}>
                                            <option value="">قالب حواله داخلی</option>
                                            {settings.printTemplates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                                        <input className="border rounded p-1.5 text-sm dir-ltr text-left" placeholder="شماره شبا (بدون IR)" value={tempBankSheba} onChange={e => setTempBankSheba(e.target.value)} />
                                        <label className="flex items-center gap-2 text-xs cursor-pointer border rounded p-1.5 bg-gray-50">
                                            <input type="checkbox" checked={tempDualPrint} onChange={e => setTempDualPrint(e.target.checked)} className="w-4 h-4 text-blue-600 rounded"/>
                                            چاپ دوگانه حواله (برداشت/واریز جدا)
                                        </label>
                                    </div>
                                    {tempDualPrint && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2 animate-fade-in">
                                            <select className="border rounded p-1.5 text-xs bg-red-50" value={tempInternalWithdrawalLayout} onChange={e => setTempInternalWithdrawalLayout(e.target.value)}>
                                                <option value="">قالب برداشت (Bardasht)</option>
                                                {settings.printTemplates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                            </select>
                                            <select className="border rounded p-1.5 text-xs bg-green-50" value={tempInternalDepositLayout} onChange={e => setTempInternalDepositLayout(e.target.value)}>
                                                <option value="">قالب واریز (Variz)</option>
                                                {settings.printTemplates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <button type="button" onClick={addOrUpdateCompanyBank} className="w-full bg-blue-600 text-white p-1.5 px-4 rounded-lg border border-blue-600 hover:bg-blue-700 flex items-center justify-center gap-1 font-bold text-xs mt-2">{editingBankId ? <Pencil size={16}/> : <Plus size={16}/>} {editingBankId ? 'بروزرسانی بانک' : 'افزودن بانک'}</button>
                                    <div className="space-y-1 mt-2">
                                        {newCompanyBanks.map((bank, idx) => (
                                            <div key={bank.id || idx} className={`flex justify-between items-center px-2 py-1.5 rounded text-xs border ${editingBankId === bank.id ? 'bg-blue-50 border-blue-300' : 'bg-gray-50'}`}>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold">{bank.bankName}</span>
                                                    <span className="font-mono text-gray-500">{bank.accountNumber}</span>
                                                    {bank.formLayoutId && <span className="text-[9px] text-blue-600">قالب چک: {settings.printTemplates?.find(t=>t.id===bank.formLayoutId)?.name}</span>}
                                                </div>
                                                <div className="flex gap-1"><button type="button" onClick={() => editCompanyBank(bank)} className="text-blue-500"><Pencil size={14}/></button><button type="button" onClick={() => removeCompanyBank(bank.id)} className="text-red-400"><X size={14}/></button></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <button type="button" onClick={handleSaveCompany} className={`w-full text-white px-4 py-2 rounded-lg text-sm h-10 font-bold shadow-sm ${editingCompanyId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{editingCompanyId ? 'ذخیره تغییرات شرکت' : 'افزودن شرکت'}</button>
                                <div className="space-y-2 mt-6 max-h-64 overflow-y-auto border-t pt-4">
                                    {settings.companies?.map(c => (
                                        <div key={c.id} className="flex flex-col bg-white p-3 rounded border shadow-sm gap-2">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">{c.logo && <img src={c.logo} className="w-6 h-6 object-contain"/>}<span className="text-sm font-bold">{c.name}</span></div>
                                                <div className="flex gap-1"><button type="button" onClick={() => handleEditCompany(c)} className="text-blue-500 p-1 hover:bg-blue-50 rounded"><Pencil size={14}/></button><button type="button" onClick={() => handleRemoveCompany(c.id)} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 size={14}/></button></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            </div>
                        </div>
                    )}
                    
                    {/* INTEGRATIONS TAB - Render */}
                    {activeCategory === 'integrations' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><BrainCircuit size={20}/> تنظیمات هوش مصنوعی و ربات‌ها</h3>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">کلید API جمینای (Google Gemini)</label>
                                    <input type="password" className="w-full border rounded-lg p-2 dir-ltr text-left" placeholder="API Key..." value={settings.geminiApiKey} onChange={(e) => setSettings({...settings, geminiApiKey: e.target.value})} />
                                    <p className="text-xs text-gray-500">برای استفاده از تحلیل هوشمند و ربات واتساپ</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="text-sm font-bold text-gray-700 block mb-1">توکن ربات تلگرام</label><input type="password" className="w-full border rounded-lg p-2 dir-ltr text-left" value={settings.telegramBotToken} onChange={(e) => setSettings({...settings, telegramBotToken: e.target.value})} /></div>
                                    <div><label className="text-sm font-bold text-gray-700 block mb-1">آیدی عددی مدیر (تلگرام)</label><input className="w-full border rounded-lg p-2 dir-ltr text-left" value={settings.telegramAdminId} onChange={(e) => setSettings({...settings, telegramAdminId: e.target.value})} /></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ... (Other Tabs like WAREHOUSE, COMMERCE, TEMPLATES, PERMISSIONS preserved) ... */}
                    {activeCategory === 'warehouse' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                                <h3 className="font-bold text-orange-800 mb-3 flex items-center gap-2"><Truck size={20}/> تنظیمات خروج کارخانه</h3>
                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1">شماره موبایل سرپرست انبار (جهت مجوز خروج)</label>
                                    <select 
                                        className="w-full border rounded-lg p-2 text-sm bg-white" 
                                        value={settings.exitPermitNotificationGroup || ''} 
                                        onChange={e => setSettings({...settings, exitPermitNotificationGroup: e.target.value})}
                                    >
                                        <option value="">-- ارسال نشود --</option>
                                        {getMergedContactOptions().map(c => (
                                            <option key={`exit_group_${c.number}`} value={c.number}>
                                                {c.name} {c.isGroup ? '(گروه)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-gray-500 mt-1">پس از تایید مجوز خروج توسط مدیرعامل، تصویر مجوز به این شخص/گروه (سرپرست انبار) ارسال خواهد شد.</p>
                                </div>
                                
                                <SecondExitGroupSettings 
                                    settings={settings} 
                                    setSettings={setSettings} 
                                    contacts={getMergedContactOptions()} 
                                />
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Warehouse size={20}/> تنظیمات انبار و ارسال خودکار</h3>
                                <div className="space-y-6">
                                    {settings.companies?.filter(c => c.showInWarehouse !== false).map(company => (
                                        <div key={company.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                            <h4 className="font-bold text-base text-gray-800 mb-3 border-b pb-2 flex justify-between"><span>شرکت: {company.name}</span>{company.logo && <img src={company.logo} className="h-6 object-contain"/>}</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div><label className="text-xs font-bold text-blue-700 block mb-1">مدیر فروش (جهت ارسال با قیمت)</label><select className="w-full border rounded-lg p-2 text-sm bg-white" value={settings.companyNotifications?.[company.name]?.salesManager || ''} onChange={e => setSettings({...settings, companyNotifications: {...settings.companyNotifications, [company.name]: { ...settings.companyNotifications?.[company.name], salesManager: e.target.value }}})}><option value="">-- ارسال نشود --</option>{getMergedContactOptions().map(c => (<option key={`${company.id}_sm_${c.number}`} value={c.number}>{c.name} {c.isGroup ? '(گروه)' : ''}</option>))}</select></div>
                                                <div><label className="text-xs font-bold text-orange-700 block mb-1">گروه انبار (جهت ارسال بدون قیمت)</label><select className="w-full border rounded-lg p-2 text-sm bg-white" value={settings.companyNotifications?.[company.name]?.warehouseGroup || ''} onChange={e => setSettings({...settings, companyNotifications: {...settings.companyNotifications, [company.name]: { ...settings.companyNotifications?.[company.name], warehouseGroup: e.target.value }}})}><option value="">-- ارسال نشود --</option>{getMergedContactOptions().map(c => (<option key={`${company.id}_wg_${c.number}`} value={c.number}>{c.name} {c.isGroup ? '(گروه)' : ''}</option>))}</select></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeCategory === 'commerce' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="space-y-2">
                                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2"><ShieldCheck size={18}/> شرکت‌های بیمه</h3>
                                <p className="text-xs text-gray-500 mb-2">لیست شرکت‌های بیمه جهت انتخاب در پرونده‌های بازرگانی</p>
                                <div className="flex gap-2"><input className="flex-1 border rounded-lg p-2 text-sm" placeholder="نام شرکت بیمه..." value={newInsuranceCompany} onChange={(e) => setNewInsuranceCompany(e.target.value)} /><button type="button" onClick={handleAddInsuranceCompany} className="bg-rose-600 text-white p-2 rounded-lg"><Plus size={18} /></button></div>
                                <div className="flex flex-wrap gap-2">{(settings.insuranceCompanies || []).map((comp, idx) => (<div key={idx} className="bg-rose-50 text-rose-700 px-2 py-1 rounded text-xs flex items-center gap-1 border border-rose-100"><span>{comp}</span><button type="button" onClick={() => handleRemoveInsuranceCompany(comp)} className="hover:text-red-500"><X size={12} /></button></div>))}</div>
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2"><Landmark size={18}/> بانک‌های عامل</h3>
                                <div className="flex gap-2"><input className="flex-1 border rounded-lg p-2 text-sm" placeholder="نام بانک..." value={newOperatingBank} onChange={(e) => setNewOperatingBank(e.target.value)} /><button type="button" onClick={handleAddOperatingBank} className="bg-indigo-600 text-white p-2 rounded-lg"><Plus size={18} /></button></div>
                                <div className="flex flex-wrap gap-2">{(settings.operatingBankNames || []).map((bank, idx) => (<div key={idx} className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs flex items-center gap-1 border border-indigo-100"><span>{bank}</span><button type="button" onClick={() => handleRemoveOperatingBank(bank)} className="hover:text-red-500"><X size={12} /></button></div>))}</div>
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2"><Container size={18}/> گروه‌های کالایی</h3>
                                <div className="flex gap-2"><input className="flex-1 border rounded-lg p-2 text-sm" placeholder="نام گروه..." value={newCommodity} onChange={(e) => setNewCommodity(e.target.value)} /><button type="button" onClick={handleAddCommodity} className="bg-teal-600 text-white p-2 rounded-lg"><Plus size={18} /></button></div>
                                <div className="flex flex-wrap gap-2">{(settings.commodityGroups || []).map((grp, idx) => (<div key={idx} className="bg-teal-50 text-teal-700 px-2 py-1 rounded text-xs flex items-center gap-1 border border-teal-100"><span>{grp}</span><button type="button" onClick={() => handleRemoveCommodity(grp)} className="hover:text-red-500"><X size={12} /></button></div>))}</div>
                            </div>
                        </div>
                    )}
                    
                    {activeCategory === 'templates' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex justify-between items-center border-b pb-2">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><LayoutTemplate size={20}/> مدیریت قالب‌های چاپ (فرم بانکی)</h3>
                                <button type="button" onClick={() => { setEditingTemplate(null); setShowDesigner(true); }} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-teal-700 shadow"><Plus size={18}/> طراحی قالب جدید</button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {settings.printTemplates?.map(t => (
                                    <div key={t.id} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                                        <div className="font-bold text-gray-800 mb-2">{t.name}</div>
                                        <div className="text-xs text-gray-500 mb-4">{t.fields.length} فیلد تعریف شده</div>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => handleEditTemplate(t)} className="flex-1 bg-blue-50 text-blue-600 py-1.5 rounded text-xs font-bold hover:bg-blue-100 flex items-center justify-center gap-1"><Pencil size={14}/> ویرایش</button>
                                            <button type="button" onClick={() => handleDeleteTemplate(t.id)} className="px-3 bg-red-50 text-red-500 py-1.5 rounded text-xs font-bold hover:bg-red-100 flex items-center justify-center gap-1"><Trash2 size={14}/></button>
                                        </div>
                                        <div className="absolute top-2 left-2 opacity-10">
                                            <Printer size={48} />
                                        </div>
                                    </div>
                                ))}
                                {(!settings.printTemplates || settings.printTemplates.length === 0) && (
                                    <div className="col-span-full text-center py-10 text-gray-400 border-2 border-dashed rounded-xl">
                                        هنوز قالبی تعریف نشده است.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {activeCategory === 'permissions' && (
                        <div className="space-y-8 animate-fade-in">
                            {/* ... Permission UI (kept same) ... */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-1 w-full space-y-1">
                                    <label className="text-xs font-bold text-gray-500">افزودن نقش سفارشی</label>
                                    <input className="w-full border rounded-lg p-2 text-sm" placeholder="نام نقش (مثال: حسابدار)" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} />
                                </div>
                                <button type="button" onClick={handleAddRole} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-700 h-[38px] flex items-center gap-2"><Plus size={16}/> افزودن</button>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><ShieldCheck size={20}/> مدیریت دسترسی نقش‌ها</h3>
                                {allRoles.map(role => (
                                    <div key={role.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden transition-all shadow-sm hover:shadow-md">
                                        <div 
                                            className="p-4 bg-gray-50 flex justify-between items-center cursor-pointer select-none"
                                            onClick={() => toggleGroupExpand(role.id)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${role.id === UserRole.ADMIN ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                    <ShieldCheck size={20}/>
                                                </div>
                                                <span className="font-bold text-gray-800">{role.label}</span>
                                                <span className="text-xs text-gray-500 font-mono">({role.id})</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {!Object.values(UserRole).includes(role.id as any) && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleRemoveRole(role.id); }}
                                                        className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition-colors"
                                                    >
                                                        <Trash2 size={16}/>
                                                    </button>
                                                )}
                                                {expandedPermGroups[role.id] ? <ChevronUp size={20} className="text-gray-400"/> : <ChevronDown size={20} className="text-gray-400"/>}
                                            </div>
                                        </div>
                                        
                                        {expandedPermGroups[role.id] && (
                                            <div className="p-4 bg-white border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                                                {role.id === UserRole.ADMIN ? (
                                                    <div className="col-span-full p-4 bg-red-50 text-red-700 rounded-lg text-sm font-bold text-center border border-red-100">
                                                        مدیر سیستم دسترسی کامل به تمامی بخش‌ها دارد و قابل تغییر نیست.
                                                    </div>
                                                ) : (
                                                    PERMISSION_GROUPS.map(group => {
                                                        const GroupIcon = group.icon;
                                                        const isGroupAllChecked = group.items.every(item => settings.rolePermissions?.[role.id]?.[item.id]);

                                                        return (
                                                            <div key={group.id} className="border rounded-xl overflow-hidden">
                                                                <div className={`px-4 py-2 bg-${group.color}-50 border-b border-${group.color}-100 flex justify-between items-center`}>
                                                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                                                        <GroupIcon size={16} className={`text-${group.color}-600`}/>
                                                                        {group.title}
                                                                    </div>
                                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                                        <input 
                                                                            type="checkbox" 
                                                                            className={`w-4 h-4 text-${group.color}-600 rounded`}
                                                                            checked={isGroupAllChecked}
                                                                            onChange={(e) => togglePermissionGroup(role.id, group.items, e.target.checked)}
                                                                        />
                                                                        <span className="text-[10px] text-gray-500">انتخاب همه</span>
                                                                    </label>
                                                                </div>
                                                                <div className="p-3 grid grid-cols-1 gap-2">
                                                                    {group.items.map(perm => (
                                                                        <label key={perm.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors">
                                                                            <input 
                                                                                type="checkbox" 
                                                                                className={`w-4 h-4 text-${group.color}-600 rounded border-gray-300 focus:ring-${group.color}-500`}
                                                                                checked={settings.rolePermissions?.[role.id]?.[perm.id] || false}
                                                                                onChange={(e) => handlePermissionChange(role.id, perm.id as keyof RolePermissions, e.target.checked)}
                                                                            />
                                                                            <span className="text-sm text-gray-700 select-none">{perm.label}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
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
