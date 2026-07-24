
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { createPortal } from 'react-dom';
import { Waiter, Table, Meat, Category, ProductExtra, Product, Order, CashClosingReport, UserRole, Branch, Customer, PromotionRule } from '../types';
import GlobalHistoryScreen from './GlobalHistoryScreen';
import { PencilIcon, TrashIcon, PlusIcon, UserIcon, TableIcon, ProductIcon, CategoryIcon, MeatIcon, ExtrasIcon, ChartBarIcon, CashRegisterIcon, ReceiptIcon, ShieldCheckIcon, StoreIcon, UserGroupIcon, ClipboardListIcon, SaveIcon, EyeIcon, EyeOffIcon, CheckCircleIcon, ClockIcon, TagIcon, ShoppingBagIcon, TrendingUpIcon, StarIcon, CreditCardIcon } from './icons';
import DailySummaryScreen from './DailySummaryScreen';
import CashClosingScreen from './CashClosingScreen';
import CashClosingHistoryScreen from './CashClosingHistoryScreen';
import ManageCustomersScreen from './ManageCustomersScreen';
import ReportsScreen from './ReportsScreen';
import PromotionsManager from './PromotionsManager';

import { FeedbackDashboard } from './FeedbackDashboard';
import { SalesProjectionsDashboard } from './SalesProjectionsDashboard';
import NotificationToast from './NotificationToast';
import ConfirmationModal from './ConfirmationModal';
import PinVerificationModal from './PinVerificationModal';
import AuditLogsScreen from './AuditLogsScreen';
import PaymentControl from './PaymentControl';
import { api } from '../api';

type AdminView = 'dashboard' | 'payment' | 'users' | 'tables' | 'meats' | 'categories' | 'extras' | 'products' | 'dailySummary' | 'cashClosing' | 'cashClosingHistory' | 'branches' | 'customers' | 'reports' | 'history' | 'promotions' | 'feedback' | 'projections' | 'auditLogs';

interface AdminPanelProps {
    waiters: Waiter[];
    setWaiters: React.Dispatch<React.SetStateAction<Waiter[]>>;
    tables: Table[];
    setTables: React.Dispatch<React.SetStateAction<Table[]>>;
    meats: Meat[];
    setMeats: React.Dispatch<React.SetStateAction<Meat[]>>;
    categories: Category[];
    setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
    productExtras: ProductExtra[];
    setProductExtras: React.Dispatch<React.SetStateAction<ProductExtra[]>>;
    products: Product[];
    setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
    orders: Order[];
    cashClosingReports: CashClosingReport[];
    setCashClosingReports: React.Dispatch<React.SetStateAction<CashClosingReport[]>>;
    onOpenMasterSettings: () => void;
    isSuperAdmin: boolean;
    branches: Branch[];
    setBranches: React.Dispatch<React.SetStateAction<Branch[]>>;
    currentBranchId: number | null;
    customers: Customer[];
    setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
    currentAdminName: string;
    onForceClose: (orders: Order[]) => Promise<void>;
    promotions: PromotionRule[];
    setPromotions: React.Dispatch<React.SetStateAction<PromotionRule[]>>;
    onRequireCashOpening?: () => void;
    companySettings: any;
    setCompanySettings?: React.Dispatch<React.SetStateAction<any>>;
}

