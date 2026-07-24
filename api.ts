import io from 'socket.io-client';
import { Order, OrderDetails, User, Customer, CashClosingReport } from './types';

const API_URL = import.meta.env.VITE_API_URL || '/api'; // Changed from localhost to relative for production safety
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || ''; // Relative for socket too usually works if same origin

export const socket = io(SOCKET_URL);

export const api = {
    async login(pin: string) {
        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin })
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Login failed: ${res.status} ${text}`);
            }
            return res.json();
        } catch (e: any) {
            throw new Error(e.message || 'Network Error during Login');
        }
    },

    async getInitialData() {
        const res = await fetch(`${API_URL}/initial-data`);
        if (!res.ok) throw new Error('Failed to fetch data');
        return res.json();
    },


    async getOrders(branchId?: number, status?: string) {
        const params = new URLSearchParams();
        if (branchId) params.append('branchId', branchId.toString());
        if (status) params.append('status', status);
        const res = await fetch(`${API_URL}/orders?${params}`);
        return res.json();
    },

    async getHistory(filters: { startDate?: string, endDate?: string, search?: string, limit?: number, offset?: number, branchId?: number }) {
        const params = new URLSearchParams();
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.search) params.append('search', filters.search);
        if (filters.limit) params.append('limit', filters.limit.toString());
        if (filters.offset) params.append('offset', filters.offset.toString());
        if (filters.branchId) params.append('branchId', filters.branchId.toString());

        const res = await fetch(`${API_URL}/orders/history?${params}`);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Error ${res.status}: ${text}`);
        }
        return res.json();
    },

    async getDeliveryHistory(filters: { startDate?: string, endDate?: string, branchId?: number }) {
        const params = new URLSearchParams();
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.branchId) params.append('branchId', filters.branchId.toString());

        const res = await fetch(`${API_URL}/delivery/history?${params}`);
        return res.json();
    },

    async createOrder(order: Order) {
        const res = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order)
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.sqlMessage || errData.error || 'Failed to create order');
        }
        return res.json();
    },

    async updateOrder(id: string, updates: Partial<Order>) {
        const res = await fetch(`${API_URL}/orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to update order: ${text}`);
        }
        return res.json();
    },

    async saveCashClosing(report: CashClosingReport) {
        const res = await fetch(`${API_URL}/cash-closing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(report)
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to save cash closing: ${text}`);
        }
        return res.json();
    },

    async deleteOrder(id: string, userId?: number, reason?: string) {
        const res = await fetch(`${API_URL}/orders/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, reason })
        });
        if (!res.ok) throw new Error('Failed to delete order');
        return res.json();
    },


    async createCustomer(customer: Partial<Customer>) {
        const res = await fetch(`${API_URL}/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customer)
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Failed to create customer: ${txt}`);
        }
        return res.json();
    },

    async updateCustomer(id: number, data: Partial<Customer>) {
        const res = await fetch(`${API_URL}/customers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Failed to update customer: ${txt}`);
        }
        return res.json();
    },

    async saveGPSAddress(customerId: number, latitude: number, longitude: number, addressId?: string) {
        const res = await fetch(`${API_URL}/customers/${customerId}/gps_address`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude, longitude, addressId })
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Failed to save GPS address: ${txt}`);
        }
        return res.json();
    },

    async notifyDelivery(orderId: string) {
        const res = await fetch(`${API_URL}/orders/${orderId}/notify_delivery`, {
            method: 'POST'
        });
        return res.json();
    },

    async auditItemDeletion(data: { orderId: string; branchId: number; userId?: number; itemData: any; reason?: string }) {
        return this.post('/audit/item-deletion', data);
    },

    async getChefPerformance(filters: { startDate?: string, endDate?: string, branchId?: number }) {
        const params = new URLSearchParams();
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.branchId) params.append('branchId', filters.branchId.toString());
        return this.get(`/reports/chef-performance?${params}`);
    },

    async deleteCustomer(id: number) {
        return this._delete(`/customers/${id}`);
    },

    async searchCustomers(query: string) {
        const res = await fetch(`${API_URL}/customers?search=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error('Search failed');
        return res.json();
    },

    // --- GENERIC CRUD HELPERS (Typed) ---
    async createBranch(data: any) { return this._post('/branches', data); },
    async updateBranch(id: number, data: any) { return this._put(`/branches/${id}`, data); },
    async deleteBranch(id: number) { return this._delete(`/branches/${id}`); },

    async createTable(data: any) { return this._post('/tables', data); },
    async updateTable(id: number, data: any) { return this._put(`/tables/${id}`, data); },
    async deleteTable(id: number) { return this._delete(`/tables/${id}`); },

    async createUser(data: any) { return this._post('/users', data); },
    async updateUser(id: number, data: any) { return this._put(`/users/${id}`, data); },
    async deleteUser(id: number) { return this._delete(`/users/${id}`); },

    async createCategory(data: any) { return this._post('/categories', data); },
    async updateCategory(id: number, data: any) { return this._put(`/categories/${id}`, data); },
    async deleteCategory(id: number) { return this._delete(`/categories/${id}`); },

    async createMeat(data: any) { return this._post('/meats', data); },
    async updateMeat(id: number, data: any) { return this._put(`/meats/${id}`, data); },
    async deleteMeat(id: number) { return this._delete(`/meats/${id}`); },

    async createProductExtra(data: any) { return this._post('/product_extras', data); },
    async updateProductExtra(id: number, data: any) { return this._put(`/product_extras/${id}`, data); },
    async deleteProductExtra(id: number) { return this._delete(`/product_extras/${id}`); },

    async createProduct(data: any) { return this._post('/products', data); },
    async updateProduct(id: number, data: any) { return this._put(`/products/${id}`, data); },
    async deleteProduct(id: number) { return this._delete(`/products/${id}`); },

    async createPromotion(data: any) { return this._post('/promotions', data); },
    async updatePromotion(id: number, data: any) { return this._post('/promotions', { ...data, id }); },
    async deletePromotion(id: number) { return this._delete(`/promotions/${id}`); },

    async aiParseOrder(text: string, branchId: number) { return this._post('/ai/parse-order', { text, branchId }); },

    async getSettings() { return this.get('/settings'); },
    async getProductPopularity() { return this.get('/product-popularity'); },
    async updateSettings(settings: Record<string, any>) { return this.post('/settings', settings); },

    async getAuditLogs(filters?: { startDate?: string, endDate?: string, type?: 'orders' | 'items' }) {
        const params = new URLSearchParams();
        if (filters?.startDate) params.append('startDate', filters.startDate);
        if (filters?.endDate) params.append('endDate', filters.endDate);
        if (filters?.type) params.append('type', filters.type);
        return this.get(`/audit-logs?${params}`);
    },

    async checkOrdersRange(startDate: string, endDate: string, userId: number) {
        return this.post('/admin/check-orders-range', { startDate, endDate, userId });
    },

    async backupDatabase(pin: string, userId: number) {
        const res = await fetch(`${API_URL}/admin/backup-database`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin, userId })
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Backup failed: ${txt}`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const disposition = res.headers.get('content-disposition') || '';
        const match = disposition.match(/filename="?(.+?)"?$/);
        a.download = match ? match[1] : `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    },

    async clearData(type: 'SALES' | 'PRODUCTS' | 'ALL', pin: string, userId: number, startDate?: string, endDate?: string) {
        return this.post('/admin/clear-data', { type, pin, userId, startDate, endDate });
    },

    // Helpers
    async get(url: string) {
        const res = await fetch(`${API_URL}${url}`);
        if (!res.ok) throw new Error(`GET ${url} failed`);
        return res.json();
    },

    async post(url: string, data: any) {
        const res = await fetch(`${API_URL}${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`POST ${url} failed: ${txt}`);
        }
        return res.json();
    },

    // Alias for backward compatibility if needed, or just use post
    async _post(url: string, data: any) {
        return this.post(url, data);
    },

    async _put(url: string, data: any) {
        const res = await fetch(`${API_URL}${url}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`PUT ${url} failed`);
        return res.json();
    },

    async _delete(url: string) {
        const res = await fetch(`${API_URL}${url}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`DELETE ${url} failed`);
        return res.json();
    },
};
