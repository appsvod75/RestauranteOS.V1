import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { CashRegisterIcon } from './icons';

interface CashOpeningModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (amount: number) => Promise<void>;
    onSilence?: () => void;
    branchName?: string;
}

const CashOpeningModal: React.FC<CashOpeningModalProps> = ({ isOpen, onClose, onSave, onSilence, branchName }) => {
    const [amount, setAmount] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) {
            toast.error('Ingresa un monto válido mayor a 0');
            return;
        }
        setIsSaving(true);
        try {
            await onSave(val);
            setAmount('');
        } catch {
            // Error handled by parent
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const portal = document.getElementById('portal-root');
    if (!portal) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4">
            <div className="bg-gray-900 rounded-[32px] p-6 w-full max-w-sm border border-amber-500/30 shadow-2xl shadow-amber-500/5 transition-all duration-300">
                <div className="flex flex-col items-center gap-3 mb-6">
                    <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center border-2 border-amber-500/20">
                        <CashRegisterIcon className="w-8 h-8 text-amber-500" />
                    </div>
                    <h2 className="text-xl font-black text-white italic uppercase tracking-tighter text-center">
                        Apertura de <span className="text-amber-500">Caja</span>
                    </h2>
                    {branchName && (
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{branchName}</p>
                    )}
                    <p className="text-gray-600 text-[9px] font-black uppercase tracking-widest italic">
                        {new Date().toLocaleDateString('es-SV', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                <div className="space-y-2 mb-6">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">
                        Monto Inicial (Fondo de Caja)
                    </label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 font-black text-xl italic">$</span>
                        <input
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSave()}
                            placeholder="0.00"
                            autoFocus
                            className="w-full py-4 pl-12 pr-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-xl outline-none focus:border-amber-500 shadow-inner italic text-center"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-2xl uppercase text-[11px] tracking-widest transition-all active:scale-95 shadow-lg shadow-amber-900/20 disabled:opacity-50 italic"
                    >
                        {isSaving ? 'GUARDANDO...' : 'REGISTRAR APERTURA'}
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest transition-all active:scale-95"
                        >
                            Ignorar (5 min)
                        </button>
                        {onSilence && (
                            <button
                                onClick={onSilence}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest transition-all active:scale-95"
                            >
                                No recordar
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        portal
    );
};

export default CashOpeningModal;
