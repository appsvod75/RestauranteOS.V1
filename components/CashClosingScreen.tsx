
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Order, PaymentMethod, CashClosingReport } from '../types';
import { api } from '../api';
import { toast } from 'react-hot-toast';
import { PrintIcon, SaveIcon, ClipboardListIcon, ClockIcon, UserIcon, TableIcon } from './icons';
import CashClosingTicketModal from './CashClosingTicketModal';
import ConfirmationModal from './ConfirmationModal';
import PinVerificationModal from './PinVerificationModal';
import { UserRole } from '../types';

interface OrderAuditDetail {
    id: string;
    dailyOrderNumber: number;
    time: string;
    waiter: string;
    type: string;
    amount: number;
}

interface CashClosingScreenProps {
    orders: Order[];
    activeOrders?: Order[]; // Optional to avoid breaking other usages if any
    onForceClose?: (orders: Order[]) => Promise<void>;
    onBack: () => void;
    cashClosingReports: CashClosingReport[];
    setCashClosingReports: React.Dispatch<React.SetStateAction<CashClosingReport[]>>;
    branchId: number;
    companySettings?: any;
    onRequireCashOpening?: () => void;
    cashierMode?: boolean; // Si es true: oculta forzar cierre, no pide apertura de caja
}

// ... helper functions ...
const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const CashClosingScreen: React.FC<CashClosingScreenProps> = ({ orders, activeOrders = [], onForceClose, onBack, cashClosingReports, setCashClosingReports, branchId, onRequireCashOpening, cashierMode = false }) => {
    const todayString = useMemo(() => getTodayDateString(), []);
    // PERSISTENCE LOGIC START
    // RETROACTIVE LOGIC START
    const [selectedDate, setSelectedDate] = useState(() => getTodayDateString());
    const [historicalOrders, setHistoricalOrders] = useState<Order[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    useEffect(() => {
        const fetchPastOrders = async () => {
            if (selectedDate === todayString) {
                setHistoricalOrders([]);
                return;
            }

            setIsLoadingHistory(true);
            try {
                // Fetch for the specific branch and date
                const result = await api.getHistory({
                    startDate: selectedDate,
                    endDate: selectedDate,
                    branchId: branchId,
                    limit: 1000
                });

                // Hydrate slightly to match expected properties
                const hydrated = (Array.isArray(result) ? result : []).map((o: any) => ({
                    ...o,
                    createdAt: o.createdAt || o.created_at,
                    total: parseFloat(o.total || '0')
                }));

                setHistoricalOrders(hydrated);
            } catch (error) {
                console.error("Failed to fetch historical orders:", error);
                toast.error("Error al cargar datos históricos");
            } finally {
                setIsLoadingHistory(false);
            }
        };

        fetchPastOrders();
    }, [selectedDate, todayString, branchId]);

    const activeOrdersForView = useMemo(() => {
        const rawOrders = selectedDate === todayString ? orders : historicalOrders;

        return rawOrders.filter(o => {
            const d = new Date(o.createdAt || (o as any).created_at);
            if (isNaN(d.getTime())) return false;

            // Format to YYYY-MM-DD in local time
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dStr = `${year}-${month}-${day}`;

            return dStr === selectedDate;
        });
    }, [selectedDate, todayString, orders, historicalOrders]);

    const activePendingsForView = useMemo(() => {
        if (selectedDate === todayString) {
            return activeOrders || [];
        }
        // For past dates, include any order from historical data that isn't finished
        return historicalOrders.filter(o => o.status === 'active' && o.deliveryStatus !== 'delivered');
    }, [selectedDate, todayString, activeOrders, historicalOrders]);

    const initialCashKey = useMemo(() => `cash_closing_initial_${branchId}_${selectedDate}`, [branchId, selectedDate]);

    const existingReport = useMemo(() => {
        return cashClosingReports.find(report => report.date === selectedDate && report.branchId === branchId);
    }, [cashClosingReports, selectedDate, branchId]);

    const [initialCash, setInitialCash] = useState('');

    // Reset initial cash when date changes or existingReport arrives
    useEffect(() => {
        if (existingReport) {
            const val = parseFloat(String(existingReport.initialCash));
            setInitialCash(isNaN(val) ? '' : val.toFixed(2));
        } else {
            const savedDraft = localStorage.getItem(initialCashKey);
            if (savedDraft) {
                const val = parseFloat(savedDraft);
                setInitialCash(isNaN(val) ? '' : val.toFixed(2));
            } else {
                setInitialCash('');
            }
        }
    }, [existingReport, initialCashKey]);
    // RETROACTIVE LOGIC END

    // Force cash opening if needed when entering closing screen
    useEffect(() => {
        if (cashierMode || !onRequireCashOpening) return;
        const todayStr = getTodayDateString();
        const reportForToday = cashClosingReports.find(r => r.date === todayStr && r.branchId === branchId);
        const hasOpening = reportForToday && reportForToday.initialCash > 0;
        if (!hasOpening) {
            onRequireCashOpening();
        }
    }, [cashierMode]);

    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [isForceClosing, setIsForceClosing] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ type: 'replace' | 'force' } | null>(null);
    const [showPinModal, setShowPinModal] = useState(false); // NEW STATE FOR PIN
    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [auditTitle, setAuditTitle] = useState('');
    const [auditOrders, setAuditOrders] = useState<OrderAuditDetail[]>([]);
    const numericInitialCash = parseFloat(initialCash) || 0;

    const hasPendings = activePendingsForView && activePendingsForView.length > 0;

    // ... scroll logic ...
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

    // ... calculations ...
    const totalChangeOut = useMemo(() => {
        return activeOrdersForView.reduce((sum, order) => {
            if (order.status !== 'completed') return sum;
            return sum + (order.changeGiven || 0);
        }, 0);
    }, [activeOrdersForView]);

    const summaryAndOrders = useMemo(() => {
        const orderDetailsByMethod: Record<string, OrderAuditDetail[]> = {};

        const rawData = activeOrdersForView.reduce((acc, order) => {
            const isFinished = order.status === 'completed' || order.deliveryStatus === 'delivered';
            if (!isFinished) return acc;

            const payments = order.payments || [];
            if (payments.length === 0) return acc;

            payments.forEach(payment => {
                const rawMethod = String(payment.method || '');
                const method = (Object.values(PaymentMethod).find(
                    m => m.toLowerCase() === rawMethod.toLowerCase()
                ) || rawMethod) as PaymentMethod;

                const amt = Number(payment.amount || 0);
                const excess = Number(payment.excessAmount || 0);

                if (method === PaymentMethod.Transfer) {
                    const propia = amt - excess;
                    const otro = excess;

                    acc['Transfer. Propias'] = (acc['Transfer. Propias'] || 0) + propia;
                    if (otro > 0) acc['Transfer. Otros'] = (acc['Transfer. Otros'] || 0) + otro;

                    if (!orderDetailsByMethod['Transfer. Propias']) orderDetailsByMethod['Transfer. Propias'] = [];
                    if (propia > 0) {
                        orderDetailsByMethod['Transfer. Propias'].push({
                            id: order.id,
                            dailyOrderNumber: order.dailyOrderNumber,
                            time: order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
                            waiter: (order as any).waiter_name || order.waiter?.name || (order as any).user_name || 'ADMIN',
                            type: order.type,
                            amount: propia
                        });
                    }
                    if (otro > 0) {
                        if (!orderDetailsByMethod['Transfer. Otros']) orderDetailsByMethod['Transfer. Otros'] = [];
                        orderDetailsByMethod['Transfer. Otros'].push({
                            id: order.id,
                            dailyOrderNumber: order.dailyOrderNumber,
                            time: order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
                            waiter: (order as any).waiter_name || order.waiter?.name || (order as any).user_name || 'ADMIN',
                            type: order.type,
                            amount: otro
                        });
                    }
                } else if (method === PaymentMethod.TransferOther) {
                    acc['Transfer. Otros'] = (acc['Transfer. Otros'] || 0) + amt;

                    if (!orderDetailsByMethod['Transfer. Otros']) orderDetailsByMethod['Transfer. Otros'] = [];
                    orderDetailsByMethod['Transfer. Otros'].push({
                        id: order.id,
                        dailyOrderNumber: order.dailyOrderNumber,
                        time: order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
                        waiter: (order as any).waiter_name || order.waiter?.name || (order as any).user_name || 'ADMIN',
                        type: order.type,
                        amount: amt
                    });
                } else {
                    if (!acc[method]) acc[method] = 0;
                    acc[method] += amt;

                    if (!orderDetailsByMethod[method]) orderDetailsByMethod[method] = [];

                    const timeStr = order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
                    const netAmt = (method === PaymentMethod.Cash) ? amt - (order.changeGiven || 0) : amt;

                    orderDetailsByMethod[method].push({
                        id: order.id,
                        dailyOrderNumber: order.dailyOrderNumber,
                        time: timeStr,
                        waiter: (order as any).waiter_name || order.waiter?.name || (order as any).user_name || 'ADMIN',
                        type: order.type,
                        amount: netAmt
                    });
                }
            });
            return acc;
        }, {} as Record<string, number>);

        const methodOrder: Record<string, number> = {
            [PaymentMethod.Cash]: 0,
            'Transfer. Propias': 1,
            'Transfer. Otros': 2,
        };

        const displaySummary = Object.entries(rawData)
            .map(([method, total]) => ({
                method: method as string,
                total: method === PaymentMethod.Cash ? Number(total) - Number(totalChangeOut) : total,
                rawTotal: total,
            }))
            .sort((a, b) => {
                const orderA = methodOrder[a.method] ?? 999;
                const orderB = methodOrder[b.method] ?? 999;
                return orderA - orderB;
            });

        return { summary: displaySummary, orderDetailsByMethod, rawSummary: rawData };
    }, [activeOrdersForView, totalChangeOut]);

    const summary = summaryAndOrders.summary;
    const orderDetailsByMethod = summaryAndOrders.orderDetailsByMethod;
    const rawSummary = summaryAndOrders.rawSummary;

    const totalSales = useMemo(() => summary.reduce((sum, item) => sum + item.total, 0), [summary]);

    const orderTotalSum = useMemo(() => {
        return activeOrdersForView
            .filter(o => o.status === 'completed')
            .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    }, [activeOrdersForView]);

    const totalExcessAmount = useMemo(() => {
        return activeOrdersForView
            .filter(o => o.status === 'completed')
            .reduce((sum, o) => sum + ((o.payments || []).reduce((s: number, p: any) => s + (Number(p.excessAmount) || 0), 0)), 0);
    }, [activeOrdersForView]);

    const discrepancy = totalSales !== orderTotalSum ? (totalSales - orderTotalSum - totalExcessAmount) : 0;

    const discrepancyOrders = useMemo(() => {
        return activeOrdersForView
            .filter(o => o.status === 'completed')
            .filter(o => {
                const netPaid = (Number(o.amountPaid) || 0) - (Number(o.changeGiven) || 0);
                const diff = Math.abs(netPaid - Number(o.total));
                if (diff <= 0.01) return false;
                const orderExcess = (o.payments || []).reduce((s: number, p: any) => s + (Number(p.excessAmount) || 0), 0);
                return Math.abs(diff - orderExcess) > 0.01;
            })
            .map(o => ({
                num: o.dailyOrderNumber,
                total: Number(o.total) || 0,
                netPaid: (Number(o.amountPaid) || 0) - (Number(o.changeGiven) || 0),
                diff: ((Number(o.amountPaid) || 0) - (Number(o.changeGiven) || 0)) - (Number(o.total) || 0),
                methods: (o.payments || []).map((p: any) => p.method).join(', ')
            }));
    }, [activeOrdersForView]);
    const totalCashIn = useMemo(() => rawSummary[PaymentMethod.Cash] || 0, [rawSummary]);

    const expectedCash = useMemo(() => numericInitialCash + totalCashIn - totalChangeOut, [numericInitialCash, totalCashIn, totalChangeOut]);

    const totalOrdersCount = useMemo(() => {
        return activeOrdersForView.filter(o => o.status === 'completed').length;
    }, [activeOrdersForView]);

    const isAlreadySaved = !!existingReport;

    const isDirty = useMemo(() => {
        if (!existingReport) return true;

        const savedInitial = parseFloat(String(existingReport.initialCash));
        const currentInitial = parseFloat(initialCash) || 0;

        // Check if values changed significantly
        if (Math.abs(savedInitial - currentInitial) > 0.0001) return true;
        if (Math.abs(existingReport.totalSales - totalSales) > 0.0001) return true;
        if (Math.abs(existingReport.totalCashIn - totalCashIn) > 0.0001) return true;
        if (Math.abs(existingReport.totalChangeOut - totalChangeOut) > 0.0001) return true;
        if ((existingReport.totalOrders || 0) !== totalOrdersCount) return true;

        return false;
    }, [existingReport, initialCash, totalSales, totalCashIn, totalChangeOut, totalOrdersCount]);

    const saveButtonLabel = useMemo(() => {
        if (!isAlreadySaved) return 'GUARDAR CIERRE';
        return isDirty ? 'ACTUALIZAR CIERRE' : 'CIERRE GUARDADO';
    }, [isAlreadySaved, isDirty]);

    const generateReportObject = (): CashClosingReport => {
        const now = new Date();
        const dateString = selectedDate;

        return {
            date: dateString,
            createdAt: now, // Ensure it's a Date object for .toLocaleString()
            initialCash: numericInitialCash,
            totalSales,
            totalCashIn,
            totalChangeOut,
            expectedCash,
            totalOrders: totalOrdersCount,
            summary,
            branchId
        };
    };

    const handleSaveReport = async () => {
        const report = generateReportObject();
        const isUpdate = isAlreadySaved;

        const loadingToast = toast.loading(isUpdate ? 'ACTUALIZANDO CIERRE...' : 'GUARDANDO CIERRE...');

        try {
            let savedReport;
            // The API uses a single saveCashClosing method which likely handles upsert based on date/branch
            savedReport = await api.saveCashClosing(report);

            setCashClosingReports(prev => {
                // Check if we are updating an existing report in state
                const exists = prev.some(r => r.date === savedReport.date && r.branchId === savedReport.branchId);
                if (exists) {
                    return prev.map(r => (r.date === savedReport.date && r.branchId === savedReport.branchId) ? savedReport : r);
                }
                return [...prev, savedReport];
            });

            // CLEAR DRAFT ON SUCCESS
            localStorage.removeItem(initialCashKey);

            toast.success(isUpdate ? 'CIERRE ACTUALIZADO CORRECTAMENTE' : 'CIERRE GUARDADO CORRECTAMENTE', { id: loadingToast });

            // Generate ticket automatically on save
            // handlePrint(); // Optional: Auto-print
        } catch (error) {
            console.error("Failed to save cash closing:", error);
            toast.error(`ERROR AL GUARDAR: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: loadingToast });
        }
    };

    const handleSave = () => {
        if (hasPendings) {
            alert('NO SE PUEDE CERRAR CAJA: Hay pedidos pendientes.');
            return;
        }

        if (!isDirty && isAlreadySaved) {
            toast('El cierre ya está guardado y no tiene cambios.', { icon: 'ℹ️' });
            return;
        }

        if (isAlreadySaved) {
            // IF UPDATING: Require PIN
            setShowPinModal(true);
        } else {
            // IF NEW: Save directly
            handleSaveReport();
        }
    };

    const handlePrint = () => {
        setIsTicketModalOpen(true);
    };

    const handleOpenAudit = (method: string) => {
        const orders = orderDetailsByMethod[method] || [];
        setAuditTitle(`DETALLE DE PAGOS: ${method.toUpperCase()}`);
        setAuditOrders(orders);
        setIsAuditModalOpen(true);
    };

    const handleInitialCashBlur = () => {
        if (!initialCash) return;
        const val = parseFloat(initialCash);
        if (!isNaN(val)) {
            setInitialCash(val.toFixed(2));
        }
    };

    const handleInitialCashFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        // Option A: Clear
        // setInitialCash('');

        // Option B: Select (Better for numbers as user might decide not to change it)
        e.target.select();
    };

    const handleForceCloseClick = () => {
        if (!onForceClose) return;
        setConfirmAction({ type: 'force' });
    };

    const confirmForceClose = async () => {
        if (!onForceClose) return;
        setIsForceClosing(true);
        await onForceClose(activeOrders);
        setIsForceClosing(false);
        setConfirmAction(null);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden max-w-7xl mx-auto w-full">
            <div className="flex flex-wrap justify-between items-center gap-4 p-4 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="bg-gray-800 p-2 rounded-full hover:bg-gray-700 active:scale-90 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h1 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">CIERRE DE <span className="text-amber-400">CAJA</span></h1>
                </div>
                <div className="flex items-center gap-2 bg-gray-800/80 p-1.5 rounded-2xl border border-gray-700 shadow-inner group">
                    <span className="text-[9px] font-black text-gray-500 uppercase ml-2 group-hover:text-amber-500 transition-colors">Fecha:</span>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent text-white font-black text-xs uppercase outline-none px-2 py-1 cursor-pointer focus:text-amber-400 transition-colors"
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleSave}
                        disabled={hasPendings || (isAlreadySaved && !isDirty)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all active:scale-95 font-black uppercase tracking-wide text-[10px] shadow-lg ${hasPendings
                            ? 'bg-gray-600 cursor-not-allowed opacity-50 text-gray-400'
                            : (!isAlreadySaved
                                ? 'bg-green-600 hover:bg-green-500 text-white ring-1 ring-green-500/50 ring-offset-1 ring-offset-gray-900'
                                : (isDirty
                                    ? 'bg-amber-600 hover:bg-amber-500 text-white ring-1 ring-amber-500/50 ring-offset-1 ring-offset-gray-900'
                                    : 'bg-gray-800 text-gray-500 border border-gray-700 cursor-default opacity-80'
                                )
                            )
                            }`}
                        title={hasPendings ? "Cierre mesas pendientes primero" : (isAlreadySaved ? (isDirty ? "Actualizar registro existente" : "Cierre ya guardado") : "Guardar nuevo cierre")}
                    >
                        <SaveIcon className="w-4 h-4" />
                        <span>{saveButtonLabel}</span>
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-blue-400 border border-blue-500/30 rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-500 transition-all active:scale-95 font-black uppercase tracking-wide text-[10px]"
                        title="Imprimir Reporte"
                    >
                        <PrintIcon className="w-4 h-4" />
                        <span>IMPRIMIR</span>
                    </button>
                </div>
            </div>

            <div
                ref={scrollRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                className={`flex-1 overflow-y-auto px-4 pb-32 scrollbar-hide select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${isLoadingHistory ? 'opacity-30 pointer-events-none' : ''}`}
            >
                <div className="space-y-4">
                    {/* WARNING BANNER */}
                    {hasPendings && (
                        <div className="bg-red-500/20 border-2 border-red-500 p-4 rounded-[24px] mb-4 animate-bounce-short">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-red-400 font-black uppercase text-xs tracking-widest flex items-center gap-2">
                                    <span className="text-xl">⚠️</span> {activePendingsForView.length} PEDIDOS PENDIENTES
                                </h3>
                                {selectedDate === todayString && onForceClose && (
                                    <button
                                        onClick={handleForceCloseClick}
                                        disabled={isForceClosing}
                                        className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {isForceClosing ? 'CERRANDO...' : 'FORZAR CIERRE'}
                                    </button>
                                )}
                            </div>
                            <p className="text-gray-400 text-[10px] italic mb-2">No puedes cerrar caja con mesas abiertas. Finalízalas manualmente{selectedDate === todayString ? ' o usa "Forzar Cierre"' : ''}.</p>
                            <div className="max-h-24 overflow-y-auto space-y-1">
                                {activePendingsForView.map(o => (
                                    <div key={o.id} className="text-[10px] text-red-300 font-mono bg-red-900/20 px-2 py-1 rounded flex justify-between">
                                        <span>#{o.dailyOrderNumber} - {o.type === 'Local' ? 'Restaurante' : o.type}</span>
                                        <span>${o.total.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-gray-900/50 p-6 rounded-[32px] border border-gray-800 shadow-xl">
                        <label htmlFor="initial-cash" className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 text-center">
                            Fondo de Caja Inicial (Caja Chica)
                        </label>
                        <input
                            id="initial-cash"
                            type="number"
                            step="0.01"
                            value={initialCash}
                            onChange={(e) => setInitialCash(e.target.value)}
                            onBlur={handleInitialCashBlur}
                            onFocus={handleInitialCashFocus}
                            placeholder="0.00"
                            readOnly={cashierMode}
                            className={`w-full p-4 bg-gray-800 border-2 rounded-2xl text-white font-black text-3xl text-center focus:outline-none focus:border-amber-500 ${cashierMode ? 'border-gray-600 opacity-70 cursor-not-allowed' : 'border-gray-700'}`}
                        />
                    </div>

                    <div className="bg-gray-900/50 p-6 rounded-[32px] border border-gray-800 shadow-xl space-y-4">
                        <h2 className="text-sm font-black text-amber-500 border-b border-gray-800 pb-2 mb-4 uppercase italic">Desglose de Ingresos</h2>
                        <div className="space-y-3">
                            {summary.length > 0 ? (() => {
                                const cashItem = summary.find(i => i.method === PaymentMethod.Cash);
                                const transferPropias = summary.find(i => i.method === 'Transfer. Propias');
                                const transferOtros = summary.find(i => i.method === 'Transfer. Otros');
                                const otherItems = summary.filter(i => i.method !== PaymentMethod.Cash && i.method !== 'Transfer. Propias' && i.method !== 'Transfer. Otros');
                                const transferTotal = (transferPropias?.total || 0) + (transferOtros?.total || 0);

                                return (
                                    <>
                                        {cashItem && (
                                            <div key={cashItem.method} className="flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => handleOpenAudit(cashItem.method)}
                                                        className="p-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500 hover:text-white rounded-lg transition-all active:scale-90 shadow-sm"
                                                        title="Ver desglose de órdenes"
                                                    >
                                                        <ClipboardListIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                    <span className="text-xs font-bold text-gray-400 uppercase">{cashItem.method}</span>
                                                </div>
                                                <span className="font-black text-white italic">${cashItem.total.toFixed(2)}</span>
                                            </div>
                                        )}
                                        {(transferPropias || transferOtros) && (
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center text-amber-400 border-b border-gray-700/50 pb-1">
                                                    <span className="text-xs font-black uppercase tracking-widest">TRANSFERENCIAS</span>
                                                    <span className="font-black italic">${transferTotal.toFixed(2)}</span>
                                                </div>
                                                {transferPropias && (
                                                    <div className="flex justify-between items-center pl-4">
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => handleOpenAudit('Transfer. Propias')}
                                                                className="p-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500 hover:text-white rounded-lg transition-all active:scale-90 shadow-sm"
                                                                title="Ver desglose de órdenes"
                                                            >
                                                                <ClipboardListIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            <span className="text-[10px] font-bold text-gray-500 uppercase">Propias</span>
                                                        </div>
                                                        <span className="font-bold text-gray-300 italic text-sm">${transferPropias.total.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {transferOtros && (
                                                    <div className="flex justify-between items-center pl-4">
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => handleOpenAudit('Transfer. Otros')}
                                                                className="p-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500 hover:text-white rounded-lg transition-all active:scale-90 shadow-sm"
                                                                title="Ver desglose de órdenes"
                                                            >
                                                                <ClipboardListIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            <span className="text-[10px] font-bold text-gray-500 uppercase">Otros</span>
                                                        </div>
                                                        <span className="font-bold text-gray-300 italic text-sm">${transferOtros.total.toFixed(2)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {otherItems.map(item => (
                                            <div key={item.method} className="flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => handleOpenAudit(item.method)}
                                                        className="p-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500 hover:text-white rounded-lg transition-all active:scale-90 shadow-sm"
                                                        title="Ver desglose de órdenes"
                                                    >
                                                        <ClipboardListIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                    <span className="text-xs font-bold text-gray-400 uppercase">{item.method}</span>
                                                </div>
                                                <span className="font-black text-white italic">${item.total.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </>
                                );
                            })() : (
                                <p className="text-gray-600 text-center italic text-xs uppercase font-black py-4">Sin ventas hoy</p>
                            )}
                        </div>
                        <div className="border-t border-gray-800 pt-4 mt-4 flex justify-between items-center">
                            <span className="font-black text-gray-500 uppercase text-xs">Total Ventas</span>
                            <span className="font-black text-xl text-amber-500 italic">${totalSales.toFixed(2)}</span>
                        </div>
                        {discrepancy !== 0 && (
                            <div className="mt-3 p-3 bg-red-600/20 border border-red-500/40 rounded-2xl">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-red-400 font-black text-lg">⚠️</span>
                                    <div className="text-left">
                                        <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Diferencia Detectada</p>
                                        <p className="text-[9px] text-red-300/80 font-bold">
                                            Total por métodos: <span className="text-red-400">${totalSales.toFixed(2)}</span>
                                            vs Suma pedidos: <span className="text-red-400">${orderTotalSum.toFixed(2)}</span>
                                        </p>
                                    </div>
                                </div>
                                {discrepancyOrders.length > 0 && (
                                    <div className="border-t border-red-500/20 pt-2 mt-2 space-y-1">
                                        {discrepancyOrders.map(o => (
                                            <div key={o.num} className="text-[9px] text-red-300/80 font-bold flex justify-between">
                                                <span>#{String(o.num).padStart(3, '0')} — {o.methods}</span>
                                                <span>Pedido ${o.total.toFixed(2)} / Pagado ${o.netPaid.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-green-600/10 border-2 border-green-500/30 p-6 rounded-[32px] shadow-xl space-y-3">
                        <div className="flex justify-between items-center opacity-60">
                            <span className="text-[10px] font-black text-gray-400 uppercase">Fondo Inicial</span>
                            <span className="font-bold text-white text-sm">${numericInitialCash.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase">Efectivo Recibido</span>
                            <span className="font-bold text-white text-sm">+ ${totalCashIn.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-red-400">
                            <span className="text-[10px] font-black uppercase">Cambio Entregado</span>
                            <span className="font-bold text-sm">- ${totalChangeOut.toFixed(2)}</span>
                        </div>
                        <div className="border-t-2 border-green-500/20 border-dashed pt-4 mt-2 flex flex-col items-center gap-1">
                            <span className="text-[10px] font-black text-green-500 uppercase tracking-[0.2em]">Efectivo Esperado</span>
                            <span className="font-black text-4xl text-green-400 italic">${expectedCash.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {isTicketModalOpen && (
                <CashClosingTicketModal
                    report={generateReportObject()}
                    onClose={() => setIsTicketModalOpen(false)}
                />
            )}

            <PinVerificationModal
                isOpen={showPinModal}
                onClose={() => setShowPinModal(false)}
                onSuccess={(user) => {
                    setShowPinModal(false);
                    // Proceed with save after verification
                    handleSaveReport();
                }}
                requiredRole={UserRole.Admin}
                title="ACTUALIZAR CIERRE"
                message="Se requiere autorización de Admin para modificar un cierre existente."
            />

            <ConfirmationModal
                isOpen={!!confirmAction}
                onClose={() => setConfirmAction(null)}
                // @ts-ignore
                onConfirm={async () => {
                    if (confirmAction?.type === 'force') await confirmForceClose();
                }}
                title={confirmAction?.type === 'force' ? '⚠️ FORZAR CIERRE DE CAJA' : 'CONFIRMAR'}
                message={confirmAction?.type === 'force' ? 'Esto cerrará TODAS las mesas abiertas y marcará sus cuentas como PAGADAS EN EFECTIVO. ¿Seguro?' : ''}
                confirmText={confirmAction?.type === 'force' ? 'SÍ, FORZAR CIERRE' : 'CONFIRMAR'}
                cancelText="CANCELAR"
                isDestructive={confirmAction?.type === 'force'}
            />

            {/* Audit Modal */}
            {isAuditModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-gray-900 border border-white/10 w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 bg-gray-800/50 border-b border-white/5 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">{auditTitle}</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">{auditOrders.length} ÓRDENES EN TOTAL</p>
                            </div>
                            <button 
                                onClick={() => setIsAuditModalOpen(false)}
                                className="p-2 bg-gray-700/50 text-gray-400 hover:text-white hover:bg-red-500/20 rounded-full transition-all active:scale-90"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 overflow-y-auto flex-1 scrollbar-hide">
                            <div className="space-y-2">
                                {auditOrders.length > 0 ? (
                                    <>
                                        <div className="grid grid-cols-12 px-4 py-2 text-[9px] font-black text-gray-600 uppercase tracking-widest italic sticky top-0 bg-gray-900 z-10">
                                            <div className="col-span-2"># ORD</div>
                                            <div className="col-span-3">HORA / TIPO</div>
                                            <div className="col-span-4">MESERO</div>
                                            <div className="col-span-3 text-right">MONTO</div>
                                        </div>
                                        {auditOrders.map((ord, idx) => (
                                            <div 
                                                key={`${ord.id}-${idx}`}
                                                className="grid grid-cols-12 items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.05] transition-all group"
                                            >
                                                <div className="col-span-2">
                                                    <span className="text-sm font-black text-amber-500 italic">#{ord.dailyOrderNumber}</span>
                                                </div>
                                                <div className="col-span-3 flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-1.5 text-gray-300">
                                                        <ClockIcon className="w-3 h-3 text-gray-500" />
                                                        <span className="text-[10px] font-bold">{ord.time}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-gray-500">
                                                        <TableIcon className="w-3 h-3 text-gray-600" />
                                                        <span className="text-[9px] font-black uppercase tracking-tighter truncate">{ord.type === 'Local' ? 'Restaurante' : ord.type}</span>
                                                    </div>
                                                </div>
                                                <div className="col-span-4 flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                                        <UserIcon className="w-3 h-3 text-purple-400" />
                                                    </div>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase italic truncate">{ord.waiter}</span>
                                                </div>
                                                <div className="col-span-3 text-right">
                                                    <span className="text-sm font-black text-white italic">${ord.amount.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <div className="py-20 flex flex-col items-center justify-center opacity-30">
                                        <ClipboardListIcon className="w-16 h-16 mb-4" />
                                        <p className="text-xs font-black uppercase tracking-widest text-center">NO HAY ÓRDENES REGISTRADAS</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-gray-800/30 border-t border-white/5 flex justify-between items-center shrink-0">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">TOTAL AUDITORÍA</span>
                            <span className="text-2xl font-black text-amber-500 italic">
                                ${auditOrders.reduce((sum, o) => sum + o.amount, 0).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashClosingScreen;
