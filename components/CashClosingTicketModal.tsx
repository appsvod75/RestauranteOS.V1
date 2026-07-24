import React from 'react';
import { createPortal } from 'react-dom';
import { CashClosingReport } from '../types';

interface CashClosingTicketModalProps {
    onClose: () => void;
    report: CashClosingReport;
}

const CashClosingTicketContent: React.FC<{ report: CashClosingReport }> = ({ report }) => (
    <div className="bg-white text-black p-4 rounded-md font-mono text-xs w-[80mm]">
        <div className="text-center">
            <h2 className="text-base font-bold">CIERRE DE CAJA</h2>
            <p>Fecha: {(() => {
                if (!report.createdAt) return '---';
                const d = new Date(report.createdAt);
                return isNaN(d.getTime()) ? 'Fecha Inválida' : d.toLocaleString();
            })()}</p>
        </div>
        <hr className="my-2 border-black border-dashed" />
        <div className="space-y-1">
            <p className="font-bold">DESGLOSE DE INGRESOS:</p>
            {Array.isArray(report.summary) ? (() => {
                const cashItem = report.summary.find(i => i.method === 'Efectivo');
                const transferPropias = report.summary.find(i => i.method === 'Transfer. Propias');
                const transferOtros = report.summary.find(i => i.method === 'Transfer. Otros');
                const otherItems = report.summary.filter(i => i.method !== 'Efectivo' && i.method !== 'Transfer. Propias' && i.method !== 'Transfer. Otros');
                const transferTotal = (Number(transferPropias?.total) || 0) + (Number(transferOtros?.total) || 0);

                return (
                    <>
                        {cashItem && (
                            <div className="flex justify-between font-bold">
                                <span>{cashItem.method}:</span>
                                <span>${(Number(cashItem.total) || 0).toFixed(2)}</span>
                            </div>
                        )}
                        {(transferPropias || transferOtros) && (
                            <div className="space-y-0.5">
                                <div className="flex justify-between font-bold border-t border-dashed border-gray-400 pt-1 mt-1">
                                    <span>TRANSFERENCIAS:</span>
                                    <span>${transferTotal.toFixed(2)}</span>
                                </div>
                                {transferPropias && (
                                    <div className="flex justify-between text-xs pl-3">
                                        <span>Propias:</span>
                                        <span>${(Number(transferPropias.total) || 0).toFixed(2)}</span>
                                    </div>
                                )}
                                {transferOtros && (
                                    <div className="flex justify-between text-xs pl-3 text-gray-500">
                                        <span>Otros:</span>
                                        <span>${(Number(transferOtros.total) || 0).toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        {otherItems.map(item => (
                            <div key={item.method} className="flex justify-between">
                                <span>{item.method}:</span>
                                <span>${(Number(item.total) || 0).toFixed(2)}</span>
                            </div>
                        ))}
                    </>
                );
            })() : <p className="italic text-gray-500">Sin datos de desglose</p>}
        </div>
        <hr className="my-2 border-black border-dashed" />
        <div className="flex justify-between font-bold">
            <span>TOTAL VENTAS:</span>
            <span>${(Number(report.totalSales) || 0).toFixed(2)}</span>
        </div>
        <hr className="my-2 border-black border-dashed" />
        <div className="space-y-1">
            <p className="font-bold">CÁLCULO DE EFECTIVO:</p>
            <div className="flex justify-between">
                <span>Fondo Inicial:</span>
                <span>${(Number(report.initialCash) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
                <span>(+) Efectivo Recibido:</span>
                <span>${(Number(report.totalCashIn) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
                <span>(-) Cambio Entregado:</span>
                <span>-${(Number(report.totalChangeOut) || 0).toFixed(2)}</span>
            </div>
        </div>
        <hr className="my-2 border-black border-dashed" />
        <div className="flex justify-between font-bold text-sm">
            <span>EFECTIVO ESPERADO:</span>
            <span>${(Number(report.expectedCash) || 0).toFixed(2)}</span>
        </div>
    </div>
);

const CashClosingTicketModal: React.FC<CashClosingTicketModalProps> = ({ onClose, report }) => {
    const handlePrint = () => {
        window.print();
    };

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 no-print">
                <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-sm mx-auto flex flex-col max-h-[90vh]">
                    <div className="flex-1 overflow-y-auto bg-gray-100 p-4 rounded-xl flex flex-col items-center">
                        <CashClosingTicketContent report={report} />
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                        <button onClick={handlePrint} className="w-full p-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">Imprimir</button>
                        <button onClick={onClose} className="w-full sm:w-auto p-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors">Cerrar</button>
                    </div>
                </div>
            </div>

            {/* Hidden Print Portal at Body Root */}
            {createPortal(
                <div className="print-area">
                    <CashClosingTicketContent report={report} />
                </div>,
                document.body
            )}
        </>
    );
};

export default CashClosingTicketModal;