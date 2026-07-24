
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { OrderType, Waiter, Table, OrderDetails, Customer, Address, Order, UserRole, Product, Meat, ProductExtra, Branch } from '../types';
import { UserIcon, TableIcon, PlusIcon, UserGroupIcon, CheckCircleIcon, MapIcon, RobotIcon, SearchIcon, InfoIcon, ClockIcon, TrashIcon, FlameIcon, CheckIcon, CreditCardIcon, ShareIcon, QrCodeIcon } from './icons';
import { useDragScroll } from '../hooks/useDragScroll';
import PinVerificationModal from './PinVerificationModal';

import { api } from '../api';
import AIOrderParserModal from './AIOrderParserModal';
import { getDaysOverdue } from '../lib/utils';
import toast from 'react-hot-toast';
import { QRCodeCanvas } from 'qrcode.react';

interface StartScreenProps {
    onStartOrder: (details: OrderDetails) => void;
    activeOrders: Order[];
    onSelectOrder: (orderId: string) => void;
    onShowCompleted: () => void;
    onShowActive: () => void;
    onManageCustomers: () => void;
    waiters: Waiter[];
    tables: Table[];
    customers: Customer[];
    setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
    orderToEdit?: Order | null;
    onUpdateOrder?: (details: OrderDetails) => void;
    onCancelEdit?: () => void;

    onCreateCustomer: (customer: Customer) => Promise<Customer>;
    // AI Parser Props
    products?: Product[];
    meats?: Meat[];
    productExtras?: ProductExtra[];
    branches: Branch[];
    currentBranchId: number | null;
    initialIsCreating?: boolean;
    companySettings?: any;
}

const formatPhone = (phone: string | null | undefined) => {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 8) {
        return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    }
    return phone;
};

const normalize = (str: any) => {
    if (str === null || str === undefined) return '';
    return String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

interface StepProps {
    title: string;
    stepNumber: number;
    value?: string | null;
    openStep: number;
    setOpenStep: (n: number) => void;
    children: React.ReactNode;
}

const Step: React.FC<StepProps> = ({ title, stepNumber, value, openStep, setOpenStep, children }) => {
    const isOpen = openStep === stepNumber;
    return (
        <div className={`bg-gray-900 rounded-3xl transition-all border ${isOpen ? 'border-gray-700 ring-4 ring-amber-500/10 overflow-visible' : 'border-gray-800 overflow-hidden'}`}>
            <button
                onClick={() => setOpenStep(isOpen ? 0 : stepNumber)}
                className="w-full p-4 flex justify-between items-center active:bg-gray-800/50"
            >
                <span className="text-xs font-black text-gray-400 tracking-widest uppercase">{title}</span>
                {value && !isOpen && (
                    <div className="flex items-center gap-1.5 bg-green-600/10 text-green-500 px-3 py-1 rounded-full border border-green-500/20">
                        <CheckCircleIcon className="w-3 h-3" />
                        <span className="text-[10px] font-black uppercase truncate max-w-[150px]">{value}</span>
                    </div>
                )}
            </button>
            {isOpen && <div className="p-4 pt-0">{children}</div>}
        </div>
    );
};

const AddCustomerModal: React.FC<{ initialName: string, initialPhone?: string, initialAddress?: string, initialEmail?: string, onClose: () => void, onSave: (c: Customer) => void, isSaving?: boolean }> = ({ initialName, initialPhone, initialAddress, initialEmail, onClose, onSave, isSaving }) => {
    const [name, setName] = useState(initialName.toUpperCase());
    const [phone, setPhone] = useState(initialPhone || '');
    const [address, setAddress] = useState(initialAddress || '');
    const [email, setEmail] = useState(initialEmail || '');
    const [birthDate, setBirthDate] = useState('');
    const [error, setError] = useState('');

    const handleSave = () => {
        let cleanPhone = phone.replace(/\D/g, '');

        if (cleanPhone === '') {
            cleanPhone = '00000000';
        } else if (cleanPhone.length !== 8) {
            setError('EL TELÉFONO DEBE TENER 8 DÍGITOS');
            return;
        }
        if (!name.trim()) {
            setError('EL NOMBRE ES OBLIGATORIO');
            return;
        }

        const newCustomer: Customer = {
            id: 0,
            name: name.trim().toUpperCase(),
            phone: cleanPhone,
            email: email.trim().toLowerCase() || undefined,
            birthDate: (birthDate && birthDate.trim() !== '') ? birthDate : undefined,
            addresses: address.trim() ? [{
                id: `temp-${Date.now()}`,
                street: address.trim().toUpperCase(),
                city: 'SAN SALVADOR',
                details: 'Registrada al crear cliente'
            } as any] : []
        };
        onSave(newCustomer);
    };

    const portalRoot = document.getElementById('portal-root');
    if (!portalRoot) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4">
            <div className="bg-gray-900 w-full max-w-md rounded-[32px] p-6 border border-gray-800 shadow-2xl transition-all duration-300">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-amber-500 p-2 rounded-xl">
                        <UserGroupIcon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">NUEVO CLIENTE</h3>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Nombre Completo</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setError(''); }}
                            className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500"
                            placeholder="EJ: PEDRO MARTINEZ"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Teléfono (8 Dígitos)</label>
                        <input
                            type="tel"
                            maxLength={8}
                            value={phone}
                            onChange={(e) => { setPhone(e.target.value); setError(''); }}
                            className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-xl text-center outline-none focus:border-amber-500"
                            placeholder="00000000"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Dirección (Opcional)</label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500"
                            placeholder="EJ: COL. ESCALON #123"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Email (Opcional)</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black outline-none focus:border-amber-500"
                            placeholder="EJ: CLIENTE@CORREO.COM"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">CUMPLEAÑOS (Opcional)</label>
                        <input
                            type="date"
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                            className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 calendar-picker-indicator-white"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-xl">
                            <p className="text-red-500 text-[10px] font-black text-center uppercase">{error}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button onClick={onClose} className="p-4 bg-gray-800 text-gray-400 font-black rounded-2xl uppercase text-xs">CERRAR</button>
                        <button onClick={handleSave} className="p-4 bg-green-600 text-white font-black rounded-2xl uppercase text-xs shadow-lg active:scale-95 transition-transform">GUARDAR</button>
                    </div>
                </div>
            </div>
        </div>,
        portalRoot
    );
};

