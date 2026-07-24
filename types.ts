
export enum OrderType {
    Local = 'Local',
    Delivery = 'Delivery',
    Pickup = 'Cliente Retira',
    Takeaway = 'Para Llevar',
}

export enum UserRole {
    SuperAdmin = 'SuperAdmin',
    Admin = 'Administrador',
    Waiter = 'Mesero',
    Cook = 'Cocinero',
    Cashier = 'Cajero',
    Delivery = 'Repartidor',
}

export enum PaymentMethod {
    Cash = 'Efectivo',
    Transfer = 'Transfer',
    TransferOther = 'Transfer Otros',
    Card = 'Tarjeta',
    Check = 'Cheque',
    Bitcoin = 'Bitcoin',
}

export type PromoType = 'QUANTITY' | 'HAPPY_HOUR' | 'EVENT' | 'COMBO' | 'CATEGORY' | 'BIRTHDAY' | 'GLOBAL';
export type DiscountType = 'PERCENTAGE' | 'FIXED_PRICE' | 'FIXED_AMOUNT_OFF';
export type TargetType = 'PRODUCT' | 'CATEGORY' | 'GLOBAL' | 'COMBO_SET';

export interface PromotionRule {
    id: number;
    name: string;
    type: PromoType;
    start_date?: string;
    end_date?: string;
    days_of_week?: number[];
    start_time?: string;
    end_time?: string;
    discount_type: DiscountType;
    discount_value: number;
    target_type: TargetType;
    target_ids?: number[];
    trigger_quantity?: number;
    combo_items?: { categoryId?: number; productId?: number; qty: number }[];
    isActive: boolean;
    priority: number;
}

export enum PromotionType {
    Quantity = 'Por Cantidad',
}

export interface Promotion {
    type: PromotionType;
    requiredQuantity: number;
    promoPrice: number;
    activeDays?: number[]; // 0=Domingo, 1=Lunes, etc.
}

export interface Branch {
    id: number;
    name: string;
    isActive: boolean;
    autoCloseTime?: string; // HH:mm
    autoCloseEnabled?: boolean;
    address?: string;
    phone?: string;
    gasWebhookUrl?: string; // Webhook specific to this branch for email sending
    geminiApiKey?: string; // AI Key
    ticketWidth?: '58mm' | '80mm';
    logoUrl?: string;
    closingWebhookUrl?: string;
    closingEmail?: string;
}

export interface User {
    id: number;
    username: string;
    role: UserRole;
    allRoles: UserRole[]; // For multi-role support
    currentRole: UserRole;
}

export interface Waiter {
    id: number;
    name: string;
    username?: string;
    pin: string; // Acceso rápido por PIN de 6 dígitos
    isActive: boolean;
    roles: UserRole[];
    branchId?: number;
}

export interface Table {
    id: number;
    name: string;
    branchId: number; // Linked to a specific branch
}

export interface Meat {
    id: number;
    name: string;
    type?: 'meat' | 'masa';
    isActive?: boolean;
}

export interface Category {
    id: number;
    name: string;
    isActive?: boolean;
    sort_order?: number;
}

export interface ProductExtra {
    id: number;
    name: string;
    price: number;
    isActive?: boolean;
    categoryId?: number;
    requiresMeat?: boolean;
}

export interface Product {
    id: number;
    name: string;
    imageUrl?: string;
    description?: string;
    price: number;
    cost?: number;
    categoryId: number;
    requiresMeat: boolean;
    requiresMasa?: boolean;
    availableExtraIds?: number[];
    promotion?: Promotion;
    isActive: boolean;
    showInKds?: boolean;
    isCombo?: boolean;
    comboDefinition?: {
        type: 'fixed' | 'dynamic';
        items?: { productId: number; quantity: number }[]; // Para combos fijos
        slots?: {
            categoryId?: number;
            productIds?: number[];
            quantity: number;
            title?: string;
        }[]; // Para combos dinámicos
    };
}

export interface OrderItem {
    id: string;
    product: Product;
    quantity: number;
    meat?: Meat;
    masa?: Meat;
    extras?: ProductExtra[];
    comboSelections?: { productId: number; productName: string; quantity: number; meat?: Meat; masa?: Meat; meatName?: string; masaName?: string }[];
    total: number;
    observations?: string;
    completed?: boolean; // New field for KDS item checking
}

export interface Address {
    id: string;
    customerId?: number; // Added to link back to customer
    street: string;
    city: string;
    details?: string;
    latitude?: number;
    longitude?: number;
}

export interface Customer {
    id: number;
    name: string;
    phone: string;
    email?: string; // Added email field
    birthDate?: string; // YYYY-MM-DD
    addresses: Address[];
}

export interface OrderDetails {
    type: OrderType;
    waiter?: Waiter;
    table?: Table;
    customer?: Customer;
    deliveryAddress?: Address;
    initialItems?: OrderItem[]; // Payload for AI Parser from Start Screen
}

export interface Payment {
    method: PaymentMethod;
    amount: number;
    receivedBy?: string; // Username of who processed the payment
    excessAmount?: number; // Para otros negocios (Transfer excedente o Transfer Otros)
}

export type KitchenStatus = 'pending' | 'in_process' | 'ready' | 'served';

export interface Order extends OrderDetails {
    id: string;
    branchId: number; // Linked to a specific branch
    dailyOrderNumber: number;
    items: OrderItem[];
    subtotal: number;
    tax: number;
    discount: number;
    manualDiscount?: number;
    deliveryFee?: number;
    total: number;
    createdAt: Date;
    completedAt?: Date;
    readyAt?: Date; // Hora en que cocina marcó como listo
    status: 'active' | 'completed';
    kitchenStatus?: KitchenStatus;
    chef?: string; // New field to assign a cook
    payments: Payment[];
    amountPaid: number;
    changeGiven: number;
    createdByUserId?: number;
    deliveryDriverId?: number;
    deliveryStatus?: 'pending' | 'assigned' | 'delivered';
    deliveryAddressId?: string;
}

export interface CashClosingReport {
    date: string; // YYYY-MM-DD
    branchId: number; // Linked to a specific branch
    createdAt: Date;
    initialCash: number;
    summary: { method: PaymentMethod; total: number }[];
    totalSales: number;
    totalCashIn: number;
    totalChangeOut: number;
    expectedCash: number;
    totalOrders?: number; // New field for order count
}

export interface CompanySettings {
    name: string;
    address: string;
    phone: string;
    logoUrl?: string; // URL or Base64
    gasWebhookUrl?: string; // Google Apps Script Webhook URL for emails
    geminiApiKey?: string; // Google Gemini API Key
    paymentDueDate?: string; // Día de pago (1-31)
    paymentPending?: boolean; // true = pendiente (SI), false = pagada (NO)
    paymentGraceDays?: number; // Días de gracia antes de bloquear (default 3)
}
