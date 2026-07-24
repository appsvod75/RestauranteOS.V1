
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Order, OrderItem, Product, Category, Meat, OrderType, ProductExtra, Payment, CompanySettings, Branch, PaymentMethod, UserRole, PromotionRule, Waiter } from '../types';
import { calculatePromotions } from '../utils/promotionEngine';
import { CLIENTE_VARIOS } from '../constants';
import TicketModal from './TicketModal';
import PaymentModal from './PaymentModal';
import ErrorBoundary from './ErrorBoundary';
import { PlusIcon, MinusIcon, TrashIcon, PencilIcon, PlusCircleIcon, CashRegisterIcon, ReceiptIcon, CheckCircleIcon, TagIcon, BellIcon, LockClosedIcon } from './icons';
import toast from 'react-hot-toast';
import AIOrderParserModal from './AIOrderParserModal';
import ComboSelectionModal from './ComboSelectionModal';
import { api } from '../api';

interface OrderScreenProps {
    order: Order;
    updateOrder: (orderId: string, items: OrderItem[]) => void;
    onCompleteOrder: (orderId: string, payments: Payment[], changeGiven: number, manualDiscount?: number) => void;
    onStartNewOrder: () => void;
    onBackToStart: () => void;
    onEditOrderHeader: (orderId: string) => void;
    categories: Category[];
    products: Product[];
    meats: Meat[];
    productExtras: ProductExtra[];
    updateDeliveryFee: (orderId: string, fee: number) => void;
    productPopularity: Record<number, number>;
    companySettings: CompanySettings;
    onUpdateCustomerEmail: (customerId: number, email: string) => void;
    branches: Branch[];
    currentUser: { id: number; username: string; currentRole: UserRole; allRoles: UserRole[] } | null;
    promotions: PromotionRule[];
    waiters?: Waiter[];
}