const AddAddressModal: React.FC<{ onClose: () => void, onSave: (street: string, details: string, lat?: number, lng?: number) => void }> = ({ onClose, onSave }) => {
    const [street, setStreet] = useState('');
    const [details, setDetails] = useState('');
    const [lat, setLat] = useState<number | undefined>(undefined);
    const [lng, setLng] = useState<number | undefined>(undefined);

    const handleSave = () => {
        if (!street.trim()) return;
        onSave(street, details, lat, lng);
    };

    const handleGetLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                setLat(position.coords.latitude);
                setLng(position.coords.longitude);
                setDetails(prev => (prev ? prev + ' ' : '') + '[UBICACIÓN GPS]');
            }, (error) => {
                console.error("GPS Error", error);
            });
        }
    }

    const portalRoot = document.getElementById('portal-root');
    if (!portalRoot) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4">
            <div className="bg-gray-900 w-full max-w-md rounded-[32px] p-6 border border-gray-800 shadow-2xl transition-all duration-300">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-amber-500 p-2 rounded-xl">
                        <MapIcon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">NUEVA DIRECCIÓN</h3>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Calle / Avenida / Colonia</label>
                        <input
                            type="text"
                            value={street}
                            onChange={(e) => setStreet(e.target.value)}
                            className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500"
                            placeholder="EJ: COL. ESCALÓN, FINAL CALLE PPAL"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Detalles / Referencia</label>
                        <textarea
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-bold uppercase outline-none focus:border-amber-500 h-24 resize-none"
                            placeholder="EJ: CASA BLANCA PORTÓN NEGRO..."
                        />
                    </div>

                    <button
                        onClick={handleGetLocation}
                        type="button"
                        className="w-full py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 font-bold rounded-xl border border-blue-500/20 flex items-center justify-center gap-2 transition-colors"
                    >
                        <MapIcon className="w-4 h-4" />
                        {lat ? 'UBICACIÓN GUARDADA' : 'USAR MI UBICACIÓN ACTUAL'}
                    </button>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button onClick={onClose} className="p-4 bg-gray-800 text-gray-400 font-black rounded-2xl uppercase text-xs">CANCELAR</button>
                        <button onClick={handleSave} className="p-4 bg-green-600 text-white font-black rounded-2xl uppercase text-xs shadow-lg active:scale-95 transition-transform">GUARDAR</button>
                    </div>
                </div>
            </div>
        </div>,
        portalRoot
    );
};

