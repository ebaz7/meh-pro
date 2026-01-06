
import React, { useState, useEffect, useRef } from 'react';
import { SystemSettings, Company, CompanyBank, Contact, UserRole, PrintTemplate } from '../types';
import { getSettings, saveSettings, uploadFile } from '../services/storageService';
import { getUsers } from '../services/authService';
import { generateUUID } from '../constants';
import { 
    Save, Plus, Trash2, Building2, CreditCard, Users, Settings as SettingsIcon, 
    Smartphone, Upload, Image as ImageIcon, Printer, FileText, Shield, 
    Calendar, Truck, Megaphone, Database, RefreshCw, X, Loader2
} from 'lucide-react';
import PrintTemplateDesigner from './PrintTemplateDesigner';
import { FiscalYearManager } from './FiscalModule';
import FaxModule from './FaxModule';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [activeTab, setActiveTab] = useState('companies');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  
  // Edit States
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingBank, setEditingBank] = useState<CompanyBank | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  
  // Template Designer
  const [showTemplateDesigner, setShowTemplateDesigner] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PrintTemplate | null>(null);

  // File Upload
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local inputs
  const [newCommodity, setNewCommodity] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newInsurance, setNewInsurance] = useState('');

  useEffect(() => {
      const load = async () => {
          setLoading(true);
          try {
              const [s, u] = await Promise.all([getSettings(), getUsers()]);
              setSettings(s);
              setUsers(u);
          } catch(e) { console.error(e); }
          finally { setLoading(false); }
      };
      load();
  }, []);

  const handleSaveSettings = async (newSettings: SystemSettings) => {
      await saveSettings(newSettings);
      setSettings(newSettings);
  };

  const getMergedContactOptions = () => {
      if (!settings) return [];
      const saved = settings.savedContacts || [];
      const userContacts = users.filter(u => u.phoneNumber).map(u => ({
          id: u.id,
          name: u.fullName,
          number: u.phoneNumber!,
          isGroup: false
      }));
      // Remove duplicates by number
      const seen = new Set();
      return [...saved, ...userContacts].filter(c => {
          const duplicate = seen.has(c.number);
          seen.add(c.number);
          return !duplicate;
      });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !settings) return;
      setUploadingIcon(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
          const base64 = ev.target?.result as string;
          try {
              const result = await uploadFile(file.name, base64);
              handleSaveSettings({ ...settings, pwaIcon: result.url });
          } catch (e) { alert('خطا در آپلود آیکون'); }
          finally { setUploadingIcon(false); }
      };
      reader.readAsDataURL(file);
  };

  // Company Handlers
  const saveCompany = () => {
      if (!settings || !editingCompany) return;
      const companies = settings.companies || [];
      const idx = companies.findIndex(c => c.id === editingCompany.id);
      let newCompanies = [...companies];
      if (idx > -1) newCompanies[idx] = editingCompany;
      else newCompanies.push(editingCompany);
      handleSaveSettings({ ...settings, companies: newCompanies });
      setEditingCompany(null);
  };
  const deleteCompany = (id: string) => {
      if (!settings || !confirm('حذف شود؟')) return;
      handleSaveSettings({ ...settings, companies: settings.companies.filter(c => c.id !== id) });
  };

  // Bank Handlers (Nested in Company)
  const saveBank = () => {
      if (!settings || !editingCompany || !editingBank) return;
      const banks = editingCompany.banks || [];
      const idx = banks.findIndex(b => b.id === editingBank.id);
      let newBanks = [...banks];
      if (idx > -1) newBanks[idx] = editingBank;
      else newBanks.push(editingBank);
      setEditingCompany({ ...editingCompany, banks: newBanks });
      setEditingBank(null);
  };
  const deleteBank = (id: string) => {
      if (!editingCompany) return;
      setEditingCompany({ ...editingCompany, banks: editingCompany.banks?.filter(b => b.id !== id) });
  };

  // Contact Handlers
  const saveContact = () => {
      if (!settings || !editingContact) return;
      const contacts = settings.savedContacts || [];
      const idx = contacts.findIndex(c => c.id === editingContact.id);
      let newContacts = [...contacts];
      if (idx > -1) newContacts[idx] = editingContact;
      else newContacts.push(editingContact);
      handleSaveSettings({ ...settings, savedContacts: newContacts });
      setEditingContact(null);
  };
  const deleteContact = (id: string) => {
      if (!settings || !confirm('حذف شود؟')) return;
      handleSaveSettings({ ...settings, savedContacts: settings.savedContacts.filter(c => c.id !== id) });
  };

  // Template Handlers
  const saveTemplate = (tpl: PrintTemplate) => {
      if (!settings) return;
      const templates = settings.printTemplates || [];
      const idx = templates.findIndex(t => t.id === tpl.id);
      let newTemplates = [...templates];
      if (idx > -1) newTemplates[idx] = tpl;
      else newTemplates.push(tpl);
      handleSaveSettings({ ...settings, printTemplates: newTemplates });
      setShowTemplateDesigner(false);
      setEditingTemplate(null);
  };
  const deleteTemplate = (id: string) => {
      if (!settings || !confirm('حذف شود؟')) return;
      handleSaveSettings({ ...settings, printTemplates: settings.printTemplates?.filter(t => t.id !== id) });
  };

  if (loading || !settings) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in relative">
        
        {showTemplateDesigner && (
            <PrintTemplateDesigner 
                onSave={saveTemplate}
                onCancel={() => { setShowTemplateDesigner(false); setEditingTemplate(null); }}
                initialTemplate={editingTemplate}
            />
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-4">
            <div className="flex items-center gap-3">
                <div className="bg-slate-800 p-3 rounded-2xl text-white"><SettingsIcon size={24}/></div>
                <div><h1 className="text-2xl font-black text-slate-800">تنظیمات سیستم</h1><p className="text-gray-500 text-sm">مدیریت اطلاعات پایه و پیکربندی</p></div>
            </div>
            <div className="flex bg-white p-1 rounded-xl shadow-sm border overflow-x-auto max-w-full">
                <button onClick={() => setActiveTab('companies')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'companies' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>شرکت‌ها و حساب‌ها</button>
                <button onClick={() => setActiveTab('general')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'general' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>عمومی و پایه</button>
                <button onClick={() => setActiveTab('notifications')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'notifications' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>اطلاع‌رسانی</button>
                <button onClick={() => setActiveTab('printing')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'printing' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>قالب‌های چاپ</button>
                <button onClick={() => setActiveTab('fiscal')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'fiscal' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>سال مالی</button>
                <button onClick={() => setActiveTab('fax')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'fax' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>فکس آنلاین</button>
            </div>
        </div>

        {/* Companies Tab */}
        {activeTab === 'companies' && (
            <div className="space-y-6">
                <div className="flex justify-end"><button onClick={() => setEditingCompany({ id: generateUUID(), name: '', banks: [] })} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20"><Plus size={18}/> افزودن شرکت</button></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {settings.companies?.map(comp => (
                        <div key={comp.id} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all group relative">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden border">{comp.logo ? <img src={comp.logo} className="w-full h-full object-cover"/> : <Building2 className="text-gray-400"/>}</div>
                                    <div><h3 className="font-bold text-lg text-gray-800">{comp.name}</h3><div className="text-xs text-gray-500">{comp.banks?.length || 0} حساب بانکی</div></div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingCompany(comp)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><SettingsIcon size={16}/></button>
                                    <button onClick={() => deleteCompany(comp.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                                </div>
                            </div>
                            <div className="space-y-1">{comp.banks?.slice(0, 3).map(b => (<div key={b.id} className="text-xs bg-gray-50 p-2 rounded flex justify-between"><span>{b.bankName}</span><span className="font-mono">{b.accountNumber}</span></div>))}</div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* General Tab */}
        {activeTab === 'general' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Database size={20}/> اطلاعات پایه</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">لیست بانک‌های سیستم</label>
                            <div className="flex gap-2 mb-2"><input className="flex-1 border rounded p-2 text-sm" value={newBankName} onChange={e => setNewBankName(e.target.value)} placeholder="نام بانک..." /><button onClick={() => { if(newBankName){ handleSaveSettings({...settings, bankNames: [...(settings.bankNames||[]), newBankName]}); setNewBankName(''); } }} className="bg-blue-600 text-white p-2 rounded"><Plus size={16}/></button></div>
                            <div className="flex flex-wrap gap-2">{settings.bankNames?.map(b => (<span key={b} className="bg-gray-100 px-2 py-1 rounded text-xs flex items-center gap-1">{b} <button onClick={() => handleSaveSettings({...settings, bankNames: settings.bankNames.filter(n => n !== b)})} className="hover:text-red-500"><X size={12}/></button></span>))}</div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">گروه‌های کالایی</label>
                            <div className="flex gap-2 mb-2"><input className="flex-1 border rounded p-2 text-sm" value={newCommodity} onChange={e => setNewCommodity(e.target.value)} placeholder="گروه کالا..." /><button onClick={() => { if(newCommodity){ handleSaveSettings({...settings, commodityGroups: [...(settings.commodityGroups||[]), newCommodity]}); setNewCommodity(''); } }} className="bg-green-600 text-white p-2 rounded"><Plus size={16}/></button></div>
                            <div className="flex flex-wrap gap-2">{settings.commodityGroups?.map(g => (<span key={g} className="bg-gray-100 px-2 py-1 rounded text-xs flex items-center gap-1">{g} <button onClick={() => handleSaveSettings({...settings, commodityGroups: settings.commodityGroups.filter(n => n !== g)})} className="hover:text-red-500"><X size={12}/></button></span>))}</div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">شرکت‌های بیمه</label>
                            <div className="flex gap-2 mb-2"><input className="flex-1 border rounded p-2 text-sm" value={newInsurance} onChange={e => setNewInsurance(e.target.value)} placeholder="نام شرکت بیمه..." /><button onClick={() => { if(newInsurance){ handleSaveSettings({...settings, insuranceCompanies: [...(settings.insuranceCompanies||[]), newInsurance]}); setNewInsurance(''); } }} className="bg-orange-600 text-white p-2 rounded"><Plus size={16}/></button></div>
                            <div className="flex flex-wrap gap-2">{settings.insuranceCompanies?.map(c => (<span key={c} className="bg-gray-100 px-2 py-1 rounded text-xs flex items-center gap-1">{c} <button onClick={() => handleSaveSettings({...settings, insuranceCompanies: settings.insuranceCompanies?.filter(n => n !== c)})} className="hover:text-red-500"><X size={12}/></button></span>))}</div>
                        </div>
                    </div>
                </div>
                
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><ImageIcon size={20}/> لوگو و آیکون سیستم</h3>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gray-100 rounded-xl border flex items-center justify-center overflow-hidden">{settings.pwaIcon ? <img src={settings.pwaIcon} className="w-full h-full object-cover"/> : <Upload className="text-gray-400"/>}</div>
                            <div className="flex-1">
                                <p className="text-xs text-gray-500 mb-2">این آیکون در صفحه ورود و PWA نمایش داده می‌شود.</p>
                                <div className="flex gap-2">
                                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingIcon} className="text-xs bg-blue-50 text-blue-600 px-3 py-2 rounded-lg font-bold border border-blue-200">{uploadingIcon ? 'در حال آپلود...' : 'تغییر آیکون'}</button>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                        <h3 className="font-bold text-orange-800 mb-3 flex items-center gap-2"><Truck size={20}/> تنظیمات خروج کارخانه</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">گروه اصلی اطلاع‌رسانی خروج (سرپرست انبار/گروه ۱)</label>
                                <select 
                                    className="w-full border rounded-lg p-2 text-sm bg-white" 
                                    value={settings.exitPermitNotificationGroup || ''} 
                                    onChange={e => handleSaveSettings({...settings, exitPermitNotificationGroup: e.target.value})}
                                >
                                    <option value="">-- ارسال نشود --</option>
                                    {getMergedContactOptions().map(c => (
                                        <option key={`exit_group_${c.number}`} value={c.number}>
                                            {c.name} {c.isGroup ? '(گروه)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">گروه دوم اطلاع‌رسانی (اختیاری)</label>
                                <select 
                                    className="w-full border rounded-lg p-2 text-sm bg-white" 
                                    value={settings.exitPermitNotificationGroup2 || ''} 
                                    onChange={e => handleSaveSettings({...settings, exitPermitNotificationGroup2: e.target.value})}
                                >
                                    <option value="">-- ارسال نشود --</option>
                                    {getMergedContactOptions().map(c => (
                                        <option key={`exit_group2_${c.number}`} value={c.number}>
                                            {c.name} {c.isGroup ? '(گروه)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2">تصویر مجوز خروج پس از تایید مدیر کارخانه و همچنین پس از خروج نهایی به این گروه‌ها ارسال خواهد شد.</p>
                    </div>
                </div>
            </div>
        )}

        {/* Notification Tab */}
        {activeTab === 'notifications' && (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Smartphone size={20}/> تنظیمات واتساپ و تلگرام</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm font-bold block mb-1">شماره واتساپ ربات (ارسال کننده)</label>
                            <input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.whatsappNumber || ''} onChange={e => handleSaveSettings({...settings, whatsappNumber: e.target.value})} placeholder="989..." />
                            <p className="text-[10px] text-gray-400 mt-1">شماره‌ای که ربات روی آن فعال است (جهت نمایش)</p>
                        </div>
                        <div>
                            <label className="text-sm font-bold block mb-1">توکن ربات تلگرام</label>
                            <input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.telegramBotToken || ''} onChange={e => handleSaveSettings({...settings, telegramBotToken: e.target.value})} type="password" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Users size={20}/> دفترچه تلفن (مخاطبین و گروه‌ها)</h3>
                        <button onClick={() => setEditingContact({ id: generateUUID(), name: '', number: '', isGroup: false })} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 hover:bg-blue-700"><Plus size={16}/> افزودن مخاطب</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {settings.savedContacts?.map(contact => (
                            <div key={contact.id} className="border rounded-xl p-3 flex justify-between items-center hover:bg-gray-50 group">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${contact.isGroup ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>{contact.isGroup ? <Users size={16}/> : <Smartphone size={16}/>}</div>
                                    <div><div className="font-bold text-sm">{contact.name}</div><div className="text-xs text-gray-500 font-mono">{contact.number}</div></div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingContact(contact)} className="text-blue-500 p-1 hover:bg-blue-50 rounded"><SettingsIcon size={14}/></button>
                                    <button onClick={() => deleteContact(contact.id)} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Printing Tab */}
        {activeTab === 'printing' && (
            <div className="space-y-6">
                <div className="flex justify-end"><button onClick={() => { setEditingTemplate(null); setShowTemplateDesigner(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold hover:bg-indigo-700 shadow-lg"><Plus size={18}/> طراحی قالب جدید</button></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {settings.printTemplates?.map(tpl => (
                        <div key={tpl.id} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-gray-800">{tpl.name}</h3>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingTemplate(tpl); setShowTemplateDesigner(true); }} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><SettingsIcon size={16}/></button>
                                    <button onClick={() => deleteTemplate(tpl.id)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><Trash2 size={16}/></button>
                                </div>
                            </div>
                            <div className="text-xs text-gray-500 flex gap-2">
                                <span className="bg-gray-100 px-2 py-0.5 rounded">{tpl.pageSize}</span>
                                <span className="bg-gray-100 px-2 py-0.5 rounded">{tpl.orientation === 'portrait' ? 'عمودی' : 'افقی'}</span>
                                <span className="bg-gray-100 px-2 py-0.5 rounded">{tpl.fields.length} فیلد</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Fiscal Year Tab */}
        {activeTab === 'fiscal' && <FiscalYearManager />}

        {/* Fax Tab */}
        {activeTab === 'fax' && <FaxModule currentUser={users.find(u => u.username === 'admin') || {role:'admin', fullName:'Admin', id:'1', username:'admin'}} settings={settings} />}

        {/* --- MODALS --- */}
        
        {/* Company Modal */}
        {editingCompany && (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between mb-6"><h3 className="font-bold text-lg">مدیریت شرکت</h3><button onClick={() => setEditingCompany(null)}><X size={24} className="text-gray-400"/></button></div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold block mb-1">نام شرکت</label><input className="w-full border rounded p-2" value={editingCompany.name} onChange={e => setEditingCompany({...editingCompany, name: e.target.value})} /></div>
                            <div><label className="text-xs font-bold block mb-1">شناسه ملی</label><input className="w-full border rounded p-2" value={editingCompany.nationalId || ''} onChange={e => setEditingCompany({...editingCompany, nationalId: e.target.value})} /></div>
                            <div><label className="text-xs font-bold block mb-1">شماره ثبت</label><input className="w-full border rounded p-2" value={editingCompany.registrationNumber || ''} onChange={e => setEditingCompany({...editingCompany, registrationNumber: e.target.value})} /></div>
                            <div><label className="text-xs font-bold block mb-1">کد اقتصادی</label><input className="w-full border rounded p-2" value={editingCompany.economicCode || ''} onChange={e => setEditingCompany({...editingCompany, economicCode: e.target.value})} /></div>
                            <div className="col-span-2"><label className="text-xs font-bold block mb-1">آدرس</label><input className="w-full border rounded p-2" value={editingCompany.address || ''} onChange={e => setEditingCompany({...editingCompany, address: e.target.value})} /></div>
                        </div>
                        
                        <div className="border-t pt-4">
                            <div className="flex justify-between items-center mb-2"><h4 className="font-bold text-sm text-gray-600">حساب‌های بانکی</h4><button onClick={() => setEditingBank({ id: generateUUID(), bankName: '', accountNumber: '' })} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">+ افزودن حساب</button></div>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {editingCompany.banks?.map(b => (
                                    <div key={b.id} className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm border">
                                        <div><span className="font-bold">{b.bankName}</span> - <span className="font-mono">{b.accountNumber}</span></div>
                                        <div className="flex gap-1"><button onClick={() => setEditingBank(b)} className="text-blue-500"><SettingsIcon size={14}/></button><button onClick={() => setEditingCompany({...editingCompany, banks: editingCompany.banks?.filter(x => x.id !== b.id)})} className="text-red-500"><Trash2 size={14}/></button></div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <button onClick={() => setEditingCompany(null)} className="px-4 py-2 border rounded text-gray-600">انصراف</button>
                            <button onClick={saveCompany} className="px-6 py-2 bg-blue-600 text-white rounded font-bold">ذخیره</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Bank Modal */}
        {editingBank && editingCompany && (
            <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-scale-in">
                    <div className="flex justify-between mb-4"><h3 className="font-bold text-lg">ویرایش حساب بانکی</h3><button onClick={() => setEditingBank(null)}><X size={20}/></button></div>
                    <div className="space-y-3">
                        <div><label className="text-xs font-bold block mb-1">نام بانک</label><input className="w-full border rounded p-2" value={editingBank.bankName} onChange={e => setEditingBank({...editingBank, bankName: e.target.value})} list="bank-names" /><datalist id="bank-names">{settings.bankNames?.map(b => <option key={b} value={b}/>)}</datalist></div>
                        <div><label className="text-xs font-bold block mb-1">شماره حساب / کارت</label><input className="w-full border rounded p-2 dir-ltr" value={editingBank.accountNumber || ''} onChange={e => setEditingBank({...editingBank, accountNumber: e.target.value})} /></div>
                        <div><label className="text-xs font-bold block mb-1">شماره شبا</label><input className="w-full border rounded p-2 dir-ltr" value={editingBank.sheba || ''} onChange={e => setEditingBank({...editingBank, sheba: e.target.value})} /></div>
                        
                        <div className="bg-gray-50 p-3 rounded border mt-2">
                            <label className="text-xs font-bold block mb-2 text-gray-600">قالب چاپ چک</label>
                            <select className="w-full border rounded p-2 text-sm bg-white" value={editingBank.formLayoutId || ''} onChange={e => setEditingBank({...editingBank, formLayoutId: e.target.value})}>
                                <option value="">-- پیش‌فرض سیستم --</option>
                                {settings.printTemplates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>

                        {/* Internal Transfer Templates */}
                        <div className="bg-blue-50 p-3 rounded border border-blue-100 mt-2 space-y-2">
                            <label className="text-xs font-bold block text-blue-800">قالب‌های فیش داخلی (رسید)</label>
                            <select className="w-full border rounded p-1.5 text-xs bg-white" value={editingBank.internalTransferTemplateId || ''} onChange={e => setEditingBank({...editingBank, internalTransferTemplateId: e.target.value})}>
                                <option value="">-- قالب پیش‌فرض --</option>
                                {settings.printTemplates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            
                            <label className="flex items-center gap-2 text-xs cursor-pointer mt-2">
                                <input type="checkbox" checked={editingBank.enableDualPrint} onChange={e => setEditingBank({...editingBank, enableDualPrint: e.target.checked})} className="rounded text-blue-600"/>
                                <span>فعال‌سازی چاپ دوگانه (برداشت/واریز)</span>
                            </label>

                            {editingBank.enableDualPrint && (
                                <div className="grid grid-cols-2 gap-2 mt-2 animate-fade-in">
                                    <div>
                                        <span className="text-[10px] text-gray-500 block mb-1">قالب برداشت</span>
                                        <select className="w-full border rounded p-1 text-xs" value={editingBank.internalWithdrawalTemplateId || ''} onChange={e => setEditingBank({...editingBank, internalWithdrawalTemplateId: e.target.value})}>
                                            <option value="">انتخاب...</option>
                                            {settings.printTemplates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-gray-500 block mb-1">قالب واریز</span>
                                        <select className="w-full border rounded p-1 text-xs" value={editingBank.internalDepositTemplateId || ''} onChange={e => setEditingBank({...editingBank, internalDepositTemplateId: e.target.value})}>
                                            <option value="">انتخاب...</option>
                                            {settings.printTemplates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setEditingBank(null)} className="px-4 py-2 border rounded text-gray-600 text-sm">انصراف</button>
                            <button onClick={saveBank} className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-bold">تایید</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Contact Modal */}
        {editingContact && (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-scale-in">
                    <div className="flex justify-between mb-4"><h3 className="font-bold text-lg">مخاطب / گروه</h3><button onClick={() => setEditingContact(null)}><X size={20}/></button></div>
                    <div className="space-y-3">
                        <div><label className="text-xs font-bold block mb-1">نام مخاطب / گروه</label><input className="w-full border rounded p-2" value={editingContact.name} onChange={e => setEditingContact({...editingContact, name: e.target.value})} /></div>
                        <div><label className="text-xs font-bold block mb-1">شماره / آیدی گروه</label><input className="w-full border rounded p-2 dir-ltr" value={editingContact.number} onChange={e => setEditingContact({...editingContact, number: e.target.value})} placeholder="989..." /></div>
                        <label className="flex items-center gap-2 cursor-pointer bg-gray-50 p-2 rounded"><input type="checkbox" checked={editingContact.isGroup} onChange={e => setEditingContact({...editingContact, isGroup: e.target.checked})} className="w-4 h-4"/> <span className="text-sm">این یک گروه واتساپ است</span></label>
                        <button onClick={saveContact} className="w-full bg-blue-600 text-white py-2 rounded font-bold mt-2">ذخیره</button>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};

export default Settings;
