
import React, { useMemo } from 'react';
import { Order, OrderType } from '../types';

interface DailySummaryScreenProps {
    orders: Order[];
    onBack: () => void;
}

const DailySummaryScreen: React.FC<DailySummaryScreenProps> = ({ orders, onBack }) => {
    const summary = useMemo(() => {
        const summaryMap = new Map<OrderType, { count: number; total: number }>();
        for (const order of orders) {
            const existing = summaryMap.get(order.type);
            if (existing) {
                existing.count++;
                existing.total += order.total;
            } else {
                summaryMap.set(order.type, { count: 1, total: order.total });
            }
        }
        return Array.from(summaryMap.entries()).map(([type, data]) => ({ type, ...data }));
    }, [orders]);

    const grandTotal = useMemo(() => summary.reduce((sum, item) => sum + item.total, 0), [summary]);

    return (
        <div className="h-full flex flex-col p-4 sm:p-6 max-w-7xl mx-auto overflow-hidden w-full">
            <div className="flex items-center gap-4 mb-8 shrink-0">
                <button onClick={onBack} className="bg-gray-800 p-2.5 rounded-full hover:bg-gray-700 active:scale-90 transition-all shadow-lg border border-gray-700/50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h1 className="text-2xl md:text-4xl font-black text-white italic uppercase tracking-tighter leading-none">
                    RESUMEN <span className="text-amber-500">DEL DÍA</span>
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide space-y-6">
                {orders.length === 0 ? (
                    <div className="bg-gray-900/50 border border-gray-800 p-12 rounded-[40px] text-center text-gray-600 font-black uppercase italic tracking-widest text-xs">
                        Aún no hay pedidos hoy.
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-gray-900 border border-gray-800 rounded-[40px] overflow-hidden shadow-2xl">
                            <table className="w-full text-left">
                                <thead className="bg-gray-800/50">
                                    <tr>
                                        <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Servicio</th>
                                        <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Cant.</th>
                                        <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {summary.map(item => (
                                        <tr key={item.type}>
                                            <td className="p-6 font-black text-white uppercase italic text-sm">{item.type === 'Local' ? 'Restaurante' : item.type}</td>
                                            <td className="p-6 text-center font-bold text-gray-400">{item.count}</td>
                                            <td className="p-6 text-right font-black text-amber-500 italic text-lg">${item.total.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-amber-500 p-8 rounded-[40px] flex justify-between items-center shadow-2xl shadow-amber-500/20">
                            <span className="text-xs font-black text-amber-950 uppercase tracking-widest">VENTA TOTAL BRUTA</span>
                            <span className="text-4xl font-black text-white italic tracking-tighter">${grandTotal.toFixed(2)}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailySummaryScreen;
