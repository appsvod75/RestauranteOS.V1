import React, { useState } from 'react';
import { CashClosingReport, Branch } from '../types';
import CashClosingTicketModal from './CashClosingTicketModal';
import { StoreIcon } from './icons';

interface CashClosingHistoryScreenProps {
    reports: CashClosingReport[];
    onBack: () => void;
    branches?: Branch[];
}

const CashClosingHistoryScreen: React.FC<CashClosingHistoryScreenProps> = ({ reports, onBack, branches = [] }) => {
    const [selectedReport, setSelectedReport] = useState<CashClosingReport | null>(null);

    const sortedReports = [...reports].sort((a, b) => {
        const dateA = a.date ? new Date(a.date + 'T12:00:00') : new Date(0);
        const dateB = b.date ? new Date(b.date + 'T12:00:00') : new Date(0);
        const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
        const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
        return timeB - timeA;
    });

    const formatDate = (dateInput: any) => {
        if (!dateInput) return '---';
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return 'Fecha Inválida';
        return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    const formatTime = (dateInput: any) => {
        if (!dateInput) return '---';
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return '---';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getBranchName = (branchId: number) => {
        return branches.find(b => b.id === branchId)?.name || `Sucursal ${branchId}`;
    };

    const getBranchChip = (report: CashClosingReport) => {
        const name = getBranchName(Number(report.branchId));
        return (
            <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded-lg text-[8px] font-black text-gray-400 uppercase tracking-tighter">
                {name}
            </span>
        );
    };

    return (
        <div className="h-full flex flex-col p-4 sm:p-6 max-w-7xl mx-auto overflow-hidden w-full animate-in fade-in duration-300">
            <div className="flex items-center gap-4 mb-6 shrink-0">
                <button onClick={onBack} className="bg-gray-800 p-2.5 rounded-full hover:bg-gray-700 active:scale-90 transition-all shadow-lg border border-gray-700/50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div>
                    <h1 className="text-2xl md:text-4xl font-black text-white italic uppercase tracking-tighter leading-none">
                        HISTORIAL <span className="text-amber-500">DE CIERRES</span>
                    </h1>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">REGISTRO CRONOLÓGICO DE CAJA</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
                {sortedReports.length === 0 ? (
                    <div className="bg-gray-900/50 border border-gray-800 p-12 rounded-[40px] text-center">
                        <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700">
                           <StoreIcon className="w-8 h-8 text-gray-600" />
                        </div>
                        <p className="text-gray-500 font-black uppercase italic tracking-widest text-xs">No hay cierres para esta selección.</p>
                    </div>
                ) : (
                    <div className="bg-gray-900 border border-gray-800 rounded-[40px] overflow-hidden shadow-2xl">
                        <ul className="divide-y divide-gray-800">
                            {sortedReports.map(report => (
                                <li
                                    key={report.id || report.date}
                                    onClick={() => setSelectedReport(report)}
                                    className="px-4 py-4 hover:bg-gray-800/30 cursor-pointer transition-all flex items-center justify-between group gap-4"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-black text-white text-sm uppercase italic group-hover:text-amber-500 transition-colors truncate">
                                                {formatDate(report.date + 'T12:00:00')}
                                            </p>
                                            {getBranchChip(report)}
                                        </div>
                                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-tight">
                                            CREADO EL {formatDate(report.createdAt)} A LAS {formatTime(report.createdAt)}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 sm:gap-4 items-center shrink-0">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest leading-none mb-0.5">SERVICIOS</p>
                                            <p className="font-black text-base sm:text-lg text-white italic tracking-tighter leading-none">{report.totalOrders || 0}</p>
                                        </div>
                                        <div className="text-right border-l border-gray-800 pl-2 sm:pl-4">
                                            <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest leading-none mb-0.5">VENTAS</p>
                                            <p className="font-black text-base sm:text-lg text-amber-500 italic tracking-tighter leading-none">${(Number(report.totalSales) || 0).toFixed(2)}</p>
                                        </div>
                                        <div className="text-right border-l border-gray-800 pl-2 sm:pl-4">
                                            <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest leading-none mb-0.5">CAJA</p>
                                            <p className="font-black text-base sm:text-lg text-emerald-400 italic tracking-tighter leading-none">${(Number(report.expectedCash) || 0).toFixed(2)}</p>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {selectedReport && (
                <CashClosingTicketModal
                    report={selectedReport}
                    onClose={() => setSelectedReport(null)}
                />
            )}
        </div>
    );
};

export default CashClosingHistoryScreen;
