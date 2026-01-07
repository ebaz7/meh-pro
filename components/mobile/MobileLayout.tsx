
import React from 'react';
import { Home, PlusCircle, ListChecks, User as UserIcon, Menu } from 'lucide-react';
import { User } from '../../types';

interface MobileLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  onLogout: () => void;
  unreadCount: number;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  currentUser,
  unreadCount 
}) => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100 pb-20">
      {/* Mobile Header */}
      <header className="bg-white shadow-sm p-4 sticky top-0 z-50 flex justify-between items-center safe-pt">
        <div>
          <h1 className="font-black text-lg text-gray-800">سیستم مالی</h1>
          <p className="text-xs text-gray-500">{currentUser.fullName}</p>
        </div>
        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold shadow-sm border border-blue-200">
            {currentUser.fullName.charAt(0)}
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 p-4 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center py-3 pb-safe z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <button 
          onClick={() => setActiveTab('dashboard')} 
          className={`flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <Home size={24} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
          <span className="text-[10px] font-bold">خانه</span>
        </button>

        <button 
          onClick={() => setActiveTab('create')} 
          className={`flex flex-col items-center gap-1 ${activeTab === 'create' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <PlusCircle size={24} strokeWidth={activeTab === 'create' ? 2.5 : 2} />
          <span className="text-[10px] font-bold">ثبت جدید</span>
        </button>

        <button 
          onClick={() => setActiveTab('manage')} 
          className={`flex flex-col items-center gap-1 ${activeTab === 'manage' ? 'text-blue-600' : 'text-gray-400'} relative`}
        >
          <div className="relative">
            <ListChecks size={24} strokeWidth={activeTab === 'manage' ? 2.5 : 2} />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>}
          </div>
          <span className="text-[10px] font-bold">کارتابل</span>
        </button>

        <button 
          onClick={() => setActiveTab('settings')} 
          className={`flex flex-col items-center gap-1 ${activeTab === 'settings' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <Menu size={24} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
          <span className="text-[10px] font-bold">منو</span>
        </button>
      </nav>
    </div>
  );
};

export default MobileLayout;
