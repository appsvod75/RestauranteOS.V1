import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { toast } from 'react-hot-toast';
import { useDragScroll } from '../hooks/useDragScroll';

const AuditLogsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    // Default to last 3 days
    const defaultEnd = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(defaultEnd.getDate() - 3);

    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
    const [startDate, setStartDate] = useState(defaultStart.toLocaleDateString('en-CA'));
    const [endDate, setEndDate] = useState(defaultEnd.toLocaleDateString('en-CA'));

    // Drag Scroll
    const dragScroll = useDragScroll();

    const [activeTab, setActiveTab] = useState<'orders' | 'items'>('orders');

    useEffect(() => {
        loadLogs();
    }, [startDate, endDate, activeTab]);

    const loadLogs = async () => {
        setIsLoading(true);
        try {
            const data = await api.getAuditLogs({
                startDate,
                endDate: endDate + ' 23:59:59',
                type: activeTab
            });
            setLogs(data);
        } catch (error) {
            console.error('Error loading audit logs:', error);
            toast.error('Error al cargar historial de auditoría');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleExpand = (id: number) => {
        setExpandedLogId(expandedLogId === id ? null : id);
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 overflow-hidden transition-all duration-300">
            {/* Header matches GlobalHistoryScreen */}
            <div className="flex flex-wrap justify-between items-center p-6 border-b border-gray-800 shrink-0 gap-3">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <button onClick={onBack} className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 active:scale-90 transition-all border border-gray-700 shrink-0">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-lg sm:text-3xl font-black text-white italic uppercase tracking-tighter truncate">
                            AUDITORÍA DE <span className="text-red-500">BORRADOS</span>
                        </h1>
                        <p className="text-gray-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest truncate">
                            HISTORIAL DE SEGURIDAD Y ELIMINACIÓN
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-800 rounded-xl p-1 border border-gray-700 shrink-0">
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold uppercase transition-all ${activeTab === 'orders' ? 'bg-red-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Pedidos Completos
                    </button>
                    <button
                        onClick={() => setActiveTab('items')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold uppercase transition-all ${activeTab === 'items' ? 'bg-red-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Productos Individuales
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="p-4 grid grid-cols-2 gap-4 bg-gray-900/50 shrink-0 border-b border-gray-800/50">
                <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">DESDE</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-red-500" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">HASTA</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-red-500" />
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
                </div>
            ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-30 italic">
                    <p className="text-xl font-black uppercase text-gray-500">No hay registros de auditoría</p>
                </div>
            ) : (
                <div
                    {...dragScroll}
                    className={`flex-1 overflow-auto p-4 scrollbar-hide ${dragScroll.isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                    <div className="grid gap-4 max-w-7xl mx-auto pb-32 w-full">
                        {logs.map((log) => (
                            <div
                                key={log.id}
                                className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg hover:border-gray-700 transition-colors"
                            >
                                <div
                                    onClick={() => toggleExpand(log.id)}
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-800/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-500">
                                            {activeTab === 'orders' ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                                </svg>
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                {activeTab === 'orders' ? (
                                                    <h3 className="text-white font-bold uppercase">
                                                        Pedido #{String(log.order_data?.daily_order_number || log.order_data?.dailyOrderNumber || '???').padStart(3, '0')}
                                                    </h3>
                                                ) : (
                                                    <h3 className="text-white font-bold uppercase">
                                                        {log.item_data?.product?.name || 'Producto Desconocido'} <span className="text-red-500">x{log.item_data?.quantity}</span>
                                                    </h3>
                                                )}

                                                <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-400 font-mono">
                                                    {activeTab === 'orders' ? log.order_id : `Orden #${log.order_id}`}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1 flex gap-3">
                                                <span className="flex items-center gap-1">
                                                    👤 <span className="text-red-400 font-bold">{log.deleted_by_name || 'Desconocido'}</span>
                                                </span>
                                                <span className="flex items-center gap-1 opacity-60">
                                                    📅 {new Date(log.deleted_at).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-sm font-bold text-gray-300 uppercase">
                                            Razón: <span className="text-white italic">"{log.reason || 'Sin razón especificada'}"</span>
                                        </div>
                                        <div className="mt-1 text-xs text-gray-500 font-bold uppercase opacity-50">
                                            Clic para detalles {expandedLogId === log.id ? '▲' : '▼'}
                                        </div>
                                    </div>
                                </div>

                                {expandedLogId === log.id && (
                                    <div className="bg-black/30 p-4 border-t border-gray-800 text-xs font-mono text-gray-400 space-y-2 animate-in slide-in-from-top-2">
                                        {activeTab === 'orders' ? (
                                            <>
                                                <p className="uppercase font-bold text-gray-500 mb-2">Detalles del Pedido Eliminado:</p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="block text-gray-600 uppercase">Cliente:</span>
                                                        <span className="text-white">{log.order_data?.customer?.name || 'Cliente Mostrador'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-gray-600 uppercase">Total:</span>
                                                        <span className="text-green-400 font-bold">${Number(log.order_data?.total || 0).toFixed(2)}</span>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <span className="block text-gray-600 uppercase mb-1">Items:</span>
                                                        <ul className="list-disc pl-4 space-y-1">
                                                            {log.order_data?.items?.map((item: any, idx: number) => (
                                                                <li key={idx}>
                                                                    {item.quantity}x {item.name || 'Producto'} (${Number(item.total).toFixed(2)})
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <p className="uppercase font-bold text-gray-500 mb-2">Detalles del Item Eliminado:</p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="block text-gray-600 uppercase">Total Item:</span>
                                                        <span className="text-green-400 font-bold">${Number(log.item_data?.total || 0).toFixed(2)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-gray-600 uppercase">ID Item:</span>
                                                        <span className="text-gray-500">{log.item_data?.id}</span>
                                                    </div>
                                                    {log.item_data?.extras && log.item_data.extras.length > 0 && (
                                                        <div className="col-span-2">
                                                            <span className="block text-gray-600 uppercase mb-1">Extras:</span>
                                                            <ul className="list-disc pl-4 space-y-1">
                                                                {log.item_data.extras.map((extra: any, idx: number) => (
                                                                    <li key={idx}>
                                                                        {extra.name} (${Number(extra.price).toFixed(2)})
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {log.item_data?.observations && (
                                                        <div className="col-span-2">
                                                            <span className="block text-gray-600 uppercase mb-1">Observaciones:</span>
                                                            <p className="text-yellow-400 italic">"{log.item_data.observations}"</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditLogsScreen;