const OrderScreen: React.FC<OrderScreenProps> = ({
    order,
    updateOrder,
    onCompleteOrder,
    onStartNewOrder,
    onBackToStart,
    onEditOrderHeader,
    categories,
    products,
    meats,
    productExtras,
    updateDeliveryFee,
    productPopularity,
    companySettings,
    onUpdateCustomerEmail,
    branches,
    currentUser,
    promotions,
    waiters
}) => {
    // Calculate driver name
    const driverName = useMemo(() => {
        if (!order.deliveryDriverId || !waiters) return null;
        const driver = waiters.find(w => Number(w.id) === Number(order.deliveryDriverId));
        return driver ? driver.name.toUpperCase() : 'REPARTIDOR';
    }, [order.deliveryDriverId, waiters]);
    // Calculate promotions for display
    const appliedDiscounts = useMemo(() => calculatePromotions(order.items, promotions), [order.items, promotions]);

    const normalize = (str: any) => {
        if (str === null || str === undefined) return '';
        return String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    };
    // DEBUG: Log what data we're receiving
    useEffect(() => {
        // console.log('🔍 OrderScreen - Order:', order);
    }, [order]);

    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Cash);

    // Default Delivery Fee Logic
    // Default Delivery Fee Logic: Handled in App.tsx createNewOrder now
    // useEffect removed to prevent render loops.

    const filteredCategories = useMemo(() => {
        const hasPopularity = Object.keys(productPopularity).length > 0;
        const realCats = categories.filter(c => c.id !== 0 && (c.isActive !== false));
        if (hasPopularity) {
            return [{ id: -1, name: '⭐ TOP' } as Category, ...realCats];
        }
        return realCats;
    }, [categories, productPopularity]);

    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [productSearchQuery, setProductSearchQuery] = useState('');

    useEffect(() => {
        // Auto-select first available category only if nothing is selected yet.
        // Now that the top is ready after the header delay, we can default to it (-1)
        if (selectedCategoryId === null && filteredCategories.length > 0) {
            // If TOP exists in filteredCategories (it's first), it will be selected.
            setSelectedCategoryId(filteredCategories[0].id);
        }
    }, [filteredCategories, selectedCategoryId]);

    const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
    const [isTicketVisible, setIsTicketVisible] = useState(false);
    const isOpeningPayment = useRef(false);
    const [productForMeatSelection, setProductForMeatSelection] = useState<Product | null>(null);
    const [productForMasaSelection, setProductForMasaSelection] = useState<Product | null>(null); // New state for Masa
    const [pendingMasa, setPendingMasa] = useState<Meat | null>(null); // Store masa while selecting meat
    const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
    const [itemForExtras, setItemForExtras] = useState<OrderItem | null>(null);
    const [completedOrderForTicket, setCompletedOrderForTicket] = useState<Order | null>(null);
    const [manualDiscount, setManualDiscount] = useState(0);
    // Optimization: Land on Cart if there are items, Menu if empty
    const [mobileView, setMobileView] = useState<'menu' | 'summary'>(order.items.length > 0 ? 'summary' : 'menu');
    const [addedFeedback, setAddedFeedback] = useState<string | null>(null);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null); // State for deletion modal
    const [comboForSelection, setComboForSelection] = useState<Product | null>(null);

    // ... (scroll logic omitted, keeping it) ...
    const categoryScrollRef = useRef<HTMLDivElement>(null);
    const [isDraggingCat, setIsDraggingCat] = useState(false);
    const [startXCat, setStartXCat] = useState(0);
    const [scrollLeftCat, setScrollLeftCat] = useState(0);

    const handleMouseDownCat = (e: React.MouseEvent) => {
        if (!categoryScrollRef.current) return;
        setIsDraggingCat(true);
        setStartXCat(e.pageX - categoryScrollRef.current.offsetLeft);
        setScrollLeftCat(categoryScrollRef.current.scrollLeft);
    };

    const handleMouseMoveCat = (e: React.MouseEvent) => {
        if (!isDraggingCat || !categoryScrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - categoryScrollRef.current.offsetLeft;
        const walk = (x - startXCat) * 2;
        categoryScrollRef.current.scrollLeft = scrollLeftCat - walk;
    };

    // --- Lógica de Drag-to-Scroll Vertical para Productos ---
    const productScrollRef = useRef<HTMLDivElement>(null);
    const [isDraggingProd, setIsDraggingProd] = useState(false);
    const [startYProd, setStartYProd] = useState(0);
    const [scrollTopProd, setScrollTopProd] = useState(0);
    const [hasDraggedProd, setHasDraggedProd] = useState(false);

    const handleMouseDownProd = (e: React.MouseEvent) => {
        if (!productScrollRef.current) return;
        setIsDraggingProd(true);
        setHasDraggedProd(false);
        setStartYProd(e.pageY - productScrollRef.current.offsetTop);
        setScrollTopProd(productScrollRef.current.scrollTop);
    };

    const handleMouseMoveProd = (e: React.MouseEvent) => {
        if (!isDraggingProd || !productScrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - productScrollRef.current.offsetTop;
        const walk = (y - startYProd) * 2;
        if (Math.abs(walk) > 5) setHasDraggedProd(true);
        productScrollRef.current.scrollTop = scrollTopProd - walk;
    };

    // --- Lógica de Drag-to-Scroll Vertical para Carrito ---
    const cartScrollRef = useRef<HTMLDivElement>(null);
    const [isDraggingCart, setIsDraggingCart] = useState(false);
    const [startYCart, setStartYCart] = useState(0);
    const [scrollTopCart, setScrollTopCart] = useState(0);
    const [hasDraggedCart, setHasDraggedCart] = useState(false);

    const handleMouseDownCart = (e: React.MouseEvent) => {
        if (!cartScrollRef.current) return;
        setIsDraggingCart(true);
        setHasDraggedCart(false);
        setStartYCart(e.pageY - cartScrollRef.current.offsetTop);
        setScrollTopCart(cartScrollRef.current.scrollTop);
    };

    const handleMouseMoveCart = (e: React.MouseEvent) => {
        if (!isDraggingCart || !cartScrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - cartScrollRef.current.offsetTop;
        const walk = (y - startYCart) * 2;
        if (Math.abs(walk) > 5) setHasDraggedCart(true);
        cartScrollRef.current.scrollTop = scrollTopCart - walk;
    };

    const handleMouseUpOrLeave = () => {
        setIsDraggingCat(false);
        setIsDraggingProd(false);
        setIsDraggingCart(false);
    };

    const filteredProducts = useMemo(() => {
        if (!products || !Array.isArray(products)) return [];

        const normalizedSearch = normalize(productSearchQuery);
        const isSearching = normalizedSearch.length > 0;

        let result = products.filter(p => {
            if (!p) return false;
            // Robust isActive check
            if (p.isActive === false || p.is_active === 0) return false;
            // Validate price
            if (p.price === null || p.price === undefined || isNaN(Number(p.price))) return false;

            if (isSearching) {
                return normalize(p.name).includes(normalizedSearch);
            }

            if (selectedCategoryId === -1) {
                // Virtual category: Top 15 products with sales
                return (productPopularity[p.id] || 0) > 0;
            }

            // Category filter
            const pCatId = p.categoryId || p.category_id;
            return String(pCatId) === String(selectedCategoryId);
        });

        if (isSearching) {
            return result.map(p => ({ ...p, price: Number(p.price) })).sort((a, b) => (productPopularity[b.id] || 0) - (productPopularity[a.id] || 0));
        }

        if (selectedCategoryId === -1) {
            return result
                .sort((a, b) => (productPopularity[b.id] || 0) - (productPopularity[a.id] || 0))
                .slice(0, 15)
                .map(p => ({ ...p, price: Number(p.price) }));
        }

        return result
            .map(p => ({ ...p, price: Number(p.price) }))
            .sort((a, b) => (productPopularity[b.id] || 0) - (productPopularity[a.id] || 0));
    }, [selectedCategoryId, products, productPopularity, productSearchQuery]);


    const handleConfirmPayment = (payments: Payment[], changeGiven: number) => {
        try {
            const receiverName = currentUser?.username || 'Sistema';

            const finalOrder: Order = {
                ...order,
                manualDiscount: manualDiscount, // Send the manual discount
                payments: payments.map(p => ({
                    ...p,
                    receivedBy: receiverName
                })),
                amountPaid: payments.reduce((sum, p) => sum + p.amount, 0),
                changeGiven: changeGiven,
                status: 'completed' as const,
                completedAt: new Date(),
            };

            const ticketOrder = finalOrder.type === OrderType.Local && !finalOrder.customer
                ? { ...finalOrder, customer: CLIENTE_VARIOS }
                : finalOrder;

            setCompletedOrderForTicket(ticketOrder);

            // Use functional state updates for modals to avoid race conditions
        setIsPaymentModalVisible(false);
        isOpeningPayment.current = false;
        setIsTicketVisible(true);
        } catch (error) {
            console.error("Error processing payment:", error);
            alert("Error al procesar el pago.");
        }
    };

    const handleAddItem = (product: Product, meat?: Meat, masa?: Meat) => {
        // --- COMBO CHECK ---
        if (product.isCombo && !comboForSelection) {
            setComboForSelection(product);
            return;
        }

        // Resolve Masa (from args or pending state)
        const activeMasa = masa || pendingMasa;

        // 1. Check Masa Requirement
        if (product.requiresMasa && !activeMasa) {
            setProductForMasaSelection(product);
            return;
        }

        // 2. Check Meat Requirement
        if (product.requiresMeat && !meat) {
            // Store the already selected masa (if any) so it's not lost
            if (activeMasa) setPendingMasa(activeMasa);
            setProductForMeatSelection(product);
            return;
        }

        const existingItem = order.items.find(i =>
            i.product.id === product.id &&
            !i.observations &&
            (!i.extras || i.extras.length === 0) &&
            (product.requiresMeat ? i.meat?.id === meat?.id : true) &&
            (product.requiresMasa ? i.masa?.id === activeMasa?.id : true) &&
            !i.comboSelections && // Don't group combos for now to be safe
            !i.completed // FIX: Forzar línea nueva si el producto ya está preparado (tachado)
        );

        let newItems;
        if (existingItem) {
            const otherItems = order.items.filter(item => item.id !== existingItem.id);
            const updatedItem = {
                ...existingItem,
                id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                quantity: existingItem.quantity + 1,
                total: (existingItem.quantity + 1) * existingItem.product.price,
                completed: false
            };
            newItems = [updatedItem, ...otherItems];
        } else {
            const newItem: OrderItem = {
                id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                product,
                quantity: 1,
                meat,
                masa: activeMasa || undefined,
                total: Number(product.price) || 0,
                extras: [],
                completed: false
            };
            newItems = [newItem, ...order.items];
        }
        updateOrder(order.id, newItems);

        // Reset States
        setProductForMeatSelection(null);
        setProductForMasaSelection(null);
        setPendingMasa(null);

        toast.success(`${product.name.toUpperCase()} - AGREGADO`, { id: `add-${product.id}`, duration: 1500 });
    };

    const handleConfirmCombo = (selections: any[]) => {
        if (!comboForSelection) return;

        const newItem: OrderItem = {
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            product: comboForSelection,
            quantity: 1,
            comboSelections: selections,
            total: Number(comboForSelection.price) || 0,
            extras: [],
            completed: false
        };

        updateOrder(order.id, [newItem, ...order.items]);
        setComboForSelection(null);
        toast.success(`${comboForSelection.name.toUpperCase()} - AGREGADO`, { icon: '🍱' });
    };

    const handleUpdateQuantity = (itemId: string, delta: number) => {
        const item = order.items.find(i => i.id === itemId);
        if (!item) return;

        // NEW: Bloqueo absoluto si el ítem individual ya está preparado
        if (item.completed) {
            toast.error('PRODUCTO YA PREPARADO: NO SE PUEDE MODIFICAR', { icon: '🚫' });
            return;
        }

        const newQuantity = Math.max(0, item.quantity + delta);
        if (newQuantity === 0) {
            const newItems = order.items.filter(i => i.id !== itemId);
            updateOrder(order.id, newItems);
            return;
        }

        const otherItems = order.items.filter(i => i.id !== itemId);
        const extrasPrice = item.extras?.reduce((sum, extra) => sum + (Number(extra.price) || 0), 0) || 0;
        const singleItemPrice = (Number(item.product.price) || 0) + extrasPrice;

        const updatedItem = {
            ...item,
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            quantity: newQuantity,
            total: Number((newQuantity * singleItemPrice).toFixed(2)),
            completed: delta > 0 ? false : item.completed
        };

        updateOrder(order.id, [updatedItem, ...otherItems]);
    };

    const handleRemoveItem = (itemId: string) => {
        setItemToDelete(itemId);
    };

    const confirmRemoveItem = () => {
        if (itemToDelete) {
            const item = order.items.find(i => i.id === itemToDelete);
            if (item) {
                // Determine if this is a "valid" deletion or one that needs auditing
                // Audit everything deleted from the cart
                api.auditItemDeletion({
                    orderId: order.id,
                    branchId: order.branchId,
                    userId: currentUser?.id,
                    itemData: item,
                    reason: `Eliminado por: ${currentUser?.username || 'Usuario'}`
                }).catch(err => console.error('Audit failed:', err));
            }

            const newItems = order.items.filter(item => item.id !== itemToDelete);
            updateOrder(order.id, newItems);
            setItemToDelete(null);
        }
    };

    const handleSaveObservations = (itemId: string, observations: string) => {
        const newItems = order.items.map(item =>
            item.id === itemId ? { ...item, observations: observations.toUpperCase() } : item
        );
        updateOrder(order.id, newItems);
        setEditingItem(null);
    };

    const [isAIModalVisible, setIsAIModalVisible] = useState(false);

    return (
        <div className="flex flex-col h-[calc(100dvh-3.5rem)] sm:h-[calc(100vh-4rem)] bg-gray-950 overflow-hidden relative">

            {/* Cabecera de pedido */}
            <div className="bg-gray-900 px-4 py-2 flex items-center justify-between border-b border-gray-800 shrink-0">
                <div className="min-w-0">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
                        {order.type === 'Local' ? 'Restaurante' : order.type} {order.table && `• ${order.table.name}`}
                    </p>
                    <button
                        onClick={() => onEditOrderHeader(order.id)}
                        className="text-sm font-black text-white truncate uppercase italic tracking-tight leading-none mt-0.5 text-left hover:text-amber-400 transition-colors max-w-full"
                        title="Cambiar cliente"
                    >
                        {order.customer?.name || 'Cliente Mostrador'}
                    </button>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsAIModalVisible(true)}
                        className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl text-white active:scale-90 transition-all shadow-lg hover:shadow-purple-500/20 border border-white/10"
                        title="Magic Bot"
                    >
                        <span className="text-lg">✨</span>
                    </button>
                    <button
                        onClick={() => onEditOrderHeader(order.id)}
                        className="p-2 bg-gray-800 rounded-xl text-gray-400 active:scale-90 transition-transform border border-gray-700/50"
                    >
                        <PencilIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Selector de Vista (Móvil) */}
            <div className="lg:hidden flex border-b border-gray-800 shrink-0">
                <button
                    onClick={() => setMobileView('menu')}
                    className={`flex-1 py-3 text-sm font-black uppercase tracking-widest transition-all ${mobileView === 'menu' ? 'text-amber-500 border-b-2 border-amber-500 bg-amber-500/5' : 'text-gray-500'}`}
                >
                    MENÚ
                </button>
                <button
                    onClick={() => setMobileView('summary')}
                    className={`flex-1 py-3 text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${mobileView === 'summary'
                        ? 'text-amber-500 border-b-2 border-amber-500 bg-amber-500/5'
                        : order.items.length > 0
                            ? 'text-cyan-400 bg-cyan-900 shadow-[inset_0_0_20px_rgba(34,211,238,0.2)] ring-1 ring-cyan-500/50'
                            : 'text-gray-500'
                        }`}
                >
                    PEDIDO ({order.items.reduce((acc, i) => acc + i.quantity, 0)})
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Menú de Productos */}
                <div className={`flex-1 flex flex-col min-w-0 ${mobileView === 'summary' ? 'hidden lg:flex' : 'flex'}`}>
                    <div className="p-2 shrink-0">
                        <div
                            ref={categoryScrollRef}
                            onMouseDown={handleMouseDownCat}
                            onMouseLeave={handleMouseUpOrLeave}
                            onMouseUp={handleMouseUpOrLeave}
                            onMouseMove={handleMouseMoveCat}
                            className={`flex gap-2 overflow-x-auto pb-2 scrollbar-hide select-none ${isDraggingCat ? 'cursor-grabbing' : 'cursor-grab'}`}
                        >
                            {filteredCategories.map(category => (
                                <button
                                    key={category.id}
                                    onClick={() => !isDraggingCat && setSelectedCategoryId(category.id)}
                                    className={`px-4 py-2 rounded-2xl font-black text-xs sm:text-sm whitespace-nowrap transition-all flex-shrink-0 uppercase tracking-widest border-2 ${selectedCategoryId === category.id
                                        ? 'bg-amber-500 text-black shadow-lg border-transparent'
                                        : 'bg-amber-500/10 text-white border-amber-500/30 hover:border-amber-500 hover:text-amber-500 hover:bg-amber-500/20'}`}
                                >
                                    {category.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="px-2 pb-2">
                        <div className="relative">
                            <input
                                type="text"
                                value={productSearchQuery}
                                onChange={(e) => setProductSearchQuery(e.target.value)}
                                placeholder="BUSCAR PRODUCTO..."
                                className="w-full p-2.5 bg-gray-900 border border-gray-800 rounded-xl text-xs font-black text-white focus:border-amber-500 outline-none uppercase placeholder:text-gray-600 shadow-inner"
                            />
                            {productSearchQuery && (
                                <button
                                    onClick={() => setProductSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-400 active:scale-90 transition-all"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Contenedor de Productos con DRAG-TO-SCROLL VERTICAL */}
                    <div
                        ref={productScrollRef}
                        onMouseDown={handleMouseDownProd}
                        onMouseLeave={handleMouseUpOrLeave}
                        onMouseUp={handleMouseUpOrLeave}
                        onMouseMove={handleMouseMoveProd}
                        className={`flex-1 overflow-y-auto p-2 pt-0 scrollbar-hide select-none relative ${isDraggingProd ? 'cursor-grabbing' : 'cursor-default'}`}
                    >
                        {/* LOCK OVERLAY */}
                        {order.status === 'completed' && (
                            <div className="absolute inset-0 bg-gray-950/90 z-[50] flex flex-col items-center justify-center p-6 text-center transition-all duration-300">
                                <div className="bg-amber-500/10 p-6 rounded-full mb-4 border-2 border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.1)]">
                                    <LockClosedIcon className="w-16 h-16 text-amber-500/60" />
                                </div>
                                <h3 className="text-3xl font-black text-amber-500 italic uppercase tracking-tighter leading-none mb-2">ORDEN COBRADA</h3>
                                <p className="text-gray-400 font-black uppercase tracking-[0.3em] text-[10px] max-w-[200px] leading-relaxed">
                                    EL MENÚ ESTÁ EN MODO LECTURA. NO SE PUEDEN AGREGAR MÁS PRODUCTOS.
                                </p>
                            </div>
                        )}

                        <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 ${order.status === 'completed' ? 'pointer-events-none opacity-40' : ''}`}>
                            {filteredProducts.map(product => (
                                <button
                                    key={product.id}
                                    onClick={() => !hasDraggedProd && handleAddItem(product)}
                                    className={`rounded-[20px] active:scale-95 transition-all p-2 flex flex-col items-center justify-center text-center gap-0.5 border shadow-md h-[82px] relative overflow-hidden group ${product.isCombo
                                            ? 'bg-indigo-900 border-indigo-500 shadow-none'
                                            : 'bg-gray-800 border-gray-700/50'
                                        }`}
                                >
                                    <span className={`text-[15px] font-black leading-[1.1] uppercase line-clamp-2 group-active:text-amber-200 tracking-tight px-1 w-full ${product.isCombo ? 'text-indigo-200' : 'text-white'}`}>{product.name}</span>
                                    <span className="text-lg font-black text-amber-500 italic tracking-tighter leading-none">${product.price.toFixed(2)}</span>
                                    {product.requiresMeat && (
                                        <div className="absolute top-2.5 right-2.5">
                                            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_6px_rgba(34,211,238,0.8)]"></div>
                                        </div>
                                    )}
                                    {product.requiresMasa && (
                                        <div className="absolute top-2.5 left-2.5">
                                            <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_6px_rgba(250,204,21,0.8)]"></div>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Resumen del Pedido */}
                <div className={`w-full lg:w-[420px] bg-gray-900 border-l border-gray-800 flex flex-col ${mobileView === 'menu' ? 'hidden lg:flex' : 'flex'}`}>
                    <div
                        ref={cartScrollRef}
                        onMouseDown={handleMouseDownCart}
                        onMouseLeave={handleMouseUpOrLeave}
                        onMouseUp={handleMouseUpOrLeave}
                        onMouseMove={handleMouseMoveCart}
                        className={`flex-1 overflow-y-auto p-3 scrollbar-hide select-none ${isDraggingCart ? 'cursor-grabbing' : 'cursor-default'}`}
                    >
                        {order.items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center scale-75">
                                <ReceiptIcon className="w-20 h-20 mb-4" />
                                <p className="font-black text-lg uppercase tracking-[0.2em]">CARRITO VACÍO</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {[...order.items].sort((a, b) => b.id.localeCompare(a.id)).map(item => (
                                    <div key={item.id} className="bg-gray-800 rounded-[18px] p-2.5 border border-gray-700 relative group">
                                        <div className="flex justify-between items-start mb-1.5">
                                            <div className="flex-1 min-w-0 pr-3">
                                                <p className="font-black text-[15px] text-white leading-tight uppercase truncate tracking-tight group-active:text-amber-400">{item.product.name}</p>
                                                {item.masa && <p className="text-sm font-black text-fuchsia-400 uppercase italic mt-0.5 tracking-wider">{item.masa.name}</p>}
                                                {item.meat && <p className="text-sm font-black text-amber-500 uppercase italic mt-0.5">{item.meat.name}</p>}
                                                {item.comboSelections?.map((s, idx) => (
                                                    <p key={idx} className="text-[11px] font-bold text-purple-400 uppercase tracking-tight mt-0.5 leading-none italic pl-2 border-l-2 border-purple-500/30">
                                                        {s.productName} {s.meatName ? `(${s.meatName})` : ''} {s.masaName ? `[${s.masaName}]` : ''}
                                                    </p>
                                                ))}
                                                {item.extras?.map(e => <p key={e.id} className="text-[11px] text-green-400 uppercase font-black tracking-tight mt-0.5 flex items-center gap-1"><PlusIcon className="w-3 h-3" /> {e.name}</p>)}
                                                {item.observations && (
                                                    <div className="bg-cyan-900/10 border border-cyan-800/20 rounded-lg p-1.5 mt-1">
                                                        <p className="text-[10px] text-cyan-400 italic leading-snug font-bold">"{item.observations}"</p>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="font-black text-base text-amber-500 italic tracking-tighter leading-none">${item.total.toFixed(2)}</p>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-lg border border-gray-800 shadow-inner">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (item.completed) {
                                                            toast.error('BLOQUEADO: PRODUCTO PREPARADO', { icon: '🚫' });
                                                            return;
                                                        }
                                                        if (order.kitchenStatus && order.kitchenStatus !== 'pending') {
                                                            toast.error('NO SE PUEDE REDUCIR: YA EN COCINA', { icon: '🚫' });
                                                            return;
                                                        }
                                                        !hasDraggedCart && handleUpdateQuantity(item.id, -1);
                                                    }}
                                                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-all active:scale-95 shadow-sm ${(item.completed || (order.kitchenStatus && order.kitchenStatus !== 'pending')) ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-800 text-amber-500 hover:bg-gray-700'}`}
                                                    title="Disminuir"
                                                >
                                                    <MinusIcon className="w-3.5 h-3.5" />
                                                </button>
                                                <span className={`px-2 font-black text-[12px] leading-none min-w-[20px] text-center ${item.completed ? 'text-green-500 line-through' : 'text-white'}`}>{item.quantity}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (item.completed) {
                                                            toast.error('BLOQUEADO: PRODUCTO PREPARADO', { icon: '🚫' });
                                                            return;
                                                        }
                                                        !hasDraggedCart && handleUpdateQuantity(item.id, 1);
                                                    }}
                                                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-all active:scale-95 shadow-sm ${item.completed ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-800 text-amber-500 hover:bg-gray-700'}`}
                                                    title="Aumentar"
                                                >
                                                    <PlusIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                {item.product.availableExtraIds && item.product.availableExtraIds.length > 0 && (
                                                    <button
                                                        onClick={() => {
                                                            if (item.completed) {
                                                                toast.error('BLOQUEADO: PRODUCTO PREPARADO', { icon: '🚫' });
                                                                return;
                                                            }
                                                            if (order.kitchenStatus && order.kitchenStatus !== 'pending') {
                                                                toast.error('BLOQUEADO: YA EN COCINA', { icon: '🚫' });
                                                                return;
                                                            }
                                                            !hasDraggedCart && setItemForExtras(item);
                                                        }}
                                                        className={`p-1.5 rounded-lg active:scale-90 border ${(item.completed || (order.kitchenStatus && order.kitchenStatus !== 'pending')) ? 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed' : 'bg-gray-700 text-green-600 border-green-500/20'}`}
                                                        title="Extras"
                                                    >
                                                        <PlusCircleIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        if (item.completed) {
                                                            toast.error('BLOQUEADO: PRODUCTO PREPARADO', { icon: '🚫' });
                                                            return;
                                                        }
                                                        if (order.kitchenStatus && order.kitchenStatus !== 'pending') {
                                                            toast.error('BLOQUEADO: YA EN COCINA', { icon: '🚫' });
                                                            return;
                                                        }
                                                        !hasDraggedCart && setEditingItem(item);
                                                    }}
                                                    className={`p-1.5 rounded-lg active:scale-90 border ${(item.completed || (order.kitchenStatus && order.kitchenStatus !== 'pending')) ? 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed' : 'bg-gray-700 text-cyan-600 border-cyan-500/20'}`}
                                                    title="Observaciones"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (item.completed) {
                                                            toast.error('NO SE PUEDE BORRAR: YA PREPARADO', { icon: '🚫' });
                                                            return;
                                                        }
                                                        if (order.kitchenStatus && order.kitchenStatus !== 'pending') {
                                                            toast.error('NO SE PUEDE BORRAR: YA EN COCINA', { icon: '🚫' });
                                                            return;
                                                        }
                                                        !hasDraggedCart && handleRemoveItem(item.id);
                                                    }}
                                                    className={`p-1.5 rounded-lg transition-colors border shadow-sm active:scale-90 shadow-md ${(item.completed || (order.kitchenStatus && order.kitchenStatus !== 'pending')) ? 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed' : 'bg-red-600 text-white border-red-700'}`}
                                                    title="Borrar"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-gray-900 border-t border-gray-800 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
                        {order.type === OrderType.Delivery && (
                            <div className="flex justify-between items-center mb-3 bg-gray-800/60 p-3 rounded-xl border border-gray-700">
                                <span className="text-xs font-black text-gray-300 uppercase tracking-widest italic">COSTO ENVÍO</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-sm font-black text-amber-500">$</span>
                                    <input
                                        type="number"
                                        step="0.25"
                                        min="0"
                                        disabled={!currentUser || (!currentUser.allRoles.includes(UserRole.Admin) && !currentUser.allRoles.includes(UserRole.Cashier) && !currentUser.allRoles.includes(UserRole.SuperAdmin))}
                                        value={order.deliveryFee ?? 1}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            updateDeliveryFee(order.id, isNaN(val) ? 0 : val);
                                        }}
                                        className="w-20 bg-gray-900 border border-gray-600 p-2 text-right text-sm font-black text-white focus:ring-2 focus:ring-amber-500 rounded-lg outline-none disabled:opacity-50"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Promotions Breakdown */}
                        {appliedDiscounts.length > 0 && (
                            <div className="mb-3 border-b border-dashed border-gray-700 pb-2 space-y-1">
                                {appliedDiscounts.map((d, idx) => (
                                    <div key={idx} className="flex justify-between items-center px-1">
                                        <span className="text-[10px] font-black text-green-400 uppercase tracking-widest italic flex items-center gap-1">
                                            <TagIcon className="w-3 h-3" /> {d.description}
                                        </span>
                                        <span className="text-sm font-black text-green-400 italic tracking-tighter">- ${d.amount.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {manualDiscount > 0 && (
                            <div className="flex justify-between items-baseline mb-1 px-1 text-cyan-500 italic">
                                <span className="text-[10px] font-black uppercase tracking-widest">CORTESÍA ADMIN</span>
                                <span className="text-sm font-black tracking-tighter">- ${manualDiscount.toFixed(2)}</span>
                            </div>
                        )}

                        {/* TOTAL ARRIBA */}
                        <div className="flex justify-between items-end mb-4 px-1">
                            <span className="text-xs font-black text-gray-500 uppercase tracking-[0.25em] italic">TOTAL A PAGAR</span>
                            <span className="text-3xl font-black text-amber-500 italic tracking-tighter leading-none">${(order.total - manualDiscount).toFixed(2)}</span>
                        </div>

                        {/* FILA DE BOTONES ABAJO */}
                        <div className="flex gap-2 items-stretch">
                            {/* BOTÓN NOTIFICAR (IZQUIERDA) */}
                            {order.type === OrderType.Delivery && (
                                <button
                                    disabled={!currentUser || (!currentUser.allRoles.includes(UserRole.Admin) && !currentUser.allRoles.includes(UserRole.Cashier) && !currentUser.allRoles.includes(UserRole.SuperAdmin)) || !!order.deliveryDriverId || order.deliveryStatus === 'delivered'}
                                    onClick={() => {
                                        import('../api').then(({ api }) => {
                                            api.notifyDelivery(order.id).then(() => toast.success('ALERTA ENVIADA', { icon: '🔔' }));
                                        });
                                    }}
                                    className={`flex-1 flex flex-col items-center justify-center p-2 rounded-2xl border transition-all active:scale-95 shadow-lg
                                        ${(!order.deliveryDriverId && order.deliveryStatus !== 'delivered')
                                            ? 'bg-yellow-600/10 border-yellow-500/50 text-yellow-500 hover:bg-yellow-600/20'
                                            : 'bg-gray-800/50 border-gray-700 text-gray-500'} 
                                        disabled:opacity-40 disabled:scale-100 disabled:grayscale`}
                                >
                                    <BellIcon className={`w-5 h-5 mb-0.5 ${(!order.deliveryDriverId && order.deliveryStatus !== 'delivered') ? 'animate-pulse' : ''}`} />
                                    <span className="text-[9px] font-black uppercase tracking-tighter leading-none">Notificar</span>
                                </button>
                            )}

                            {/* BOTÓN COBRAR / VER TICKET (CENTRO) */}
                            {order.status === 'completed' ? (
                                <button
                                    onClick={() => {
                                        setCompletedOrderForTicket(order);
                                        setIsTicketVisible(true);
                                    }}
                                    className="flex-[3] h-14 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 italic uppercase tracking-widest text-lg border-t border-white/10"
                                >
                                    <ReceiptIcon className="w-6 h-6" />
                                    <span>VER TICKET</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (isOpeningPayment.current) return;
                                        isOpeningPayment.current = true;
                                        setIsPaymentModalVisible(true);
                                    }}
                                    disabled={!currentUser || (!currentUser.allRoles.includes(UserRole.Admin) && !currentUser.allRoles.includes(UserRole.Cashier) && !currentUser.allRoles.includes(UserRole.SuperAdmin)) || order.items.length === 0}
                                    className="flex-[3] h-14 bg-green-600 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 italic uppercase tracking-widest text-lg border-t border-white/10"
                                >
                                    <CashRegisterIcon className="w-6 h-6" />
                                    <span>COBRAR</span>
                                </button>
                            )}

                            {/* BOTÓN NUEVO (DERECHA) */}
                            <button
                                onClick={onStartNewOrder}
                                className="w-14 h-14 bg-[#0DB6E0] rounded-2xl shadow-[0_8px_20px_rgba(13,182,224,0.3)] flex items-center justify-center text-gray-950 active:scale-90 transition-all border-4 border-gray-950 shrink-0"
                                title="Nueva Orden"
                            >
                                <PlusIcon className="w-8 h-8" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modales */}
            {
                productForMasaSelection && (
                    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[200] p-4">
                        <div className="bg-gray-900 w-full max-w-sm rounded-[40px] p-8 border border-gray-800 shadow-2xl transition-all duration-300">
                            <h3 className="text-xl font-black text-amber-500 mb-1 uppercase italic leading-none tracking-tight">{productForMasaSelection.name}</h3>
                            <p className="text-[10px] text-gray-500 mb-8 font-black uppercase tracking-[0.3em] italic">Seleccione la masa o harina</p>
                            <div className="grid grid-cols-2 gap-3 mb-8">
                                {meats.filter(m => m.type === 'masa').map(masa => (
                                    <button key={masa.id} onClick={() => handleAddItem(productForMasaSelection, undefined, masa)} className="p-4 bg-gray-800 rounded-[20px] font-black text-sm uppercase border border-gray-700 hover:bg-amber-600 hover:border-amber-400 hover:text-white active:scale-95 transition-all italic tracking-widest text-amber-100">
                                        {masa.name}
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => setProductForMasaSelection(null)} className="w-full p-4 bg-gray-800 text-gray-500 font-black rounded-[20px] uppercase text-[10px] active:bg-gray-750 tracking-widest">CANCELAR</button>
                        </div>
                    </div>
                )
            }

            {
                productForMeatSelection && (
                    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[200] p-4">
                        <div className="bg-gray-900 w-full max-w-sm rounded-[40px] p-8 border border-gray-800 shadow-2xl transition-all duration-300">
                            <h3 className="text-xl font-black text-amber-500 mb-1 uppercase italic leading-none tracking-tight">{productForMeatSelection.name}</h3>
                            <p className="text-[10px] text-gray-500 mb-8 font-black uppercase tracking-[0.3em] italic">Seleccione la proteína</p>
                            <div className="grid grid-cols-2 gap-3 mb-8">
                                {meats.filter(m => !m.type || m.type === 'meat').map(meat => (
                                    <button key={meat.id} onClick={() => handleAddItem(productForMeatSelection, meat, pendingMasa || undefined)} className="p-4 bg-gray-800 rounded-[20px] font-black text-sm uppercase border border-gray-700 hover:bg-amber-600 hover:border-amber-400 hover:text-white active:scale-95 transition-all italic tracking-widest">
                                        {meat.name}
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => { setProductForMeatSelection(null); setPendingMasa(null); }} className="w-full p-4 bg-gray-800 text-gray-500 font-black rounded-[20px] uppercase text-[10px] active:bg-gray-750 tracking-widest">CANCELAR</button>
                        </div>
                    </div>
                )
            }

            {
                editingItem && (
                    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[200] p-4">
                        <div className="bg-gray-900 w-full max-w-sm rounded-[40px] p-8 border border-gray-800 shadow-2xl transition-all duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-cyan-600 p-2 rounded-xl shadow-lg shadow-cyan-900/40">
                                    <PencilIcon className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-xl font-black text-white mb-1 uppercase italic leading-none tracking-tighter">OBSERVACIONES</h3>
                            </div>
                            <p className="text-[10px] text-gray-500 mb-4 font-black uppercase tracking-widest italic truncate">{editingItem.product.name}</p>
                            <textarea
                                className="w-full h-36 p-5 bg-gray-800 border-2 border-gray-700 rounded-[24px] text-white font-black uppercase text-xs outline-none focus:border-cyan-500 mb-8 shadow-inner resize-none tracking-wider placeholder:text-gray-600"
                                placeholder="EJ: SIN CEBOLLA, BIEN COCIDO, SIN PICANTE..."
                                defaultValue={editingItem.observations || ''}
                                id="obs-textarea"
                                autoFocus
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setEditingItem(null)} className="p-4 bg-gray-800 text-gray-400 font-black rounded-2xl uppercase text-xs active:scale-95 tracking-widest">DESCARTAR</button>
                                <button
                                    onClick={() => handleSaveObservations(editingItem.id, (document.getElementById('obs-textarea') as HTMLTextAreaElement).value)}
                                    className="p-4 bg-cyan-600 text-white font-black rounded-2xl uppercase text-xs shadow-lg active:scale-95 transition-transform italic tracking-widest"
                                >
                                    GUARDAR
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                isPaymentModalVisible && (
                    <PaymentModal
                        orderTotal={order.total}
                        manualDiscount={manualDiscount}
                        onManualDiscountChange={setManualDiscount}
                        onClose={() => { setIsPaymentModalVisible(false); isOpeningPayment.current = false; }}
                        onConfirmPayment={handleConfirmPayment}
                    />
                )
            }

            {
                isTicketVisible && completedOrderForTicket && (
                    <ErrorBoundary name="TicketModal">
                        <TicketModal
                            order={completedOrderForTicket}
                            onClose={() => {
                                onCompleteOrder(completedOrderForTicket.id, completedOrderForTicket.payments, completedOrderForTicket.changeGiven, manualDiscount);
                                setIsTicketVisible(false);
                                setMobileView('menu');
                            }}
                            onNewOrder={() => {
                                onCompleteOrder(completedOrderForTicket.id, completedOrderForTicket.payments, completedOrderForTicket.changeGiven, manualDiscount);
                                onStartNewOrder();
                            }}
                            companySettings={companySettings}
                            onUpdateCustomerEmail={onUpdateCustomerEmail}
                            branches={branches}
                        />
                    </ErrorBoundary>
                )
            }

            {
                itemForExtras && (
                    <ExtrasSelectionModal
                        item={itemForExtras}
                        onSave={(id, extras) => {
                            const newItems = order.items.map(i => {
                                if (i.id === id) {
                                    const extrasPrice = extras.reduce((sum, e) => sum + (Number(e.price) || 0), 0);
                                    const itemPrice = Number(i.product.price) || 0;
                                    return {
                                        ...i,
                                        extras,
                                        total: Number(((itemPrice + extrasPrice) * i.quantity).toFixed(2))
                                    };
                                }
                                return i;
                            });
                            updateOrder(order.id, newItems);
                            setItemForExtras(null);
                            toast.success('EXTRAS ACTUALIZADOS', { icon: '✨' });
                        }}
                        onClose={() => setItemForExtras(null)}
                        productExtras={productExtras}
                    />
                )
            }

            {
                itemToDelete && (
                    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[250] p-4">
                        <div className="bg-gray-900 w-full max-w-xs rounded-[32px] p-6 border border-gray-800 shadow-2xl transition-all duration-300">
                            <div className="flex flex-col items-center text-center mb-6">
                                <div className="bg-red-500/10 p-4 rounded-full mb-4 border border-red-500/20">
                                    <TrashIcon className="w-8 h-8 text-red-500" />
                                </div>
                                <h3 className="text-lg font-black text-white uppercase italic tracking-tighter leading-none mb-2">¿ELIMINAR PRODUCTO?</h3>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Esta acción no se puede deshacer</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setItemToDelete(null)} className="p-4 bg-gray-800 text-gray-400 font-black rounded-2xl uppercase text-[10px] active:scale-95 tracking-widest">CANCELAR</button>
                                <button onClick={confirmRemoveItem} className="p-4 bg-red-600 text-white font-black rounded-2xl uppercase text-[10px] shadow-lg active:scale-95 transition-transform tracking-widest">ELIMINAR</button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* AI Modal */}
            {
                isAIModalVisible && (
                    <AIOrderParserModal
                        onClose={() => setIsAIModalVisible(false)}
                        onParse={async (text) => {
                            try {
                                // @ts-ignore
                                const result = await import('../api').then(m => m.api.aiParseOrder(text, order.branchId));

                                if (result.customerName || result.address) {
                                    // Call up to parent to update customer info? Or just show toast
                                    // For now, let's just toast
                                    toast.success(`CLIENTE: ${result.customerName}`, { icon: '👤' });
                                }

                                if (result.items && Array.isArray(result.items)) {
                                    const newItemsFromAI: OrderItem[] = [];

                                    // We need to fetch the full product objects to use existing add logic or manual push
                                    // Since handleAddItem relies on existing state, let's just construct items manually and call updateOrder once

                                    const currentItems = [...order.items];

                                    result.items.forEach((aiItem: any) => {
                                        const product = products.find(p => p.id === aiItem.productId);
                                        if (!product) return;

                                        const meat = aiItem.meatId ? meats.find(m => m.id === aiItem.meatId) : undefined;
                                        const masa = aiItem.masaId ? meats.find(m => m.id === aiItem.masaId) : undefined;
                                        const extras = aiItem.extraIds ? productExtras.filter(e => aiItem.extraIds.includes(e.id)) : [];

                                        // Create Item
                                        const newItem: OrderItem = {
                                            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                            product,
                                            quantity: aiItem.quantity || 1,
                                            meat,
                                            masa,
                                            extras,
                                            // Calculate total
                                            total: Number(((Number(product.price) || 0) + extras.reduce((sum, e) => sum + (Number(e.price) || 0), 0)) * (aiItem.quantity || 1)),
                                            observations: aiItem.note ? aiItem.note.toUpperCase() : undefined,
                                            completed: false
                                        };
                                        newItemsFromAI.push(newItem);
                                    });

                                    updateOrder(order.id, [...newItemsFromAI, ...currentItems]);
                                    setIsAIModalVisible(false);
                                    toast.success(`✅ ${newItemsFromAI.length} ITEMS AÑADIDOS`);
                                }
                            } catch (e: any) {
                                console.error(e);
                                alert('ERROR IA: ' + e.message);
                            }
                        }}
                    />
                )
            }
            {
                comboForSelection && (
                    <ComboSelectionModal
                        combo={comboForSelection}
                        categories={categories}
                        products={products}
                        meats={meats.filter(m => !m.type || m.type === 'meat')}
                        masas={meats.filter(m => m.type === 'masa')}
                        onClose={() => setComboForSelection(null)}
                        onConfirm={handleConfirmCombo}
                    />
                )
            }
        </div >
    );
};

// --- SUBSIDIARY COMPONENTS ---

const ExtrasSelectionModal: React.FC<{ item: OrderItem, onSave: (itemId: string, extras: ProductExtra[]) => void, onClose: () => void, productExtras: ProductExtra[] }> = ({ item, onSave, onClose, productExtras }) => {
    const availableExtras = productExtras.filter(extra => item.product.availableExtraIds?.includes(extra.id));
    const [selectedExtras, setSelectedExtras] = useState<ProductExtra[]>(item.extras || []);

    const toggleExtra = (extra: ProductExtra) => {
        setSelectedExtras(prev => prev.some(e => e.id === extra.id) ? prev.filter(e => e.id !== extra.id) : [...prev, extra]);
    };

    return (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[210] p-4">
            <div className="bg-gray-900 w-full max-w-sm rounded-[40px] p-8 border border-gray-800 shadow-2xl transition-all duration-300 flex flex-col max-h-[85vh]">
                <div className="flex items-center gap-3 mb-6 shrink-0">
                    <div className="bg-green-600 p-2 rounded-xl shadow-lg shadow-green-900/40">
                        <PlusCircleIcon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-black text-amber-500 uppercase italic leading-none tracking-tighter">VINCULAR EXTRAS</h3>
                </div>
                <p className="text-[10px] text-gray-500 mb-6 uppercase font-black tracking-widest italic truncate shrink-0">{item.product.name}</p>
                <div className="space-y-2 overflow-y-auto mb-8 pr-1 scrollbar-hide flex-1">
                    {availableExtras.map(extra => {
                        const isSelected = selectedExtras.some(e => e.id === extra.id);
                        return (
                            <button key={extra.id} onClick={() => toggleExtra(extra)} className={`w-full flex justify-between items-center p-5 rounded-[24px] border-2 transition-all active:scale-[0.98] ${isSelected ? 'bg-amber-500 text-white border-amber-400 shadow-lg' : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-500'}`}>
                                <span className="font-black text-[11px] uppercase italic tracking-widest">{extra.name}</span>
                                <span className="font-black text-base italic tracking-tighter">${Number(extra.price).toFixed(2)}</span>
                            </button>
                        );
                    })}
                    {availableExtras.length === 0 && (
                        <div className="text-center py-12 opacity-30">
                            <PlusCircleIcon className="w-16 h-16 mx-auto mb-4 text-gray-500" />
                            <p className="font-black uppercase italic text-xs tracking-widest">Sin extras permitidos</p>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-auto shrink-0">
                    <button onClick={onClose} className="p-4 bg-gray-800 text-gray-400 font-black rounded-[20px] uppercase text-[10px] active:scale-95 tracking-widest">CERRAR</button>
                    <button onClick={() => onSave(item.id, selectedExtras)} className="p-4 bg-green-600 text-white font-black rounded-[20px] uppercase text-[10px] shadow-lg active:scale-95 transition-transform italic tracking-widest">CONFIRMAR</button>
                </div>
            </div>
        </div>
    );
};

export default OrderScreen;