const StartScreen: React.FC<StartScreenProps> = ({
    onStartOrder,
    activeOrders,
    onSelectOrder,
    onShowCompleted,
    onShowActive,
    onManageCustomers,
    waiters,
    tables,
    customers = [],
    setCustomers,
    orderToEdit,
    onUpdateOrder,
    onCancelEdit,
    onCreateCustomer,
    products = [],
    meats = [],
    productExtras = [],
    branches,
    currentBranchId,
    initialIsCreating = false,
    companySettings
}) => {
    const isEditing = !!orderToEdit;
    const [orderType, setOrderType] = useState<OrderType | null>(null);
    const [waiter, setWaiter] = useState<Waiter | null>(null);
    const [table, setTable] = useState<Table | null>(null);
    const [openStep, setOpenStep] = useState(1);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
    const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
    const [isAddAddressModalOpen, setIsAddAddressModalOpen] = useState(false);
    const [isSavingCustomer, setIsSavingCustomer] = useState(false);
    const [pendingAIResult, setPendingAIResult] = useState<any | null>(null); // To store AI result while creating customer // Valid loading state
    const [notification, setNotification] = useState<{ title: string; message: string } | null>(null);
    const [isAIModalVisible, setIsAIModalVisible] = useState(false); // AI Modal State
    const [isCreating, setIsCreating] = useState(initialIsCreating); // Toggle between List and New Order Wizard
    const [listSearchQuery, setListSearchQuery] = useState('');
    const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
    const [infoOrder, setInfoOrder] = useState<Order | null>(null);
    const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
    const [showQRModal, setShowQRModal] = useState(false);
    const dragScroll = useDragScroll();
    const customerScrollRef = useDragScroll();

    const handleDeleteClick = (orderId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeletingOrderId(orderId);
    };

    const handlePinSuccess = async (adminUser: any) => {
        if (!deletingOrderId) return;
        try {
            await api.deleteOrder(deletingOrderId, adminUser.id, `Eliminado desde Inicio por: ${adminUser.name}`);
            showNotification('PEDIDO ELIMINADO', 'La orden ha sido borrada correctamente');
        } catch (error: any) {
            console.error('Failed to delete order:', error);
            showNotification('ERROR', 'No se pudo eliminar el pedido');
        } finally {
            setDeletingOrderId(null);
        }
    };

    useEffect(() => {
        setIsCreating(initialIsCreating);
    }, [initialIsCreating]);

    const showNotification = (title: string, message: string) => {
        setNotification({ title, message });
        setTimeout(() => setNotification(null), 3000); // Hide after 3s
    };

    useEffect(() => {
        if (isEditing && orderToEdit) {
            setOrderType(orderToEdit.type);
            setWaiter(orderToEdit.waiter || null);
            setTable(orderToEdit.table || null);
            setSelectedCustomer(orderToEdit.customer || null);
            if (orderToEdit.customer) setSearchQuery(orderToEdit.customer.name.toUpperCase());
            setSelectedAddress(orderToEdit.deliveryAddress || null);
            setOpenStep(0);
        }
    }, [isEditing, orderToEdit]);

    const handleConfirm = () => {
        if (!orderType) return;
        const details: OrderDetails = {
            type: orderType,
            waiter: waiter ?? undefined,
            table: table ?? undefined,
            customer: selectedCustomer ?? undefined,
            deliveryAddress: selectedAddress ?? undefined,
        };
        if (isEditing && onUpdateOrder) onUpdateOrder(details);
        else onStartOrder(details);
    };


    const filteredCustomers = useMemo(() => {
        const safeSearchQuery = normalize(searchQuery);
        if (!safeSearchQuery) return [];

        if (!Array.isArray(customers)) return [];

        const searchDigits = safeSearchQuery.replace(/\D/g, '');

        try {
            const matched = customers.filter(c => {
                if (!c || typeof c !== 'object') return false;
                const customerName = normalize(c.name);
                const nameMatch = customerName.includes(safeSearchQuery);
                let customerDigits = '';
                if (c.phone !== null && c.phone !== undefined) {
                    customerDigits = String(c.phone).replace(/\D/g, '');
                }
                const phoneMatch = searchDigits.length > 0 && customerDigits.includes(searchDigits);
                return nameMatch || phoneMatch;
            });

            matched.sort((a, b) => {
                const aName = normalize(a.name);
                const bName = normalize(b.name);
                const q = safeSearchQuery;

                const aExact = aName === q ? 0 : aName.startsWith(q) ? 1 : aName.includes(q) ? 2 : 3;
                const bExact = bName === q ? 0 : bName.startsWith(q) ? 1 : bName.includes(q) ? 2 : 3;
                if (aExact !== bExact) return aExact - bExact;

                return aName.localeCompare(bName);
            });

            return matched.slice(0, 30);
        } catch (error) {
            console.error("Critical Error filtering customers:", error);
            return [];
        }
    }, [searchQuery, customers]);

    const handleAIParse = async (text: string) => {
        try {
            const result = await api.aiParseOrder(text, currentBranchId || 1);

            // 1. Resolve Items First
            const parsedItems: any[] = [];
            if (result.items && Array.isArray(result.items)) {
                result.items.forEach((aiItem: any) => {
                    const product = products.find(p => p.id === aiItem.productId);
                    if (product) {
                        const meat = aiItem.meatId ? meats.find(m => m.id === aiItem.meatId) : undefined;
                        const masa = aiItem.masaId ? meats.find(m => m.id === aiItem.masaId) : undefined;
                        const extras = aiItem.extraIds ? productExtras.filter(e => aiItem.extraIds.includes(e.id)) : [];

                        parsedItems.push({
                            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            product,
                            quantity: aiItem.quantity || 1,
                            meat,
                            masa,
                            extras,
                            total: (product.price + extras.reduce((sum, e) => sum + Number(e.price), 0)) * (aiItem.quantity || 1),
                            observations: aiItem.note ? aiItem.note.toUpperCase() : undefined,
                            completed: false
                        });
                    }
                });
            }

            // 2. Determine Type First
            let type = OrderType.Delivery;
            const lowerText = text.toLowerCase();
            const pickupKeywords = [
                'llegare', 'llegaré', 'llegaran', 'llegarán', 'paso por', 'pasaré',
                'recoger', 'recogere', 'recogeré', 'retiro', 'retira', 'cliente retira', 'llego por',
                'retirare', 'retiraré', 'paso a traer', 'paso a recoger'
            ];

            if (pickupKeywords.some(k => lowerText.includes(k))) {
                type = OrderType.Pickup;
            }

            // 3. Resolve Customer
            let customer: Customer | undefined;
            const aiName = result.customerName ? result.customerName.toUpperCase() : '';
            const aiPhone = result.customerPhone ? result.customerPhone.replace(/\D/g, '') : '';
            const aiEmail = result.customerEmail || '';

            if (aiName || aiPhone) {
                let existing = customers.find(c => {
                    const cName = normalize(c.name);
                    const cPhone = c.phone ? c.phone.replace(/\D/g, '') : '';
                    const nameMatch = aiName && cName.includes(normalize(aiName));
                    const phoneMatch = aiPhone && cPhone.includes(aiPhone);
                    return nameMatch || phoneMatch;
                });

                if (!existing && aiName) {
                    try {
                        const apiMatches: Customer[] = await api.searchCustomers(aiName);
                        if (apiMatches && apiMatches.length > 0) existing = apiMatches[0];
                    } catch (err) {
                        console.warn("[AI] API Search failed", err);
                    }
                }

                if (existing) {
                    customer = existing;
                    showNotification('CLIENTE ENCONTRADO', `${existing.name}`);
                } else if (aiName) {
                    setSearchQuery(aiName);
                    setPendingAIResult({
                        customerName: aiName,
                        customerPhone: aiPhone,
                        customerEmail: aiEmail,
                        items: parsedItems,
                        type,
                        address: result.address
                    });
                    setIsAIModalVisible(false);
                    setIsAddCustomerModalOpen(true);
                    showNotification('NUEVO CLIENTE DETECTADO', 'Confirme los datos para continuar');
                    return;
                }
            }

            // 4. Resolve Address
            let address: Address | undefined;
            if (type === OrderType.Delivery && customer) {
                if (result.address) {
                    const searchAddr = result.address.toLowerCase();
                    const match = customer.addresses.find(a =>
                        a.street.toLowerCase().includes(searchAddr) ||
                        searchAddr.includes(a.street.toLowerCase())
                    );

                    if (match) {
                        address = match;
                    } else {
                        const newAddr: Address = {
                            id: `addr-${Date.now()}`,
                            customerId: customer.id,
                            street: result.address,
                            city: 'San Salvador',
                            details: 'Detectada por IA'
                        };
                        try {
                            const updatedAddresses = [...(customer.addresses || []), newAddr];
                            customer = { ...customer, addresses: updatedAddresses };
                            address = newAddr;
                            api.updateCustomer(customer.id, { addresses: updatedAddresses })
                                .catch(e => console.error("Failed to auto-save address", e));
                        } catch (e) {
                            console.error("Address auto-add logic error", e);
                        }
                    }
                } else if (customer && customer.addresses.length > 0) {
                    address = customer.addresses[0];
                }
            }

            if (!customer) {
                setOrderType(type);
                setOpenStep(4);
                setIsAIModalVisible(false);
                setIsCreating(true);
            } else {
                onStartOrder({
                    type,
                    customer,
                    deliveryAddress: address,
                    initialItems: parsedItems
                });
                setIsAIModalVisible(false);
            }
        } catch (e: any) {
            console.error(e);
            showNotification('ERROR IA', e.message);
        }
    };

    const handleSelectCustomer = (c: Customer) => {
        setSelectedCustomer(c);
        setSearchQuery(c.name);
        if (c.addresses && c.addresses.length > 0) setSelectedAddress(c.addresses[0]);
    };

    const needsWaiter = orderType === OrderType.Local || orderType === OrderType.Takeaway;
    const needsTable = orderType === OrderType.Local;

    const hasActiveOrders = activeOrders.filter(o => o.status === 'active').length > 0;

    // Payment banner logic
    const graceDays = companySettings?.paymentGraceDays ?? 3;
    const paymentInfo = useMemo(() => {
        const dayStr = companySettings?.paymentDueDate;
        const isPending = companySettings?.paymentPending;
        if (!dayStr || !isPending) return null;
        const overdueDays = getDaysOverdue(dayStr);
        if (overdueDays <= 0) return null;
        return { overdueDays, isBlocked: overdueDays > graceDays };
    }, [companySettings?.paymentDueDate, companySettings?.paymentPending, graceDays]);

    // Grouping logic for Unified List
    const groupedOrders = useMemo(() => {
        const groups: { [key: string]: Order[] } = {
            'LOCAL': [],
            'DELIVERY': [],
            'CLIENTE RETIRA': []
        };

        activeOrders.forEach(order => {
            if (order.type === OrderType.Local || order.type === OrderType.Takeaway) {
                groups['LOCAL'].push(order);
            } else if (order.type === OrderType.Delivery) {
                groups['DELIVERY'].push(order);
            } else if (order.type === OrderType.Pickup) {
                groups['CLIENTE RETIRA'].push(order);
            }
        });

        // Filter out empty groups
        return Object.entries(groups).filter(([_, list]) => list.length > 0);
    }, [activeOrders]);


    return (
        <>
            {(!isCreating && !isEditing) ? (
                <div
                    ref={dragScroll.ref}
                    onMouseDown={dragScroll.onMouseDown}
                    onMouseMove={dragScroll.onMouseMove}
                    onMouseUp={dragScroll.onMouseUp}
                    onMouseLeave={dragScroll.onMouseLeave}
                    className="h-screen overflow-y-auto scrollbar-hide select-none relative"
                >
                    <div className="max-w-4xl mx-auto space-y-6 pb-32">
                        <header className="sticky top-0 z-30 bg-[#0a0a0b] p-4 lg:p-8 -mx-4 lg:-mx-8 mb-2 flex flex-col gap-4 border-b border-gray-800">
                            <div className="flex items-center justify-between">
                                <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                                    PEDIDOS <span className="text-amber-500">DE HOY</span>
                                </h1>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowUnpaidOnly(prev => !prev)}
                                        className={`p-2 rounded-xl active:scale-90 transition-all ${showUnpaidOnly ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg' : 'bg-gray-800 text-gray-400 border border-transparent'}`}
                                        title={showUnpaidOnly ? 'MOSTRAR TODOS' : 'SOLO NO PAGADOS'}
                                    >
                                        <CreditCardIcon className="w-6 h-6" />
                                    </button>
                                    <button
                                        onClick={() => setIsAIModalVisible(true)}
                                        className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl text-white active:scale-90 transition-all shadow-lg border border-white/10"
                                    >
                                        <RobotIcon className="w-6 h-6" />
                                    </button>
                                    <button onClick={onManageCustomers} className="p-2 bg-gray-800 rounded-xl text-gray-400 active:scale-90 transition-transform">
                                        <UserGroupIcon className="w-6 h-6" />
                                    </button>
                                    <button
                                        onClick={() => setShowQRModal(true)}
                                        className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30 active:opacity-60 transition-opacity"
                                        title="MENÚ DIGITAL"
                                    >
                                        <QrCodeIcon className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        placeholder="BUSCAR..."
                                        value={listSearchQuery}
                                        onChange={(e) => setListSearchQuery(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded-2xl focus:border-amber-500 focus:outline-none text-xs font-bold uppercase pl-9 shadow-inner"
                                    />
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                    {listSearchQuery && (
                                        <button
                                            onClick={() => setListSearchQuery('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white bg-gray-800 rounded-full p-0.5 transition-colors"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                <div className="ml-auto text-amber-400 font-black text-xs tracking-wider whitespace-nowrap bg-gray-900 border border-gray-700 px-3 py-2 rounded-2xl">
                                    TOTAL: <span className="text-white">{activeOrders.length}</span>
                                </div>
                            </div>
                            {paymentInfo && (
                                <div className={`-mx-4 lg:-mx-8 px-4 lg:px-8 py-2.5 ${paymentInfo.isBlocked ? 'bg-red-600/20 border-t border-red-500/30' : 'bg-amber-600/20 border-t border-amber-500/30'}`}>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${paymentInfo.isBlocked ? 'bg-red-500' : 'bg-amber-500'}`} />
                                        <p className={`font-black text-[10px] uppercase tracking-wider ${paymentInfo.isBlocked ? 'text-red-400' : 'text-amber-400'}`}>
                                            {paymentInfo.isBlocked
                                                ? `🚫 CREACIÓN DE ÓRDENES DESACTIVADA POR FALTA DE PAGO (${paymentInfo.overdueDays} DÍAS DE MORA)`
                                                : `⚠️ USO DE APLICACIÓN CON ${paymentInfo.overdueDays} DÍA${paymentInfo.overdueDays !== 1 ? 'S' : ''} DE MORA. POR FAVOR EFECTÚA EL PAGO.`}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </header>

                        <div className="p-4 lg:p-8 pt-0 lg:pt-0 space-y-6">

                            {(() => {
                                const filteredList = activeOrders.filter(order => {
                                    if (showUnpaidOnly && order.status === 'completed') return false;
                                    if (!listSearchQuery) return true;
                                    const term = normalize(listSearchQuery);
                                    const orderId = String(order.dailyOrderNumber).padStart(3, '0');
                                    const orderTempId = String(order.id || '').toLowerCase();
                                    const customer = normalize(order.customer?.name || '');
                                    const table = normalize(order.table?.name || '');
                                    const waiter = normalize(order.waiter?.name || '');
                                    return orderId.includes(term) || orderTempId.includes(term) || customer.includes(term) || table.includes(term) || waiter.includes(term);
                                });

                                const groups = [
                                    { name: 'CLIENTE RETIRA', list: filteredList.filter(o => o.type === OrderType.Pickup), color: 'purple' },
                                    { name: 'DELIVERY', list: filteredList.filter(o => o.type === OrderType.Delivery), color: 'amber' },
                                    { name: 'PARA LLEVAR', list: filteredList.filter(o => o.type === OrderType.Takeaway), color: 'emerald' },
                                    { name: 'RESTAURANTE', list: filteredList.filter(o => o.type === OrderType.Local), color: 'blue' }
                                ].filter(g => g.list.length > 0);

                                if (groups.length === 0) {
                                    return (
                                        <div className="flex flex-col items-center justify-center py-20 opacity-30 italic">
                                            <p className="text-xl font-black uppercase tracking-tighter text-center">
                                                {listSearchQuery ? 'No se encontraron coincidencias' : 'No hay pedidos hoy'}
                                            </p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="flex flex-col gap-4">
                                        {groups.map((group) => (
                                            <section key={group.name} className="relative">
                                                <div className="sticky top-[128px] lg:top-[160px] z-20 py-2 mb-2 flex items-center gap-2">
                                                    <div className={`px-4 py-1.5 rounded-full border-2 font-black text-[12px] tracking-[0.2em] shadow-lg uppercase italic
                                                    ${group.color === 'blue' ? 'bg-blue-950 border-blue-700 text-blue-400' :
                                                            group.color === 'emerald' ? 'bg-emerald-950 border-emerald-700 text-emerald-400' :
                                                                group.color === 'amber' ? 'bg-amber-950 border-amber-700 text-amber-400' :
                                                                    'bg-purple-950 border-purple-700 text-purple-400'}`}
                                                    >
                                                        {group.name}
                                                    </div>
                                                    <div className={`px-3 py-1.5 rounded-full border-2 font-black text-[13px] tabular-nums shadow-lg
                                                    ${group.color === 'blue' ? 'bg-blue-950 border-blue-700 text-blue-400' :
                                                            group.color === 'emerald' ? 'bg-emerald-950 border-emerald-700 text-emerald-400' :
                                                                group.color === 'amber' ? 'bg-amber-950 border-amber-700 text-amber-400' :
                                                                    'bg-purple-950 border-purple-700 text-purple-400'}`}
                                                    >
                                                        {group.list.length}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                                    {group.list.sort((a, b) => (b.dailyOrderNumber || 0) - (a.dailyOrderNumber || 0)).map(order => {
                                                        const isPaid = order.status === 'completed';
                                                        const cardBg = group.color === 'blue' ? 'bg-blue-600/10' :
                                                            group.color === 'emerald' ? 'bg-emerald-600/10' :
                                                                group.color === 'amber' ? 'bg-amber-600/10' :
                                                                    'bg-purple-600/10';
                                                        const cardBorder = group.color === 'blue' ? 'border-blue-500/20' :
                                                            group.color === 'emerald' ? 'border-emerald-500/20' :
                                                                group.color === 'amber' ? 'border-amber-500/20' :
                                                                    'border-purple-500/20';

                                                        return (
                                                            <button
                                                                key={order.id}
                                                                onClick={() => onSelectOrder(order.id)}
                                                                className={`py-1 px-4 border ${cardBorder} ${cardBg} rounded-2xl shadow-xl hover:brightness-125 active:scale-[0.98] transition-all text-left relative overflow-hidden group`}
                                                            >
                                                                <div className="flex justify-between items-center gap-2">
                                                                    <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                                                                        <span className="font-black text-[#E0650D] text-[15px] tracking-tighter shrink-0">
                                                                            #{String(order.dailyOrderNumber).padStart(3, '0')}
                                                                        </span>
                                                                        <span className="text-white font-black text-[15px] truncate uppercase leading-none opacity-90">
                                                                            {order.customer?.name || 'Cliente Mostrador'}
                                                                        </span>
                                                                    </div>

                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        {/* Info Button */}
                                                                        <div
                                                                            onClick={(e) => { e.stopPropagation(); setInfoOrder(order); }}
                                                                            className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black text-gray-400 uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all active:scale-90"
                                                                        >
                                                                            INFO
                                                                        </div>

                                                                        {/* Delete Button (ALWAYS VISIBLE with PIN Lock) */}
                                                                        <div
                                                                            onClick={(e) => handleDeleteClick(order.id, e)}
                                                                            className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-[9px] hover:bg-red-500 hover:text-white transition-all active:scale-90 cursor-pointer flex items-center gap-1"
                                                                        >
                                                                            <TrashIcon className="w-3 h-3" />
{!isPaid && order.kitchenStatus === 'in_process' && (
                                                <FlameIcon className="w-4 h-4 text-orange-500" />
                                            )}
                                                                            {isPaid && (
                                                                                <div className="bg-green-500 rounded-full p-0.5">
                                                                                    <CheckIcon className="w-2 h-2 text-gray-950" />
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Total Price (Intelligent Effect - Just Text) */}
                                                                        <span className={`inline-block font-black text-[17px] tabular-nums tracking-tight transition-all ${isPaid
                                                                            ? 'text-green-500'
                                                                            : 'text-red-500 animate-text-urgent'}`}>
                                                                            ${Number(order.total).toFixed(2)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </section>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>

                        <button
                            onClick={() => { if (!paymentInfo?.isBlocked) setIsCreating(true); }}
                            disabled={paymentInfo?.isBlocked || false}
                            className={`fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-[0_10px_40px_rgba(13,182,224,0.4)] flex items-center justify-center text-gray-950 active:scale-90 transition-all z-50 group border-4 border-gray-950 ${paymentInfo?.isBlocked ? 'bg-gray-700 cursor-not-allowed opacity-50' : 'bg-[#0DB6E0]'}`}
                            title={paymentInfo?.isBlocked ? 'CREACIÓN DE ÓRDENES DESACTIVADA POR FALTA DE PAGO' : 'NUEVO PEDIDO'}
                        >
                            <PlusIcon className="w-8 h-8 transition-transform group-hover:scale-110" />
                        </button>
                    </div >
                </div >
            ) : (
                <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-6 pb-32">
                    <header className="flex items-center justify-between mb-2">
                        <div className="flex flex-col">
                            {!isEditing && (
                                <button
                                    onClick={() => setIsCreating(false)}
                                    className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1 flex items-center gap-1 active:scale-95 transition-transform"
                                >
                                    ← VOLVER AL LISTADO
                                </button>
                            )}
                            <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                                {isEditing ? 'EDITAR' : 'NUEVO'} <span className="text-amber-500">PEDIDO</span>
                            </h1>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsAIModalVisible(true)}
                                className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl text-white active:scale-90 transition-all shadow-lg border border-white/10 flex items-center gap-2"
                            >
                                <RobotIcon className="w-6 h-6" />
                            </button>
                            <button onClick={onManageCustomers} className="p-2 bg-gray-800 rounded-xl text-gray-400 active:scale-90 transition-transform">
                                <UserGroupIcon className="w-6 h-6" />
                            </button>
                        </div>
                    </header>

                    <div className="space-y-3">
                        <Step title="1. SERVICIO" stepNumber={1} value={orderType ? (orderType === 'Local' ? 'Restaurante' : orderType) : undefined} openStep={openStep} setOpenStep={setOpenStep}>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.values(OrderType).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => { setOrderType(type); setOpenStep(needsWaiter ? 2 : 4); }}
                                        className={`py-4 px-2 rounded-2xl font-black text-xs uppercase transition-all border-2 ${orderType === type ? 'bg-amber-500 text-white border-amber-400 shadow-lg' : 'bg-gray-800 text-gray-300 border-gray-800'}`}
                                    >
                                        {type === 'Local' ? 'Restaurante' : type}
                                    </button>
                                ))}
                            </div>
                        </Step>

                        {needsWaiter && (
                            <Step title="2. MESERO" stepNumber={2} value={waiter?.name} openStep={openStep} setOpenStep={setOpenStep}>
                                <div className="grid grid-cols-3 gap-2">
                                    {waiters.filter(w => w.isActive && (w.roles?.includes(UserRole.Waiter) || w.roles?.includes(UserRole.Cashier))).map(w => (
                                        <button
                                            key={w.id}
                                            onClick={() => { setWaiter(w); setOpenStep(needsTable ? 3 : 4); }}
                                            className={`py-3 rounded-2xl flex flex-col items-center gap-1 border-2 transition-all ${waiter?.id === w.id ? 'bg-amber-500 text-white border-amber-400' : 'bg-gray-800 text-gray-300 border-gray-800'}`}
                                        >
                                            <UserIcon className="w-5 h-5" />
                                            <span className="text-[10px] font-black uppercase truncate w-full px-1">{w.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </Step>
                        )}

                        {needsTable && (
                            <Step title="3. MESA" stepNumber={3} value={table?.name} openStep={openStep} setOpenStep={setOpenStep}>
                                <div className="grid grid-cols-4 gap-2">
                                    {tables.map(t => {
                                        const isOccupied = activeOrders.some(o =>
                                            o.type === OrderType.Local &&
                                            o.table &&
                                            Number(o.table.id) === Number(t.id) &&
                                            o.status === 'active'
                                        );

                                        return (
                                            <button
                                                key={t.id}
                                                onClick={() => { setTable(t); setOpenStep(4); }}
                                                className={`py-3 rounded-2xl flex flex-col items-center gap-1 border-2 transition-all relative overflow-hidden
                                            ${table?.id === t.id
                                                        ? 'bg-amber-500 text-white border-amber-400'
                                                        : isOccupied
                                                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 ring-2 ring-amber-500/10 animate-pulse'
                                                            : 'bg-gray-800 text-gray-300 border-gray-800'
                                                    }`}
                                            >
                                                <TableIcon className="w-5 h-5" />
                                                <span className="text-[10px] font-black uppercase">{t.name}</span>
                                                {isOccupied && (
                                                    <span className="absolute top-0 right-0 bg-amber-500 text-black text-[7px] font-black px-1 rounded-bl-lg uppercase tracking-tighter">
                                                        OCUPADA
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </Step>
                        )}

                        <Step title="4. CLIENTE" stepNumber={4} value={selectedCustomer?.name} openStep={openStep} setOpenStep={setOpenStep}>
                            <div className="space-y-3 relative">
                                {!selectedCustomer ? (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="BUSCAR NOMBRE O TEL..."
                                            className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-bold outline-none focus:border-amber-500 uppercase"
                                        />

                                        {searchQuery.trim().length > 0 && (
                                            <div className="absolute left-0 right-0 mt-2 bg-gray-800 border-2 border-gray-700 rounded-2xl overflow-hidden shadow-2xl z-[60] animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col max-h-[280px]">
                                                {filteredCustomers.length > 0 ? (
                                                    <div
                                                        ref={customerScrollRef.ref}
                                                        onMouseDown={customerScrollRef.onMouseDown}
                                                        onMouseMove={customerScrollRef.onMouseMove}
                                                        onMouseUp={customerScrollRef.onMouseUp}
                                                        onMouseLeave={customerScrollRef.onMouseLeave}
                                                        onTouchStart={customerScrollRef.onTouchStart}
                                                        onTouchMove={customerScrollRef.onTouchMove}
                                                        onTouchEnd={customerScrollRef.onTouchEnd}
                                                        className="divide-y divide-gray-700 overflow-y-auto cursor-ns-resize scrollbar-hide"
                                                    >
                                                        {filteredCustomers.map(c => (
                                                            <button
                                                                key={c.id}
                                                                onClick={() => handleSelectCustomer(c)}
                                                                className="w-full p-4 flex justify-between items-center hover:bg-gray-700 active:bg-amber-500 transition-colors"
                                                            >
                                                                <div className="text-left">
                                                                    <p className="font-black text-sm text-white uppercase">{c.name}</p>
                                                                    <p className="text-xs text-gray-400 font-bold">{formatPhone(c.phone)}</p>
                                                                </div>
                                                                <CheckCircleIcon className="w-5 h-5 text-amber-500" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setIsAddCustomerModalOpen(true)}
                                                        className="w-full p-6 text-center hover:bg-gray-700 transition-colors group"
                                                    >
                                                        <p className="text-xs font-black text-gray-400 uppercase mb-2">No se encontraron resultados</p>
                                                        <div className="inline-flex items-center gap-2 bg-amber-500 text-white px-6 py-3 rounded-xl font-black text-sm uppercase italic group-active:scale-95 transition-transform">
                                                            <PlusIcon className="w-5 h-5" />
                                                            AGREGAR: {searchQuery.toUpperCase()}
                                                        </div>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-amber-500 p-4 rounded-2xl flex justify-between items-center shadow-lg animate-in fade-in zoom-in duration-200">
                                        <div className="min-w-0 pr-4">
                                            <p className="font-black text-white italic uppercase truncate">{selectedCustomer.name}</p>
                                            <p className="text-xs text-amber-100 font-bold">{formatPhone(selectedCustomer.phone)}</p>
                                        </div>
                                        <button
                                            onClick={() => { setSelectedCustomer(null); setSearchQuery(''); }}
                                            className="shrink-0 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-white"
                                        >
                                            CAMBIAR
                                        </button>
                                    </div>
                                )}

                                {orderType === OrderType.Delivery && selectedCustomer && (
                                    <div className="mt-4 p-4 bg-gray-800/50 rounded-2xl border border-gray-700">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Dirección de Entrega</p>
                                        {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 ? (
                                            <div className="space-y-2">
                                                {selectedCustomer.addresses.map(addr => (
                                                    <button
                                                        key={addr.id}
                                                        onClick={() => setSelectedAddress(addr)}
                                                        className={`w-full p-3 rounded-xl text-left border-2 transition-all ${selectedAddress?.id === addr.id ? 'bg-amber-500/10 border-amber-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                                                    >
                                                        <p className="text-xs font-bold uppercase">{addr.street}</p>
                                                        {addr.details && <p className="text-[10px] opacity-60 italic">{addr.details}</p>}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                <p className="text-xs text-amber-500 font-bold italic uppercase">Este cliente no tiene direcciones guardadas.</p>
                                            </div>
                                        )}

                                        <button
                                            onClick={() => setIsAddAddressModalOpen(true)}
                                            className="mt-3 w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-black rounded-xl uppercase text-xs flex items-center justify-center gap-2 transition-colors active:scale-95 border border-gray-600 border-dashed"
                                        >
                                            <PlusIcon className="w-4 h-4 text-green-500" />
                                            AGREGAR NUEVA DIRECCIÓN
                                        </button>
                                    </div>
                                )}
                            </div>
                        </Step>
                    </div >

                    <div className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 z-30">
                        <div className="max-w-4xl mx-auto p-4">
                            <button
                                onClick={handleConfirm}
                                disabled={!orderType || (needsWaiter && !waiter) || (needsTable && !table) || (orderType === OrderType.Delivery && !selectedCustomer)}
                                className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-800 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 text-lg uppercase italic tracking-tighter"
                            >
                                {isEditing ? 'ACTUALIZAR' : 'SELECCIONAR PRODUCTOS'}
                            </button>
                        </div>
                    </div>

                    {
                        isAddCustomerModalOpen && (
                            <AddCustomerModal
                                initialName={searchQuery}
                                initialPhone={pendingAIResult?.customerPhone || ''}
                                initialAddress={pendingAIResult?.address || ''}
                                initialEmail={pendingAIResult?.customerEmail || ''}
                                onClose={() => {
                                    setIsAddCustomerModalOpen(false);
                                    setPendingAIResult(null); // Clear on cancel
                                }}
                                isSaving={isSavingCustomer}
                                onSave={async (newCustomerData) => {
                                    setIsSavingCustomer(true);
                                    try {
                                        const saved = await onCreateCustomer(newCustomerData);
                                        setCustomers(prev => [...prev, saved]);

                                        // NEW: Check if there is a pending AI Order
                                        if (pendingAIResult) {
                                            handleSelectCustomer(saved); // This just sets context
                                            setIsAddCustomerModalOpen(false);

                                            // Use the newly created address if available
                                            let addressToUse = undefined;
                                            if (saved.addresses && saved.addresses.length > 0) {
                                                addressToUse = saved.addresses[0];
                                            }

                                            // Trigger Order Start with Pending Items
                                            onStartOrder({
                                                type: pendingAIResult.type,
                                                customer: saved,
                                                deliveryAddress: addressToUse,
                                                initialItems: pendingAIResult.items
                                            });

                                            setPendingAIResult(null);
                                            showNotification('CLIENTE CREADO', `PEDIDO IA INICIADO AUTOMÁTICAMENTE`);

                                        } else {
                                            handleSelectCustomer(saved);
                                            setIsAddCustomerModalOpen(false);
                                            showNotification('CLIENTE GUARDADO', `${saved.name} REGISTRADO CORRECTAMENTE`);
                                        }

                                    } catch (e: any) {
                                        console.error(e);
                                        showNotification('ERROR', e.message || 'NO SE PUDO GUARDAR EL CLIENTE');
                                    } finally {
                                        setIsSavingCustomer(false);
                                    }
                                }}
                            />
                        )
                    }

                    {
                        isAddAddressModalOpen && selectedCustomer && (
                            <AddAddressModal
                                onClose={() => setIsAddAddressModalOpen(false)}
                                onSave={async (street, details, lat, lng) => {
                                    setIsSavingCustomer(true);
                                    try {
                                        const newAddress: Address = {
                                            id: `addr-${Date.now()}`,
                                            street: street.trim().toUpperCase(),
                                            city: 'SAN SALVADOR',
                                            details: details.trim().toUpperCase() || undefined,
                                            latitude: lat,
                                            longitude: lng
                                        };

                                        const updatedAddresses = [...(selectedCustomer.addresses || []), newAddress];

                                        // 0. LOGGING FOR DEBUG
                                        console.log('[StartScreen] Saving Address Payload:', {
                                            customerId: selectedCustomer.id,
                                            addresses: updatedAddresses
                                        });

                                        // 1. Update Backend
                                        const updatedCustomer = await api.updateCustomer(selectedCustomer.id, {
                                            ...selectedCustomer,
                                            addresses: updatedAddresses
                                        });

                                        // 2. Update Local State (Customers List)
                                        setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, addresses: updatedAddresses } : c));

                                        // 3. Update Currently Selected Customer & Address
                                        setSelectedCustomer(prev => prev ? { ...prev, addresses: updatedAddresses } : null);
                                        setSelectedAddress(newAddress);

                                        setIsAddAddressModalOpen(false);
                                        showNotification('DIRECCIÓN GUARDADA', `SE AGREGÓ: ${street}`);

                                    } catch (e: any) {
                                        console.error("Failed to add address", e);
                                        showNotification('ERROR', 'NO SE PUDO GUARDAR LA DIRECCIÓN. REVISA LA CONEXIÓN.');
                                    } finally {
                                        setIsSavingCustomer(false);
                                    }
                                }}
                            />
                        )
                    }

                </div>
            )}

            {
                isAIModalVisible && (
                    <AIOrderParserModal
                        onClose={() => setIsAIModalVisible(false)}
                        onParse={async (text) => {
                            try {
                                const result = await api.aiParseOrder(text, currentBranchId || 1);

                                // 1. Resolve Items First (MOVED UP to fix ReferenceError)
                                const parsedItems: any[] = [];
                                if (result.items && Array.isArray(result.items)) {
                                    result.items.forEach((aiItem: any) => {
                                        const product = products.find(p => p.id === aiItem.productId);
                                        if (product) {
                                            const meat = aiItem.meatId ? meats.find(m => m.id === aiItem.meatId) : undefined;
                                            const masa = aiItem.masaId ? meats.find(m => m.id === aiItem.masaId) : undefined;
                                            const extras = aiItem.extraIds ? productExtras.filter(e => aiItem.extraIds.includes(e.id)) : [];

                                            parsedItems.push({
                                                id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                                product,
                                                quantity: aiItem.quantity || 1,
                                                meat,
                                                masa,
                                                extras,
                                                total: (product.price + extras.reduce((sum, e) => sum + Number(e.price), 0)) * (aiItem.quantity || 1),
                                                observations: aiItem.note ? aiItem.note.toUpperCase() : undefined,
                                                completed: false
                                            });
                                        }
                                    });
                                }

                                // 2. Determine Type First (MOVED UP to fix ReferenceError)
                                let type = OrderType.Delivery;
                                const lowerText = text.toLowerCase();
                                const pickupKeywords = [
                                    'llegare', 'llegaré', 'llegaran', 'llegarán', 'paso por', 'pasaré',
                                    'recoger', 'recogere', 'recogeré', 'retiro', 'retira', 'cliente retira', 'llego por',
                                    'retirare', 'retiraré', 'paso a traer', 'paso a recoger'
                                ]; // Strong pickup intent only

                                if (pickupKeywords.some(k => lowerText.includes(k))) {
                                    type = OrderType.Pickup;
                                }

                                // 3. Resolve Customer (After Items and Type are defined)
                                let customer: Customer | undefined;


                                const aiName = result.customerName ? result.customerName.toUpperCase() : '';
                                const aiPhone = result.customerPhone ? result.customerPhone.replace(/\D/g, '') : '';
                                const aiEmail = result.customerEmail || '';

                                if (aiName || aiPhone) {
                                    // Try simplified local search (Name OR Phone)
                                    let existing = customers.find(c => {
                                        const cName = normalize(c.name);
                                        const cPhone = c.phone ? c.phone.replace(/\D/g, '') : '';

                                        const nameMatch = aiName && cName.includes(normalize(aiName));
                                        const phoneMatch = aiPhone && cPhone.includes(aiPhone);

                                        return nameMatch || phoneMatch;
                                    });

                                    // Fallback: API Search
                                    if (!existing && aiName) {
                                        try {
                                            console.log(`[AI] Local match failed. Searching API for: ${aiName}`);
                                            const apiMatches: Customer[] = await api.searchCustomers(aiName);
                                            if (apiMatches && apiMatches.length > 0) {
                                                existing = apiMatches[0];
                                            }
                                        } catch (err) {
                                            console.warn("[AI] API Search failed", err);
                                        }
                                    }

                                    if (existing) {
                                        customer = existing;
                                        showNotification('CLIENTE ENCONTRADO', `${existing.name}`);

                                        // IF existing customer has NO phone, but AI found one, notify user?
                                        if (!existing.phone && aiPhone) {
                                            showNotification('DATOS NUEVOS DETECTADOS', `Tel: ${aiPhone} (Actualiza en Editar)`);
                                        }
                                    } else {
                                        // Prepare for NEW Customer
                                        if (aiName) setSearchQuery(aiName);

                                        // NEW: Auto-open Add Customer Modal with AI Data - RELAXED CONDITION
                                        // JUST NAME is enough to start the "New Customer" flow
                                        if (aiName) {
                                            setPendingAIResult({
                                                customerName: aiName,
                                                customerPhone: aiPhone, // Might be empty, that's fine
                                                customerEmail: aiEmail,
                                                items: parsedItems, // Persist parsed items (Now defined!)
                                                type, // Persist type (Now defined!)
                                                address: result.address // Keep original string address
                                            });

                                            // CRITICAL: Close AI Modal and Open Add Customer Modal
                                            setIsAIModalVisible(false);
                                            setIsAddCustomerModalOpen(true);

                                            showNotification('NUEVO CLIENTE DETECTADO', 'Confirme los datos para continuar');
                                        } else {
                                            if (aiPhone) showNotification('CLIENTE NUEVO DETECTADO', 'Complete el registro');
                                        }
                                    }
                                }

                                // 4. Resolve Address (Only if Delivery and Customer Exists)
                                let address: Address | undefined;
                                if (type === OrderType.Delivery && customer) {
                                    if (result.address) {
                                        // 1. Try to find existing address (Simple Fuzzy Match)
                                        const searchAddr = result.address.toLowerCase();
                                        const match = customer.addresses.find(a =>
                                            a.street.toLowerCase().includes(searchAddr) ||
                                            searchAddr.includes(a.street.toLowerCase())
                                        );

                                        if (match) {
                                            address = match;
                                            // showNotification('DIRECCIÓN CONFIRMADA', match.street);
                                        } else {
                                            // 2. Auto-Add New Address to Customer
                                            const newAddr: Address = {
                                                id: `addr-${Date.now()}`,
                                                customerId: customer.id,
                                                street: result.address,
                                                city: 'San Salvador', // Default city
                                                details: 'Detectada por IA'
                                            };

                                            try {
                                                const updatedAddresses = [...(customer.addresses || []), newAddr];
                                                // Optimistic update of local customer object
                                                customer = { ...customer, addresses: updatedAddresses };
                                                address = newAddr;

                                                // Persist to Backend in background
                                                api.updateCustomer(customer.id, { addresses: updatedAddresses })
                                                    .then(() => showNotification('DIRECCIÓN GUARDADA', 'Nueva dirección agregada al cliente'))
                                                    .catch(e => console.error("Failed to auto-save address", e));

                                            } catch (e) {
                                                console.error("Address auto-add logic error", e);
                                            }
                                        }
                                    } else if (customer && customer.addresses.length > 0) {
                                        // No address from AI, but customer has one? Default to first?
                                        // Maybe safer to ask user, but for speed, let's keep previous behavior or just leave undefined
                                        address = customer.addresses[0];
                                    }
                                }

                                if (!customer) {
                                    // No Customer Found -> Fill Form and Let User Finish (Only if NOT opening modal)
                                    // If pendingAIResult (and thus modal) was set above, this block is skipped for the modal logic
                                    if (!pendingAIResult && !isAddCustomerModalOpen) {
                                        setOrderType(type);
                                        setOpenStep(4); // Go to Customer Step
                                        showNotification('IA FINALIZADA', 'Selecciona el cliente para continuar');
                                        setIsAIModalVisible(false);
                                    }
                                    // Else: Modal is opening (handled above), so just ensure AI modal is closed (done above too)

                                } else {
                                    // Customer Found -> Start Order directly (Go to Cart/Payment)
                                    onStartOrder({
                                        type,
                                        customer,
                                        deliveryAddress: address,
                                        initialItems: parsedItems
                                    });
                                    setIsAIModalVisible(false);
                                }

                            } catch (e: any) {
                                console.error(e);
                                showNotification('ERROR IA', e.message);
                            }
                        }}
                    />
                )
            }
            {
                notification && (
                    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 duration-300">
                        <div className="bg-gray-900 border-2 border-amber-500 rounded-2xl p-4 shadow-2xl flex items-center gap-3">
                            <div className="bg-amber-500 p-2 rounded-xl">
                                <CheckCircleIcon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{notification.title}</p>
                                <p className="text-white font-black text-xs uppercase italic">{notification.message}</p>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal de Información de Pedido */}
            {
                infoOrder && (
                    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[200] p-4" onClick={() => setInfoOrder(null)}>
                        <div className="bg-gray-900 w-full max-w-xs rounded-[32px] p-6 border border-gray-800 shadow-2xl transition-all duration-300" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-blue-500/20 p-2 rounded-xl">
                                    <InfoIcon className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">DETALLES</h3>
                                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">PEDIDO #{String(infoOrder.dailyOrderNumber).padStart(3, '0')}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="bg-gray-800/40 p-3 rounded-2xl border border-gray-800 flex items-center gap-3">
                                    <div className="p-1.5 bg-blue-500/10 rounded-lg shrink-0">
                                        <TableIcon className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">MESA / LUGAR</p>
                                        <p className="text-white font-black uppercase italic text-sm truncate">{infoOrder.table?.name || 'SIN MESA'}</p>
                                    </div>
                                </div>

                                <div className="bg-gray-800/40 p-3 rounded-2xl border border-gray-800 flex items-center gap-3">
                                    <div className="p-1.5 bg-amber-500/10 rounded-lg shrink-0">
                                        <UserIcon className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">ATENDIDO POR</p>
                                        <p className="text-white font-black uppercase italic text-sm truncate">{infoOrder.waiter?.name || 'ADMIN'}</p>
                                    </div>
                                </div>

                                <div className="bg-gray-800/40 p-3 rounded-2xl border border-gray-800 flex items-center gap-3">
                                    <div className="p-1.5 bg-emerald-500/10 rounded-lg shrink-0">
                                        <ClockIcon className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">HORA DE APERTURA</p>
                                        <p className="text-white font-black uppercase italic text-sm">
                                            {new Date(infoOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setInfoOrder(null)}
                                className="w-full mt-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-black rounded-xl uppercase text-xs transition-all active:scale-95"
                            >
                                CERRAR
                            </button>
                        </div>
                    </div>
                )
            }
            {/* QR Code Modal */}
            {showQRModal && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-200" onClick={() => setShowQRModal(false)}>
                    <div className="bg-gray-900 border border-gray-800 rounded-[40px] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="text-center space-y-4">
                            <h2 className="text-lg font-black text-white italic uppercase tracking-tighter">MENÚ DIGITAL</h2>
                            <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">ESCANEÁ PARA VER EL MENÚ</p>
                            <div className="bg-white p-4 rounded-[24px] inline-block mx-auto shadow-xl">
                                <QRCodeCanvas
                                    value={`${window.location.origin}/menu`}
                                    size={2048}
                                    style={{ width: 200, height: 200 }}
                                    level="H"
                                    includeMargin
                                />
                            </div>
                            <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest italic break-all">
                                {window.location.origin}/menu
                            </p>
                            <button
                                onClick={() => {
                                    const url = `${window.location.origin}/menu`;
                                    if (navigator.share) {
                                        navigator.share({ title: 'Menú Digital', text: 'Mirá el menú digital', url }).catch(() => {});
                                    } else {
                                        navigator.clipboard.writeText(url);
                                        toast.success('ENLACE DEL MENÚ DIGITAL COPIADO');
                                    }
                                }}
                                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase italic tracking-widest transition-all active:scale-95 shadow-lg"
                            >
                                COMPARTIR ENLACE
                            </button>
                            <button
                                onClick={() => setShowQRModal(false)}
                                className="w-full py-3 bg-gray-800 text-gray-400 rounded-2xl font-black text-[10px] uppercase italic tracking-widest hover:bg-gray-700 transition-all"
                            >
                                CERRAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PIN Verification Modal for Deletion */}
            <PinVerificationModal
                isOpen={!!deletingOrderId}
                onClose={() => setDeletingOrderId(null)}
                onSuccess={handlePinSuccess}
                title="ELIMINAR PEDIDO"
                subtitle="INGRESE PIN DE ADMIN"
                requiredRole={UserRole.Admin}
            />
        </>
    );
};




export default StartScreen;
