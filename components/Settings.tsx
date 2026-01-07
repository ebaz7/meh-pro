
import React, { useState, useEffect } from 'react';
import { SystemSettings, Company, CompanyBank, CustomRole, Contact, User } from '../types';
import { getSettings, saveSettings } from '../services/storageService';
import { getUsers } from '../services/authService';
import { generateUUID } from '../constants';
import { Save, Plus, Trash2, Building2, Landmark, Users, Phone, Bell, Key, Settings as SettingsIcon, Truck, Database, Shield, FileText } from 'lucide-react';
import { FiscalYearManager } from './FiscalModule';
import PrintTemplateDesigner from './PrintTemplateDesigner';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [newCompany, setNewCompany] = useState('');
  const [newBank, setNewBank] = useState({ name: '', account: '', sheba: '' });
  const [selectedCompanyForBank, setSelectedCompanyForBank] = useState<string | null>(null);
  const [newRole, setNewRole] = useState({ id: '', label: '' });
  const [newContact, setNewContact] = useState({ name: '', number: '', isGroup: false });
  const [showTemplateDesigner, setShowTemplateDesigner] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [s, u] = await Promise.all([getSettings(), getUsers()]);
        setSettings(s);
        setUsers(u);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    if (settings) {
      await saveSettings(settings);
      alert('تنظیمات با موفقیت ذخیره شد.');
      window.location.reload();
    }
  };

  const addCompany = () => {
    if (newCompany && settings) {
      const company: Company = { id: generateUUID(), name: newCompany, banks: [] };
      setSettings({ ...settings, companies: [...(settings.companies || []), company], companyNames: [...(settings.companyNames || []), newCompany] });
      setNewCompany('');
    }
  };

  const removeCompany = (id: string) => {
    if (settings) {
      const newCompanies = settings.companies?.filter(c => c.id !== id) || [];
      setSettings({ ...settings, companies: newCompanies, companyNames: newCompanies.map(c => c.name) });
    }
  };

  const addBank = () => {
    if (selectedCompanyForBank && newBank.name && settings) {
      const updatedCompanies = settings.companies?.map(c => {
        if (c.name === selectedCompanyForBank) {
          return { ...c, banks: [...(c.banks || []), { id: generateUUID(), bankName: newBank.name, accountNumber: newBank.account, sheba: newBank.sheba }] };
        }
        return c;
      });
      setSettings({ ...settings, companies: updatedCompanies });
      setNewBank({ name: '', account: '', sheba: '' });
    }
  };

  const removeBank = (companyName: string, bankId: string) => {
    if (settings) {
      const updatedCompanies = settings.companies?.map(c => {
        if (c.name === companyName) {
          return { ...c, banks: c.banks?.filter(b => b.id !== bankId) };
        }
        return c;
      });
      setSettings({ ...settings, companies: updatedCompanies });
    }
  };

  const addRole = () => {
    if (newRole.id && newRole.label && settings) {
      setSettings({ ...settings, customRoles: [...(settings.customRoles || []), { id: newRole.id, label: newRole.label }] });
      setNewRole({ id: '', label: '' });
    }
  };

  const removeRole = (id: string) => {
    if (settings) {
      setSettings({ ...settings, customRoles: settings.customRoles?.filter(r => r.id !== id) });
    }
  };

  const addContact = () => {
    if (newContact.name && newContact.number && settings) {
      setSettings({ ...settings, savedContacts: [...(settings.savedContacts || []), { id: generateUUID(), ...newContact }] });
      setNewContact({ name: '', number: '', isGroup: false });
    }
  };

  const removeContact = (id: string) => {
    if (settings) {
      setSettings({ ...settings, savedContacts: settings.savedContacts?.filter(c => c.id !== id) });
    }
  };

  const getMergedContactOptions = () => {
      const userContacts = users.filter(u => u.phoneNumber).map(u => ({ id: u.id, name: u.fullName, number: u.phoneNumber!, isGroup: false }));
      const savedContacts = settings?.savedContacts || [];
      return [...userContacts, ...savedContacts];
  };

  if (loading || !settings) return <div className="flex justify-center items-center h-screen">در حال بارگذاری...</div>;

  if (showTemplateDesigner) {
      return (
          <PrintTemplateDesigner 
              onSave={async (tmpl) => {
                  const currentTemplates = settings.printTemplates || [];
                  const exists = currentTemplates.find(t => t.id === tmpl.id);
                  let newTemplates;
                  if (exists) {
                      newTemplates = currentTemplates.map(t => t.id === tmpl.id ? tmpl : t);
                  } else {
                      newTemplates = [...currentTemplates, tmpl];
                  }
                  const newSettings = { ...settings, printTemplates: newTemplates };
                  await saveSettings(newSettings);
                  setSettings(newSettings);
                  setShowTemplateDesigner(false);
                  setEditingTemplateId(null);
              }}
              onCancel={() => { setShowTemplateDesigner(false); setEditingTemplateId(null); }}
              initialTemplate={editingTemplateId ? settings.printTemplates?.find(t => t.id === editingTemplateId) : null}
          />
      );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><SettingsIcon size={28} className="text-blue-600"/> تنظیمات سیستم</h1>
        <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all"><Save size={20}/> ذخیره تغییرات</button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-200">
        <button onClick={() => setActiveTab('general')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'general' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>عمومی و شرکت‌ها</button>
        <button onClick={() => setActiveTab('banks')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'banks' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>حساب‌های بانکی</button>
        <button onClick={() => setActiveTab('print')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'print' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>قالب‌های چاپ</button>
        <button onClick={() => setActiveTab('roles')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'roles' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>نقش‌ها و کاربران</button>
        <button onClick={() => setActiveTab('contacts')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'contacts' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>مخاطبین و اعلان‌ها</button>
        <button onClick={() => setActiveTab('fiscal')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'fiscal' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>سال مالی</button>
        <button onClick={() => setActiveTab('system')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'system' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>سیستمی</button>
      </div>

      <div className="space-y-6">
        {activeTab === 'general' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Building2 size={20}/> مدیریت شرکت‌ها</h2>
            <div className="flex gap-2">
              <input className="flex-1 border rounded-lg p-2 text-sm" placeholder="نام شرکت جدید" value={newCompany} onChange={e => setNewCompany(e.target.value)} />
              <button onClick={addCompany} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700"><Plus size={18}/></button>
            </div>
            <div className="space-y-2">
              {settings.companies?.map(c => (
                <div key={c.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
                  <span className="font-bold text-gray-700">{c.name}</span>
                  <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input type="checkbox" checked={c.showInWarehouse !== false} onChange={e => {
                              const updated = settings.companies!.map(comp => comp.id === c.id ? { ...comp, showInWarehouse: e.target.checked } : comp);
                              setSettings({ ...settings, companies: updated });
                          }} className="w-4 h-4 rounded text-blue-600"/>
                          نمایش در انبار
                      </label>
                      <button onClick={() => removeCompany(c.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="border-t pt-4 mt-4">
                <h3 className="font-bold text-gray-800 mb-2">شماره‌گذاری</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-bold text-gray-600 block mb-1">شماره فعلی دستور پرداخت</label>
                        <input type="number" className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.currentTrackingNumber} onChange={e => setSettings({...settings, currentTrackingNumber: Number(e.target.value)})} />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-gray-600 block mb-1">شماره فعلی مجوز خروج</label>
                        <input type="number" className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.currentExitPermitNumber} onChange={e => setSettings({...settings, currentExitPermitNumber: Number(e.target.value)})} />
                    </div>
                </div>
            </div>
          </div>
        )}

        {activeTab === 'banks' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Landmark size={20}/> حساب‌های بانکی</h2>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">انتخاب شرکت</label>
                    <select className="w-full border rounded-lg p-2 text-sm" value={selectedCompanyForBank || ''} onChange={e => setSelectedCompanyForBank(e.target.value)}>
                        <option value="">-- انتخاب کنید --</option>
                        {settings.companies?.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                </div>
                {selectedCompanyForBank && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                            <div><label className="text-xs font-bold text-gray-500 block mb-1">نام بانک</label><input className="w-full border rounded-lg p-2 text-sm" placeholder="مثال: ملی" value={newBank.name} onChange={e => setNewBank({...newBank, name: e.target.value})}/></div>
                            <div><label className="text-xs font-bold text-gray-500 block mb-1">شماره حساب / کارت</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" placeholder="1234..." value={newBank.account} onChange={e => setNewBank({...newBank, account: e.target.value})}/></div>
                            <div><label className="text-xs font-bold text-gray-500 block mb-1">شماره شبا (IR...)</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" placeholder="IR..." value={newBank.sheba} onChange={e => setNewBank({...newBank, sheba: e.target.value})}/></div>
                            <button onClick={addBank} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 h-[38px] w-full flex items-center justify-center"><Plus size={18}/></button>
                        </div>
                        <div className="space-y-2">
                            {settings.companies?.find(c => c.name === selectedCompanyForBank)?.banks?.map(b => (
                                <div key={b.id} className="flex justify-between items-center bg-white p-3 rounded-lg border shadow-sm">
                                    <div className="text-sm">
                                        <span className="font-bold text-gray-800 block">{b.bankName}</span>
                                        <span className="text-gray-500 text-xs font-mono">{b.accountNumber}</span>
                                        {b.sheba && <span className="text-gray-400 text-[10px] block font-mono">IR{b.sheba}</span>}
                                    </div>
                                    <button onClick={() => removeBank(selectedCompanyForBank, b.id)} className="text-red-500 hover:text-red-700 p-2"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
          </div>
        )}

        {activeTab === 'print' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><FileText size={20}/> مدیریت قالب‌های چاپ (چک، فیش و ...)</h2>
                    <button onClick={() => setShowTemplateDesigner(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-2"><Plus size={16}/> طراحی قالب جدید</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {settings.printTemplates?.map(t => (
                        <div key={t.id} className="border rounded-xl p-4 flex flex-col gap-2 hover:shadow-md transition-shadow relative group bg-gray-50">
                            <div className="font-bold text-gray-800">{t.name}</div>
                            <div className="text-xs text-gray-500">{t.width}mm x {t.height}mm | {t.fields.length} فیلد</div>
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => { setEditingTemplateId(t.id); setShowTemplateDesigner(true); }} className="flex-1 bg-white border text-blue-600 py-1.5 rounded text-xs font-bold hover:bg-blue-50">ویرایش</button>
                                <button onClick={() => { 
                                    const newTmpls = settings.printTemplates?.filter(pt => pt.id !== t.id);
                                    setSettings({...settings, printTemplates: newTmpls});
                                }} className="bg-white border text-red-500 py-1.5 px-3 rounded text-xs font-bold hover:bg-red-50"><Trash2 size={14}/></button>
                            </div>
                        </div>
                    ))}
                    {(!settings.printTemplates || settings.printTemplates.length === 0) && <div className="text-gray-400 text-sm col-span-full text-center py-8">هیچ قالبی تعریف نشده است.</div>}
                </div>

                <div className="border-t pt-4 mt-6">
                    <h3 className="font-bold text-gray-800 mb-4 text-sm">تخصیص قالب به بانک‌ها</h3>
                    {settings.companies?.map(comp => (
                        <div key={comp.id} className="mb-4">
                            <div className="font-bold text-xs text-gray-500 mb-2">{comp.name}</div>
                            <div className="space-y-2">
                                {comp.banks?.map(bank => (
                                    <div key={bank.id} className="flex flex-col md:flex-row md:items-center gap-2 bg-gray-50 p-2 rounded border">
                                        <div className="text-sm font-bold w-40">{bank.bankName}</div>
                                        <select 
                                            className="border rounded p-1 text-xs flex-1 bg-white" 
                                            value={bank.formLayoutId || ''} 
                                            onChange={e => {
                                                const updatedComps = settings.companies!.map(c => c.id === comp.id ? { 
                                                    ...c, banks: c.banks!.map(b => b.id === bank.id ? { ...b, formLayoutId: e.target.value } : b) 
                                                } : c);
                                                setSettings({ ...settings, companies: updatedComps });
                                            }}
                                        >
                                            <option value="">-- قالب پیش‌فرض (چک) --</option>
                                            {settings.printTemplates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                        
                                        {/* Internal Transfer Template */}
                                        <select 
                                            className="border rounded p-1 text-xs flex-1 bg-white" 
                                            value={bank.internalTransferTemplateId || ''} 
                                            onChange={e => {
                                                const updatedComps = settings.companies!.map(c => c.id === comp.id ? { 
                                                    ...c, banks: c.banks!.map(b => b.id === bank.id ? { ...b, internalTransferTemplateId: e.target.value } : b) 
                                                } : c);
                                                setSettings({ ...settings, companies: updatedComps });
                                            }}
                                        >
                                            <option value="">-- قالب حواله داخلی --</option>
                                            {settings.printTemplates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'roles' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Key size={20}/> مدیریت نقش‌های کاربری</h2>
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1"><label className="text-xs text-gray-500">شناسه نقش (انگلیسی)</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" placeholder="sales_manager" value={newRole.id} onChange={e => setNewRole({...newRole, id: e.target.value})} /></div>
              <div className="flex-1 space-y-1"><label className="text-xs text-gray-500">عنوان نمایشی</label><input className="w-full border rounded-lg p-2 text-sm" placeholder="مدیر فروش" value={newRole.label} onChange={e => setNewRole({...newRole, label: e.target.value})} /></div>
              <button onClick={addRole} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-700 h-[38px]"><Plus size={18}/></button>
            </div>
            <div className="space-y-2">
              {settings.customRoles?.map(r => (
                <div key={r.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
                  <span className="font-bold text-gray-700">{r.label} <span className="text-xs text-gray-400 font-mono font-normal">({r.id})</span></span>
                  <button onClick={() => removeRole(r.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Phone size={20}/> مخاطبین و اعلان‌ها</h2>
            
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h3 className="font-bold text-gray-700 mb-3 text-sm">افزودن مخاطب (جهت ارسال واتساپ)</h3>
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]"><input className="w-full border rounded-lg p-2 text-sm" placeholder="نام مخاطب / گروه" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} /></div>
                    <div className="flex-1 min-w-[150px]"><input className="w-full border rounded-lg p-2 text-sm dir-ltr" placeholder="شماره / ID گروه" value={newContact.number} onChange={e => setNewContact({...newContact, number: e.target.value})} /></div>
                    <label className="flex items-center gap-2 text-xs bg-white border rounded-lg px-3 py-2.5 h-[38px] cursor-pointer"><input type="checkbox" checked={newContact.isGroup} onChange={e => setNewContact({...newContact, isGroup: e.target.checked})} className="w-4 h-4"/> گروه است</label>
                    <button onClick={addContact} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 h-[38px]"><Plus size={18}/></button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    {settings.savedContacts?.map(c => (
                        <div key={c.id} className="flex items-center gap-2 bg-white border px-3 py-1.5 rounded-lg text-sm shadow-sm">
                            {c.isGroup ? <Users size={14} className="text-orange-500"/> : <Phone size={14} className="text-blue-500"/>}
                            <span>{c.name}</span>
                            <button onClick={() => removeContact(c.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2"><Bell size={20}/> تنظیمات اعلان بیجک (واتساپ)</h3>
                <div className="space-y-3">
                    {settings.companies?.filter(c => c.showInWarehouse !== false).map(c => (
                        <div key={c.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-white p-3 rounded-lg border border-blue-100">
                            <div className="font-bold text-gray-700">{c.name}</div>
                            <div>
                                <label className="text-[10px] text-gray-500 block mb-1">مدیر فروش (قیمت‌دار)</label>
                                <select 
                                    className="w-full border rounded p-1.5 text-xs" 
                                    value={settings.companyNotifications?.[c.name]?.salesManager || ''} 
                                    onChange={e => setSettings({
                                        ...settings, 
                                        companyNotifications: { 
                                            ...settings.companyNotifications, 
                                            [c.name]: { ...(settings.companyNotifications?.[c.name] || {}), salesManager: e.target.value } 
                                        }
                                    })}
                                >
                                    <option value="">-- انتخاب --</option>
                                    {getMergedContactOptions().map(opt => <option key={opt.id} value={opt.number}>{opt.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 block mb-1">گروه انبار (بدون قیمت)</label>
                                <select 
                                    className="w-full border rounded p-1.5 text-xs" 
                                    value={settings.companyNotifications?.[c.name]?.warehouseGroup || ''} 
                                    onChange={e => setSettings({
                                        ...settings, 
                                        companyNotifications: { 
                                            ...settings.companyNotifications, 
                                            [c.name]: { ...(settings.companyNotifications?.[c.name] || {}), warehouseGroup: e.target.value } 
                                        }
                                    })}
                                >
                                    <option value="">-- انتخاب --</option>
                                    {getMergedContactOptions().map(opt => <option key={opt.id} value={opt.number}>{opt.name}</option>)}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Factory Exit Settings - Requested Snippet Integrated Here */}
            <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                <h3 className="font-bold text-orange-800 mb-3 flex items-center gap-2"><Truck size={20}/> تنظیمات خروج کارخانه</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-700 block mb-1">شماره گروه اول (سرپرست انبار)</label>
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
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-700 block mb-1">شماره گروه دوم (اختیاری)</label>
                        <select 
                            className="w-full border rounded-lg p-2 text-sm bg-white" 
                            value={settings.exitPermitNotificationGroup2 || ''} 
                            onChange={e => setSettings({...settings, exitPermitNotificationGroup2: e.target.value})}
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
                <p className="text-[10px] text-gray-500 mt-2">پس از تایید مجوز خروج توسط مدیرعامل، تصویر مجوز به این گروه‌ها ارسال خواهد شد.</p>
            </div>

          </div>
        )}

        {activeTab === 'fiscal' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><SettingsIcon size={20}/> مدیریت سال‌های مالی</h2>
                <FiscalYearManager />
            </div>
        )}

        {activeTab === 'system' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Database size={20}/> تنظیمات سیستمی</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">توکن ربات تلگرام</label>
                    <input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.telegramBotToken || ''} onChange={e => setSettings({...settings, telegramBotToken: e.target.value})} placeholder="123456:ABC-..." />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">شناسه عددی مدیر (تلگرام)</label>
                    <input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.telegramAdminId || ''} onChange={e => setSettings({...settings, telegramAdminId: e.target.value})} placeholder="12345678" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">کلید API هوش مصنوعی (Gemini)</label>
                    <input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.geminiApiKey || ''} onChange={e => setSettings({...settings, geminiApiKey: e.target.value})} type="password" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">شماره اختصاصی واتساپ (ربات)</label>
                    <input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.whatsappNumber || ''} onChange={e => setSettings({...settings, whatsappNumber: e.target.value})} placeholder="989..." />
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
