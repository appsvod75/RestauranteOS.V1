import React, { useState, useMemo } from 'react';
import { Product, Category, Meat } from '../types';
import { XMarkIcon as XIcon, CheckCircleIcon, ArrowRightIcon } from './icons';

interface ComboSelectionModalProps {
    combo: Product;
    categories: Category[];
    products: Product[];
    meats: Meat[];
    masas: Meat[];
    onClose: () => void;
    onConfirm: (selections: any[]) => void;
}

const ComboSelectionModal: React.FC<ComboSelectionModalProps> = ({ combo, categories, products, meats, masas, onClose, onConfirm }) => {
    const comboDef = useMemo(() => {
        try {
            return typeof combo.comboDefinition === 'string'
                ? JSON.parse(combo.comboDefinition)
                : (combo.comboDefinition || { type: 'fixed', items: [], slots: [] });
        } catch (e) {
            console.error("Error parsing combo definition", e);
            return { type: 'fixed', items: [], slots: [] };
        }
    }, [combo]);

    const isFixed = comboDef.type === 'fixed' || !comboDef.type;

    // effectiveSteps: what the user actually interacts with
    const steps = useMemo(() => {
        if (isFixed) {
            // In fixed mode, each product in the bundle is a step IF it requires config
            // However, to keep it simple and consistent, we'll show all items or just the ones that need config
            return (comboDef.items || []).flatMap((item: any) => {
                const p = products.find(prod => prod.id === item.productId);
                if (!p) return [];
                // Repeat based on quantity
                const result = [];
                for (let i = 0; i < item.quantity; i++) {
                    result.push({ product: p, type: 'fixed_item' });
                }
                return result;
            });
        } else {
            return (comboDef.slots || []).map((slot: any) => ({ ...slot, type: 'dynamic_slot' }));
        }
    }, [comboDef, isFixed, products]);

    const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
    // Track selections per slot index
    const [selections, setSelections] = useState<{ [slotIndex: number]: any[] }>({});
    const [productToConfig, setProductToConfig] = useState<{
        product: Product;
        meatId?: number;
        masaId?: number;
    } | null>(null);

    // Safety check for empty steps
    if (steps.length === 0) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-gray-900 p-8 rounded-[30px] border border-gray-800 text-center">
                    <p className="text-white font-black uppercase italic mb-4 text-sm tracking-widest">ERROR: COMBO SIN DEFINICIÓN VÁLIDA</p>
                    <button onClick={onClose} className="px-8 py-3 bg-purple-600 text-white rounded-2xl font-black uppercase italic text-xs tracking-widest shadow-lg shadow-purple-900/40">CERRAR</button>
                </div>
            </div>
        );
    }

    const currentStep = steps[currentSlotIndex];
    const isStepFixed = currentStep.type === 'fixed_item';
    
    // For fixed steps, the product is already defined. For dynamic, we need to pick from list.
    const stepProduct = isStepFixed ? currentStep.product : null;
    const slotQty = isStepFixed ? 1 : (currentStep.quantity || currentStep.qty || 1);
    
    const category = categories.find(c => c.id === currentStep.categoryId);

    const currentSlotSelections = selections[currentSlotIndex] || [];
    const currentSelectedQty = currentSlotSelections.reduce((sum, s) => sum + (s.qty || 1), 0);
    const canProceed = currentSelectedQty === slotQty;

    const slotProducts = useMemo(() => {
        if (isStepFixed) return [currentStep.product];
        if (currentStep.productIds && currentStep.productIds.length > 0) {
            return products.filter(p => currentStep.productIds.includes(p.id) && (p.isActive !== false));
        }
        if (!category) return [];
        return products.filter(p => p.categoryId === category.id && (p.isActive !== false));
    }, [category, products, currentStep, isStepFixed]);

    // Auto-advance logic for FIXED steps that DON'T need config
    React.useEffect(() => {
        if (isStepFixed && !currentStep.product.requiresMeat && !currentStep.product.requiresMasa && currentSelectedQty === 0) {
            addSelectionToSlot(currentStep.product);
        }
    }, [currentSlotIndex]);

    const handleSelect = (product: Product) => {
        const remaining = slotQty - currentSelectedQty;
        if (remaining <= 0) return;

        if (product.requiresMeat || product.requiresMasa) {
            setProductToConfig({
                product,
                meatId: product.requiresMeat ? meats[0]?.id : undefined,
                masaId: product.requiresMasa ? masas[0]?.id : undefined
            });
        } else {
            addSelectionToSlot(product);
        }
    };

    const addSelectionToSlot = (product: Product, meat?: Meat, masa?: Meat) => {
        setSelections(prev => {
            const slotSels = prev[currentSlotIndex] || [];
            // If it has meat/masa, we treat it as a unique variant, don't group if different
            const existingIndex = slotSels.findIndex(s =>
                s.product.id === product.id &&
                s.meat?.id === meat?.id &&
                s.masa?.id === masa?.id
            );

            let newSlotSels;
            if (existingIndex >= 0) {
                newSlotSels = [...slotSels];
                newSlotSels[existingIndex] = { ...newSlotSels[existingIndex], qty: newSlotSels[existingIndex].qty + 1 };
            } else {
                newSlotSels = [...slotSels, {
                    product,
                    qty: 1,
                    meat,
                    masa,
                    productName: product.name,
                    productId: product.id
                }];
            }

            return { ...prev, [currentSlotIndex]: newSlotSels };
        });
    };

    const confirmConfig = () => {
        if (!productToConfig) return;
        const meat = meats.find(m => m.id === productToConfig.meatId);
        const masa = masas.find(m => m.id === productToConfig.masaId);
        addSelectionToSlot(productToConfig.product, meat, masa);
        setProductToConfig(null);
    };

    const handleRemove = (product: Product) => {
        setSelections(prev => {
            const slotSels = prev[currentSlotIndex] || [];
            const idx = slotSels.findLastIndex(s => s.product.id === product.id);
            if (idx === -1) return prev;

            const newSlotSels = [...slotSels];
            if (newSlotSels[idx].qty > 1) {
                newSlotSels[idx] = { ...newSlotSels[idx], qty: newSlotSels[idx].qty - 1 };
            } else {
                newSlotSels.splice(idx, 1);
            }

            return { ...prev, [currentSlotIndex]: newSlotSels };
        });
    };

    const handleNext = () => {
        if (currentSlotIndex < steps.length - 1) {
            setCurrentSlotIndex(prev => prev + 1);
        } else {
            // FINISH
            const flatSelections: any[] = [];
            Object.values(selections).forEach((slotSels: any[]) => {
                slotSels.forEach(s => {
                    flatSelections.push({
                        productId: Number(s.product.id),
                        productName: s.product.name,
                        quantity: 1,
                        meat: s.meat,
                        masa: s.masa,
                        meatName: s.meat?.name,
                        masaName: s.masa?.name
                    });
                });
            });
            onConfirm(flatSelections);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-gray-950 w-full sm:max-w-2xl h-[95vh] sm:h-auto sm:max-h-[85vh] sm:rounded-[40px] rounded-t-[30px] border-t sm:border border-gray-800 shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-500">
                {/* CONFIG OVERLAY */}
                {productToConfig && (
                    <div className="absolute inset-0 bg-gray-900/98 backdrop-blur-md z-[110] p-5 sm:p-8 flex flex-col animate-in slide-in-from-bottom sm:zoom-in duration-300">
                        <div className="flex-1 overflow-y-auto scrollbar-hide">
                            <h3 className="text-xl sm:text-2xl font-black text-white italic uppercase mb-1 sm:mb-2 tracking-tighter">CONFIGURAR PRODUCTO</h3>
                            <p className="text-purple-500 font-bold uppercase text-[10px] sm:text-xs mb-6 sm:mb-8 italic tracking-widest">{productToConfig.product.name}</p>

                            <div className="space-y-6 sm:space-y-8">
                                {productToConfig.product.requiresMeat && (
                                    <div className="space-y-3 sm:space-y-4">
                                        <p className="text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1 italic">SELECCIONAR PROTEÍNA</p>
                                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                            {meats.map(m => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setProductToConfig({ ...productToConfig, meatId: m.id })}
                                                    className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 font-black uppercase text-[9px] sm:text-xs italic transition-all ${productToConfig.meatId === m.id ? 'bg-amber-500 border-amber-400 text-white shadow-[0_8px_20px_-4px_rgba(245,158,11,0.4)] scale-[1.02]' : 'bg-gray-800/50 border-gray-700 text-gray-500 hover:bg-gray-800'}`}
                                                >
                                                    {m.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {productToConfig.product.requiresMasa && (
                                    <div className="space-y-3 sm:space-y-4">
                                        <p className="text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1 italic">SELECCIONAR COMPLEMENTO</p>
                                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                            {masas.map(m => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setProductToConfig({ ...productToConfig, masaId: m.id })}
                                                    className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 font-black uppercase text-[9px] sm:text-xs italic transition-all ${productToConfig.masaId === m.id ? 'bg-fuchsia-600 border-fuchsia-400 text-white shadow-[0_8px_20px_-4px_rgba(192,38,211,0.4)] scale-[1.02]' : 'bg-gray-800/50 border-gray-700 text-gray-500 hover:bg-gray-800'}`}
                                                >
                                                    {m.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-6 sm:mt-8 shrink-0 pb-2">
                            <button type="button" onClick={() => setProductToConfig(null)} className="p-3 sm:p-4 bg-gray-800 text-gray-400 font-black rounded-xl sm:rounded-2xl uppercase text-[10px] sm:tracking-widest active:scale-95 border border-gray-700">CANCELAR</button>
                            <button type="button" onClick={confirmConfig} className="p-3 sm:p-4 bg-green-600 text-white font-black rounded-xl sm:rounded-2xl uppercase text-[10px] shadow-lg active:scale-95 transition-transform sm:tracking-widest italic border border-green-500">CONFIRMAR</button>
                        </div>
                    </div>
                )}

                {/* HEAD */}
                <div className="p-5 sm:p-8 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 shrink-0">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-black text-white italic uppercase tracking-tight leading-tight">{combo.name}</h2>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 sm:mt-2">
                            <span className="bg-purple-500/20 text-purple-400 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest border border-purple-500/30">
                                PASO {currentSlotIndex + 1} DE {steps.length}
                            </span>
                            <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px] sm:text-xs">
                                {isStepFixed ? `CONFIG: ${currentStep.product.name}` : (currentStep.title || `SELECCIONA ${slotQty} ${category?.name || 'Items'}`)}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 sm:p-3 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-2xl transition-all active:scale-90 border border-gray-700/50 shadow-lg">
                        <XIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide bg-gray-950/50">
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                        {slotProducts.map(p => {
                            const selectedCount = (selections[currentSlotIndex] || []).find(s => s.product.id === p.id)?.qty || 0;
                            const isMaxReached = currentSelectedQty >= slotQty;
                            const isActive = selectedCount > 0;

                            return (
                                <button
                                    key={p.id}
                                    onClick={() => handleSelect(p)}
                                    disabled={isMaxReached && !isActive}
                                    className={`group relative h-28 sm:h-40 rounded-[25px] sm:rounded-[35px] border-2 transition-all duration-300 flex flex-col items-center justify-center text-center p-3 sm:p-6 ${isActive
                                        ? 'bg-purple-600 border-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.4)] scale-[0.98]'
                                        : (isMaxReached ? 'bg-gray-900/40 border-gray-800 opacity-40 grayscale cursor-not-allowed' : 'bg-gray-900/40 border-gray-800 hover:border-gray-600 hover:bg-gray-800/40')
                                        }`}
                                >
                                    <div className={`p-2 sm:p-4 rounded-full mb-1 sm:mb-3 transition-colors ${isActive ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-500 group-hover:text-gray-300'}`}>
                                        <CheckCircleIcon className="w-5 h-5 sm:w-8 sm:h-8" />
                                    </div>
                                    <span className={`text-sm sm:text-xl font-black uppercase italic leading-tight truncate w-full ${isActive ? 'text-white' : 'text-gray-400'}`}>{p.name}</span>
                                    {isActive && (
                                        <div className="absolute top-2 sm:top-4 right-2 sm:right-4 bg-white text-purple-600 rounded-full p-1 shadow-lg animate-in zoom-in duration-300">
                                            <CheckCircleIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                                        </div>
                                    )}

                                    {selectedCount > 0 && (
                                        <div
                                            onClick={(e) => { e.stopPropagation(); handleRemove(p); }}
                                            className="absolute -bottom-3 -right-3 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center border-4 border-gray-900 shadow-lg hover:scale-110 transition-transform cursor-pointer"
                                        >
                                            <div className="w-4 h-1 bg-white rounded-full"></div>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
                {/* FOOTER */}
                <div className="p-5 sm:p-8 border-t border-gray-800 bg-gray-900/90 backdrop-blur-md shrink-0 flex flex-col gap-4 sm:gap-6">
                    {/* PROGRESS BAR */}
                    <div className="flex gap-1.5 sm:gap-2">
                        {steps.map((_, idx) => (
                            <div key={idx} className={`h-1.5 sm:h-2 flex-1 rounded-full transition-all duration-500 ${idx <= currentSlotIndex ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-gray-800'}`} />
                        ))}
                    </div>

                    <button
                        onClick={handleNext}
                        disabled={!canProceed}
                        className={`w-full py-4 sm:py-6 rounded-2xl sm:rounded-3xl font-black text-white uppercase italic tracking-widest text-lg sm:text-2xl flex items-center justify-center gap-2 sm:gap-4 transition-all duration-300 ${canProceed
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:to-indigo-500 shadow-[0_10px_40px_-10px_rgba(147,51,234,0.5)] active:scale-95'
                            : (isStepFixed ? 'bg-indigo-600/20 text-indigo-400 animate-pulse border border-indigo-500/30' : 'bg-gray-800 text-gray-600 cursor-not-allowed grayscale')
                            }`}
                    >
                        <span>{currentSlotIndex < steps.length - 1 ? 'SIGUIENTE' : 'CONFIRMAR COMBO'}</span>
                        <ArrowRightIcon className={`w-6 h-6 sm:w-8 sm:h-8 transition-transform duration-300 ${canProceed ? 'translate-x-0' : '-translate-x-2 opacity-0'}`} />
                    </button>

                    {!canProceed && (
                        <p className="text-center text-gray-500 font-bold uppercase text-[10px] tracking-[0.2em] animate-pulse">
                            Selecciona {slotQty - currentSelectedQty} item(s) más para continuar
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ComboSelectionModal;
