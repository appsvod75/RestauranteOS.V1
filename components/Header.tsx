
import React from 'react';
import { AdminIcon, LogoutIcon, ReceiptIcon, KdsIcon, UploadIcon, CashRegisterIcon } from './icons';
import { UserRole, CompanySettings } from '../types';

interface HeaderProps {
    currentView: string;
    onNavigate: (view: 'start' | 'admin' | 'kds' | 'cashClosing') => void;
    onLogout: () => void;
    allUserRoles: UserRole[];
    branchName?: string;
    onInstallApp?: () => void;
    companySettings: CompanySettings;
    isConnected: boolean;
}

const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onLogout, allUserRoles, branchName, onInstallApp, companySettings, isConnected }) => {
    if (currentView === 'select_branch') return null;

    const isPosView = ['start', 'order', 'completed', 'active_orders_mobile', 'manage_customers'].includes(currentView);
    const isKdsView = currentView === 'kds';
    const isAdminView = currentView === 'admin' || currentView === 'master_settings';

    // Un SuperAdmin es implícitamente un Administrador
    const hasAdminRole = allUserRoles.includes(UserRole.Admin) || allUserRoles.includes(UserRole.SuperAdmin);
    const isCashierOrWaiter = allUserRoles.includes(UserRole.Cashier) || allUserRoles.includes(UserRole.Waiter);
    const isCashierView = currentView === 'cashClosing';

    return (
        <header className="bg-gray-900 text-white border-b border-gray-800 shadow-2xl fixed top-0 left-0 right-0 z-40 h-14 sm:h-16 flex items-center safe-top">
            <div className="w-full px-4 flex justify-between items-center">
                <div className="flex flex-col shrink-0">
                    <div className="flex items-center gap-2">
                        <h1 className="text-base sm:text-lg font-black text-amber-500 tracking-tighter uppercase italic leading-none">
                            {companySettings.name.toUpperCase() || 'SISTEMA POS'}
                        </h1>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    </div>
                    {branchName && (
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] text-gray-500 font-black uppercase truncate max-w-[80px]">{branchName}</span>
                            {!isConnected && <span className="text-[7px] text-red-400 font-black uppercase tracking-widest animate-pulse">SIN CONEXIÓN</span>}
                        </div>
                    )}
                </div>

                <nav className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 pr-1 flex-nowrap ml-auto pl-4">
                    {onInstallApp && (
                        <button
                            onClick={onInstallApp}
                            className="p-2 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20 animate-pulse shrink-0"
                            title="Instalar App"
                        >
                            <UploadIcon className="w-5 h-5" />
                        </button>
                    )}

                    {(isPosView || hasAdminRole || isCashierOrWaiter) && (
                        <button
                            onClick={() => onNavigate('start')}
                            className={`flex items-center gap-2 pr-4 pl-2 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 ${isPosView ? 'bg-amber-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400'
                                }`}
                        >
                            <ReceiptIcon className="w-5 h-5" />
                            <span className="text-[10px] font-black uppercase tracking-widest leading-none">ORDENES HOY</span>
                        </button>
                    )}

                    {(isKdsView || hasAdminRole) && (
                        <button
                            onClick={() => onNavigate('kds')}
                            className={`p-2 rounded-xl transition-all shrink-0 ${isKdsView ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400'
                                }`}
                        >
                            <KdsIcon className="w-5 h-5" />
                        </button>
                    )}

                    {(isCashierView || isCashierOrWaiter) && (
                        <button
                            onClick={() => onNavigate('cashClosing')}
                            className={`flex items-center gap-2 pr-4 pl-2 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 ${isCashierView ? 'bg-emerald-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400'
                                }`}
                        >
                            <CashRegisterIcon className="w-5 h-5" />
                            <span className="text-[10px] font-black uppercase tracking-widest leading-none">CIERRE</span>
                        </button>
                    )}

                    {hasAdminRole && (
                        <button
                            onClick={() => onNavigate('admin')}
                            className={`p-2 rounded-xl transition-all shrink-0 ${isAdminView ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400'
                                }`}
                        >
                            <AdminIcon className="w-5 h-5" />
                        </button>
                    )}

                    <div className="w-px h-6 bg-gray-800 mx-1 shrink-0"></div>

                    <button
                        onClick={onLogout}
                        className="p-2 rounded-xl bg-gray-800 text-red-500 active:bg-red-600 active:text-white shrink-0"
                    >
                        <LogoutIcon className="w-5 h-5" />
                    </button>
                </nav>
            </div>
        </header>
    );
};

export default Header;
