
import React, { useState, useRef } from 'react';
import { Order } from '../types';
import TicketModal from './TicketModal';

interface CompletedOrdersScreenProps {
    orders: Order[];
    onBack: () => void;
    onNewOrder: () => void;
    companySettings: any;
    onUpdateCustomerEmail: (customerId: number, email: string) => void;
    branches: any[];
}

const CompletedOrdersScreen: React.FC<CompletedOrdersScreenProps> = ({ orders, onBack, onNewOrder, companySettings, onUpdateCustomerEmail, branches }) => {
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'TODOS' | string>('TODOS');

    // Drag-to-Scroll Logic
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartY(e.pageY - scrollRef.current.offsetTop);
        setScrollTop(scrollRef.current.scrollTop);
    };

    const handleMouseLeave = () => setIsDragging(false);
    const handleMouseUp = () => setIsDragging(false);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - scrollRef.current.offsetTop;
        const walk = (y - startY) * 2;
        scrollRef.current.scrollTop = scrollTop - walk;
    };

    // --- TABS HORIZONTAL DRAG SCROLL LOGIC ---
    const tabsScrollRef = useRef<HTMLDivElement>(null);
    const [isTabsDragging, setIsTabsDragging] = useState(false);
    const [tabsStartX, setTabsStartX] = useState(0);
    const [tabsScrollLeft, setTabsScrollLeft] = useState(0);

    const handleTabsMouseDown = (e: React.MouseEvent) => {
        if (!tabsScrollRef.current) return;
        setIsTabsDragging(true);
        setTabsStartX(e.pageX - tabsScrollRef.current.offsetLeft);
        setTabsScrollLeft(tabsScrollRef.current.scrollLeft);
    };

    const handleTabsMouseLeave = () => {
        setIsTabsDragging(false);
    };

    const handleTabsMouseMove = (e: React.MouseEvent) => {
        if (!isTabsDragging || !tabsScrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - tabsScrollRef.current.offsetLeft;
        const walk = (x - tabsStartX) * 2; // Scroll-fast
        tabsScrollRef.current.scrollLeft = tabsScrollLeft - walk;
    };

    const filterTabs = ['TODOS', 'RESTAURANTE', 'P. LLEVAR', 'DELIVERY', 'C. RETIRA'];

    // Ordenar por Numero de Pedido (Mayor a Menor)
    const sortedOrders = [...orders]
        .sort((a, b) => (b.dailyOrderNumber || 0) - (a.dailyOrderNumber || 0))
        .filter(order => {
            // STRICT DATE FILTER: TODAY ONLY
            const orderDate = new Date(order.completedAt || order.createdAt);
            const today = new Date();
            const isToday = orderDate.getDate() === today.getDate() &&
                orderDate.getMonth() === today.getMonth() &&
                orderDate.getFullYear() === today.getFullYear();

            if (!isToday) return false;

            // Type Filter
            if (activeTab !== 'TODOS') {
                let requiredType = activeTab;
                if (activeTab === 'RESTAURANTE') requiredType = 'Local';
                if (activeTab === 'P. LLEVAR') requiredType = 'Para Llevar';
                if (activeTab === 'C. RETIRA') requiredType = 'Cliente Retira';
                if (activeTab === 'DELIVERY') requiredType = 'Delivery';

                if (order.type !== requiredType) return false;
            }

            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            const orderIdStr = String(order.id).toLowerCase();
            const dailyIdStr = order.dailyOrderNumber ? String(order.dailyOrderNumber) : '';
            const customerName = (order.customer?.name || '').toLowerCase();
            const tableName = (order.table?.name || '').toLowerCase();
            const waiterName = (order.waiter?.name || '').toLowerCase();
            const typeStr = (order.type || '').toLowerCase();

            return orderIdStr.includes(term) ||
                dailyIdStr.includes(term) ||
                customerName.includes(term) ||
                tableName.includes(term) ||
                waiterName.includes(term) ||
                typeStr.includes(term);
        });

    return (
        <div
            ref={scrollRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            className={`p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-20 h-full overflow-y-auto scrollbar-hide select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
            <header className="flex flex-col gap-4 mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                        PEDIDOS <span className="text-amber-500">FINALIZADOS</span>
                    </h1>

                    <div className="flex w-full sm:w-auto gap-2">
                        <div className="relative flex-1 sm:w-64">
                            <input
                                type="text"
                                placeholder="Buscar por #, Cliente, Mesa..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 pl-9 rounded-xl focus:border-amber-500 focus:outline-none text-sm font-bold uppercase placeholder:normal-case placeholder:font-normal"
                            />
                            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <button
                            onClick={onBack}
                            className="bg-gray-800 text-gray-400 font-black text-[10px] uppercase tracking-widest py-2 px-4 rounded-xl border border-gray-700 active:scale-95 transition-transform"
                        >
                            &larr; VOLVER
                        </button>
                    </div>
                </div>

                {/* Filter Tabs */}
                {/* Filter Tabs - Drag to Scroll Implemented */}
                <div
                    ref={tabsScrollRef}
                    onMouseDown={handleTabsMouseDown}
                    onMouseLeave={handleTabsMouseLeave}
                    onMouseUp={handleTabsMouseLeave}
                    onMouseMove={handleTabsMouseMove}
                    className={`flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1 cursor-grab active:cursor-grabbing select-none`}
                >
                    {['TODOS', 'RESTAURANTE', 'P. LLEVAR', 'DELIVERY', 'C. RETIRA'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => !isTabsDragging && setActiveTab(tab)}
                            className={`px-4 py-2 rounded-2xl font-black text-xs whitespace-nowrap transition-all flex-shrink-0 uppercase tracking-widest border-2 ${activeTab === tab
                                ? 'bg-amber-500 text-black shadow-lg border-transparent'
                                : 'bg-amber-500/10 text-white border-amber-500/30 hover:border-amber-500 hover:text-amber-500 hover:bg-amber-500/20'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </header>

            {sortedOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-30 italic">
                    <p className="text-xl font-black uppercase tracking-tighter">
                        {searchTerm ? 'No se encontraron pedidos' : 'No hay pedidos finalizados'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {sortedOrders.map(order => {
                        const total = Number(order.total || 0);
                        const completedAt = new Date(order.completedAt || order.createdAt);

                        return (
                            <button
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className="p-3 bg-gray-800 border border-gray-700 rounded-2xl shadow-xl hover:bg-gray-750 active:scale-[0.98] transition-all text-left flex flex-col gap-1 group relative overflow-hidden"
                            >
                                {/* Header Row: #Number + Chips */}
                                <div className="flex justify-between items-start w-full">
                                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 pr-2">
                                        <span className="font-black text-cyan-400 text-[17px] tracking-tighter shrink-0">
                                            #{String(order.dailyOrderNumber).padStart(3, '0')}
                                        </span>

                                        {/* Chips Area */}
                                        <div className="flex flex-wrap items-center gap-1">
                                            <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded text-[11px] font-black text-amber-500 uppercase italic">
                                                {order.type === 'Local' ? 'Restaurante' : order.type}
                                            </span>
                                            {order.table && (
                                                <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded text-[11px] font-black text-blue-400 uppercase">
                                                    {order.table.name}
                                                </span>
                                            )}
                                            {order.waiter && (
                                                <span className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/30 rounded text-[11px] font-black text-purple-400 uppercase truncate max-w-[80px]">
                                                    {order.waiter.name.split(' ')[0]}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Total Price - Top Right Aligned */}
                                    <span className="text-white font-black text-xl tabular-nums tracking-tight shrink-0">
                                        ${total.toFixed(2)}
                                    </span>
                                </div>

                                {/* Customer Row + Time */}
                                <div className="flex justify-between items-center w-full mt-1">
                                    <p className="text-sm font-bold text-gray-400 truncate uppercase flex-1 italic pr-2">
                                        {order.customer?.name || 'Cliente Mostrador'}
                                    </p>

                                    <div className="flex items-center gap-2 shrink-0 bg-gray-900/50 px-2 py-1 rounded-lg border border-gray-700/50">
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                            {completedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <div className="w-1.5 h-1.5 bg-gray-600 rounded-full shadow-[0_0_5px_rgba(75,85,99,0.5)]"></div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {selectedOrder && (
                <TicketModal
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    onNewOrder={onNewOrder}
                    isViewingCompleted={true}
                    companySettings={companySettings}
                    onUpdateCustomerEmail={onUpdateCustomerEmail}
                    branches={branches}
                />
            )}
        </div>
    );
};

export default CompletedOrdersScreen;
