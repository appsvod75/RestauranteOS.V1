import React, { useState, useMemo, useEffect } from 'react';
import { PaymentMethod, Payment, UserRole } from '../types';
import { PlusIcon, TrashIcon } from './icons';
import PinVerificationModal from './PinVerificationModal';
import toast from 'react-hot-toast';

interface PaymentModalProps {
    orderTotal: number;
    manualDiscount: number;
    onManualDiscountChange: (amount: number) => void;
    onClose: () => void;
    onConfirmPayment: (payments: Payment[], changeGiven: number) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
    orderTotal,
    manualDiscount,
    onManualDiscountChange,
    onClose,
    onConfirmPayment
}) => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [currentPaymentMethod, setCurrentPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Cash);
    const [currentAmount, setCurrentAmount] = useState('');
    const [isPinModalVisible, setIsPinModalVisible] = useState(false);
    const [isDiscountInputVisible, setIsDiscountInputVisible] = useState(false);
    const [discountValue, setDiscountValue] = useState(manualDiscount > 0 ? manualDiscount.toString() : '');

    const safeOrderTotal = useMemo(() => {
        const val = Number(orderTotal);
        return (isNaN(val) ? 0 : val) - manualDiscount;
    }, [orderTotal, manualDiscount]);

    const totalPaid = useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments]);
    const remainingAmount = useMemo(() => Math.max(0, safeOrderTotal - totalPaid), [safeOrderTotal, totalPaid]);

    const isCashOnlyPayment = useMemo(() => {
        return payments.every(p => p.method === PaymentMethod.Cash);
    }, [payments]);

    const totalExcess = useMemo(() => {
        return payments.reduce((sum, p) => sum + (p.excessAmount || 0), 0);
    }, [payments]);

    const changeAmount = useMemo(() => {
        if (isCashOnlyPayment && totalPaid > safeOrderTotal) {
            return totalPaid - safeOrderTotal;
        }
        return 0;
    }, [totalPaid, safeOrderTotal, isCashOnlyPayment]);

    const paraOtrosAmount = useMemo(() => {
        if (!isCashOnlyPayment && totalPaid > safeOrderTotal && totalExcess > 0) {
            return totalExcess;
        }
        return 0;
    }, [totalPaid, safeOrderTotal, isCashOnlyPayment, totalExcess]);

    useEffect(() => {
        setCurrentAmount(remainingAmount > 0 ? remainingAmount.toFixed(2) : '');
    }, [remainingAmount]);


    const handleAddPayment = () => {
        const amount = parseFloat(currentAmount);
        if (isNaN(amount) || amount <= 0) return;

        if (currentPaymentMethod !== PaymentMethod.Cash && currentPaymentMethod !== PaymentMethod.Transfer && currentPaymentMethod !== PaymentMethod.TransferOther && (totalPaid + amount > safeOrderTotal + 0.009)) {
            toast.error('El monto excede el total. Solo puede pagar de más en efectivo o transferencia.');
            return;
        }

        let excessAmount = 0;
        if (currentPaymentMethod === PaymentMethod.Transfer && totalPaid + amount > safeOrderTotal + 0.009) {
            excessAmount = totalPaid + amount - safeOrderTotal;
        } else if (currentPaymentMethod === PaymentMethod.TransferOther) {
            excessAmount = amount;
        }

        setPayments(prev => [...prev, { method: currentPaymentMethod, amount, excessAmount }]);
        setCurrentAmount('');
    };

    const handleApplyManualDiscount = () => {
        const discount = parseFloat(discountValue);
        if (isNaN(discount) || discount < 0) {
            onManualDiscountChange(0);
        } else if (discount > orderTotal) {
            alert('El descuento no puede ser mayor al total.');
        } else {
            onManualDiscountChange(discount);
        }
        setIsDiscountInputVisible(false);
    };

    const handleRemovePayment = (index: number) => {
        setPayments(prev => prev.filter((_, i) => i !== index));
    };

    const canConfirm = totalPaid >= safeOrderTotal - 0.009;

    const handleConfirm = () => {
        if (!canConfirm) return;
        onConfirmPayment(payments, changeAmount);
    };

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[300] p-4">
                <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                    <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); if (canConfirm) handleConfirm(); }} className="flex flex-col flex-1">
                        <h3 className="text-2xl md:text-3xl font-bold text-amber-400 text-center mb-2">Procesar Pago</h3>

                        <div className="text-center py-2 mb-1 bg-gray-900 rounded-lg relative overflow-hidden">
                            <p className="text-base md:text-lg text-gray-400">Total a Pagar</p>
                            <p className="text-4xl md:text-5xl font-bold text-white">${safeOrderTotal.toFixed(2)}</p>
                            {manualDiscount > 0 && (
                                <div className="mt-1 flex justify-center items-center gap-2">
                                    <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Cortesía Admin: -${manualDiscount.toFixed(2)}</span>
                                    <button
                                        type="button"
                                        onClick={() => onManualDiscountChange(0)}
                                        className="text-gray-500 hover:text-red-400 transition-colors"
                                    >
                                        <TrashIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {!isDiscountInputVisible && (
                            <button
                                type="button"
                                onClick={() => setIsPinModalVisible(true)}
                                className="mb-1 py-1 px-4 self-center bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 rounded-full text-[10px] font-black uppercase tracking-[0.2em] hover:bg-cyan-500/20 transition-all flex items-center gap-2"
                            >
                                <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
                                DESC. ADMIN
                            </button>
                        )}

                        {isDiscountInputVisible && (
                            <div className="mb-4 p-4 bg-cyan-950/30 border border-cyan-500/30 rounded-xl animate-in zoom-in-95 duration-200">
                                <label className="block text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-2">Monto de Descuento Especial</label>
                                <div className="flex gap-2">
                                    <input
                                        autoFocus
                                        type="number"
                                        step="0.01"
                                        value={discountValue}
                                        onChange={(e) => setDiscountValue(e.target.value)}
                                        className="flex-1 bg-gray-900 border border-cyan-500/50 rounded-lg p-2 text-white font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                        placeholder="0.00"
                                        onKeyDown={(e) => e.key === 'Enter' && handleApplyManualDiscount()}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleApplyManualDiscount}
                                        className="px-4 bg-cyan-600 text-white font-black text-xs rounded-lg hover:bg-cyan-500 uppercase"
                                    >
                                        Aplicar
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                            {payments.map((payment, index) => (
                                <div key={index} className="bg-gray-900/50 border border-gray-700/50 p-3 rounded-xl flex justify-between items-center group transition-all hover:bg-gray-900">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-amber-500/10 text-amber-500 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-amber-500/20">
                                            {payment.method}
                                        </div>
                                        <p className="font-black text-white text-lg font-mono">
                                            ${payment.amount.toFixed(2)}
                                        </p>
                                        {(payment.excessAmount || 0) > 0 && (
                                            <span className="text-[9px] text-purple-400 font-black uppercase tracking-wider ml-1">
                                                (${payment.excessAmount!.toFixed(2)} otros)
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemovePayment(index)}
                                        className="p-2 text-gray-500 hover:text-rose-500 bg-gray-800/50 hover:bg-rose-500/10 rounded-full transition-all border border-transparent hover:border-rose-500/20"
                                    >
                                        <TrashIcon className="w-5 h-5 flex-shrink-0" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {(!canConfirm || (isCashOnlyPayment && changeAmount === 0)) ? (
                            <div className="bg-gray-900 p-4 rounded-lg space-y-3 mt-1">
                                <div>
                                    <label className="block text-gray-400 text-sm font-bold mb-2">Forma de Pago</label>
                                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                        {Object.values(PaymentMethod).map(method => (
                                            <button
                                                type="button"
                                                key={method}
                                                onClick={() => setCurrentPaymentMethod(method)}
                                                className={`p-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${currentPaymentMethod === method ? 'bg-amber-500 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                                            >
                                                {method}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-end gap-2">
                                    <div className="flex-1">
                                        <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="amount">Monto</label>
                                        <input
                                            id="amount"
                                            type="number"
                                            value={currentAmount}
                                            onChange={(e) => setCurrentAmount(e.target.value)}
                                            onFocus={() => setCurrentAmount('')}
                                            placeholder={remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00'}
                                            autoComplete="new-password"
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPayment(); } }}
                                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>
                                    <button type="button" onClick={handleAddPayment} className="p-3 bg-green-600 rounded-lg text-white hover:bg-green-700">
                                        <PlusIcon className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        <div className={`mt-1 text-center py-2 rounded-lg transition-colors ${canConfirm ? 'bg-green-800' : 'bg-red-800'}`}>
                            <p className="text-base md:text-lg text-gray-300">
                                {canConfirm ? 'Total Recibido' : 'Faltan'}
                            </p>
                            <p className="text-3xl md:text-4xl font-bold text-white">
                                ${canConfirm ? totalPaid.toFixed(2) : remainingAmount.toFixed(2)}
                            </p>
                        </div>

                        {changeAmount > 0 && (
                            <div className="mt-4 text-center py-2 rounded-lg bg-cyan-800">
                                <p className="text-base md:text-lg text-cyan-200">Cambio</p>
                                <p className="text-3xl md:text-4xl font-bold text-white">${changeAmount.toFixed(2)}</p>
                            </div>
                        )}
                        {paraOtrosAmount > 0 && (
                            <div className="mt-4 text-center py-2 rounded-lg bg-purple-800">
                                <p className="text-base md:text-lg text-purple-200">Para Otros</p>
                                <p className="text-3xl md:text-4xl font-bold text-white">${paraOtrosAmount.toFixed(2)}</p>
                            </div>
                        )}

                        <div className="flex gap-4 pt-4">
                            <button type="button" onClick={onClose} className="w-full p-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                            <button type="submit" disabled={!canConfirm} className="w-full p-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors">Confirmar Pago</button>
                        </div>
                    </form>
                </div>
            </div>

            <PinVerificationModal
                isOpen={isPinModalVisible}
                onClose={() => setIsPinModalVisible(false)}
                onSuccess={() => {
                    setIsPinModalVisible(false);
                    setIsDiscountInputVisible(true);
                }}
                requiredRole={UserRole.Admin}
                title="AUTORIZACIÓN DE DESCUENTO"
                message="Ingresa tu PIN de Administrador para aplicar cortesía"
            />
        </>
    );
};

export default PaymentModal;