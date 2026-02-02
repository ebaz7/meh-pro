
import React, { useState, useEffect, useRef } from 'react';
import { getSettings, saveSettings, uploadFile } from '../services/storageService';
import { SystemSettings, Company, Contact, CompanyBank, User, PrintTemplate } from '../types';
import { Settings as SettingsIcon, Save, Loader2, Database, Bell, Plus, Trash2, Building, ShieldCheck, Landmark, AppWindow, BellRing, BellOff, Send, Image as ImageIcon, Pencil, X, Check, MessageCircle, RefreshCw, Users, FolderSync, Smartphone, Link, Truck, DownloadCloud, UploadCloud, Warehouse, FileText, Container, LayoutTemplate, WifiOff, Info, Clock, User as UserIcon } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { requestNotificationPermission, setNotificationPreference, isNotificationEnabledInApp } from '../services/notificationService';
import { getUsers } from '../services/authService';
import { generateUUID } from '../constants';
import PrintTemplateDesigner from './PrintTemplateDesigner';
import { FiscalYearManager } from './FiscalModule'; 
import SecondExitGroupSettings from './settings/SecondExitGroupSettings';
import RolePermissionsEditor from './settings/RolePermissionsEditor';
import BackupManager from './settings/BackupManager'; // NEW IMPORT

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

  const loadAppUsers = async () => {
      try {
          const users = await getUsers();
          // Convert users to compatible contact format
          const formattedUsers = users.map(u => ({
              id: u.id,
              name: u.fullName,
              number: u.phoneNumber || '',
              role: u.role,
              isUser: true,
              isGroup: false
          }));
          setAppUsers(formattedUsers);
      } catch (e) { console.error(e); }
  };

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (error) { console.error('Failed to load settings', error); }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if(e) e.preventDefault();
    setLoading(true);
    try {
      await saveSettings(settings);
      setMessage('تنظیمات با موفقیت ذخیره شد.');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('خطا در ذخیره تنظیمات.');
    } finally {
      setLoading(false);
    }
  };

  // ... (Rest of existing handler functions - keeping them intact as requested) ...
  // Keeping handleCompanyEdit, handleBankAdd, etc. unchanged to preserve logic.
  // Assuming they are present in the full file.
  // Re-implementing key logic just in case:

  const handleCompanySubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newCompanyName) return;
      
      const newCompanyObj: Company = {
          id: editingCompanyId || generateUUID(),
          name: newCompanyName,
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

      let updatedCompanies = [];
      if (editingCompanyId) {
          updatedCompanies = (settings.companies || []).map(c => c.id === editingCompanyId ? newCompanyObj : c);
      } else {
          updatedCompanies = [...(settings.companies || []), newCompanyObj];
      }

      setSettings({ ...settings, companies: updatedCompanies, companyNames: updatedCompanies.map(c => c.name) });
      
      // Reset form
      setNewCompanyName(''); setNewCompanyLogo(''); setNewCompanyShowInWarehouse(true); setNewCompanyBanks([]); setNewCompanyLetterhead('');
      setNewCompanyRegNum(''); setNewCompanyNatId(''); setNewCompanyAddress(''); setNewCompanyPhone(''); setNewCompanyFax(''); setNewCompanyPostalCode(''); setNewCompanyEcoCode('');
      setEditingCompanyId(null);
      
      // Auto save
      await saveSettings({ ...settings, companies: updatedCompanies, companyNames: updatedCompanies.map(c => c.name) });
  };

  const handleEditCompany = (c: Company) => {
      setEditingCompanyId(c.id);
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
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelCompanyEdit = () => {
      setEditingCompanyId(null);
      setNewCompanyName(''); setNewCompanyLogo(''); setNewCompanyShowInWarehouse(true); setNewCompanyBanks([]); setNewCompanyLetterhead('');
      setNewCompanyRegNum(''); setNewCompanyNatId(''); setNewCompanyAddress(''); setNewCompanyPhone(''); setNewCompanyFax(''); setNewCompanyPostalCode(''); setNewCompanyEcoCode('');
  };

  const handleDeleteCompany = (id: string) => {
      if (!confirm('آیا از حذف این شرکت اطمینان دارید؟')) return;
      const updatedCompanies = (settings.companies || []).filter(c => c.id !== id);
      setSettings({ ...settings, companies: updatedCompanies, companyNames: updatedCompanies.map(c => c.name) });
      saveSettings({ ...settings, companies: updatedCompanies, companyNames: updatedCompanies.map(c => c.name) });
  };

  const handleTempBankSave = () => {
      if (!tempBankName) return;
      const bankObj: CompanyBank = {
          id: editingBankId || generateUUID(),
          bankName: tempBankName,
          accountNumber: tempAccountNum,
          sheba: tempBankSheba,
          formLayoutId: tempBankLayout,
          internalTransferTemplateId: tempInternalLayout,
          internalWithdrawalTemplateId: tempInternalWithdrawalLayout,
          internalDepositTemplateId: tempInternalDepositLayout,
          enableDualPrint: tempDualPrint
      };
      
      let updatedBanks = [];
      if (editingBankId) {
          updatedBanks = newCompanyBanks.map(b => b.id === editingBankId ? bankObj : b);
      } else {
          updatedBanks = [...newCompanyBanks, bankObj];
      }
      setNewCompanyBanks(updatedBanks);
      
      // Reset temp bank form
      setTempBankName(''); setTempAccountNum(''); setTempBankSheba(''); 
      setTempBankLayout(''); setTempInternalLayout(''); setTempInternalWithdrawalLayout(''); setTempInternalDepositLayout(''); setTempDualPrint(false);
      setEditingBankId(null);
  };

  const handleEditBank = (b: CompanyBank) => {
      setEditingBankId(b.id);
      setTempBankName(b.bankName);
      setTempAccountNum(b.accountNumber);
      setTempBankSheba(b.sheba || '');
      setTempBankLayout(b.formLayoutId || '');
      setTempInternalLayout(b.internalTransferTemplateId || '');
      setTempInternalWithdrawalLayout(b.internalWithdrawalTemplateId || '');
      setTempInternalDepositLayout(b.internalDepositTemplateId || '');
      setTempDualPrint(b.enableDualPrint || false);
  };

  const handleDeleteBank = (id: string) => {
      setNewCompanyBanks(newCompanyBanks.filter(b => b.id !== id));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      setIsUploadingLogo(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
          const base64 = ev.target?.result as string;
          try { const result = await uploadFile(file.name, base64); setNewCompanyLogo(result.url); } catch (e) { alert('خطا در آپلود'); } finally { setIsUploadingLogo(false); }
      };
      reader.readAsDataURL(file);
  };

  const handleLetterheadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      setIsUploadingLetterhead(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
          const base64 = ev.target?.result as string;
          try { const result = await uploadFile(file.name, base64); setNewCompanyLetterhead(result.url); } catch (e) { alert('خطا در آپلود'); } finally { setIsUploadingLetterhead(false); }
      };
      reader.readAsDataURL(file);
  };

  const checkWhatsappStatus = async () => {
      setRefreshingWA(true);
      try { const res = await apiCall<{ready: boolean, qr: string, user: string}>('/whatsapp-status'); setWhatsappStatus(res); } catch (e) {} finally { setRefreshingWA(false); }
  };

  const logoutWhatsapp = async () => { if(confirm('آیا از خروج واتساپ اطمینان دارید؟')) { await apiCall('/whatsapp-logout', 'POST'); checkWhatsappStatus(); } };

  const handleSaveContact = () => {
      if(!contactName || !contactNumber) return;
      const newContact: Contact = { id: editingContactId || generateUUID(), name: contactName, number: contactNumber, isGroup: isGroupContact, baleId: contactBaleId };
      let updatedContacts = [];
      if(editingContactId) {
          updatedContacts = (settings.savedContacts || []).map(c => c.id === editingContactId ? newContact : c);
      } else {
          updatedContacts = [...(settings.savedContacts || []), newContact];
      }
      setSettings({...settings, savedContacts: updatedContacts});
      saveSettings({...settings, savedContacts: updatedContacts});
      setContactName(''); setContactNumber(''); setContactBaleId(''); setIsGroupContact(false); setEditingContactId(null);
  };

  const handleEditContact = (c: Contact) => {
      setEditingContactId(c.id); setContactName(c.name); setContactNumber(c.number); setIsGroupContact(c.isGroup); setContactBaleId(c.baleId || '');
  };

  const handleDeleteContact = (id: string) => {
      if(!confirm('حذف شود؟')) return;
      const updated = (settings.savedContacts || []).filter(c => c.id !== id);
      setSettings({...settings, savedContacts: updated});
      saveSettings({...settings, savedContacts: updated});
  };

  const handleImportGroups = async () => {
      setFetchingGroups(true);
      try {
          const groups = await apiCall<{id: string, name: string}[]>('/whatsapp-groups');
          if (groups && groups.length > 0) {
              const newContacts = groups.map(g => ({ id: generateUUID(), name: g.name, number: g.id, isGroup: true }));
              const merged = [...(settings.savedContacts || []), ...newContacts];
              setSettings({...settings, savedContacts: merged});
              saveSettings({...settings, savedContacts: merged});
              alert(`${groups.length} گروه اضافه شد.`);
          } else { alert('گروهی یافت نشد.'); }
      } catch (e) { alert('خطا در دریافت گروه‌ها'); } finally { setFetchingGroups(false); }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      setUploadingIcon(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
          const base64 = ev.target?.result as string;
          try { const result = await uploadFile(file.name, base64); setSettings({...settings, pwaIcon: result.url}); saveSettings({...settings, pwaIcon: result.url}); } catch (e) { alert('خطا'); } finally { setUploadingIcon(false); }
      };
      reader.readAsDataURL(file);
  };

  const handleSaveTemplate = (template: PrintTemplate) => {
      const existing = settings.printTemplates || [];
      const updated = existing.some(t => t.id === template.id) ? existing.map(t => t.id === template.id ? template : t) : [...existing, template];
      setSettings({ ...settings, printTemplates: updated });
      saveSettings({ ...settings, printTemplates: updated });
      setShowDesigner(false);
      setEditingTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => {
      if (!confirm('قالب حذف شود؟')) return;
      const updated = (settings.printTemplates || []).filter(t => t.id !== id);
      setSettings({ ...settings, printTemplates: updated });
      saveSettings({ ...settings, printTemplates: updated });
  };

  if (showDesigner) {
      return <PrintTemplateDesigner onSave={handleSaveTemplate} onCancel={() => { setShowDesigner(false); setEditingTemplate(null); }} initialTemplate={editingTemplate} />;
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-100px)] animate-fade-in">
      
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 flex flex-col gap-2 shrink-0 overflow-y-auto pb-4">
          {[
              { id: 'system', label: 'اطلاعات پایه سیستم', icon: AppWindow },
              { id: 'fiscal', label: 'سال مالی و شماره‌ها', icon: Clock }, // New Label
              { id: 'data', label: 'مدیریت داده‌ها', icon: Database },
              { id: 'permissions', label: 'دسترسی نقش‌ها', icon: ShieldCheck },
              { id: 'templates', label: 'قالب‌های چاپ', icon: LayoutTemplate },
              { id: 'commerce', label: 'اطلاعات بازرگانی', icon: Container },
              { id: 'integrations', label: 'ربات‌های پیام‌رسان', icon: MessageCircle },
              { id: 'whatsapp', label: 'اتصال واتساپ', icon: Smartphone },
              { id: 'warehouse', label: 'مخاطبین انبار', icon: Warehouse },
          ].map(item => (
              <button 
                key={item.id} 
                onClick={() => setActiveCategory(item.id as any)} 
                className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${activeCategory === item.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'}`}
              >
                  <item.icon size={18}/> {item.label}
              </button>
          ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pb-10">
          
          {message && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in">
                  <Check size={20}/> {message}
              </div>
          )}

          {activeCategory === 'data' && (
              <div className="space-y-6">
                  {/* >>> ADDED BACKUP MANAGER HERE <<< */}
                  <BackupManager />

                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-6 border-b pb-2"><Building size={20} className="text-blue-600"/><h3 className="text-lg font-bold text-gray-800">مدیریت شرکت‌ها و حساب‌ها</h3></div>
                      
                      {/* ... (Existing Company Form & List - Preserved) ... */}
                      <form onSubmit={handleCompanySubmit} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div><label className="block text-xs font-bold mb-1">نام شرکت</label><input required className="w-full border rounded-lg p-2 text-sm" value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} placeholder="مثال: بازرگانی نمونه" /></div>
                              <div><label className="block text-xs font-bold mb-1">شناسه ملی</label><input className="w-full border rounded-lg p-2 text-sm" value={newCompanyNatId} onChange={e => setNewCompanyNatId(e.target.value)} /></div>
                              <div><label className="block text-xs font-bold mb-1">شماره ثبت</label><input className="w-full border rounded-lg p-2 text-sm" value={newCompanyRegNum} onChange={e => setNewCompanyRegNum(e.target.value)} /></div>
                              <div><label className="block text-xs font-bold mb-1">کد اقتصادی</label><input className="w-full border rounded-lg p-2 text-sm" value={newCompanyEcoCode} onChange={e => setNewCompanyEcoCode(e.target.value)} /></div>
                              <div><label className="block text-xs font-bold mb-1">تلفن</label><input className="w-full border rounded-lg p-2 text-sm" value={newCompanyPhone} onChange={e => setNewCompanyPhone(e.target.value)} /></div>
                              <div><label className="block text-xs font-bold mb-1">فکس</label><input className="w-full border rounded-lg p-2 text-sm" value={newCompanyFax} onChange={e => setNewCompanyFax(e.target.value)} /></div>
                              <div className="md:col-span-2"><label className="block text-xs font-bold mb-1">آدرس</label><input className="w-full border rounded-lg p-2 text-sm" value={newCompanyAddress} onChange={e => setNewCompanyAddress(e.target.value)} /></div>
                              <div><label className="block text-xs font-bold mb-1">کد پستی</label><input className="w-full border rounded-lg p-2 text-sm" value={newCompanyPostalCode} onChange={e => setNewCompanyPostalCode(e.target.value)} /></div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                                  <label className="block text-xs font-bold mb-2">لوگو شرکت</label>
                                  <div className="flex items-center gap-3">
                                      <div className="w-16 h-16 bg-white rounded-lg border flex items-center justify-center overflow-hidden">{newCompanyLogo ? <img src={newCompanyLogo} className="w-full h-full object-contain" /> : <ImageIcon className="text-gray-300"/>}</div>
                                      <div><input type="file" ref={companyLogoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} /><button type="button" onClick={() => companyLogoInputRef.current?.click()} disabled={isUploadingLogo} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200">{isUploadingLogo ? '...' : 'آپلود لوگو'}</button></div>
                                  </div>
                              </div>
                              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                                  <label className="block text-xs font-bold mb-2">سربرگ نامه (اختیاری)</label>
                                  <div className="flex items-center gap-3">
                                      <div className="w-16 h-16 bg-white rounded-lg border flex items-center justify-center overflow-hidden">{newCompanyLetterhead ? <img src={newCompanyLetterhead} className="w-full h-full object-cover" /> : <FileText className="text-gray-300"/>}</div>
                                      <div><input type="file" ref={companyLetterheadInputRef} className="hidden" accept="image/*" onChange={handleLetterheadUpload} /><button type="button" onClick={() => companyLetterheadInputRef.current?.click()} disabled={isUploadingLetterhead} className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-300">{isUploadingLetterhead ? '...' : 'آپلود سربرگ'}</button></div>
                                  </div>
                              </div>
                          </div>

                          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                              <h4 className="font-bold text-sm text-indigo-800 mb-3 flex items-center gap-2"><Landmark size={16}/> تعریف حساب‌های بانکی شرکت</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                                  <input placeholder="نام بانک (مثال: ملت)" className="border rounded p-2 text-sm" value={tempBankName} onChange={e => setTempBankName(e.target.value)} />
                                  <input placeholder="شماره حساب / کارت" className="border rounded p-2 text-sm dir-ltr text-left" value={tempAccountNum} onChange={e => setTempAccountNum(e.target.value)} />
                                  <input placeholder="شماره شبا (IR...)" className="border rounded p-2 text-sm dir-ltr text-left" value={tempBankSheba} onChange={e => setTempBankSheba(e.target.value)} />
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                                  <select className="border rounded p-2 text-sm bg-white" value={tempBankLayout} onChange={e => setTempBankLayout(e.target.value)}>
                                      <option value="">قالب چاپ چک (پیش‌فرض)</option>
                                      {settings.printTemplates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                  </select>
                                  <select className="border rounded p-2 text-sm bg-white" value={tempInternalLayout} onChange={e => setTempInternalLayout(e.target.value)}>
                                      <option value="">قالب رسید داخلی (پیش‌فرض)</option>
                                      {settings.printTemplates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                  </select>
                                  <div className="flex items-center gap-2 text-xs">
                                      <input type="checkbox" checked={tempDualPrint} onChange={e => setTempDualPrint(e.target.checked)} className="w-4 h-4"/>
                                      <span>فعالسازی چاپ دوگانه (واریز/برداشت)</span>
                                  </div>
                              </div>
                              
                              {/* New Fields for Dual Print Templates */}
                              {tempDualPrint && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 animate-fade-in bg-white p-2 rounded border border-indigo-200">
                                      <div>
                                          <label className="text-[10px] font-bold block mb-1 text-gray-500">قالب نسخه برداشت (خروجی)</label>
                                          <select className="w-full border rounded p-1.5 text-xs bg-white" value={tempInternalWithdrawalLayout} onChange={e => setTempInternalWithdrawalLayout(e.target.value)}>
                                              <option value="">انتخاب...</option>
                                              {settings.printTemplates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                          </select>
                                      </div>
                                      <div>
                                          <label className="text-[10px] font-bold block mb-1 text-gray-500">قالب نسخه واریز (ورودی)</label>
                                          <select className="w-full border rounded p-1.5 text-xs bg-white" value={tempInternalDepositLayout} onChange={e => setTempInternalDepositLayout(e.target.value)}>
                                              <option value="">انتخاب...</option>
                                              {settings.printTemplates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                          </select>
                                      </div>
                                  </div>
                              )}

                              <button type="button" onClick={handleTempBankSave} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 w-full md:w-auto">{editingBankId ? 'بروزرسانی بانک' : 'افزودن بانک'}</button>
                              
                              {newCompanyBanks.length > 0 && (
                                  <div className="mt-3 space-y-1">
                                      {newCompanyBanks.map((b, idx) => (
                                          <div key={b.id} className="flex justify-between items-center bg-white p-2 rounded border text-sm">
                                              <span>{b.bankName} - {b.accountNumber}</span>
                                              <div className="flex gap-1"><button type="button" onClick={() => handleEditBank(b)} className="text-amber-500 p-1"><Pencil size={14}/></button><button type="button" onClick={() => handleDeleteBank(b.id)} className="text-red-500 p-1"><Trash2 size={14}/></button></div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>

                          <div className="flex items-center gap-2">
                              <input type="checkbox" checked={newCompanyShowInWarehouse} onChange={e => setNewCompanyShowInWarehouse(e.target.checked)} className="w-4 h-4"/>
                              <span className="text-sm">این شرکت در ماژول انبار نمایش داده شود</span>
                          </div>

                          <div className="flex gap-2 border-t pt-4">
                              {editingCompanyId && <button type="button" onClick={handleCancelCompanyEdit} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-xl font-bold">انصراف</button>}
                              <button type="submit" className="bg-blue-600 text-white px-8 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-lg">{editingCompanyId ? 'ذخیره تغییرات شرکت' : 'افزودن شرکت جدید'}</button>
                          </div>
                      </form>

                      <div className="mt-8 pt-6 border-t">
                          <h4 className="font-bold text-gray-700 mb-4 text-sm">لیست شرکت‌های ثبت شده</h4>
                          <div className="space-y-2">
                              {settings.companies?.map(c => (
                                  <div key={c.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200 hover:border-blue-200 transition-colors">
                                      <div className="flex items-center gap-3">
                                          {c.logo ? <img src={c.logo} className="w-10 h-10 object-contain rounded bg-white border" /> : <Building className="text-gray-400"/>}
                                          <div>
                                              <div className="font-bold text-gray-800">{c.name}</div>
                                              <div className="text-xs text-gray-500 flex gap-2"><span>{c.banks?.length || 0} حساب بانکی</span> {c.showInWarehouse && <span className="bg-green-100 text-green-700 px-1 rounded">انبار</span>}</div>
                                          </div>
                                      </div>
                                      <div className="flex gap-2">
                                          <button onClick={() => handleEditCompany(c)} className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg"><Pencil size={18}/></button>
                                          <button onClick={() => handleDeleteCompany(c.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {activeCategory === 'fiscal' && (
              <FiscalYearManager />
          )}

          {activeCategory === 'permissions' && (
              <RolePermissionsEditor 
                  settings={settings} 
                  onUpdateSettings={(newS) => { setSettings(newS); saveSettings(newS); }} 
              />
          )}

          {activeCategory === 'templates' && (
              <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex justify-between items-center">
                      <div>
                          <h3 className="font-bold text-gray-800 text-lg">مدیریت قالب‌های چاپ</h3>
                          <p className="text-gray-500 text-sm">طراحی قالب‌های چک و فیش بانکی</p>
                      </div>
                      <button onClick={() => setShowDesigner(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2"><Plus size={18}/> طراحی قالب جدید</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {settings.printTemplates?.map(t => (
                          <div key={t.id} className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-all">
                              <div className="flex justify-between items-start mb-2">
                                  <h4 className="font-bold text-gray-800">{t.name}</h4>
                                  <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{t.pageSize} - {t.orientation}</span>
                              </div>
                              <p className="text-xs text-gray-500 mb-4">{t.fields.length} فیلد تعریف شده</p>
                              <div className="flex gap-2 border-t pt-2">
                                  <button onClick={() => { setEditingTemplate(t); setShowDesigner(true); }} className="flex-1 bg-blue-50 text-blue-600 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 flex items-center justify-center gap-1"><Pencil size={14}/> ویرایش</button>
                                  <button onClick={() => handleDeleteTemplate(t.id)} className="flex-1 bg-red-50 text-red-600 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 flex items-center justify-center gap-1"><Trash2 size={14}/> حذف</button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {activeCategory === 'warehouse' && (
              <div className="space-y-6">
                  {/* Warehouse Settings */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><Warehouse size={20} className="text-orange-600"/> تنظیمات اطلاع‌رسانی انبار</h3>
                      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
                          <p className="text-sm text-orange-800 leading-relaxed">در این بخش می‌توانید شماره واتساپ گروه انبار و مدیر فروش مربوط به هر شرکت را جداگانه تنظیم کنید. سیستم هنگام صدور بیجک، پیام را به شماره‌های تنظیم شده ارسال می‌کند.</p>
                      </div>
                      
                      <div className="space-y-4">
                          {settings.companies?.filter(c => c.showInWarehouse !== false).map(c => {
                              const config = settings.companyNotifications?.[c.name] || {};
                              return (
                                  <div key={c.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                      <div className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Building size={16}/> {c.name}</div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div>
                                              <label className="block text-xs font-bold text-gray-500 mb-1">شماره/آیدی گروه انبار (بی‌قیمت)</label>
                                              <input 
                                                  className="w-full border rounded p-2 text-sm dir-ltr" 
                                                  placeholder="مثال: 120363...g.us"
                                                  value={config.warehouseGroup || ''}
                                                  onChange={e => {
                                                      const newConfig = { ...settings.companyNotifications, [c.name]: { ...config, warehouseGroup: e.target.value } };
                                                      setSettings({ ...settings, companyNotifications: newConfig });
                                                  }}
                                              />
                                          </div>
                                          <div>
                                              <label className="block text-xs font-bold text-gray-500 mb-1">شماره مدیر فروش (باقیمت)</label>
                                              <input 
                                                  className="w-full border rounded p-2 text-sm dir-ltr" 
                                                  placeholder="98912..."
                                                  value={config.salesManager || ''}
                                                  onChange={e => {
                                                      const newConfig = { ...settings.companyNotifications, [c.name]: { ...config, salesManager: e.target.value } };
                                                      setSettings({ ...settings, companyNotifications: newConfig });
                                                  }}
                                              />
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                      <div className="mt-4 flex justify-end"><button onClick={() => handleSave()} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700">ذخیره تنظیمات انبار</button></div>
                  </div>
              </div>
          )}

          {activeCategory === 'commerce' && (
              <div className="space-y-6">
                  {/* Commerce Settings */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><Container size={20} className="text-teal-600"/> تنظیمات بازرگانی</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                              <label className="block text-sm font-bold text-gray-700">گروه‌های کالایی</label>
                              <div className="flex gap-2">
                                  <input className="flex-1 border rounded-lg p-2 text-sm" value={newCommodity} onChange={e => setNewCommodity(e.target.value)} placeholder="مثال: قطعات یدکی"/>
                                  <button onClick={() => { if(newCommodity) { const updated = [...(settings.commodityGroups || []), newCommodity]; setSettings({...settings, commodityGroups: updated}); saveSettings({...settings, commodityGroups: updated}); setNewCommodity(''); } }} className="bg-teal-600 text-white px-4 rounded-lg font-bold hover:bg-teal-700">+</button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                  {settings.commodityGroups?.map(g => (
                                      <span key={g} className="bg-teal-50 text-teal-700 px-3 py-1 rounded-full text-xs flex items-center gap-2 border border-teal-100">{g} <button onClick={() => { const updated = settings.commodityGroups.filter(x => x !== g); setSettings({...settings, commodityGroups: updated}); saveSettings({...settings, commodityGroups: updated}); }} className="text-teal-400 hover:text-teal-600"><X size={12}/></button></span>
                                  ))}
                              </div>
                          </div>

                          <div className="space-y-4">
                              <label className="block text-sm font-bold text-gray-700">بانک‌های عامل (جهت ثبت سفارش)</label>
                              <div className="flex gap-2">
                                  <input className="flex-1 border rounded-lg p-2 text-sm" value={newOperatingBank} onChange={e => setNewOperatingBank(e.target.value)} placeholder="مثال: بانک تجارت"/>
                                  <button onClick={() => { if(newOperatingBank) { const updated = [...(settings.operatingBankNames || []), newOperatingBank]; setSettings({...settings, operatingBankNames: updated}); saveSettings({...settings, operatingBankNames: updated}); setNewOperatingBank(''); } }} className="bg-blue-600 text-white px-4 rounded-lg font-bold hover:bg-blue-700">+</button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                  {settings.operatingBankNames?.map(b => (
                                      <span key={b} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs flex items-center gap-2 border border-blue-100">{b} <button onClick={() => { const updated = settings.operatingBankNames.filter(x => x !== b); setSettings({...settings, operatingBankNames: updated}); saveSettings({...settings, operatingBankNames: updated}); }} className="text-blue-400 hover:text-blue-600"><X size={12}/></button></span>
                                  ))}
                              </div>
                          </div>

                          {/* Insurance Companies */}
                          <div className="space-y-4 md:col-span-2">
                              <label className="block text-sm font-bold text-gray-700">شرکت‌های بیمه</label>
                              <div className="flex gap-2">
                                  <input className="flex-1 border rounded-lg p-2 text-sm" value={newInsuranceCompany} onChange={e => setNewInsuranceCompany(e.target.value)} placeholder="مثال: بیمه ایران"/>
                                  <button onClick={() => { if(newInsuranceCompany) { const updated = [...(settings.insuranceCompanies || []), newInsuranceCompany]; setSettings({...settings, insuranceCompanies: updated}); saveSettings({...settings, insuranceCompanies: updated}); setNewInsuranceCompany(''); } }} className="bg-indigo-600 text-white px-4 rounded-lg font-bold hover:bg-indigo-700">+</button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                  {settings.insuranceCompanies?.map(c => (
                                      <span key={c} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs flex items-center gap-2 border border-indigo-100">{c} <button onClick={() => { const updated = settings.insuranceCompanies.filter(x => x !== c); setSettings({...settings, insuranceCompanies: updated}); saveSettings({...settings, insuranceCompanies: updated}); }} className="text-indigo-400 hover:text-indigo-600"><X size={12}/></button></span>
                                  ))}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {activeCategory === 'system' && (
              <div className="space-y-6">
                  {/* ... (Existing System Settings - PWA Icon, etc.) ... */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><AppWindow size={20} className="text-purple-600"/> تنظیمات ظاهری و سیستمی</h3>
                      <div className="space-y-6">
                          <div className="flex items-center gap-4">
                              <div className="w-16 h-16 bg-gray-50 rounded-xl border flex items-center justify-center overflow-hidden">{settings.pwaIcon ? <img src={settings.pwaIcon} className="w-full h-full object-cover" /> : <ImageIcon className="text-gray-300"/>}</div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-600 mb-1">آیکون برنامه (PWA)</label>
                                  <div className="flex items-center gap-2">
                                      <button onClick={() => iconInputRef.current?.click()} disabled={uploadingIcon} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-200">{uploadingIcon ? '...' : 'تغییر آیکون'}</button>
                                      <input type="file" ref={iconInputRef} className="hidden" accept="image/png" onChange={handleIconUpload} />
                                  </div>
                                  <p className="text-[10px] text-gray-400 mt-1">فرمت PNG، ترجیحا مربع</p>
                              </div>
                          </div>
                          
                          {/* Default Company */}
                          <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">شرکت پیش‌فرض سیستم</label>
                              <select className="w-full border rounded-lg p-2 text-sm bg-white" value={settings.defaultCompany} onChange={e => setSettings({...settings, defaultCompany: e.target.value})}>
                                  <option value="">انتخاب...</option>
                                  {settings.companies?.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                              </select>
                          </div>

                          <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">شماره واتساپ/آیدی گروه برای مجوزهای خروج (پیش‌فرض)</label>
                              <input 
                                  className="w-full border rounded-lg p-2 text-sm dir-ltr" 
                                  value={settings.exitPermitNotificationGroup || ''} 
                                  onChange={e => setSettings({...settings, exitPermitNotificationGroup: e.target.value})} 
                                  placeholder="مثال: 120363...g.us"
                              />
                              <p className="text-[10px] text-gray-400 mt-1">این گروه برای اعلان‌های عمومی خروج استفاده می‌شود.</p>
                          </div>

                          {/* SECOND EXIT GROUP SETTINGS */}
                          <SecondExitGroupSettings 
                              settings={settings} 
                              setSettings={setSettings} 
                              contacts={settings.savedContacts || []}
                          />

                          <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">API Key جمینای (هوش مصنوعی)</label>
                              <input className="w-full border rounded-lg p-2 text-sm dir-ltr" type="password" value={settings.geminiApiKey || ''} onChange={e => setSettings({...settings, geminiApiKey: e.target.value})} placeholder="AIza..." />
                          </div>

                          <div className="flex justify-end pt-4"><button onClick={() => handleSave()} className="bg-purple-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-purple-700">ذخیره تغییرات</button></div>
                      </div>
                  </div>
              </div>
          )}

          {activeCategory === 'integrations' && (
              <div className="space-y-6">
                  {/* ... (Existing Integrations - Telegram/Bale - Preserved) ... */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><Send size={20} className="text-blue-500"/> تنظیمات ربات تلگرام</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div><label className="block text-xs font-bold mb-1">توکن ربات</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.telegramBotToken} onChange={e => setSettings({...settings, telegramBotToken: e.target.value})} placeholder="123456:ABC-..." /></div>
                          <div><label className="block text-xs font-bold mb-1">آیدی عددی مدیر (Admin ID)</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.telegramAdminId} onChange={e => setSettings({...settings, telegramAdminId: e.target.value})} placeholder="12345678" /></div>
                      </div>
                      <div className="flex justify-end pt-4"><button onClick={() => handleSave()} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700">ذخیره و اتصال</button></div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><MessageCircle size={20} className="text-green-600"/> تنظیمات بله (Bale)</h3>
                      <div><label className="block text-xs font-bold mb-1">توکن ربات بله</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.baleBotToken} onChange={e => setSettings({...settings, baleBotToken: e.target.value})} placeholder="..." /></div>
                      <div className="flex justify-end pt-4"><button onClick={() => handleSave()} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-green-700">ذخیره</button></div>
                  </div>
              </div>
          )}

          {activeCategory === 'whatsapp' && (
              <div className="space-y-6">
                  {/* ... (Existing WhatsApp - Preserved) ... */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="flex justify-between items-start mb-6">
                          <h3 className="font-bold text-gray-800 flex items-center gap-2"><Smartphone size={20} className="text-green-500"/> اتصال واتساپ وب</h3>
                          <button onClick={checkWhatsappStatus} className="text-xs bg-gray-100 px-3 py-1 rounded hover:bg-gray-200 flex items-center gap-1">{refreshingWA && <RefreshCw size={12} className="animate-spin"/>} بررسی وضعیت</button>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-2xl border border-gray-200 min-h-[300px]">
                          {whatsappStatus?.ready ? (
                              <div className="text-center">
                                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600"><Check size={40}/></div>
                                  <h4 className="font-bold text-lg text-green-700 mb-1">واتساپ متصل است</h4>
                                  <p className="text-sm text-gray-500 mb-6">متصل به شماره: <span className="font-mono dir-ltr">{whatsappStatus.user}</span></p>
                                  <button onClick={logoutWhatsapp} className="bg-red-50 text-red-600 px-6 py-2 rounded-xl font-bold hover:bg-red-100 border border-red-200">خروج از حساب</button>
                              </div>
                          ) : whatsappStatus?.qr ? (
                              <div className="text-center">
                                  <div className="bg-white p-4 rounded-xl shadow-lg mb-4 inline-block"><QRCode value={whatsappStatus.qr} size={200} /></div>
                                  <p className="text-sm font-bold text-gray-600 mb-2">اسکن کنید</p>
                                  <p className="text-xs text-gray-500">واتساپ را در گوشی باز کنید و کد بالا را اسکن نمایید.</p>
                              </div>
                          ) : (
                              <div className="text-center text-gray-400">
                                  <Loader2 size={40} className="animate-spin mx-auto mb-2"/>
                                  <p>در حال دریافت وضعیت...</p>
                              </div>
                          )}
                      </div>

                      <div className="mt-6 border-t pt-4">
                          <div className="flex justify-between items-center mb-4">
                              <h4 className="font-bold text-gray-700 text-sm">دفترچه تلفن (مخاطبین)</h4>
                              <button onClick={handleImportGroups} disabled={fetchingGroups} className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg font-bold hover:bg-green-100 flex items-center gap-1">{fetchingGroups ? <Loader2 size={14} className="animate-spin"/> : <DownloadCloud size={14}/>} فراخوانی گروه‌ها</button>
                          </div>
                          
                          <div className="flex gap-2 mb-4 bg-gray-50 p-3 rounded-xl">
                              <input className="flex-1 border rounded-lg p-2 text-sm" placeholder="نام" value={contactName} onChange={e => setContactName(e.target.value)} />
                              <input className="w-32 border rounded-lg p-2 text-sm dir-ltr" placeholder="شماره / ID" value={contactNumber} onChange={e => setContactNumber(e.target.value)} />
                              <input className="w-32 border rounded-lg p-2 text-sm dir-ltr" placeholder="Bale ID (Optional)" value={contactBaleId} onChange={e => setContactBaleId(e.target.value)} />
                              <div className="flex items-center gap-2 bg-white px-2 rounded border"><input type="checkbox" checked={isGroupContact} onChange={e => setIsGroupContact(e.target.checked)} className="w-4 h-4"/> <span className="text-xs">گروه</span></div>
                              <button onClick={handleSaveContact} className="bg-blue-600 text-white px-4 rounded-lg font-bold hover:bg-blue-700">{editingContactId ? 'ویرایش' : 'افزودن'}</button>
                          </div>

                          <div className="max-h-60 overflow-y-auto space-y-2">
                              {settings.savedContacts?.map(c => (
                                  <div key={c.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm">
                                      <div className="flex items-center gap-3">
                                          <div className={`p-2 rounded-full ${c.isGroup ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>{c.isGroup ? <Users size={16}/> : <UserIcon size={16}/>}</div>
                                          <div>
                                              <div className="font-bold">{c.name}</div>
                                              <div className="text-xs text-gray-500 font-mono">{c.number}</div>
                                              {c.baleId && <div className="text-[10px] text-blue-500">Bale: {c.baleId}</div>}
                                          </div>
                                      </div>
                                      <div className="flex gap-2">
                                          <button onClick={() => handleEditContact(c)} className="text-amber-500 p-1"><Pencil size={16}/></button>
                                          <button onClick={() => handleDeleteContact(c.id)} className="text-red-500 p-1"><Trash2 size={16}/></button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default Settings;
