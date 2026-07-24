
import React from 'react';
import { createPortal } from 'react-dom';
import { Order, OrderType } from '../types';
import { XMarkIcon, ClipboardListIcon } from './icons';

interface KdsHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    orders: Order[];
}

const KdsHistoryModal: React.FC<KdsHistoryModalProps> = ({ isOpen, onClose, orders }) => {
    if (!isOpen) return null;

    const portalRoot = document.getElementById('portal-root');
    if (!portalRoot) return null;

    const getOrderTypeBadgeColor = (type: OrderType) => {
        switch (type) {
            case OrderType.Local: return 'bg-blue-600 border-blue-400';
            case OrderType.Delivery: return 'bg-orange-600 border-orange-400';
            case OrderType.Pickup: return 'bg-purple-600 border-purple-400';
            case OrderType.Takeaway: return 'bg-pink-600 border-pink-400';
            default: return 'bg-gray-600 border-gray-400';
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/95 animate-in fade-in duration-200"
                onClick={onClose}
            />

            <div className="relative bg-gray-900 border border-gray-800 rounded-[32px] w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl transition-all duration-200 overflow-hidden text-white">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900 sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                            <ClipboardListIcon className="w-6 h-6 text-amber-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black italic uppercase tracking-tighter">Historial de Comandas</h2>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Últimas órdenes servidas y completadas</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-2xl transition-all active:scale-95"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    {orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500 opacity-50">
                            <span className="text-4xl mb-4">📭</span>
                            <p className="text-lg font-bold uppercase tracking-tighter">No hay órdenes en el historial</p>
                        </div>
                    ) : (
                        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                            {orders.sort((a, b) => {
                                const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                                const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                                return dateB.getTime() - dateA.getTime();
                            }).map(order => (
                                <div
                                    key={order.id}
                                    className="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden flex flex-col break-inside-avoid shadow-lg"
                                >
                                    {/* Ticket Header */}
                                    <div className="p-3 bg-gray-800 border-b border-gray-700 flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-black text-white">#{String(order.dailyOrderNumber).padStart(3, '0')}</span>
                                                <span className={`${getOrderTypeBadgeColor(order.type)} text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase`}>
                                                    {order.type === 'Local' ? 'Restaurante' : order.type}
                                                </span>
                                            </div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase truncate max-w-[120px]">
                                                {order.table ? order.table.name : order.customer?.name || 'Cliente'}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-mono font-bold text-amber-500">
                                                {(order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            {order.chef && (
                                                <div className="text-[8px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 rounded mt-1 uppercase">
                                                    CHEF: {order.chef}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Items */}
                                    <div className="p-3 space-y-1">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="flex flex-col gap-0.5 text-[11px] opacity-70">
                                                <div className="flex gap-2">
                                                    <span className="font-bold text-amber-500">{item.quantity}</span>
                                                    <span className="text-gray-300 truncate font-bold">{item.product.name}</span>
                                                </div>
                                                {item.comboSelections?.map((s, si) => (
                                                    <div key={si} className="pl-4 text-[9px] text-purple-400 italic leading-none">
                                                        • {s.productName} {s.meatName ? `(${s.meatName})` : ''}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Ticket Footer */}
                                    <div className="p-2 bg-gray-900/30 border-t border-gray-700/50 flex justify-between items-center">
                                        <span className={`text-[9px] font-black uppercase ${order.status === 'completed' ? 'text-green-500' : 'text-blue-500'}`}>
                                            {order.status === 'completed' ? 'PAGADO' : 'SERVIDO'}
                                        </span>
                                        <span className="text-[10px] font-mono text-gray-500">
                                            {order.readyAt ? `Listo en ${Math.round(((order.readyAt instanceof Date ? order.readyAt : new Date(order.readyAt)).getTime() - (order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt)).getTime()) / 60000)}m` : ''}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="p-4 bg-gray-950/50 border-t border-gray-800 text-center">
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">Restaurante OS - KDS History Module</p>
                </div>
            </div>
        </div>,
        portalRoot
    );
};

export default KdsHistoryModal;