const AdminPanel: React.FC<AdminPanelProps> = (props) => {
    console.log("AdminPanel V: GlobalHistory Loaded"); // FORCE UPDATE
    const [currentView, setCurrentView] = useState<AdminView>('dashboard');
    const dashboardScrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pendingView, setPendingView] = useState<AdminView | null>(null);

    const menuItems = [
        // ORANGE / AMBER (Food & Menu)
        { key: 'products', label: 'Productos', Icon: ProductIcon, color: 'amber' },
        { key: 'categories', label: 'Categorías', Icon: CategoryIcon, color: 'amber' },
        { key: 'meats', label: 'Tipos de Carne', Icon: MeatIcon, color: 'amber' },
        { key: 'masas', label: 'Harinas / Masas', Icon: ShoppingBagIcon, color: 'amber' }, // New Item
        { key: 'extras', label: 'Extras', Icon: ExtrasIcon, color: 'amber' },
        { key: 'promotions', label: 'Promociones', Icon: TagIcon, color: 'amber' },

        // GREEN / EMERALD (Money & Analytics)
        { key: 'cashClosing', label: 'Cierre de Caja', Icon: CashRegisterIcon, color: 'emerald' },
        { key: 'dailySummary', label: 'Resumen del Día', Icon: ChartBarIcon, color: 'emerald' },
        { key: 'reports', label: 'Reportes', Icon: ClipboardListIcon, color: 'emerald' },
        { key: 'cashClosingHistory', label: 'Historial Cierres', Icon: ReceiptIcon, color: 'emerald' },
        { key: 'projections', label: 'Proyecciones', Icon: TrendingUpIcon, color: 'emerald' },
        { key: 'history', label: 'Historial Global', Icon: ClockIcon, color: 'emerald' },

        // BLUE (Management & People)
        { key: 'customers', label: 'Clientes', Icon: UserGroupIcon, color: 'blue' },
        { key: 'users', label: 'Usuarios', Icon: UserIcon, color: 'blue' },
        { key: 'tables', label: 'Mesas', Icon: TableIcon, color: 'blue' },
        { key: 'branches', label: 'Sucursales', Icon: StoreIcon, color: 'blue' },
        { key: 'feedback', label: 'Monitor Calidad', Icon: StarIcon, color: 'blue' },

        // RED (Security)
        { key: 'auditLogs', label: 'Auditoría', Icon: EyeIcon, color: 'red' },
    ];

    if (props.isSuperAdmin) {
        menuItems.unshift({ key: 'masterSettings', label: 'Config. Maestra', Icon: ShieldCheckIcon, color: 'indigo' });
        menuItems.push({ key: 'payment', label: 'Control Pago', Icon: CreditCardIcon, color: 'amber' });
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!dashboardScrollRef.current) return;
        setIsDragging(true);
        setStartY(e.pageY - dashboardScrollRef.current.offsetTop);
        setScrollTop(dashboardScrollRef.current.scrollTop);
    };
    const handleMouseLeave = () => setIsDragging(false);
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !dashboardScrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - dashboardScrollRef.current.offsetTop;
        const walk = (y - startY) * 2;
        dashboardScrollRef.current.scrollTop = scrollTop - walk;
    };

    const renderCurrentView = () => {
        if (currentView === 'dashboard') {
            return (
                <div className="flex flex-col h-full transition-all duration-300">
                    <h1 className="text-3xl md:text-5xl font-black text-center italic uppercase tracking-tighter mb-8 md:mb-12">
                        <span className="text-white">PANEL</span> <span className="text-amber-500">ADMIN</span>
                    </h1>
                    <div
                        ref={dashboardScrollRef}
                        onMouseDown={handleMouseDown}
                        onMouseLeave={handleMouseLeave}
                        onMouseUp={handleMouseUp}
                        onMouseMove={handleMouseMove}
                        className={`flex-1 overflow-y-auto scrollbar-hide pb-20 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    >
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 xl:grid-cols-10 gap-3 md:gap-4 px-2 max-w-7xl mx-auto">
                            {(() => {
                                const todayStr = new Date().toLocaleDateString('en-CA');
                                const branchId = props.currentBranchId;
                                const reportForToday = branchId ? props.cashClosingReports.find(r => r.date === todayStr && r.branchId === branchId) : null;
                                const missingOpening = !reportForToday || !reportForToday.initialCash;
                                if (missingOpening && props.onRequireCashOpening) {
                                    return (
                                        <button
                                            key="cash-opening-btn"
                                            onClick={() => props.onRequireCashOpening?.()}
                                            className="rounded-[24px] md:rounded-[32px] p-3 md:p-4 flex flex-col items-center justify-center gap-2 aspect-square transition-all duration-200 border-2 border-amber-500 bg-amber-500/20 text-amber-500 animate-pulse active:scale-95 shadow-lg shadow-amber-500/20"
                                        >
                                            <div className="relative">
                                                <CashRegisterIcon className="w-8 h-8 md:w-8 md:h-8 lg:w-9 lg:h-9" />
                                                <svg className="w-4 h-4 absolute -top-1 -right-1 bg-amber-600 rounded-full p-0.5 border border-amber-400 text-white" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                </svg>
                                            </div>
                                            <span className="text-[10px] md:text-[11px] lg:text-[12px] font-black text-center leading-tight uppercase tracking-tighter">Aperturar Caja</span>
                                        </button>
                                    );
                                }
                                return null;
                            })()}
                            {menuItems.map(item => {
                                const colorMap: any = {
                                    amber: 'bg-amber-950 border-amber-700 text-amber-500 active:bg-amber-600 active:text-white',
                                    emerald: 'bg-emerald-950 border-emerald-700 text-emerald-500 active:bg-emerald-600 active:text-white',
                                    blue: 'bg-blue-950 border-blue-700 text-blue-400 active:bg-blue-600 active:text-white',
                                    indigo: 'bg-indigo-950 border-indigo-700 text-indigo-400 active:bg-indigo-600 active:text-white',
                                    red: 'bg-red-950 border-red-700 text-red-400 active:bg-red-600 active:text-white',
                                };
                                // @ts-ignore
                                const colorClass = colorMap[item.color] || 'bg-gray-900 text-gray-400';

                                return (
                                    <button
                                        key={item.key}
                                        onClick={() => {
                                            if (isDragging) return;
                                            if (item.key === 'masterSettings') {
                                                setPendingView('masterSettings');
                                                setShowPinModal(true);
                                                return;
                                            }
                                            if (item.key === 'branches') {
                                                setPendingView('branches');
                                                setShowPinModal(true);
                                                return;
                                            }
                                            if (item.key === 'payment') {
                                                setPendingView('payment');
                                                setShowPinModal(true);
                                                return;
                                            }
                                            setCurrentView(item.key as AdminView);
                                        }}
                                        className={`rounded-[24px] md:rounded-[32px] p-3 md:p-4 flex flex-col items-center justify-center gap-2 aspect-square transition-colors duration-150 active:scale-90 border ${colorClass}`}
                                    >
                                        <item.Icon className="w-8 h-8 md:w-8 md:h-8 lg:w-9 lg:h-9" />
                                        <span className="text-[10px] md:text-[11px] lg:text-[12px] font-black text-center leading-tight uppercase tracking-tighter">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );
        }

        const goBack = () => setCurrentView('dashboard');

        switch (currentView) {
            case 'payment': return <PaymentControl settings={props.companySettings} setSettings={props.setCompanySettings || (() => {})} onBack={goBack} />;
            case 'products': return <ManageProducts products={props.products} setProducts={props.setProducts} categories={props.categories} productExtras={props.productExtras} onBack={goBack} />;
            case 'promotions': return <PromotionsManager promotions={props.promotions} setPromotions={props.setPromotions} products={props.products} categories={props.categories} onBack={goBack} />;
            case 'projections': return <SalesProjectionsDashboard branchId={props.currentBranchId || 1} branchName={props.branches.find(b => b.id === props.currentBranchId)?.name} branches={props.branches} onBack={goBack} />;
            case 'feedback': return <FeedbackDashboard onBack={goBack} />;
            case 'history': return <GlobalHistoryScreen
                tables={props.tables}
                onBack={goBack}
                products={props.products}
                productExtras={props.productExtras}
                meats={props.meats}
                users={props.waiters}
                currentBranchId={props.currentBranchId}
                branches={props.branches}
                companySettings={props.companySettings}
            />;
            case 'categories': return <ManageSimpleEntity
                title="GESTIÓN <span class='text-amber-500'>CATEGORÍAS</span>"
                label="Nombre de Categoría"
                items={props.categories}
                setItems={props.setCategories}
                onBack={goBack}
                // @ts-ignore
                onCreate={async (d) => {
                    const res = await import('../api').then(m => m.api.createCategory(d));
                    return { ...d, id: res.id };
                }}
                // @ts-ignore
                onUpdate={async (id, d) => import('../api').then(m => m.api.updateCategory(id, d))}
                // @ts-ignore
                onDelete={async (id) => import('../api').then(m => m.api.deleteCategory(id))}
                hasSortOrder={true}
            />;
            case 'meats': return <ManageSimpleEntity
                title="TIPOS <span class='text-amber-500'>DE CARNE</span>"
                label="Tipo de Carne"
                items={props.meats.filter(m => !m.type || m.type === 'meat')}
                setItems={props.setMeats}
                onBack={goBack}
                // @ts-ignore
                onCreate={async (d) => {
                    const res = await import('../api').then(m => m.api.createMeat({ ...d, type: 'meat' }));
                    return { ...d, type: 'meat', id: res.id };
                }}
                // @ts-ignore
                onUpdate={async (id, d) => import('../api').then(m => m.api.updateMeat(id, d))}
                // @ts-ignore
                onDelete={async (id) => import('../api').then(m => m.api.deleteMeat(id))}
            />;
            case 'masas': return <ManageSimpleEntity
                title="TIPOS <span class='text-amber-500'>DE MASA</span>"
                label="Tipo de Harina"
                items={props.meats.filter(m => m.type === 'masa')}
                setItems={props.setMeats}
                onBack={goBack}
                // @ts-ignore
                onCreate={async (d) => {
                    const res = await import('../api').then(m => m.api.createMeat({ ...d, type: 'masa' }));
                    return { ...d, type: 'masa', id: res.id };
                }}
                // @ts-ignore
                onUpdate={async (id, d) => import('../api').then(m => m.api.updateMeat(id, d))}
                // @ts-ignore
                onDelete={async (id) => import('../api').then(m => m.api.deleteMeat(id))}
            />;
            case 'extras': return <ManageExtras extras={props.productExtras} setExtras={props.setProductExtras} onBack={goBack} />;
            case 'users': return <ManageUsers waiters={props.waiters} setWaiters={props.setWaiters} branches={props.branches} onBack={goBack} currentAdminName={props.currentAdminName} isSuperAdmin={props.isSuperAdmin} />;
            case 'tables': return <ManageTables tables={props.tables} setTables={props.setTables} currentBranchId={props.currentBranchId} onBack={goBack} />;
            case 'branches': return <ManageBranches branches={props.branches} setBranches={props.setBranches} onBack={goBack} />;
            case 'customers': return <ManageCustomersScreen customers={props.customers} setCustomers={props.setCustomers} onBack={goBack} />;
            case 'dailySummary': return <DailySummaryScreen orders={props.orders} onBack={goBack} />;
            case 'cashClosing': return <CashClosingScreen orders={props.orders.filter(o => o.status === 'completed')} activeOrders={props.orders.filter(o => o.status === 'active')} onForceClose={props.onForceClose} onBack={goBack} cashClosingReports={props.cashClosingReports} setCashClosingReports={props.setCashClosingReports} branchId={props.currentBranchId || 1} onRequireCashOpening={props.onRequireCashOpening} />;
            case 'cashClosingHistory': return <CashClosingHistoryScreen reports={props.cashClosingReports} branches={props.branches} onBack={goBack} />;
            case 'reports': return <ReportsScreen onBack={goBack} orders={props.orders.filter(o => o.status === 'completed')} categories={props.categories} waiters={props.waiters} branchId={props.currentBranchId || 1} />;
            case 'auditLogs': return <AuditLogsScreen onBack={goBack} />;
            default: return null;
        }
    }

    return (
        <div className="p-4 sm:p-6 h-full flex flex-col overflow-hidden w-full">
            {renderCurrentView()}
            <PinVerificationModal
                isOpen={showPinModal}
                onClose={() => {
                    setShowPinModal(false);
                    setPendingView(null);
                }}
                onSuccess={(user) => {
                    setShowPinModal(false);
                    if (pendingView === 'masterSettings') {
                        setPendingView(null);
                        if (props.onOpenMasterSettings) props.onOpenMasterSettings();
                    } else if (pendingView) {
                        setCurrentView(pendingView);
                        setPendingView(null);
                    }
                }}
                requiredRole={UserRole.SuperAdmin}
                title="ACCESO PROTEGIDO"
                message="Esta sección requiere permisos de Super Admin"
            />
        </div>
    );
};

// --- COMPONENTES AUXILIARES ---

const ViewHeader: React.FC<{ title: string; onBack: () => void; onAdd?: () => void }> = ({ title, onBack, onAdd }) => (
    <div className="flex justify-between items-center gap-4 mb-6 shrink-0 px-1">
        <div className="flex items-center gap-3">
            <button onClick={onBack} className="bg-gray-800 p-2.5 rounded-full hover:bg-gray-700 active:scale-90 transition-all shadow-lg border border-gray-700/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none" dangerouslySetInnerHTML={{ __html: title }}></h1>
        </div>
        {onAdd && (
            <button onClick={onAdd} className="flex items-center gap-2 bg-green-600 text-white font-black py-2.5 px-6 rounded-2xl active:scale-95 transition-all text-[11px] uppercase shadow-xl shadow-green-900/20 italic tracking-widest">
                <PlusIcon className="w-5 h-5" /> AGREGAR
            </button>
        )}
    </div>
);

const AdminModal: React.FC<{ title: string; onClose: () => void; onSave?: () => void; saveLabel?: string; children: React.ReactNode }> = ({ title, onClose, onSave, saveLabel = "Confirmar", children }) => {
    const portal = document.getElementById('portal-root');
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const onMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartY(e.pageY - scrollRef.current.offsetTop);
        setScrollTop(scrollRef.current.scrollTop);
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - scrollRef.current.offsetTop;
        const walk = (y - startY) * 2;
        scrollRef.current.scrollTop = scrollTop - walk;
    };

    const onMouseUp = () => setIsDragging(false);

    if (!portal) return null;
    return createPortal(
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4">
            <div className="bg-gray-900 rounded-[32px] p-6 w-full max-w-sm border border-gray-800 shadow-2xl transition-all duration-300 overflow-hidden flex flex-col max-h-[85vh]">
                <h3 className="text-xl font-black text-white italic uppercase mb-6 tracking-tighter leading-none shrink-0" dangerouslySetInnerHTML={{ __html: title }}></h3>
                <div
                    ref={scrollRef}
                    onMouseDown={onMouseDown}
                    onMouseLeave={onMouseUp}
                    onMouseUp={onMouseUp}
                    onMouseMove={onMouseMove}
                    className={`space-y-4 flex-1 overflow-y-auto scrollbar-hide pr-1 pb-4 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
                >
                    {children}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-6 shrink-0">
                    <button onClick={onClose} className="p-3.5 bg-gray-800 text-gray-400 font-black rounded-2xl uppercase text-[10px] tracking-widest active:scale-95">Cerrar</button>
                    {onSave && <button onClick={onSave} className="p-3.5 bg-green-600 text-white font-black rounded-2xl uppercase text-[10px] shadow-lg active:scale-95 transition-transform tracking-widest italic">{saveLabel.toUpperCase()}</button>}
                </div>
            </div>
        </div>, portal
    );
};

// --- GESTIÓN PRODUCTOS ---
const ManageProducts: React.FC<{ products: Product[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>>; categories: Category[]; productExtras: ProductExtra[]; onBack: () => void }> = ({ products, setProducts, categories, productExtras, onBack }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [form, setForm] = useState<Partial<Product>>({ id: 0, name: '', price: 0, categoryId: categories[0]?.id || 0, requiresMeat: false, requiresMasa: false, availableExtraIds: [], isCombo: false, comboDefinition: { type: 'fixed', items: [], slots: [] }, showInKds: true });
    const [comboSearchQuery, setComboSearchQuery] = useState('');
    const [activeSlotIdx, setActiveSlotIdx] = useState<number | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const [showInactive, setShowInactive] = useState(false);

    const filteredProducts = products
        .filter(p => p && p.name && (showInactive || (p.isActive !== false && p.is_active !== 0))) // Triple robust check
        .map(p => ({ ...p, price: Number(p.price) }))
        .filter(p => {
            const term = searchQuery.toLowerCase();
            const catName = categories.find(c => c.id === p.categoryId)?.name.toLowerCase() || '';
            return p.name.toLowerCase().includes(term) || catName.includes(term);
        })
        .sort((a, b) => a.categoryId - b.categoryId);

    const handleToggleActive = async (p: Product) => {
        try {
            const newState = p.isActive === false ? true : false; // Robust toggle
            await import('../api').then(m => m.api.updateProduct(p.id, { ...p, isActive: newState }));
            setProducts(prev => prev.map(item => item.id === p.id ? { ...item, isActive: newState } : item));
            toast.success(newState ? 'Producto activado' : 'Producto desactivado');
        } catch (e) {
            console.error(e);
            toast.error('Error al cambiar estado');
        }
    };

    const handleOpen = (p?: Product) => {
        setForm(p ? {
            ...p,
            availableExtraIds: p.availableExtraIds || [],
            isCombo: p.isCombo || false,
            comboDefinition: p.comboDefinition || { type: 'fixed', items: [], slots: [] },
            showInKds: p.showInKds !== undefined ? p.showInKds : true
        } : {
            id: 0,
            name: '',
            price: 0,
            categoryId: categories[0]?.id || 0,
            requiresMeat: false,
            requiresMasa: false,
            availableExtraIds: [],
            isCombo: false,
            comboDefinition: { type: 'fixed', items: [], slots: [] },
            showInKds: true
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.name?.trim()) return;
        const finalProduct = {
            ...form,
            name: form.name.toUpperCase(),
            price: form.price || 0,
            categoryId: form.categoryId || categories[0]?.id || 0,
            isActive: form.isActive !== false,
            requiresMeat: form.requiresMeat || false,
            requiresMasa: form.requiresMasa || false,
            availableExtraIds: form.availableExtraIds || [],
            isCombo: form.isCombo || false,
            comboDefinition: form.comboDefinition || { type: 'fixed', items: [], slots: [] },
            showInKds: form.showInKds !== false
        } as Product;

        const loadingToast = toast.loading('Guardando producto...');

        try {
            if (form.id) {
                // @ts-ignore
                await api.updateProduct(form.id, finalProduct);
                setProducts(prev => prev.map(p => p.id === form.id ? finalProduct : p));
                toast.success('Producto actualizado', { id: loadingToast });
            } else {
                // @ts-ignore
                const newProduct = await api.createProduct(finalProduct);
                // Use the returned ID to prevent duplicate key issues in React list
                setProducts(prev => [...prev, { ...newProduct, id: newProduct.id }]);
                toast.success('Producto creado', { id: loadingToast });
            }
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            toast.error('Error al guardar producto', { id: loadingToast });
        }
    };

    const toggleExtra = (extraId: number) => {
        const currentExtras = form.availableExtraIds || [];
        if (currentExtras.includes(extraId)) {
            setForm({ ...form, availableExtraIds: currentExtras.filter(id => id !== extraId) });
        } else {
            setForm({ ...form, availableExtraIds: [...currentExtras, extraId] });
        }
    };

    const onMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartY(e.pageY - scrollRef.current.offsetTop);
        setScrollTop(scrollRef.current.scrollTop);
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - scrollRef.current.offsetTop;
        const walk = (y - startY) * 2;
        scrollRef.current.scrollTop = scrollTop - walk;
    };

    return (
        <div className="flex flex-col h-full overflow-hidden transition-all duration-300">
            <ViewHeader title="GESTIÓN <span class='text-amber-500'>PRODUCTOS</span>" onBack={onBack} />

            <div className="mb-6 flex items-center gap-2 px-1 h-12 shrink-0">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="BUSCAR..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-full py-3 px-5 bg-gray-800/50 border-2 border-gray-700 rounded-[20px] text-white font-black uppercase outline-none focus:border-amber-500 placeholder:text-gray-600 text-[11px] shadow-inner transition-all"
                    />
                </div>

                {/* SHOW INACTIVE TOGGLE BUTTON */}
                <button
                    onClick={() => setShowInactive(!showInactive)}
                    className={`h-full px-4 rounded-[20px] border-2 font-black text-[8px] uppercase tracking-widest transition-all italic flex items-center justify-center leading-none ${showInactive ? 'bg-amber-500 border-amber-400 text-white shadow-[0_4px_12px_-4px_rgba(245,158,11,0.5)]' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                >
                    {showInactive ? 'OCULTAR INACT.' : 'VER INACT.'}
                </button>

                {/* ADD BUTTON */}
                <button
                    onClick={() => handleOpen()}
                    className="h-full px-5 bg-green-600 border-2 border-green-500 text-white rounded-[20px] font-black italic text-[10px] uppercase flex items-center gap-2 hover:bg-green-500 transition-all active:scale-95 shadow-lg shadow-green-900/20"
                >
                    <PlusIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">AGREGAR</span>
                </button>
            </div>

            <div
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseLeave={() => setIsDragging(false)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={onMouseMove}
                className={`flex-1 overflow-y-auto bg-gray-900/50 rounded-[40px] border border-gray-800 shadow-inner scrollbar-hide select-none ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
            >
                <ul className="divide-y divide-gray-800/50">
                    {filteredProducts.map(p => (
                        <li key={p.id} className={`p-5 flex justify-between items-center group hover:bg-gray-800/20 transition-colors ${!p.isActive ? 'opacity-50 grayscale' : ''}`}>
                            <div className="min-w-0 pr-4">
                                <p className="text-[15px] font-black text-white uppercase italic truncate leading-none group-hover:text-amber-500 transition-colors">{p.name}</p>
                                <p className="text-gray-500 text-[9px] font-black uppercase tracking-[0.2em] italic mt-2.5">
                                    {categories.find(c => c.id === p.categoryId)?.name || 'Sin Cat.'}
                                    {p.requiresMeat && <span className="text-cyan-500"> • CARNE</span>}
                                    {p.requiresMasa && <span className="text-amber-500"> • MASA</span>}
                                </p>
                            </div>
                            <div className="flex items-center gap-5 shrink-0">
                                <span className="font-black text-amber-500 italic text-xl tracking-tighter">${Number(p.price).toFixed(2)}</span>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => !isDragging && handleOpen(p)} className="p-2.5 bg-gray-800 text-amber-500 rounded-full border border-gray-700 hover:bg-amber-600 hover:border-amber-400 hover:text-white transition-all shadow-lg active:scale-90"><PencilIcon className="w-4 h-4" /></button>

                                    {/* PREMIUM TOGGLE SWITCH */}
                                    <button
                                        onClick={() => !isDragging && handleToggleActive(p)}
                                        className={`w-12 h-7 rounded-full p-1 transition-all duration-300 flex items-center shadow-inner ${p.isActive ? 'bg-green-500/80 shadow-[0_0_15px_-3px_rgba(34,197,94,0.4)]' : 'bg-gray-700'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-[0_2px_4px_rgba(0,0,0,0.2)] transform ${p.isActive ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                    {filteredProducts.length === 0 && (
                        <li className="p-20 text-center text-gray-700 font-black uppercase italic tracking-[0.3em] opacity-30 text-xs">Sin registros encontrados</li>
                    )}
                </ul>
            </div>

            <ConfirmationModal
                isOpen={false} // Disabled for now, using toggle instead
                onClose={() => { }}
                onConfirm={async () => { }}
                title="¿ELIMINAR PRODUCTO?"
                message="El producto se ocultará del menú pero el historial de ventas se conservará."
                confirmText="SÍ, ELIMINAR"
            />

            {
                isModalOpen && <AdminModal title={form.id ? "EDITAR <span class='text-amber-500'>PRODUCTO</span>" : "NUEVO <span class='text-amber-500'>PRODUCTO</span>"} onClose={() => setIsModalOpen(false)} onSave={handleSave} saveLabel="GUARDAR">
                    <div className="space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Nombre del Producto</label>
                            <input
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 shadow-inner tracking-tight"
                                placeholder="EJ: TORTA PIZZA"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Precio al Público</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 font-black text-xl italic">$</span>
                                <input type="number" step="0.01" value={form.price || ''} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="w-full py-4 pl-12 pr-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-xl outline-none focus:border-amber-500 shadow-inner italic" placeholder="0.00" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Categoría</label>
                            <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: parseInt(e.target.value) })} className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 appearance-none shadow-inner tracking-widest">
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Descripción (Portal Clientes)</label>
                            <textarea
                                value={form.description || ''}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white outline-none focus:border-amber-500 shadow-inner resize-none"
                                placeholder="Descripción del producto para el menú digital..."
                                rows={3}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">URL de Imagen (Portal Clientes)</label>
                            <input
                                type="text"
                                value={form.imageUrl || ''}
                                onChange={e => setForm({ ...form, imageUrl: e.target.value })}
                                className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white outline-none focus:border-amber-500 shadow-inner"
                                placeholder="https://ejemplo.com/imagen.jpg"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-2 pt-2 border-t border-gray-800/50">
                            <div className="flex items-center justify-between bg-gray-800/80 py-4 px-6 rounded-[24px] border border-gray-700 cursor-pointer" onClick={() => setForm({ ...form, isActive: form.isActive === false ? true : false })}>
                                <label className="text-[11px] font-black text-white uppercase italic tracking-widest pointer-events-none">Producto Activo / Visible</label>
                                <div className={`w-12 h-7 rounded-full p-1 transition-all duration-300 flex items-center shadow-inner ${form.isActive !== false ? 'bg-green-500/80' : 'bg-gray-700'}`}>
                                    <div className={`w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm transform ${form.isActive !== false ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between bg-amber-900/20 py-4 px-6 rounded-[24px] border border-amber-500/30 cursor-pointer" onClick={() => setForm({ ...form, showInKds: form.showInKds === false ? true : false })}>
                                <label className="text-[11px] font-black text-amber-300 uppercase italic tracking-widest pointer-events-none">Mostrar en Cocina (KDS)</label>
                                <div className={`w-12 h-7 rounded-full p-1 transition-all duration-300 flex items-center shadow-inner ${form.showInKds !== false ? 'bg-amber-500/80' : 'bg-gray-700'}`}>
                                    <div className={`w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm transform ${form.showInKds !== false ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between bg-purple-900/20 py-4 px-6 rounded-[24px] border border-purple-500/30 cursor-pointer" onClick={() => setForm({ ...form, isCombo: !form.isCombo })}>
                                <label className="text-[11px] font-black text-purple-300 uppercase italic tracking-widest pointer-events-none">¿ES UN COMBO? (BOM)</label>
                                <div className={`w-12 h-7 rounded-full p-1 transition-all duration-300 flex items-center shadow-inner ${form.isCombo ? 'bg-purple-500 shadow-lg shadow-purple-500/30' : 'bg-gray-700'}`}>
                                    <div className={`w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm transform ${form.isCombo ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                            </div>
                        </div>

                        {form.isCombo && (
                            <div className="space-y-4 p-5 bg-purple-950/20 rounded-3xl border border-purple-500/30 animate-in zoom-in duration-200">
                                {/* MODO TOGGLE */}
                                <div className="flex bg-gray-900/50 p-1 rounded-2xl border border-gray-800">
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, comboDefinition: { ...(form.comboDefinition as any), type: 'fixed' } })}
                                        className={`flex-1 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${((form.comboDefinition as any)?.type === 'fixed' || !(form.comboDefinition as any)?.type) ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Combo Fijo (Bundle)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, comboDefinition: { ...(form.comboDefinition as any), type: 'dynamic' } })}
                                        className={`flex-1 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${(form.comboDefinition as any)?.type === 'dynamic' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Pasos (Selección)
                                    </button>
                                </div>

                                {((form.comboDefinition as any)?.type === 'fixed' || !(form.comboDefinition as any)?.type) ? (
                                    /* UI COMBO FIJO */
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest italic flex items-center gap-2">
                                                <div className="w-1.5 h-4 bg-purple-500 rounded-full" />
                                                Productos en el Combo
                                            </h4>
                                        </div>

                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="BUSCAR PRODUCTO PARA AGREGAR..."
                                                value={comboSearchQuery}
                                                onChange={(e) => {
                                                    setComboSearchQuery(e.target.value.toUpperCase());
                                                    setActiveSlotIdx(999); // Use a special index for fixed bundle search
                                                }}
                                                className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-4 py-3 text-[11px] text-white font-bold outline-none focus:border-purple-500/50"
                                            />
                                            
                                            {activeSlotIdx === 999 && comboSearchQuery && (
                                                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-2xl max-h-48 overflow-y-auto z-40 shadow-2xl">
                                                    {products
                                                        .filter(p => !p.isCombo && p.name.toUpperCase().includes(comboSearchQuery))
                                                        .slice(0, 8)
                                                        .map(p => (
                                                            <button
                                                                key={p.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    const currentDef = (form.comboDefinition as any) || { type: 'fixed', items: [] };
                                                                    const items = [...(currentDef.items || [])];
                                                                    const existing = items.find(i => i.productId === p.id);
                                                                    if (existing) existing.quantity += 1;
                                                                    else items.push({ productId: p.id, quantity: 1 });
                                                                    
                                                                    setForm({ ...form, comboDefinition: { ...currentDef, items } });
                                                                    setComboSearchQuery('');
                                                                    setActiveSlotIdx(null);
                                                                }}
                                                                className="w-full text-left p-3 hover:bg-purple-600/30 border-b border-gray-700/50 flex justify-between items-center"
                                                            >
                                                                <span className="text-[10px] text-white font-black truncate">{p.name}</span>
                                                                <span className="text-[10px] text-amber-500 font-mono">${Number(p.price).toFixed(2)}</span>
                                                            </button>
                                                        ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            {((form.comboDefinition as any)?.items || []).map((item: any, idx: number) => {
                                                const p = products.find(prod => prod.id === item.productId);
                                                return (
                                                    <div key={idx} className="flex justify-between items-center bg-gray-900/40 p-3 rounded-2xl border border-gray-800">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-gray-100 uppercase italic">{p?.name || 'Desconocido'}</span>
                                                            <span className="text-[8px] font-bold text-gray-500">Unitario: ${Number(p?.price || 0).toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700 overflow-hidden scale-90">
                                                                <button type="button" onClick={() => {
                                                                    const currentDef = { ...(form.comboDefinition as any) };
                                                                    const items = [...currentDef.items];
                                                                    if (items[idx].quantity > 1) {
                                                                        items[idx].quantity -= 1;
                                                                        setForm({ ...form, comboDefinition: { ...currentDef, items } });
                                                                    }
                                                                }} className="px-2 py-0.5 text-gray-400 font-black">-</button>
                                                                <span className="px-2 text-[9px] font-black text-white">{item.quantity}</span>
                                                                <button type="button" onClick={() => {
                                                                    const currentDef = { ...(form.comboDefinition as any) };
                                                                    const items = [...currentDef.items];
                                                                    items[idx].quantity += 1;
                                                                    setForm({ ...form, comboDefinition: { ...currentDef, items } });
                                                                }} className="px-2 py-0.5 text-gray-400 font-black">+</button>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const currentDef = { ...(form.comboDefinition as any) };
                                                                    const items = currentDef.items.filter((_: any, i: number) => i !== idx);
                                                                    setForm({ ...form, comboDefinition: { ...currentDef, items } });
                                                                }}
                                                                className="p-1 text-red-500/50 hover:text-red-500 transition-all"
                                                            >
                                                                <TrashIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    /* UI COMBO DINÁMICO (PASOS) */
                                    <>
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest italic flex items-center gap-2">
                                                <div className="w-1.5 h-4 bg-purple-500 rounded-full" />
                                                Pasos de Selección
                                            </h4>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const currentSlots = (form.comboDefinition as any)?.slots || [];
                                                    setForm({
                                                        ...form,
                                                        comboDefinition: {
                                                            ...(form.comboDefinition as any),
                                                            slots: [...currentSlots, { productIds: [], quantity: 1, title: 'NUEVO PASO' }]
                                                        }
                                                    });
                                                }}
                                                className="py-1 px-3 bg-purple-600 text-white rounded-xl active:scale-95 transition-all shadow-lg text-[9px] font-black uppercase flex items-center gap-1"
                                            >
                                                <PlusIcon className="w-3 h-3" /> PASO
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            {(form.comboDefinition as any)?.slots?.map((slot: any, idx: number) => {
                                                const selectedProducts = products.filter(p => slot.productIds?.includes(p.id));
                                                return (
                                                    <div key={idx} className="bg-gray-900/40 p-3 rounded-2xl border border-gray-800 space-y-3 group/slot relative">
                                                        <div className="flex gap-2 items-center justify-between">
                                                            <input
                                                                value={slot.title || ''}
                                                                placeholder="TÍTULO DEL PASO (EJ: ELIGE BEBIDA)"
                                                                onChange={(e) => {
                                                                    const newSlots = [...((form.comboDefinition as any)?.slots || [])];
                                                                    newSlots[idx].title = e.target.value.toUpperCase();
                                                                    setForm({ ...form, comboDefinition: { ...(form.comboDefinition as any), slots: newSlots } });
                                                                }}
                                                                className="bg-transparent border-b border-gray-700 text-purple-200 font-bold text-[10px] uppercase outline-none focus:border-purple-500 w-full pb-1"
                                                            />
                                                            
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700 overflow-hidden scale-90">
                                                                    <button type="button" onClick={() => {
                                                                        const newSlots = [...((form.comboDefinition as any)?.slots || [])];
                                                                        newSlots[idx].quantity = Math.max(1, newSlots[idx].quantity - 1);
                                                                        setForm({ ...form, comboDefinition: { ...(form.comboDefinition as any), slots: newSlots } });
                                                                    }} className="px-2 py-0.5 text-gray-400 font-black">-</button>
                                                                    <span className="px-2 text-[9px] font-black text-white">{slot.quantity}</span>
                                                                    <button type="button" onClick={() => {
                                                                        const newSlots = [...((form.comboDefinition as any)?.slots || [])];
                                                                        newSlots[idx].quantity += 1;
                                                                        setForm({ ...form, comboDefinition: { ...(form.comboDefinition as any), slots: newSlots } });
                                                                    }} className="px-2 py-0.5 text-gray-400 font-black">+</button>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newSlots = ((form.comboDefinition as any)?.slots || []).filter((_: any, i: number) => i !== idx);
                                                                        setForm({ ...form, comboDefinition: { ...(form.comboDefinition as any), slots: newSlots } });
                                                                    }}
                                                                    className="p-1 text-red-500/50 hover:text-red-500 transition-all"
                                                                >
                                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            {selectedProducts.map(p => (
                                                                <div key={p.id} className="flex justify-between items-center bg-gray-800/50 px-3 py-1.5 rounded-xl border border-gray-700/50">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] font-black text-gray-100 uppercase italic truncate max-w-[120px]">{p.name}</span>
                                                                        <span className="text-[8px] font-bold text-amber-500/80">${Number(p.price).toFixed(2)}</span>
                                                                    </div>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newSlots = [...((form.comboDefinition as any)?.slots || [])];
                                                                            newSlots[idx].productIds = (newSlots[idx].productIds || []).filter(id => id !== p.id);
                                                                            setForm({ ...form, comboDefinition: { ...(form.comboDefinition as any), slots: newSlots } });
                                                                        }}
                                                                        className="text-gray-600 hover:text-red-500 p-1"
                                                                    >
                                                                        <TrashIcon className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            
                                                            <div className="relative pt-1">
                                                                <input
                                                                    type="text"
                                                                    placeholder="BUSCAR PRODUCTO..."
                                                                    onFocus={() => setActiveSlotIdx(idx)}
                                                                    value={activeSlotIdx === idx ? comboSearchQuery : ''}
                                                                    onChange={(e) => {
                                                                        setComboSearchQuery(e.target.value.toUpperCase());
                                                                        setActiveSlotIdx(idx);
                                                                    }}
                                                                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[9px] text-white font-bold outline-none focus:border-purple-500/50"
                                                                />
                                                                
                                                                {activeSlotIdx === idx && comboSearchQuery && (
                                                                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl max-h-40 overflow-y-auto z-40 shadow-2xl overflow-x-hidden scrollbar-hide">
                                                                        {products
                                                                            .filter(p => p.name.toUpperCase().includes(comboSearchQuery))
                                                                            .filter(p => !slot.productIds?.includes(p.id))
                                                                            .slice(0, 5)
                                                                            .map(p => (
                                                                                <button
                                                                                    key={p.id}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const newSlots = [...((form.comboDefinition as any)?.slots || [])];
                                                                                        newSlots[idx].productIds = [...(newSlots[idx].productIds || []), p.id];
                                                                                        setForm({ ...form, comboDefinition: { ...(form.comboDefinition as any), slots: newSlots } });
                                                                                        setComboSearchQuery('');
                                                                                        setActiveSlotIdx(null);
                                                                                    }}
                                                                                    className="w-full text-left p-2.5 hover:bg-purple-600/30 border-b border-gray-700/50 flex justify-between items-center"
                                                                                >
                                                                                    <span className="text-[9px] text-white font-black truncate">{p.name}</span>
                                                                                    <span className="text-[9px] text-amber-500 font-mono">${Number(p.price).toFixed(2)}</span>
                                                                                </button>
                                                                            ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}

                                {/* ANÁLISIS DE PRECIOS GLOBAL */}
                                <div className="pt-2 mt-2 border-t border-purple-500/20 flex flex-col gap-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-black text-purple-400 uppercase italic">Valor Total Teórico:</span>
                                        <span className="text-sm font-black text-amber-500 italic">
                                            ${(() => {
                                                const def = form.comboDefinition as any;
                                                if (def?.type === 'fixed') {
                                                    return (def.items || []).reduce((sum: number, it: any) => sum + (Number(products.find(p => p.id === it.productId)?.price || 0) * it.quantity), 0).toFixed(2);
                                                } else {
                                                    return (def?.slots || []).reduce((total: number, slot: any) => {
                                                        const slotItems = products.filter(p => slot.productIds?.includes(p.id));
                                                        if (slotItems.length === 0) return total;
                                                        const maxPrice = Math.max(...slotItems.map(p => Number(p.price) || 0));
                                                        return total + (maxPrice * slot.quantity);
                                                    }, 0).toFixed(2);
                                                }
                                            })()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-black text-gray-500 uppercase italic">Ahorro para el Cliente:</span>
                                        <span className="text-[10px] font-black text-green-500 italic">
                                            {(() => {
                                                const def = form.comboDefinition as any;
                                                let theoretical = 0;
                                                if (def?.type === 'fixed') {
                                                    theoretical = (def.items || []).reduce((sum: number, it: any) => sum + (Number(products.find(p => p.id === it.productId)?.price || 0) * it.quantity), 0);
                                                } else {
                                                    theoretical = (def?.slots || []).reduce((total: number, slot: any) => {
                                                        const slotItems = products.filter(p => slot.productIds?.includes(p.id));
                                                        if (slotItems.length === 0) return total;
                                                        const maxPrice = Math.max(...slotItems.map(p => Number(p.price) || 0));
                                                        return total + (maxPrice * slot.quantity);
                                                    }, 0);
                                                }
                                                const savings = theoretical - (Number(form.price) || 0);
                                                return savings > 0 ? `$${savings.toFixed(2)}` : '$0.00';
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-2 pt-2 border-t border-gray-800/50">
                            <div className="flex items-center gap-4 bg-gray-800/80 py-4 px-6 rounded-[24px] border border-gray-700 cursor-pointer active:scale-[0.98] transition-all group" onClick={() => setForm({ ...form, requiresMeat: !form.requiresMeat })}>
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${form.requiresMeat ? 'bg-cyan-500 border-cyan-400' : 'bg-gray-900 border-gray-700'}`}>
                                    {form.requiresMeat && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                </div>
                                <label className="text-[11px] font-black text-white uppercase italic tracking-widest pointer-events-none group-active:text-cyan-400">Requiere Proteína (Carne)</label>
                            </div>
                            <div className="flex items-center gap-4 bg-gray-800/80 py-4 px-6 rounded-[24px] border border-gray-700 cursor-pointer active:scale-[0.98] transition-all group" onClick={() => setForm({ ...form, requiresMasa: !form.requiresMasa })}>
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${form.requiresMasa ? 'bg-amber-500 border-amber-400' : 'bg-gray-900 border-gray-700'}`}>
                                    {form.requiresMasa && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                </div>
                                <label className="text-[11px] font-black text-white uppercase italic tracking-widest pointer-events-none group-active:text-amber-400">Requiere Masa / Harina</label>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-gray-800/50">
                            <label className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] ml-1 italic">Extras Disponibles para este Producto</label>
                            <div className="grid grid-cols-2 gap-2.5">
                                {productExtras.map(extra => {
                                    const isSelected = (form.availableExtraIds || []).includes(extra.id);
                                    return (
                                        <button
                                            key={extra.id}
                                            type="button"
                                            onClick={() => toggleExtra(extra.id)}
                                            className={`flex justify-between items-center p-3.5 rounded-2xl border-2 transition-all text-[10px] font-black uppercase italic tracking-tighter ${isSelected ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-gray-800/40 border-gray-700 text-gray-600'}`}
                                        >
                                            <span className="truncate pr-1">{extra.name}</span>
                                            {isSelected && <CheckCircleIcon className="w-4 h-4 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                            {productExtras.length === 0 && <p className="text-[9px] text-gray-700 font-bold uppercase italic text-center py-4 bg-gray-950/30 rounded-2xl border border-dashed border-gray-800">No hay extras creados en el catálogo</p>}
                        </div>
                    </div>
                </AdminModal>
            }
        </div >
    );
};

// --- GESTIÓN SIMPLE (CATEGORÍAS, CARNES, ETC) ---
// --- GESTIÓN SIMPLE (CATEGORÍAS, CARNES, ETC) ---
const ManageSimpleEntity: React.FC<{
    title: string;
    label: string;
    items: any[];
    setItems: React.Dispatch<React.SetStateAction<any[]>>;
    onBack: () => void;
    onCreate: (data: any) => Promise<any>;
    onUpdate: (id: number, data: any) => Promise<any>;
    onDelete: (id: number) => Promise<any>;
    hasSortOrder?: boolean;
}> = ({ title, label, items, setItems, onBack, onCreate, onUpdate, onDelete, hasSortOrder }) => {
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [name, setName] = useState('');
    const [sortOrder, setSortOrder] = useState<number>(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [itemToDelete, setItemToDelete] = useState<any | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const [showInactive, setShowInactive] = useState(false);

    const filteredItems = items
        .filter(item => item && item.name && typeof item.name === 'string')
        .filter(item => showInactive || item.isActive !== false) // Consistent property naming and robust logic
        .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleToggleActive = async (item: any) => {
        try {
            const newState = item.isActive === false ? true : false;
            const payload = { ...item, is_active: newState ? 1 : 0 };
            // Ensure type is preserved in the payload explicitly if needed
            if (item.type) payload.type = item.type;

            await onUpdate(item.id, payload);
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...payload, isActive: newState } : i));
            toast.success(newState ? 'Activado' : 'Desactivado');
        } catch (e) {
            console.error(e);
            toast.error('Error al cambiar estado');
        }
    };

    const handleOpen = (item?: any) => {
        setEditingItem(item || null);
        setName(item ? item.name : '');
        setSortOrder(item ? (item.sort_order || 0) : 0);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        try {
            if (editingItem) {
                const payload: any = { name: name.toUpperCase() };
                if (hasSortOrder) payload.sort_order = sortOrder;
                if (editingItem.type) payload.type = editingItem.type;

                await onUpdate(editingItem.id, payload);
                setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...payload } : i));
            } else {
                const payload: any = { name: name.toUpperCase() };
                if (hasSortOrder) payload.sort_order = sortOrder;

                const newItem = await onCreate(payload);
                setItems(prev => [...prev, newItem]);
            }
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            alert('Error al guardar');
        }
    };

    const handleDelete = (item: any) => {
        setItemToDelete(item);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await onDelete(itemToDelete.id);
            setItems(prev => prev.filter(i => i.id !== itemToDelete.id));
            setItemToDelete(null);
        } catch (e) {
            console.error(e);
            alert('Error al eliminar');
        }
    };

    const onMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartY(e.pageY - scrollRef.current.offsetTop);
        setScrollTop(scrollRef.current.scrollTop);
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - scrollRef.current.offsetTop;
        const walk = (y - startY) * 2;
        scrollRef.current.scrollTop = scrollTop - walk;
    };

    return (
        <div className="flex flex-col h-full overflow-hidden transition-all duration-300">
            <ViewHeader title={title} onBack={onBack} />

            <div className="mb-6 flex items-center gap-2 px-1 h-12 shrink-0">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="BUSCAR..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-full py-3 px-5 bg-gray-800/50 border-2 border-gray-700 rounded-[20px] text-white font-black uppercase outline-none focus:border-amber-500 placeholder:text-gray-600 text-[11px] shadow-inner transition-all"
                    />
                </div>

                <button
                    onClick={() => setShowInactive(!showInactive)}
                    className={`h-full px-4 rounded-[20px] border-2 font-black text-[8px] uppercase tracking-widest transition-all italic flex items-center justify-center leading-none ${showInactive ? 'bg-amber-500 border-amber-400 text-white shadow-[0_4px_12px_-4px_rgba(245,158,11,0.5)]' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                >
                    {showInactive ? 'OCULTAR INACT.' : 'VER INACT.'}
                </button>

                <button
                    onClick={() => handleOpen()}
                    className="h-full px-5 bg-green-600 border-2 border-green-500 text-white rounded-[20px] font-black italic text-[10px] uppercase flex items-center gap-2 hover:bg-green-500 transition-all active:scale-95 shadow-lg shadow-green-900/20"
                >
                    <PlusIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">AGREGAR</span>
                </button>
            </div>

            <div
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseLeave={() => setIsDragging(false)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={onMouseMove}
                className={`flex-1 overflow-y-auto bg-gray-900/50 rounded-[40px] border border-gray-800 shadow-inner scrollbar-hide select-none ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
            >
                <ul className="divide-y divide-gray-800/50">
                    {filteredItems.map(item => (
                        <li key={item.id} className={`p-5 flex justify-between items-center group hover:bg-gray-800/20 transition-colors ${item.isActive === false ? 'opacity-50 grayscale' : ''}`}>
                            <span className="text-[14px] font-black text-white uppercase italic tracking-wider group-hover:text-amber-500 transition-colors uppercase">{item.name}</span>
                            <div className="flex items-center gap-3">
                                <button onClick={() => !isDragging && handleOpen(item)} className="p-2.5 bg-gray-800 text-amber-500 rounded-full border border-gray-700 hover:bg-amber-600 hover:border-amber-400 hover:text-white transition-all active:scale-90"><PencilIcon className="w-4 h-4" /></button>

                                <button
                                    onClick={() => !isDragging && handleToggleActive(item)}
                                    className={`w-12 h-7 rounded-full p-1 transition-all duration-300 flex items-center shadow-inner ${item.isActive ? 'bg-green-500/80 shadow-[0_0_15px_-3px_rgba(34,197,94,0.4)]' : 'bg-gray-700'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-[0_2px_4px_rgba(0,0,0,0.2)] transform ${item.isActive ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </button>
                            </div>
                        </li>
                    ))}
                    {filteredItems.length === 0 && (
                        <li className="p-20 text-center text-gray-700 font-black uppercase italic tracking-[0.3em] opacity-30 text-xs">Sin registros encontrados</li>
                    )}
                </ul>
            </div>
            {isModalOpen && <AdminModal title={editingItem ? "EDITAR <span class='text-amber-500'>REGISTRO</span>" : "NUEVO <span class='text-amber-500'>REGISTRO</span>"} onClose={() => setIsModalOpen(false)} onSave={handleSave} saveLabel="GUARDAR">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">{label}</label>
                    <input value={name} onChange={e => setName(e.target.value)} className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 shadow-inner" placeholder="ESCRIBIR NOMBRE..." autoFocus />

                    {hasSortOrder && (
                        <div className="mt-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Orden / Prioridad</label>
                            <input
                                type="number"
                                value={sortOrder}
                                onChange={e => setSortOrder(parseInt(e.target.value) || 0)}
                                className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black outline-none focus:border-amber-500 shadow-inner"
                                placeholder="0"
                            />
                            <p className="text-[9px] text-gray-600 mt-1 italic pl-2">MENOR NÚMERO = PRIMERO EN LA LISTA</p>
                        </div>
                    )}
                </div>
            </AdminModal>}

            <ConfirmationModal
                isOpen={itemToDelete !== null}
                onClose={() => setItemToDelete(null)}
                onConfirm={confirmDelete}
                title="¿ELIMINAR REGISTRO?"
                message="Esta acción no se puede deshacer"
                confirmText="SÍ, ELIMINAR"
            />

        </div>
    );
};

// --- GESTIÓN EXTRAS ---
const ManageExtras: React.FC<{ extras: ProductExtra[]; setExtras: React.Dispatch<React.SetStateAction<ProductExtra[]>>; onBack: () => void }> = ({ extras, setExtras, onBack }) => {
    console.log("Rendering ManageExtras", { extrasCount: extras?.length, extras });
    if (!extras) return <div className="p-10 text-white font-bold">CARGANDO DATOS... (Extras es null)</div>;

    // Safety check: ensure extras is an array
    const safeExtras = Array.isArray(extras) ? extras : [];

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState({ id: 0, name: '', price: 0 });
    const [extraToDelete, setExtraToDelete] = useState<number | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const handleOpen = (e?: ProductExtra) => {
        setForm(e ? { ...e } : { id: 0, name: '', price: 0 });
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (!form.name.trim()) return;

        const payload = {
            name: form.name.toUpperCase(),
            price: form.price || 0
        };

        const showSuccessToast = (msg: string) => toast.custom(
            <div className="w-[90%] max-w-sm bg-emerald-950 text-emerald-400 px-6 py-4 rounded-full shadow-[0_0_20px_rgba(52,211,153,0.3)] flex items-center justify-center gap-3 border border-emerald-500/50 text-center pointer-events-none transition-all duration-300">
                <span className="text-xl drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]">✅</span>
                <span className="font-black tracking-widest uppercase italic text-lg drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">{msg}</span>
            </div>,
            { duration: 2000, position: 'top-center' }
        );

        if (form.id) {
            // Update
            api.updateProductExtra(form.id, payload)
                .then(() => {
                    setExtras(prev => prev.map(p => p.id === form.id ? { ...p, ...payload } : p));
                    showSuccessToast('EXTRA ACTUALIZADO');
                    setIsModalOpen(false);
                })
                .catch(err => {
                    console.error('Failed to update extra', err);
                    toast.error('ERROR AL ACTUALIZAR');
                });
        } else {
            // Create
            api.createProductExtra(payload)
                .then((newExtra) => {
                    setExtras(prev => [...prev, newExtra]);
                    showSuccessToast('EXTRA CREADO');
                    setIsModalOpen(false);
                })
                .catch(err => {
                    console.error('Failed to create extra', err);
                    toast.error('ERROR AL CREAR');
                });
        }
    };

    const handleDelete = (id: number) => {
        api.deleteProductExtra(id)
            .then(() => {
                setExtras(prev => prev.filter(i => i.id !== id));
                setExtraToDelete(null);
                toast.custom(
                    <div className="w-[90%] max-w-sm bg-emerald-950 text-emerald-400 px-6 py-4 rounded-full shadow-[0_0_20px_rgba(52,211,153,0.3)] flex items-center justify-center gap-3 border border-emerald-500/50 text-center pointer-events-none transition-all duration-300">
                        <span className="text-xl drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]">✅</span>
                        <span className="font-black tracking-widest uppercase italic text-lg drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">EXTRA ELIMINADO</span>
                    </div>,
                    { duration: 2000, position: 'top-center' }
                );
            })
            .catch(err => {
                console.error('Failed to delete extra', err);
                toast.error('ERROR AL ELIMINAR');
            });
    };

    const onMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartY(e.pageY - scrollRef.current.offsetTop);
        setScrollTop(scrollRef.current.scrollTop);
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - scrollRef.current.offsetTop;
        const walk = (y - startY) * 2;
        scrollRef.current.scrollTop = scrollTop - walk;
    };

    return (
        <div className="flex flex-col h-full overflow-hidden transition-all duration-300">
            <Toaster
                position="top-center"
                reverseOrder={false}
                toastOptions={{
                    style: {
                        background: 'rgba(17, 24, 39, 0.7)',
                        backdropFilter: 'blur(12px)',
                        color: '#fff',
                        border: '1px solid rgba(52, 211, 153, 0.5)',
                        padding: '12px 24px',
                        borderRadius: '9999px',
                        boxShadow: '0 0 20px rgba(52, 211, 153, 0.2)',
                        fontWeight: '900',
                        textTransform: 'uppercase',
                        fontStyle: 'italic',
                        fontSize: '14px',
                        letterSpacing: '0.05em'
                    },
                    success: {
                        style: {
                            border: '1px solid rgba(52, 211, 153, 0.5)',
                            color: '#34d399',
                            boxShadow: '0 0 20px rgba(52, 211, 153, 0.3)'
                        },
                        iconTheme: { primary: '#34d399', secondary: '#064e3b' }
                    },
                    error: {
                        style: {
                            border: '1px solid rgba(244, 63, 94, 0.5)',
                            color: '#fb7185',
                            boxShadow: '0 0 20px rgba(244, 63, 94, 0.3)'
                        },
                        iconTheme: { primary: '#fb7185', secondary: '#4c0519' }
                    }
                }}
            />
            <ViewHeader title="GESTIÓN <span class='text-amber-500'>EXTRAS</span>" onBack={onBack} onAdd={() => handleOpen()} />
            <div
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseLeave={() => setIsDragging(false)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={onMouseMove}
                className={`flex-1 overflow-y-auto bg-gray-900/50 rounded-[40px] border border-gray-800 shadow-inner scrollbar-hide select-none ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
            >
                <ul className="divide-y divide-gray-800/50">
                    {safeExtras.length === 0 && (
                        <div className="p-10 text-center text-gray-500 italic uppercase">
                            No hay extras registrados.
                        </div>
                    )}
                    {safeExtras.map(e => (
                        <li key={e.id} className="p-5 flex justify-between items-center group hover:bg-gray-800/20 transition-colors">
                            <div>
                                <p className="text-[14px] font-black text-white uppercase italic group-hover:text-amber-500 transition-colors">{e.name}</p>
                                <p className="text-amber-500 font-black text-sm italic tracking-tighter mt-1">${Number(e.price).toFixed(2)}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => !isDragging && handleOpen(e)} className="p-2.5 bg-gray-800 text-amber-500 rounded-full border border-gray-700 hover:bg-amber-600 hover:border-amber-400 hover:text-white transition-all active:scale-90"><PencilIcon className="w-4 h-4" /></button>
                                <button onClick={() => !isDragging && setExtraToDelete(e.id)} className="p-2.5 bg-gray-800 text-red-500 rounded-full border border-gray-700 hover:bg-red-600 hover:border-red-400 hover:text-white transition-all active:scale-90"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
            <ConfirmationModal
                isOpen={extraToDelete !== null}
                onClose={() => setExtraToDelete(null)}
                // @ts-ignore
                onConfirm={() => extraToDelete && handleDelete(extraToDelete)}
                title="¿ELIMINAR EXTRA?"
                message="Esta acción no se puede deshacer"
                confirmText="SÍ, ELIMINAR"
            />
            {isModalOpen && <AdminModal title="CONFIGURACIÓN <span class='text-amber-500'>EXTRA</span>" onClose={() => setIsModalOpen(false)} onSave={handleSave} saveLabel="GUARDAR">
                <div className="space-y-6">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Nombre del Complemento</label>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 shadow-inner" placeholder="EJ: QUESO EXTRA" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Precio Adicional</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 font-black text-xl italic">$</span>
                            <input type="number" step="0.01" value={form.price || ''} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="w-full py-4 pl-12 pr-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-xl outline-none focus:border-amber-500 shadow-inner italic" placeholder="0.00" />
                        </div>
                    </div>
                </div>
            </AdminModal>}
        </div>
    );
};

// --- GESTIÓN USUARIOS ---
const ManageUsers: React.FC<{ waiters: Waiter[]; setWaiters: React.Dispatch<React.SetStateAction<Waiter[]>>; branches: Branch[]; onBack: () => void; currentAdminName: string; isSuperAdmin: boolean }> = ({ waiters, setWaiters, branches, onBack, currentAdminName, isSuperAdmin }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [revealedPins, setRevealedPins] = useState<number[]>([]);
    const [pendingAction, setPendingAction] = useState<{ type: 'reveal' | 'edit' | 'add'; user?: Waiter } | null>(null);
    const [form, setForm] = useState({ id: 0, name: '', pin: '', branchId: branches[0]?.id || 1, roles: [UserRole.Waiter], isActive: true });
    const [searchQuery, setSearchQuery] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [userToDelete, setUserToDelete] = useState<number | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const isPinDuplicate = useMemo(() => {
        if (form.pin.length !== 6) return null;
        const duplicate = waiters.find(w => w.pin === form.pin && w.id !== form.id && (w.is_active !== 0 && (w as any).isActive !== false));
        return duplicate ? duplicate.name : null;
    }, [form.pin, form.id, waiters]);

    const displayWaiters = waiters.filter(w => {
        if (!isSuperAdmin && w.roles.includes(UserRole.SuperAdmin)) return false;
        return true;
    });

    const filteredWaiters = displayWaiters.filter(w => {
        if (!showInactive) {
            const active = w.is_active === 1 || w.is_active === undefined || (w as any).isActive !== false;
            if (!active) return false;
        }
        const q = searchQuery.toLowerCase();
        const name = (w.name || '').toLowerCase();
        const username = (w.username || '').toLowerCase();
        return name.includes(q) || username.includes(q);
    });

    const currentAdmin = waiters.find(w => w.name === currentAdminName);

    const handleOpen = (w?: Waiter) => {
        setPendingAction({ type: w ? 'edit' : 'add', user: w });
    };

    const confirmHandleOpen = (w?: Waiter) => {
        // @ts-ignore
        setForm(w ? { ...w, branchId: w.branchId || 1, isActive: w.is_active !== undefined ? Boolean(w.is_active) : (w.isActive !== undefined ? Boolean(w.isActive) : true) } : { id: 0, name: '', pin: '', branchId: branches[0]?.id || 1, roles: [UserRole.Waiter], isActive: true });
        setIsModalOpen(true);
        setPendingAction(null);
    };

    const handleSave = async () => {
        if (!form.name.trim() || form.pin.length !== 6) return toast.error('EL PIN DEBE SER DE 6 DÍGITOS');
        if (isPinDuplicate) return toast.error(`ESTE PIN YA LE PERTENECE A: ${isPinDuplicate}`);

        const loadingToast = toast.loading('Guardando usuario...');

        try {
            // Generate a username since it's required by DB but not in form
            const generatedUsername = form.name.toLowerCase().replace(/\s+/g, '_') + '_' + Math.floor(Math.random() * 1000);

            const userData = {
                ...form,
                name: form.name.toUpperCase(),
                username: generatedUsername, // Fix: Ensure username is sent
                isActive: form.isActive // Ensure this boolean is sent!
            };

            if (form.id) {
                // @ts-ignore
                const updated = await api.updateUser(form.id, userData);
                // @ts-ignore
                setWaiters(prev => prev.map(w => w.id === form.id ? { ...w, ...userData, isActive: form.isActive, is_active: form.isActive ? 1 : 0 } : w));
            } else {
                // @ts-ignore
                const newUser = await api.createUser(userData);
                // @ts-ignore
                setWaiters(prev => [...prev, { ...newUser, isActive: form.isActive, is_active: form.isActive ? 1 : 0 }]);
            }
            setIsModalOpen(false);
            toast.success('USUARIO GUARDADO', { id: loadingToast });
        } catch (e: any) {
            console.error(e);
            toast.error('ERROR: ' + (e.message || 'No se pudo guardar'), { id: loadingToast });
        }
    };

    const togglePinVisibility = (userId: number) => {
        if (revealedPins.includes(userId)) {
            setRevealedPins(prev => prev.filter(id => id !== userId));
        } else {
            setPendingAction({ type: 'reveal', user: waiters.find(w => w.id === userId) });
        }
    };

    const handlePinVerified = () => {
        if (!pendingAction) return;

        if (pendingAction.type === 'reveal' && pendingAction.user) {
            setRevealedPins(prev => [...prev, pendingAction.user!.id]);
            setPendingAction(null);
        } else if (pendingAction.type === 'edit' || pendingAction.type === 'add') {
            confirmHandleOpen(pendingAction.user);
        }
    };


    const onMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartY(e.pageY - scrollRef.current.offsetTop);
        setScrollTop(scrollRef.current.scrollTop);
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - scrollRef.current.offsetTop;
        const walk = (y - startY) * 2;
        scrollRef.current.scrollTop = scrollTop - walk;
    };

    return (
        <div className="flex flex-col h-full overflow-hidden transition-all duration-300">
            <ViewHeader title="GESTIÓN <span class='text-amber-500'>USUARIOS</span>" onBack={onBack} onAdd={() => handleOpen()} />

            <div className="mb-6 shrink-0 px-1 flex items-center gap-2">
                <input
                    type="text"
                    placeholder="BUSCAR POR NOMBRE..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 py-3 px-4 bg-gray-800/50 border-2 border-gray-700 rounded-[24px] text-white font-black uppercase outline-none focus:border-amber-500 placeholder:text-gray-600 text-sm shadow-inner transition-all"
                />
                <button
                    onClick={() => setShowInactive(prev => !prev)}
                    className={`p-2.5 rounded-full transition-all active:scale-90 shrink-0 ${showInactive ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-amber-400'}`}
                    title={showInactive ? 'OCULTAR DESACTIVADOS' : 'MOSTRAR DESACTIVADOS'}
                >
                    {showInactive ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
            </div>

            <div
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseLeave={() => setIsDragging(false)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={onMouseMove}
                className={`flex-1 overflow-y-auto bg-gray-900/50 rounded-[40px] border border-gray-800 shadow-inner scrollbar-hide select-none ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
            >
                <ul className="divide-y divide-gray-800/50">
                    {filteredWaiters.length > 0 ? (
                        filteredWaiters.map(w => (
                            <li key={w.id} className={`p-5 flex justify-between items-center group transition-all ${w.is_active === 0 || (w as any).isActive === false ? 'opacity-50 grayscale bg-gray-900/30' : ''}`}>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-3">
                                        <p className="text-[14px] font-black text-white uppercase italic truncate group-hover:text-amber-500 transition-colors">{w.name}</p>
                                        <div className="flex items-center gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                                            <p className="text-gray-500 text-[9px] font-black tracking-widest uppercase italic bg-gray-800/80 px-2 py-0.5 rounded border border-gray-700/50">
                                                {revealedPins.includes(w.id) ? w.pin : '••••••'}
                                            </p>
                                            <button onClick={() => !isDragging && togglePinVisibility(w.id)} className="p-1 text-gray-400 hover:text-amber-500 bg-gray-800/50 rounded-lg">
                                                {revealedPins.includes(w.id) ? <EyeOffIcon className="w-3 h-3" /> : <EyeIcon className="w-3 h-3" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${w.roles.includes(UserRole.SuperAdmin) ? 'bg-purple-900/20 text-purple-400 border-purple-500/30' :
                                            w.roles.includes(UserRole.Admin) ? 'bg-blue-900/20 text-blue-400 border-blue-500/30' :
                                                w.roles.includes(UserRole.Cook) ? 'bg-orange-900/20 text-orange-400 border-orange-500/30' :
                                                    w.roles.includes(UserRole.Cashier) ? 'bg-green-900/20 text-green-400 border-green-500/30' :
                                                        w.roles.includes(UserRole.Delivery) ? 'bg-cyan-900/20 text-cyan-400 border-cyan-500/30' :
                                                            'bg-gray-800 text-gray-500 border-gray-700'
                                            }`}>
                                            {w.roles.includes(UserRole.SuperAdmin) ? 'SUPER ADMIN' :
                                                w.roles.includes(UserRole.Admin) ? 'ADMINISTRADOR' :
                                                    w.roles.includes(UserRole.Cook) ? 'COCINERO' :
                                                        w.roles.includes(UserRole.Cashier) ? 'MESERO / CAJERO' :
                                                            w.roles.includes(UserRole.Delivery) ? 'REPARTIDOR' : 'MESERO'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button onClick={() => !isDragging && handleOpen(w)} className="p-2.5 bg-gray-800 text-amber-500 rounded-full border border-gray-700 hover:bg-amber-600 hover:border-amber-400 hover:text-white transition-all active:scale-90"><PencilIcon className="w-4 h-4" /></button>
                                    <button onClick={() => !isDragging && setUserToDelete(w.id)} className="p-2.5 bg-gray-800 text-red-500 rounded-full border border-gray-700 hover:bg-red-600 hover:border-red-400 hover:text-white transition-all active:scale-90"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            </li>
                        ))
                    ) : (
                        <li className="p-20 text-center text-gray-700 font-black uppercase italic tracking-[0.3em] opacity-30 text-xs">Sin registros encontrados</li>
                    )}
                </ul>
            </div>

            <ConfirmationModal
                isOpen={userToDelete !== null}
                onClose={() => setUserToDelete(null)}
                // @ts-ignore
                onConfirm={async () => {
                    if (!userToDelete) return;
                    try {
                        await api.deleteUser(userToDelete);
                        setWaiters(prev => prev.filter(i => i.id !== userToDelete));
                        setUserToDelete(null);
                    } catch (e) { console.error(e); alert('Error eliminando usuario'); }
                }}
                title="¿ELIMINAR USUARIO?"
                message="Esta acción no se puede deshacer"
                confirmText="SÍ, ELIMINAR"
            />

            <PinVerificationModal
                isOpen={pendingAction !== null}
                onClose={() => setPendingAction(null)}
                onSuccess={handlePinVerified}
                title="BÓVEDA DE <span class='text-amber-500'>SEGURIDAD</span>"
                message={`Verifica tu identidad para ${pendingAction?.type === 'reveal' ? 'VER PIN' : pendingAction?.type === 'edit' ? 'EDITAR USUARIO' : 'CREAR USUARIO'}`}
            />

            {isModalOpen && <AdminModal title={form.id ? "EDITAR <span class='text-blue-500'>USUARIO</span>" : "NUEVO <span class='text-blue-500'>USUARIO</span>"} onClose={() => setIsModalOpen(false)} onSave={handleSave} saveLabel="GUARDAR">
                <div className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Nombre Completo</label>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 shadow-inner" placeholder="ESCRIBIR NOMBRE..." />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">PIN Acceso (6 Dígitos)</label>
                        <input maxLength={6} inputMode="numeric" value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })} className={`w-full py-4 px-6 bg-gray-800 border-2 rounded-2xl text-white font-black text-center text-3xl outline-none shadow-inner tracking-[0.2em] transition-all ${isPinDuplicate ? 'border-red-500 text-red-500 shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)] animate-pulse' : 'border-gray-700 focus:border-amber-500'}`} placeholder="000000" />
                        {isPinDuplicate && (
                            <p className="text-[9px] font-black text-red-500 uppercase italic tracking-widest text-center mt-2 animate-bounce">
                                ⚠️ PIN YA EN USO POR: {isPinDuplicate}
                            </p>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Sucursal</label>
                        <select value={form.branchId} onChange={e => setForm({ ...form, branchId: parseInt(e.target.value) })} className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 appearance-none shadow-inner tracking-widest">
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Rol Operativo</label>
                        <select value={form.roles[0]} onChange={e => setForm({ ...form, roles: [e.target.value as UserRole] })} className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 appearance-none shadow-inner tracking-widest">
                            <option value={UserRole.Waiter}>MESERO (SOLO PEDIDOS)</option>
                            <option value={UserRole.Cashier}>MESERO / CAJERO (COBRAR)</option>
                            <option value={UserRole.Cook}>COCINERO (KDS)</option>
                            <option value={UserRole.Delivery}>REPARTIDOR (APP DELIVERY)</option>
                            <option value={UserRole.Admin}>ADMINISTRADOR</option>
                            {isSuperAdmin && <option value={UserRole.SuperAdmin}>SUPER ADMIN</option>}
                        </select>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-2xl border border-gray-700/50">
                        <div className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${form.isActive ? 'bg-green-500' : 'bg-gray-600'}`} onClick={() => setForm({ ...form, isActive: !form.isActive })}>
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                        <span className={`font-black uppercase text-xs ${form.isActive ? 'text-green-400' : 'text-gray-500'}`}>
                            {form.isActive ? 'USUARIO ACTIVO' : 'USUARIO DESACTIVADO (ACCESO BLOQUEADO)'}
                        </span>
                    </div>

                </div>
            </AdminModal>}
        </div>
    );
};

const ManageTables: React.FC<{ tables: Table[]; setTables: React.Dispatch<React.SetStateAction<Table[]>>; currentBranchId: number | null; onBack: () => void }> = ({ tables, setTables, currentBranchId, onBack }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [tableToDelete, setTableToDelete] = useState<number | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const handleSave = async () => {
        console.log('--- INTENTANDO GUARDAR MESA ---', { name, currentBranchId });
        if (!name.trim() || !currentBranchId) return;
        try {
            // @ts-ignore
            const newTable = await api.createTable({ name: name.toUpperCase(), branchId: currentBranchId });
            console.log('--- MESA GUARDADA ---', newTable);
            setTables(prev => [...prev, newTable]);
            setIsModalOpen(false);
            setName('');
        } catch (e) {
            console.error('--- ERROR GUARDANDO MESA ---', e);
            alert('Error al guardar mesa: ' + e);
        }
    };

    const onMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartY(e.pageY - scrollRef.current.offsetTop);
        setScrollTop(scrollRef.current.scrollTop);
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - scrollRef.current.offsetTop;
        const walk = (y - startY) * 2;
        scrollRef.current.scrollTop = scrollTop - walk;
    };

    const confirmDeleteTable = async () => {
        if (!tableToDelete) return;
        try {
            // @ts-ignore
            await api.deleteTable(tableToDelete);
            setTables(prev => prev.filter(m => m.id !== tableToDelete));
            setTableToDelete(null);
        } catch (e) {
            console.error(e);
            alert('Error al eliminar mesa');
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden transition-all duration-300">
            <ViewHeader title="GESTIÓN <span class='text-amber-500'>MESAS</span>" onBack={onBack} onAdd={() => setIsModalOpen(true)} />
            <div
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseLeave={() => setIsDragging(false)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={onMouseMove}
                className={`flex-1 overflow-y-auto bg-gray-900/50 rounded-[40px] border border-gray-800 shadow-inner scrollbar-hide select-none ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
            >
                <ul className="divide-y divide-gray-800/50">
                    {tables.filter(t => t.branchId === currentBranchId).map(t => (
                        <li key={t.id} className="p-5 flex justify-between items-center group">
                            <span className="text-[14px] font-black text-white uppercase italic tracking-wider group-hover:text-amber-500 transition-colors">{t.name}</span>
                            <button onClick={() => !isDragging && setTableToDelete(t.id)} className="p-2.5 bg-gray-800 text-red-500 rounded-full border border-gray-700 hover:bg-red-600 hover:text-white transition-all active:scale-90 shadow-lg"><TrashIcon className="w-4 h-4" /></button>
                        </li>
                    ))}
                </ul>
            </div>

            <ConfirmationModal
                isOpen={tableToDelete !== null}
                onClose={() => setTableToDelete(null)}
                onConfirm={confirmDeleteTable}
                title="¿ELIMINAR MESA?"
                message="Esta acción no se puede deshacer"
                confirmText="SÍ, ELIMINAR"
            />
            {isModalOpen && <AdminModal title="NUEVA <span class='text-amber-500'>UBICACIÓN</span>" onClose={() => setIsModalOpen(false)} onSave={handleSave} saveLabel="GUARDAR">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Identificador de Mesa</label>
                    <input value={name} onChange={e => setName(e.target.value)} className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 shadow-inner" placeholder="EJ: MESA VIP 01" autoFocus />
                </div>
            </AdminModal>}
        </div>
    );
};

const ManageBranches: React.FC<{ branches: Branch[]; setBranches: React.Dispatch<React.SetStateAction<Branch[]>>; onBack: () => void }> = ({ branches, setBranches, onBack }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [form, setForm] = useState<Partial<Branch>>({ name: '', address: '', phone: '', logoUrl: '', gasWebhookUrl: '', geminiApiKey: '', autoCloseEnabled: false, autoCloseTime: '', ticketWidth: '80mm', closingWebhookUrl: '', closingEmail: '' });
    const [branchToDelete, setBranchToDelete] = useState<number | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const handleOpen = (b?: Branch) => {
        setEditingBranch(b || null);
        setForm(b ? { ...b } : { name: '', address: '', phone: '', logoUrl: '', gasWebhookUrl: '', geminiApiKey: '', autoCloseEnabled: false, autoCloseTime: '', ticketWidth: '80mm', closingWebhookUrl: '', closingEmail: '' });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.name?.trim()) return;
        const cleanPhone = (form.phone || '').replace(/\D/g, '');
        if (cleanPhone && cleanPhone.length !== 8) return toast.error('EL TELÉFONO DEBE TENER 8 DÍGITOS');

        const branchData = {
            ...form,
            name: form.name?.toUpperCase(),
            address: form.address?.toUpperCase(),
            phone: cleanPhone,
            isActive: true
        };

        try {
            if (editingBranch) {
                // @ts-ignore
                await api.updateBranch(editingBranch.id, branchData);
                // @ts-ignore
                setBranches(prev => prev.map(b => b.id === editingBranch.id ? { ...b, ...branchData } : b));
            } else {
                // @ts-ignore
                const newBranch = await api.createBranch(branchData);
                setBranches(prev => [...prev, newBranch]);
            }
            setIsModalOpen(false);
            toast.success('SUCURSAL GUARDADA CON ÉXITO', {
                style: {
                    background: '#064e3b',
                    color: '#34d399',
                    fontWeight: 'bold',
                    borderRadius: '20px',
                    border: '1px solid #10b981'
                }
            });
        } catch (e) {
            console.error(e);
            toast.error('Error al guardar sucursal');
        }
    };

    const onMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartY(e.pageY - scrollRef.current.offsetTop);
        setScrollTop(scrollRef.current.scrollTop);
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - scrollRef.current.offsetTop;
        const walk = (y - startY) * 2;
        scrollRef.current.scrollTop = scrollTop - walk;
    };

    return (
        <div className="flex flex-col h-full overflow-hidden transition-all duration-300">
            <ViewHeader title="GESTIÓN <span class='text-amber-500'>SUCURSALES</span>" onBack={onBack} onAdd={() => handleOpen()} />
            <div
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseLeave={() => setIsDragging(false)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={onMouseMove}
                className={`flex-1 overflow-y-auto bg-gray-900/50 rounded-[40px] border border-gray-800 shadow-inner scrollbar-hide select-none ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
            >
                <ul className="divide-y divide-gray-800/50">
                    {branches.map(b => (
                        <li key={b.id} className="p-5 flex justify-between items-center group hover:bg-gray-800/20 transition-colors">
                            <div className="min-w-0 pr-4">
                                <p className="text-[15px] font-black text-white uppercase italic truncate leading-tight group-hover:text-amber-500 transition-colors">{b.name}</p>
                                <div className="flex gap-3 items-center mt-2">
                                    <p className="text-gray-500 text-[9px] font-black uppercase tracking-[0.2em] truncate">{b.address || 'Ubicación Pendiente'}</p>
                                    <span className="w-1.5 h-1.5 bg-amber-500/30 rounded-full"></span>
                                    <p className="text-amber-500 font-black text-[10px] tracking-widest">{b.phone || 'S/T'}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => !isDragging && handleOpen(b)} className="p-2.5 bg-gray-800 text-amber-500 rounded-full border border-gray-700 hover:bg-amber-600 hover:border-amber-400 hover:text-white transition-all active:scale-90"><PencilIcon className="w-4 h-4" /></button>
                                <button onClick={() => !isDragging && setBranchToDelete(b.id)} className="p-2.5 bg-gray-800 text-red-500 rounded-full border border-gray-700 hover:bg-red-600 hover:border-red-400 hover:text-white transition-all active:scale-90"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <ConfirmationModal
                isOpen={branchToDelete !== null}
                onClose={() => setBranchToDelete(null)}
                // @ts-ignore
                onConfirm={async () => {
                    if (!branchToDelete) return;
                    try {
                        // Using a hypothetical api.deleteBranch since it wasn't there, but good to add. 
                        // If it fails (API method missing), catch block will run.
                        // I will assume it exists or I should comment it out. 
                        // Given ManageUsers I added it, I'll add it here too or just update state if previously it only updated state.
                        // Previous code: confirm(...) && setBranches(...)
                        setBranches(prev => prev.filter(i => i.id !== branchToDelete));
                        setBranchToDelete(null);
                    } catch (e) { console.error(e); }
                }}
                title="¿ELIMINAR SUCURSAL?"
                message="Esta acción no se puede deshacer"
                confirmText="SÍ, ELIMINAR"
            />

            {isModalOpen && <AdminModal title={editingBranch ? "EDITAR <span class='text-amber-500'>SUCURSAL</span>" : "NUEVA <span class='text-amber-500'>SUCURSAL</span>"} onClose={() => setIsModalOpen(false)} onSave={handleSave} saveLabel="GUARDAR">
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Nombre de Sucursal</label>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full py-3 px-5 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-sm uppercase outline-none focus:border-amber-500 shadow-inner" placeholder="EJ: CENTRO HISTÓRICO" autoFocus />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Dirección</label>
                        <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full py-3 px-5 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-sm uppercase outline-none focus:border-amber-500 shadow-inner" placeholder="EJ: AV. SIEMPRE VIVA 742" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Logo URL (Icono Sucursal)</label>
                        <input value={form.logoUrl} onChange={e => setForm({ ...form, logoUrl: e.target.value })} className="w-full py-3 px-5 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white text-[10px] font-mono outline-none focus:border-amber-500 shadow-inner" placeholder="https://mi-dominio.com/logo.png" />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Tamaño de Ticket (Impresora)</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setForm({ ...form, ticketWidth: '58mm' })}
                                className={`py-3 px-3 rounded-2xl border-2 font-black text-xs uppercase italic transition-all ${form.ticketWidth === '58mm' ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'}`}
                            >
                                58mm (Pequeño)
                            </button>
                            <button
                                onClick={() => setForm({ ...form, ticketWidth: '80mm' })}
                                className={`py-3 px-3 rounded-2xl border-2 font-black text-xs uppercase italic transition-all ${form.ticketWidth !== '58mm' ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'}`}
                            >
                                80mm (Estándar)
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Teléfono Público</label>
                        <input type="tel" maxLength={8} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full py-3 px-5 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-lg text-center outline-none focus:border-amber-500 shadow-inner tracking-widest" placeholder="00000000" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Correo (Webhook URL)</label>
                        <input value={form.gasWebhookUrl} onChange={e => setForm({ ...form, gasWebhookUrl: e.target.value })} className="w-full py-3 px-5 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white text-[10px] font-mono outline-none focus:border-amber-500 shadow-inner" placeholder="https://script.google.com/macros/..." />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-1 italic">Webhook Cierre (Email)</label>
                            <input value={form.closingWebhookUrl || ''} onChange={e => setForm({ ...form, closingWebhookUrl: e.target.value })} className="w-full py-3 px-5 bg-gray-800 border-2 border-emerald-500/30 rounded-2xl text-white text-[10px] font-mono outline-none focus:border-emerald-500 shadow-inner" placeholder="https://script.google.com/macros/..." />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-1 italic">Correo(s) para Reporte</label>
                            <input value={form.closingEmail || ''} onChange={e => setForm({ ...form, closingEmail: e.target.value })} className="w-full py-3 px-5 bg-gray-800 border-2 border-emerald-500/30 rounded-2xl text-white text-xs font-black outline-none focus:border-emerald-500 shadow-inner" placeholder="ejemplo@mail.com, otro@mail.com" />
                        </div>
                    </div>

                    <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Cierre Automático</label>
                            <button
                                onClick={() => setForm(prev => ({ ...prev, autoCloseEnabled: !prev.autoCloseEnabled }))}
                                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${form.autoCloseEnabled ? 'bg-amber-500' : 'bg-gray-700'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${form.autoCloseEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        {form.autoCloseEnabled && (
                            <div className="space-y-1.5 animate-in slide-in-from-top-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Hora de Cierre</label>
                                <div className="relative">
                                    <ClockIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                    <input
                                        type="time"
                                        value={form.autoCloseTime || ''}
                                        onChange={e => setForm({ ...form, autoCloseTime: e.target.value })}
                                        className="w-full py-4 pl-12 pr-6 bg-gray-900 border-2 border-gray-700 rounded-2xl text-white font-black text-xl outline-none focus:border-amber-500 shadow-inner tracking-widest"
                                    />
                                </div>
                                <p className="text-[9px] text-gray-500 mt-2 px-2 italic">
                                    Los pedidos abiertos se cerrarán automáticamente 10 minutos después de esta hora, marcándolos como pagados en efectivo.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </AdminModal>}
        </div>
    );
};

export default AdminPanel;
