
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Order, OrderItem, OrderDetails, Waiter, Table, Meat, Category, ProductExtra, Product, Customer, UserRole, Payment, PaymentMethod, PromotionType, CashClosingReport, KitchenStatus, OrderType, CompanySettings, Branch, User, PromotionRule } from './types';
import { INITIAL_COMPANY_SETTINGS, INITIAL_BRANCHES } from './constants';
import { api, socket } from './api';
import { calculatePromotions } from './utils/promotionEngine';
import { Toaster, toast } from 'react-hot-toast';
import StartScreen from './components/StartScreen';
import OrderScreen from './components/OrderScreen';
import CompletedOrdersScreen from './components/CompletedOrdersScreen';
import ActiveOrdersMobileScreen from './components/ActiveOrdersMobileScreen';
import LoginScreen from './components/LoginScreen';
import AdminPanel from './components/AdminPanel';
import Header from './components/Header';
import KdsScreen from './components/KdsScreen';
import CashClosingScreen from './components/CashClosingScreen';
import MasterSettingsScreen from './components/MasterSettingsScreen';
import DeliveryDashboard from './components/DeliveryDashboard';
import ManageCustomersScreen from './components/ManageCustomersScreen';
import { FeedbackScreen } from './components/FeedbackScreen';
import CustomerPortal from './components/CustomerPortal';
import BranchSelectionScreen from './components/BranchSelectionScreen';
import NotificationToast, { ToastType } from './components/NotificationToast';
import ExitConfirmationModal from './components/ExitConfirmationModal';
import { usePushNotifications } from './hooks/usePushNotifications';
import CashOpeningModal from './components/CashOpeningModal';
import { initAppVersionSync, checkAndApplyUpdate } from './lib/appUpdate';

interface LoggedInUserState {
    id: number;
    username: string;
    currentRole: UserRole;
    allRoles: UserRole[];
}

// --- TYPES ---
type CurrentView = 'start' | 'order' | 'completed' | 'active_orders_mobile' | 'admin' | 'kds' | 'master_settings' | 'manage_customers' | 'select_branch' | 'feedback' | 'delivery' | 'menu';

// usePersistentState removed in favor of API

const App: React.FC = () => {
    const [loggedInUser, setLoggedInUser] = useState<LoggedInUserState | null>(null);
    const [loginName, setLoginName] = useState<string | null>(null);
    const [loginErrorCount, setLoginErrorCount] = useState(0);
    const [currentView, setCurrentView] = useState<CurrentView>(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('view') === 'feedback') return 'feedback';
        if (params.get('view') === 'menu') {
            window.history.replaceState(null, '', '/');
            return 'menu';
        }

        const savedView = localStorage.getItem('currentView');

        const path = window.location.pathname.replace('/', '');
        if (path === 'menu' || path === 'portal') {
            window.history.replaceState(null, '', '/');
            return 'menu';
        }

        if (savedView && savedView !== 'start' && savedView !== 'menu') return savedView as CurrentView;

        const validViews: CurrentView[] = ['start', 'order', 'completed', 'active_orders_mobile', 'admin', 'kds', 'master_settings', 'manage_customers', 'select_branch', 'feedback', 'delivery', 'menu'];
        if (validViews.includes(path as CurrentView)) return path as CurrentView;

        return 'start';
    });

    const hydrateOrder = (o: any): Order => {
        return {
            ...o,
            id: String(o.id),
            branchId: o.branchId || o.branch_id || 1,
            dailyOrderNumber: o.dailyOrderNumber || o.daily_order_number || 0,
            createdByUserId: o.createdByUserId || (o as any).created_by_user_id,
            createdAt: (o.createdAt instanceof Date) ? o.createdAt : new Date(o.createdAt || o.created_at || Date.now()),
            completedAt: (o.completedAt || o.completed_at) ? ((o.completedAt instanceof Date) ? o.completedAt : new Date(o.completedAt || o.completed_at)) : undefined,
            readyAt: (o.readyAt || o.ready_at) ? ((o.readyAt instanceof Date) ? o.readyAt : new Date(o.readyAt || o.ready_at)) : undefined,
            items: Array.isArray(o.items) ? o.items : []
        };
    };

    const [startScreenKey, setStartScreenKey] = useState(0);
    const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
    const [notificationTitle, setNotificationTitle] = useState<string | null>(null);
    const [notificationType, setNotificationType] = useState<ToastType | undefined>('success');
    const [notificationPosition, setNotificationPosition] = useState<'top' | 'bottom' | 'center'>('bottom');
    const [notificationPersistent, setNotificationPersistent] = useState(false);
    const [notificationAction, setNotificationAction] = useState<{ label: string; onClick: () => void } | null>(null);
    const [isConnected, setIsConnected] = useState(true);
    const connectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [duplicateWarning, setDuplicateWarning] = useState<Order | null>(null);
    const [pendingDuplicateDetails, setPendingDuplicateDetails] = useState<OrderDetails | null>(null);

    // Business States
    const [orders, setOrders] = useState<Order[]>([]);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [orderToEditId, setOrderToEditId] = useState<string | null>(null);
    const [showNewOrderWizard, setShowNewOrderWizard] = useState(false);

    const [waiters, setWaiters] = useState<Waiter[]>([]);
    const [tables, setTables] = useState<Table[]>([]);
    const [meats, setMeats] = useState<Meat[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [productExtras, setProductExtras] = useState<ProductExtra[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [cashClosingReports, setCashClosingReports] = useState<CashClosingReport[]>([]);
    const [showCashOpeningModal, setShowCashOpeningModal] = useState(false);
    const [lastCashReminderTime, setLastCashReminderTime] = useState<number>(0);
    const [isCashOpeningSilenced, setIsCashOpeningSilenced] = useState(false);
    const cashDataLoadedRef = useRef(false);
    const [companySettings, setCompanySettings] = useState<CompanySettings>(() => {
        const cached = localStorage.getItem('company_settings');
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                console.error("Failed to parse cached settings", e);
            }
        }
        return INITIAL_COMPANY_SETTINGS;
    });
    const [branches, setBranches] = useState<Branch[]>(INITIAL_BRANCHES);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [promotions, setPromotions] = useState<PromotionRule[]>([]);
    const [productPopularity, setProductPopularity] = useState<Record<number, number>>({});

    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const { requestPermission, unsubscribe } = usePushNotifications();

    useEffect(() => {
        const handler = (e: any) => {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile) {
                e.preventDefault();
                setDeferredPrompt(e);
            }
        };
        window.addEventListener('beforeinstallprompt', handler);

        // --- GLOBAL VERSION CHECK (On Mount) ---
        checkAndApplyUpdate(
            (msg, duration) => toast(msg, { duration })
        );

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    // --- VERSION SYNC (initAppVersionSync handles socket, visibility, and post-reload toast) ---
    useEffect(() => {
        if (!loggedInUser) return;
        return initAppVersionSync(
            (msg, duration) => toast(msg, { duration }),
            socket,
            { enabled: () => currentView !== 'order' }
        );
    }, [loggedInUser, currentView]);

    // Fallback periodic check every 5 minutes
    useEffect(() => {
        const interval = setInterval(() => {
            checkAndApplyUpdate(
                (msg, duration) => toast(msg, { duration }),
                { silent: true }
            );
        }, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // --- VISIBILITY CHANGE: also fetch data when app resumes ---
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                setTimeout(() => {
                    if (loggedInUser && !activeOrderId) {
                        fetchAllData(true);
                    }
                }, 1000);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [loggedInUser, activeOrderId]);

    // Persist currentView changes (except menu — no queremos guardar ni replicar la URL del portal)
    useEffect(() => {
        if (currentView) {
            if (currentView === 'menu') {
                window.history.replaceState(null, '', '/');
                return;
            }
            localStorage.setItem('currentView', currentView);
            window.history.replaceState(null, '', `/${currentView === 'start' ? '' : currentView}`);
        }
    }, [currentView]);

    // Fix for refresh issue: automatically redirect to start if in order view but no activeOrderId
    useEffect(() => {
        if (currentView === 'order' && !activeOrderId) {
            const timer = setTimeout(() => {
                if (currentView === 'order' && !activeOrderId) {
                    console.log('🔄 State mismatch detected after refresh. Redirecting to start...');
                    setCurrentView('start');
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [currentView, activeOrderId]);

    const handleInstallApp = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setDeferredPrompt(null);
    };



    const fetchAllData = async (silent = false, retryCount = 0) => {
        try {
            const data = await api.getInitialData();
            // setWaiters(data.waiters || INITIAL_WAITERS); // Waiters/Users managed via API/Login usually. 
            // If API returns waiters in data.waiters, we use that.
            if (data.waiters) setWaiters(data.waiters);

            if (data.branches) setBranches(data.branches);
            if (data.tables) setTables(data.tables);
            if (data.categories) setCategories(data.categories);
            if (data.meats) setMeats(data.meats);
            if (data.productExtras) setProductExtras(data.productExtras);
            if (data.products) setProducts(data.products);
            if (data.customers) setCustomers(data.customers);
            if (data.promotions) setPromotions(data.promotions);
            if (data.cashClosingReports) {
                setCashClosingReports(data.cashClosingReports || []);
                cashDataLoadedRef.current = true;
            }

            // Now fetch popularity in background to avoid blocking main data
            api.getProductPopularity()
                .then(popData => {
                    if (!popData) return;
                    // Robustness: if it arrives as an array (common mistake), map it here too
                    if (Array.isArray(popData)) {
                        const mapped = popData.reduce((acc: any, row: any) => {
                            acc[row.product_id] = Number(row.total_qty) || 0;
                            return acc;
                        }, {});
                        setProductPopularity(mapped);
                    } else {
                        setProductPopularity(popData);
                    }
                })
                .catch(e => console.error('Background popularity fetch failed', e));

            if (data.globalSettings) {
                setCompanySettings(prev => {
                    const newSettings = {
                        ...prev,
                        name: data.globalSettings.global_store_name || prev.name,
                        logoUrl: data.globalSettings.global_logo_url || prev.logoUrl,
                        gasWebhookUrl: data.globalSettings.gas_webhook_url || prev.gasWebhookUrl,
                        geminiApiKey: data.globalSettings.gemini_api_key || prev.geminiApiKey,
                        paymentDueDate: data.globalSettings.payment_due_date || prev.paymentDueDate,
                        paymentPending: data.globalSettings.payment_pending === '1' || false,
                        paymentGraceDays: parseInt(data.globalSettings.payment_grace_days) ?? prev.paymentGraceDays ?? 3,
                    };
                    localStorage.setItem('company_settings', JSON.stringify(newSettings));
                    return newSettings;
                });
            }

            // Fetch Orders (Active + Recent Completed)
            const activeOrdersRaw = await api.getOrders(undefined, 'active');
            const completedOrdersRaw = await api.getOrders(undefined, 'completed');

            const allRawOrders = [...activeOrdersRaw, ...completedOrdersRaw];

            const hydratedOrders = allRawOrders.map((o: any) => {
                const waiter = (data.waiters || []).find((u: any) => String(u.id) === String(o.waiter_id || o.waiterId));
                const table = (data.tables || []).find((t: any) => String(t.id) === String(o.table_id || o.tableId));

                return {
                    ...o,
                    id: String(o.id), // Ensure ID is string to match activeOrderId type
                    branchId: o.branch_id || o.branchId || 1,
                    dailyOrderNumber: o.daily_order_number || o.dailyOrderNumber,
                    createdByUserId: o.created_by_user_id || o.createdByUserId,
                    createdAt: new Date(o.created_at || o.createdAt),
                    completedAt: (o.completed_at || o.completedAt) ? new Date(o.completed_at || o.completedAt) : undefined,
                    readyAt: (o.ready_at || o.readyAt) ? new Date(o.ready_at || o.readyAt) : undefined,
                    status: o.status,
                    type: o.type,
                    waiter: waiter || o.waiter, // Hydrate waiter from ID if possible
                    table: table || o.table,
                    items: Array.isArray(o.items) ? o.items.map((i: any) => {
                        const product = (data.products || []).find((p: any) => p.id === (i.product_id || i.productId));
                        const meat = (i.meat_id || i.meatId) ? (data.meats || []).find((m: any) => m.id === (i.meat_id || i.meatId)) : undefined;
                        const masa = (i.masa_id || i.masaId) ? (data.meats || []).find((m: any) => m.id === (i.masa_id || i.masaId)) : undefined;
                        const extras = Array.isArray(i.extras) ? i.extras.map((e: any) => (data.productExtras || []).find((pe: any) => pe.id === e.id)).filter(Boolean) : [];

                        return {
                            ...i,
                            productId: i.product_id || i.productId,
                            product: product || { id: i.product_id || i.productId, name: 'Unknown Product', price: 0 },
                            meat,
                            masa,
                            meatId: i.meat_id || i.meatId,
                            masaId: i.masa_id || i.masaId,
                            extras
                        };
                    }) : []
                };
            });

            // Deduplicate
            const uniqueOrders = Array.from(new Map(hydratedOrders.map((o: any) => [o.id, o])).values());
            setOrders(uniqueOrders as Order[]);

            // If there was a pending reload notification, auto-dismiss on successful sync
            if (notificationAction) {
                setNotificationMessage(null);
                setNotificationPersistent(false);
                setNotificationAction(null);
            }

        } catch (error: any) {
            console.error("Data sync error:", error);

            // RETRY LOGIC (Backoff) — reintenta cualquier error 3 veces antes de actuar
            if (retryCount < 3) {
                const delay = (retryCount + 1) * 3000; // 3s, 6s, 9s
                console.warn(`⚠️ Sync error. Retrying in ${delay}ms... (Attempt ${retryCount + 1}/3)`);
                setTimeout(() => fetchAllData(silent, retryCount + 1), delay);
                return;
            }

            // After 3 failed retries, check for asset errors
            const errorMsg = String(error.message || '');
            const isAssetError = errorMsg.includes('Failed to fetch dynamically imported module') ||
                errorMsg.includes('Load chunk failed') ||
                errorMsg.includes('Unexpected token') ||
                errorMsg.includes('is not a valid JSON');

            if (isAssetError) {
                console.log('🔄 Asset Loading Error detected (likely new version). Notifying user...');
                if (!silent) {
                    setNotificationTitle('⚠️ ERROR DE CARGA');
                    setNotificationType('warning');
                    setNotificationPersistent(true);
                    setNotificationMessage('La app necesita actualizarse. Presione RECARGAR para aplicar los cambios.');
                    setNotificationAction({ label: 'RECARGAR', onClick: () => { window.location.reload(); } });
                }
                return;
            }

            if (silent) {
                console.warn("Silent sync failed. Ignoring.");
                return;
            }

            toast.error(`ERROR DE CONEXIÓN: El servidor se está reiniciando, espera unos segundos...`, { duration: 5000, icon: '🔌' });
        }
    };

    // HEARTBEAT: Periodic background refresh to ensure sync if socket fails
    useEffect(() => {
        const heartbeat = setInterval(() => {
            if (loggedInUser && (currentView === 'kds' || currentView === 'delivery' || currentView === 'admin' || currentView === 'start')) {
                console.log(`💓 Heartbeat [${currentView}]: Syncing data...`);
                fetchAllData();
            }
        }, 60000); // 1 minute pulse

        return () => clearInterval(heartbeat);
    }, [currentView, activeOrderId, loggedInUser]);




    // Initial Data Fetch & Session Restore
    const userRef = useRef<User | null>(null);
    const activeOrderIdRef = useRef<string | null>(null);
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Debounce ref for order saves
    const isCreatingOrderRef = useRef(false); // Guard anti-doble click en creación de órdenes

    useEffect(() => {
        userRef.current = loggedInUser;
        if (loggedInUser?.id) {
            console.log('[PUSH] Usuario detectado, verificando notificaciones...');
            requestPermission(loggedInUser.id);
        }
    }, [loggedInUser]);

    useEffect(() => {
        activeOrderIdRef.current = activeOrderId;
    }, [activeOrderId]);

    // GLOBAL NEW ORDER LISTENER (For Delivery Alerts)
    useEffect(() => {
        const handleNewOrderGlobal = (newOrder: Order) => {
            if (newOrder.type === OrderType.Delivery) {
                const currentUser = userRef.current;
                const userRole = (currentUser?.role || '').toLowerCase();
                const userRoles = (currentUser?.roles || []).map(r => r.toLowerCase());
                const isDelivery = currentUser && (
                    userRole === 'repartidor' ||
                    userRole === 'delivery' ||
                    userRoles.includes('repartidor') ||
                    userRoles.includes('delivery') ||
                    currentUser.role === UserRole.Delivery
                );

                // DIAGNOSTIC TOAST (REMOVE AFTER FIX)
                /*
                toast(`Evt: NewOrder | Role: ${userRef.current?.role}`, { 
                   duration: 4000, 
                   icon: '🐛',
                   style: { background: '#333', color: '#fff', fontSize: '10px' }
                });
                */
                // Wait... if I uncomment this, every waiter sees it. 
                // Better to show it ONLY if type is Delivery (which it is L182).

                if (isDelivery) {
                    console.log('⚡ Delivery Alert Triggered for Order', newOrder.dailyOrderNumber);
                    // Audio Feedback
                    const audio = new Audio('/sounds/bell.mp3');
                    audio.play().catch(e => console.error("Audio play failed", e));

                    setTimeout(() => {
                        const orderNum = String(newOrder.dailyOrderNumber || '???').padStart(3, '0');
                        setNotificationPersistent(true);
                        setNotificationTitle(`⚡ ¡NUEVO PEDIDO!`);
                        setNotificationType('info');
                        setNotificationMessage(`ORDEN #${orderNum} DISPONIBLE PARA TOMAR`);
                        // Vibration handled by NotificationToast
                    }, 50);
                }
            }
        };

        socket.on('new_order', handleNewOrderGlobal);
        socket.on('catalog_updated', fetchAllData);

        return () => {
            socket.off('new_order', handleNewOrderGlobal);
            socket.off('catalog_updated', fetchAllData);
        };
    }, []);

    useEffect(() => {
        // CHECK URL FOR FEEDBACK MODE
        const params = new URLSearchParams(window.location.search);
        if (params.get('view') === 'feedback') {
            setCurrentView('feedback');
            return; // Skip session restore
        }

        checkAndApplyUpdate(
            (msg, duration) => toast(msg, { duration })
        );
        fetchAllData();

        // Restore Session
        const savedUser = localStorage.getItem('restauranteos_user');
        const savedBranchId = localStorage.getItem('restauranteos_branch_id');

        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                setLoggedInUser(user);
                userRef.current = user; // Set ref immediately for initial load

                if (savedBranchId) {
                    const branchId = parseInt(savedBranchId);
                    setSelectedBranchId(branchId);
                    if ([UserRole.SuperAdmin, UserRole.Admin].includes(user.currentRole)) setCurrentView('admin');
                    else if (user.currentRole === UserRole.Cook) setCurrentView('kds');
                    else if (user.currentRole === UserRole.Delivery) setCurrentView('delivery');
                    else setCurrentView('start');
                } else if (user.currentRole === UserRole.SuperAdmin) {
                    setCurrentView('select_branch');
                }
            } catch (e) {
                console.error("Failed to restore session", e);
                localStorage.removeItem('restauranteos_user');
                localStorage.removeItem('restauranteos_branch_id');
            }
        }

        // Socket Listeners
        socket.on('connect', () => {
            console.log('SOCKET CONNECTED:', socket.id);
            if (connectionTimerRef.current) {
                clearTimeout(connectionTimerRef.current);
                connectionTimerRef.current = null;
            }
            setIsConnected(true);
            // Refrescar datos al reconectar para capturar eventos perdidos
            if (loggedInUser) {
                console.log('🔄 Refreshing data after socket reconnection...');
                fetchAllData(true);
            }
        });

        socket.on('disconnect', () => {
            console.log('SOCKET DISCONNECTED');
            setIsConnected(false);
        });

        if (!socket.connected) {
            setIsConnected(false);
        }

        socket.on('new_order', (order: Order) => {
            console.log('⚡ SOCKET EVENT: new_order', order.id, order.type);

            // NOTIFICATION FOR DELIVERY DRIVERS
            if (order.type === OrderType.Delivery) {
                const currentUser = userRef.current;
                const userRole = (currentUser?.role || '').toLowerCase();
                const userRoles = (currentUser?.roles || []).map(r => r.toLowerCase());

                const isDelivery = currentUser && (
                    userRole === 'repartidor' ||
                    userRole === 'delivery' ||
                    userRoles.includes('repartidor') ||
                    userRoles.includes('delivery') ||
                    currentUser.role === UserRole.Delivery
                );

                if (isDelivery) {
                    console.log('🔔 TRIGGERING DELIVERY ALERT for New Order', order.dailyOrderNumber);
                    setTimeout(() => {
                        const orderNum = String(order.dailyOrderNumber || '???').padStart(3, '0');
                        setNotificationPersistent(true);
                        setNotificationTitle(`🔔 ¡NUEVO PEDIDO!`);
                        setNotificationType('info');
                        setNotificationMessage(`ORDEN #${orderNum} PARA REPARTO`);
                    }, 50);
                }
            }

            setOrders(prev => {
                if (prev.find(o => String(o.id) === String(order.id))) return prev;
                // Hydrate the new order partially if needed, or assume it's fresh
                const hydrated = {
                    ...order,
                    id: String(order.id), // Enforce string
                    createdByUserId: order.createdByUserId || (order as any).created_by_user_id,
                    createdAt: new Date(order.createdAt),
                    completedAt: order.completedAt ? new Date(order.completedAt) : undefined,
                    readyAt: order.readyAt ? new Date(order.readyAt) : undefined
                };
                return [hydrated, ...prev]; // Add to top
            });
        });

        socket.on('order_updated', (updatedOrder: Order) => {
            console.log('🔥 SOCKET EVENT: order_updated', updatedOrder.id, updatedOrder.kitchenStatus);



            setOrders(prev => {
                const existingOrder = prev.find(o => String(o.id) === String(updatedOrder.id));

                // NOTIFICATION LOGIC: Check if order became ready
                // We use relaxed ID checking and ensure waiter ID matches
                if (existingOrder &&
                    updatedOrder.kitchenStatus === 'ready' &&
                    existingOrder.kitchenStatus !== 'ready'
                ) {
                    const currentUser = userRef.current;
                    const waiterId = existingOrder.waiter?.id || (existingOrder as any).waiter_id || (existingOrder as any).waiterId;
                    const creatorId = existingOrder.createdByUserId || (existingOrder as any).created_by_user_id;

                    // NOTIFY if I am the Assigned Waiter OR if I am the Creator
                    const isMyOrder = currentUser && (
                        String(waiterId) === String(currentUser.id) ||
                        String(creatorId) === String(currentUser.id)
                    );

                    const shouldNotify = isMyOrder;

                    if (shouldNotify) {
                        // FIX: Move side-effects out of setOrders callback
                        setTimeout(() => {
                            let messageText = '';
                            const orderNum = String(existingOrder.dailyOrderNumber || '???').padStart(3, '0');
                            const tableName = existingOrder.table?.name || 'MESA ?';
                            const customerName = (existingOrder.customer?.name || '').split(' ')[0].toUpperCase();

                            if (existingOrder.type === OrderType.Local) {
                                messageText = `ORDEN #${orderNum} (${tableName}), LISTA PARA SERVIR`;
                            } else {
                                const guestInfo = customerName ? `- ${customerName}` : '';
                                messageText = `ORDEN #${orderNum} ${guestInfo}, LISTA PARA EMPACAR`;
                            }

                            const displayName = (currentUser?.username || 'USUARIO').split(' ')[0].toUpperCase();
                            setNotificationPersistent(true);
                            setNotificationPosition('center'); // MOD: Center to be more visible
                            setNotificationTitle(`👋 ¡ATENCIÓN ${displayName}!`);
                            setNotificationType('warning'); // MOD: Orange (Amber)
                            setNotificationMessage(messageText);
                        }, 50);
                    }
                }

                // DELIVERY ALERT LOGIC (Global for Drivers)
                // If I am a Delivery Driver and a Delivery Order becomes READY
                if (existingOrder &&
                    updatedOrder.type === OrderType.Delivery &&
                    updatedOrder.kitchenStatus === 'ready' &&
                    existingOrder.kitchenStatus !== 'ready'
                ) {
                    const currentUser = userRef.current;
                    // Check strict role directly from user object (safer than currentRole state variable which might be stale in closure)
                    const userRole = (currentUser?.role || '').toLowerCase();
                    const userRoles = (currentUser?.roles || []).map(r => r.toLowerCase());
                    const isDelivery = currentUser && (
                        userRole === 'repartidor' ||
                        userRole === 'delivery' ||
                        userRoles.includes('repartidor') ||
                        userRoles.includes('delivery') ||
                        currentUser.role === UserRole.Delivery
                    );

                    if (isDelivery) {
                        console.log('⚡ DELIVERY READY ALERT (Update)', updatedOrder.dailyOrderNumber);

                        // DEBUG TOAST FOR UPDATES
                        toast(`DEBUG UPDATE: Ready #${updatedOrder.dailyOrderNumber}`, { icon: '🔔', duration: 4000 });

                        setTimeout(() => {
                            const orderNum = String(updatedOrder.dailyOrderNumber || '???').padStart(3, '0');
                            setNotificationPersistent(true);
                            setNotificationTitle(`🔔 ¡NUEVO PEDIDO!`);
                            setNotificationType('success');
                            setNotificationMessage(`ORDEN #${orderNum} LISTA PARA RECOGER`);
                            // Vibration is handled by NotificationToast
                        }, 50);
                    }
                }

                // STOP ALERT when Taken (Assigned to ANYONE)
                if (existingOrder &&
                    updatedOrder.deliveryStatus === 'assigned'
                ) {
                    // Stop any ongoing notification for this order
                    setNotificationPersistent(false);
                    setNotificationMessage(null);
                }

                // DELIVERY NOTIFICATION LOGIC (For Admin/Cashier when Delivered)
                if (existingOrder &&
                    updatedOrder.deliveryStatus === 'delivered' &&
                    existingOrder.deliveryStatus !== 'delivered'
                ) {
                    const currentUser = userRef.current;
                    // Notify Admin / Cashier / SuperAdmin
                    if (currentUser && [UserRole.Admin, UserRole.SuperAdmin, UserRole.Cashier].includes(currentUser.currentRole)) {
                        setTimeout(() => {
                            const orderNum = String(existingOrder.dailyOrderNumber || '???').padStart(3, '0');
                            setNotificationPersistent(true);
                            setNotificationTitle(`🛵 ¡PEDIDO ENTREGADO!`);
                            setNotificationType('success');
                            setNotificationMessage(`ORDEN #${orderNum} HA SIDO ENTREGADA. PENDIENTE DE COBRO.`);
                        }, 50);
                    }
                }

                // MERGE AND HYDRATE (ROBUST)
                // 1. Convert any date strings in updatedOrder to Date objects
                const incomingHydrated = hydrateOrder(updatedOrder);
                
                // 2. Map existing orders and merge
                return prev.map(o => {
                    if (String(o.id) !== String(updatedOrder.id)) return o;
                    
                    const hasNewItems = Array.isArray(updatedOrder.items) && updatedOrder.items.length > 0;
                    const itemsToKeep = hasNewItems ? updatedOrder.items : o.items;
                    const totalToKeep = hasNewItems ? updatedOrder.total : o.total;

                    return {
                        ...o,
                        ...incomingHydrated,
                        id: String(o.id),
                        items: itemsToKeep,
                        total: totalToKeep,
                        createdAt: o.createdAt, // Never overwrite createdAt as it breaks KDS
                        // Preserve relational objects if incoming doesn't have them (server broadcast omits table/customer/waiter)
                        table: incomingHydrated.table || o.table,
                        customer: incomingHydrated.customer || o.customer,
                        waiter: incomingHydrated.waiter || o.waiter,
                    };
                });
            });
        });

        socket.on('orders_updated', () => {
            console.log('Received global refresh signal (orders_updated)');
            fetchAllData();
        });

        socket.on('customers_updated', () => {
            console.log('Received customers refresh signal');
            fetchAllData();
        });

        // INSTANT UPDATE: Server triggers this after deploying new dist
        socket.on('force_reload', () => {
            console.log('🚀 force_reload received. Checking for new version...');
            checkAndApplyUpdate(
                (msg, duration) => toast(msg, { duration }),
                { delayMs: 500 }
            );
        });

        socket.on('delivery_notification', (data: any) => {
            console.log('⚡ Delivery Notification Received:', data);
            const currentUser = userRef.current;
            const userRole = (currentUser?.role || '').toLowerCase();
            const userRoles = (currentUser?.roles || []).map(r => r.toLowerCase());
            const isDelivery = currentUser && (
                userRole === 'repartidor' ||
                userRole === 'delivery' ||
                userRoles.includes('repartidor') ||
                userRoles.includes('delivery') ||
                currentUser.role === UserRole.Delivery
            );

            if (isDelivery) {
                const orderNum = String(data.dailyOrderNumber || '???').padStart(3, '0');
                setNotificationPersistent(true);
                setNotificationTitle(`🔔 ¡NUEVO PEDIDO!`);
                setNotificationType('success');
                setNotificationMessage(`ORDEN #${orderNum} LISTA PARA RECOGER`);

                // Play Sound
                const audio = new Audio('/sounds/bell.mp3');
                audio.play().catch(e => console.error("Audio play failed", e));
            }
        });

        socket.on('order_deleted', ({ id }: { id: string }) => {
            setOrders(prev => prev.filter(o => o.id !== id));
            if (activeOrderId === id) {
                setActiveOrderId(null);
                setCurrentView('start');
            }
        });

        socket.on('orders_cleared', () => {
            console.log('Received orders_cleared signal — refetching all data');
            fetchAllData();
        });

        socket.on('force_logout', (data: any) => {
            console.warn('⚠️ RECEIVING FORCE LOGOUT SIGNAL:', data);
            toast('Sesión finalizada por mantenimiento diario.', { icon: '🔄', duration: 5000 });
            handleLogout(); // This will clear session and reload the app
        });

        socket.on('data_updated', () => {
            console.log('Received data_updated signal — refetching all data');
            fetchAllData();
        });

        return () => {
            if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
            socket.off('connect');
            socket.off('disconnect');
            socket.off('new_order');
            socket.off('order_updated');
            socket.off('order_deleted');
            socket.off('orders_cleared');
            socket.off('orders_updated');
            socket.off('customers_updated');
            socket.off('data_updated');
            socket.off('delivery_notification');
            socket.off('force_logout');
        };
    }, []);

    // --- Cash Opening Periodic Check ---
    useEffect(() => {
        const checkCashOpening = () => {
            if (!loggedInUser || currentView === 'select_branch' || !cashDataLoadedRef.current) return;

            const isAdmin = loggedInUser.currentRole === UserRole.Admin || loggedInUser.currentRole === UserRole.SuperAdmin;
            if (!isAdmin) return;

            const branchId = selectedBranchId || (loggedInUser.allRoles.includes(UserRole.SuperAdmin) ? null : null);
            if (!branchId) return;

            const branchReports = cashClosingReports.filter(r => Number(r.branchId) === Number(branchId));
            const latestForBranch = [...branchReports]
                .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))[0];

            const todayStr = new Date().toLocaleDateString('en-CA');
            const openingExists = latestForBranch && latestForBranch.date === todayStr && latestForBranch.initialCash > 0;

            if (!openingExists && !isCashOpeningSilenced) {
                const now = Date.now();
                if (now - lastCashReminderTime > 300000) {
                    setShowCashOpeningModal(true);
                    setLastCashReminderTime(now);
                }
            } else {
                if (openingExists) {
                    setShowCashOpeningModal(false);
                }
            }
        };

        checkCashOpening();
        const interval = setInterval(checkCashOpening, 60000);
        return () => clearInterval(interval);
    }, [loggedInUser, cashClosingReports, selectedBranchId, lastCashReminderTime, isCashOpeningSilenced, currentView]);

    // Handle browser back button (Android native back)
    useEffect(() => {
        // Push current view and STATE to history when it changes
        const currentPath = `/${currentView}`;
        const state = { view: currentView, orderId: activeOrderId };

        // Avoid pushing duplicate states if we just popped
        if (JSON.stringify(window.history.state) !== JSON.stringify(state)) {
            // If we are going back to start from order, maybe we should replaceState to keep stack clean?
            // For now, let's just push to ensure history works as expected
            window.history.pushState(state, '', currentPath);
        }

        // Listen for back button
        const handlePopState = (event: PopStateEvent) => {
            // CRITICAL: If we are currently on START, DELIVERY, or KDS, any back action should trigger Exit Confirm
            if (['start', 'delivery', 'kds', 'admin'].includes(currentView)) {
                window.history.pushState({ view: currentView }, '', `/${currentView}`);
                setShowExitConfirm(true);
                return;
            }

            if (event.state) {
                if (event.state.view) {
                    if (event.state.view === 'order' && !event.state.orderId) {
                        // Corrupted state -> Start
                        setCurrentView('start');
                        window.history.replaceState({ view: 'start' }, '', '/start');
                    } else {
                        setCurrentView(event.state.view);
                        if (event.state.orderId) setActiveOrderId(event.state.orderId);
                    }
                } else {
                    setCurrentView('start');
                }
            } else {
                // No state (root) -> Start + Exit Confirm if likely at root
                setCurrentView('start');
                setShowExitConfirm(true);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [currentView, activeOrderId]);

    // Safety Guard: If we are in 'order' view but have no activeOrder, redirect to start
    // This catches cases where state update timing might be off or history is corrupted
    // Safety Guard: If directly landed on order without ID (not via popstate), prompt exit or redirect
    useEffect(() => {
        if (currentView === 'order' && !activeOrderId) {
            console.warn("Safety Redirect: Order view without ID -> Start + Confirm Exit");
            setCurrentView('start');
            window.history.replaceState({ view: 'start' }, '', '/start');
            // If this happens, it might be a weird state, let's offer exit just in case, but maybe just start is enough?
            // User requested: "if user in that screen [Start] presses back... show alert"
            // This guard handles the "Error" screen appearance.
            // Let's just go safely to Start. The back button logic above handles the "Press Back" action.
        }
    }, [currentView, activeOrderId]);

    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeWaiters = Array.isArray(waiters) ? waiters : [];
    const safeTables = Array.isArray(tables) ? tables : [];
    const safeBranches = Array.isArray(branches) ? branches : [];

    const currentBranch = useMemo(() => safeBranches.find(b => b.id === selectedBranchId) || null, [safeBranches, selectedBranchId]);

    const filteredOrders = useMemo(() => {
        if (!selectedBranchId) return [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return safeOrders.filter(o => {
            const isMyBranch = (o.branchId || 1) == selectedBranchId;
            const orderDate = new Date(o.createdAt);
            orderDate.setHours(0, 0, 0, 0);
            return isMyBranch && orderDate.getTime() === today.getTime();
        });
    }, [safeOrders, selectedBranchId]);

    const activeOrders = useMemo(() => filteredOrders.filter(o => o.status === 'active'), [filteredOrders]);
    const completedOrders = useMemo(() => filteredOrders.filter(o => o.status === 'completed'), [filteredOrders]);
    // Changed: activeOrder now searches in ALL filteredOrders (active + completed) allows viewing completed orders (e.g. for ticket modal)
    // Safety: Normalizing comparison to string to avoid blue screen crash
    const activeOrder = useMemo(() => filteredOrders.find(o => String(o.id) === String(activeOrderId)), [filteredOrders, activeOrderId]);
    const orderToEdit = useMemo(() => filteredOrders.find(o => String(o.id) === String(orderToEditId)), [filteredOrders, orderToEditId]);
    const filteredTables = useMemo(() => safeTables.filter(t => (t.branchId || 1) === selectedBranchId), [safeTables, selectedBranchId]);

    // Initial Data Fetch & Session Restore
    useEffect(() => {
        const loadData = async () => {
            // ... data fetching logic ...
        };
        loadData();

        // Restore Session
        const savedUser = localStorage.getItem('restauranteos_user');
        const savedBranchId = localStorage.getItem('restauranteos_branch_id');

        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                setLoggedInUser(user);

                // If branch was also saved, restore it
                if (savedBranchId) {
                    const branchId = parseInt(savedBranchId);
                    setSelectedBranchId(branchId);

                    const params = new URLSearchParams(window.location.search);
                    if (params.get('view') !== 'feedback') {
                        const savedView = localStorage.getItem('currentView');
                        if (savedView) {
                            setCurrentView(savedView as CurrentView);
                        } else {
                            if ([UserRole.SuperAdmin, UserRole.Admin].includes(user.currentRole)) setCurrentView('admin');
                            else if (user.currentRole === UserRole.Cook) setCurrentView('kds');
                            else if (user.currentRole === UserRole.Delivery) setCurrentView('delivery');
                            else setCurrentView('start');
                        }
                    }
                } else if (user.currentRole === UserRole.SuperAdmin) {
                    const params = new URLSearchParams(window.location.search);
                    if (params.get('view') !== 'feedback') {
                        // SuperAdmin without branch -> select branch screen or admin
                        setCurrentView('select_branch');
                    }
                }
            } catch (e) {
                console.error("Failed to restore session", e);
                localStorage.removeItem('restauranteos_user');
                localStorage.removeItem('restauranteos_branch_id');
            }
        }

        // Socket Listeners
        // ...
    }, []);

    // ... (rest of code) ...

    const handleLogin = async (pin: string) => {
        try {
            const user = await api.login(pin);
            if (user) {
                // REFRESH DATA ON LOGIN to ensure history is up to date
                await fetchAllData();

                const roles = user.roles || [];
                const preferredRole = roles.includes(UserRole.SuperAdmin) ? UserRole.SuperAdmin :
                    roles.includes(UserRole.Admin) ? UserRole.Admin :
                        roles.includes(UserRole.Cook) ? UserRole.Cook :
                            roles.includes(UserRole.Delivery) ? UserRole.Delivery :
                                roles.includes(UserRole.Cashier) ? UserRole.Cashier :
                                    UserRole.Waiter;

                const userObj = { id: user.id || 0, username: user.name, currentRole: preferredRole, allRoles: roles };

                // --- WELCOME TRANSITION ---
                setLoginName(user.name);
                await new Promise(resolve => setTimeout(resolve, 1500));

                setLoggedInUser(userObj);
                localStorage.setItem('restauranteos_user', JSON.stringify(userObj)); // SAVE SESSION
                setLoginName(null); // Reset for next time

                setLoginErrorCount(0);

                setLoginErrorCount(0);

                if (user.branchId) {
                    const assignedBranch = safeBranches.find(b => b.id === user.branchId && b.isActive);
                    if (assignedBranch) {
                        setSelectedBranchId(assignedBranch.id);
                        localStorage.setItem('restauranteos_branch_id', assignedBranch.id.toString()); // SAVE BRANCH

                        // FORCE HISTORY RESET on Login
                        const targetRole = preferredRole;
                        // Determine target view to set history correctly
                        let targetView = 'start';
                        if ([UserRole.SuperAdmin, UserRole.Admin].includes(targetRole)) targetView = 'admin';
                        else if (targetRole === UserRole.Cook) targetView = 'kds';
                        else if (targetRole === UserRole.Delivery) targetView = 'delivery';

                        window.history.replaceState({ view: targetView }, '', `/${targetView}`);

                        navigateToRoleDefault(preferredRole);
                        return;
                    }
                }
                const activeBranches = safeBranches.filter(b => b.isActive);
                if (activeBranches.length === 1) {
                    setSelectedBranchId(activeBranches[0].id);
                    localStorage.setItem('restauranteos_branch_id', activeBranches[0].id.toString()); // SAVE BRANCH

                    // FORCE HISTORY RESET
                    const targetRole = preferredRole;
                    let targetView = 'start';
                    if ([UserRole.SuperAdmin, UserRole.Admin].includes(targetRole)) targetView = 'admin';
                    else if (targetRole === UserRole.Cook) targetView = 'kds';
                    else if (targetRole === UserRole.Delivery) targetView = 'delivery';
                    window.history.replaceState({ view: targetView }, '', `/${targetView}`);

                    navigateToRoleDefault(preferredRole);
                } else if (activeBranches.length > 1) {
                    setCurrentView('select_branch');
                } else {
                    navigateToRoleDefault(preferredRole);
                }
            }
        } catch (e: any) {
            console.error("Login error", e);
            // alert(`Error de inicio de sesión: ${e.message}`); // REMOVED DEBUG ALERT
            setLoginErrorCount(prev => prev + 1);
        }
    };

    const navigateToRoleDefault = (role: UserRole) => {
        if ([UserRole.SuperAdmin, UserRole.Admin].includes(role)) setCurrentView('admin');
        else if (role === UserRole.Cook) setCurrentView('kds');
        else if (role === UserRole.Delivery) setCurrentView('delivery');
        else setCurrentView('start');
    };

    const handleLogout = () => {
        setLoggedInUser(null);
        setLoginErrorCount(0);
        setSelectedBranchId(null);
        setCurrentView('start');
        localStorage.removeItem('restauranteos_user'); // CLEAR SESSION
        localStorage.removeItem('restauranteos_branch_id');
        localStorage.removeItem('currentView'); // CLEAR VIEW PERSISTENCE

        // Force Reload to clear PWA cache / ensure latest version
        window.location.reload();
    };

    const handleUpdateCustomerEmail = async (customerId: number, email: string) => {
        try {
            const cleanEmail = email.toLowerCase().trim();
            // @ts-ignore
            await api.updateCustomer(customerId, { email: cleanEmail });

            // Update local customers state
            setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, email: cleanEmail } : c));

            // Update active orders for this customer
            setOrders(prev => prev.map(o => o.customer?.id === customerId ? { ...o, customer: { ...o.customer, email: cleanEmail } } : o));

            console.log(`[CUSTOMER] Email updated for ID ${customerId}: ${cleanEmail}`);
        } catch (e) {
            console.error("Failed to update customer email", e);
            toast.error("Error al guardar el correo");
        }
    };

    const executeCreateOrder = async (details: OrderDetails) => {
        isCreatingOrderRef.current = true;
        setShowNewOrderWizard(false);
        const newOrder: Order = {
            id: `ORD-${Date.now()}`,
            branchId: selectedBranchId!,
            dailyOrderNumber: 0,
            ...details,
            createdByUserId: loggedInUser!.id,
            items: details.initialItems || [], subtotal: 0, tax: 0, discount: 0,
            deliveryFee: details.type === OrderType.Delivery ? 1.00 : 0,
            total: details.type === OrderType.Delivery ? 1.00 : 0,
            createdAt: new Date(), status: 'active', kitchenStatus: 'pending', payments: [], amountPaid: 0, changeGiven: 0,
        };

        if (newOrder.items.length > 0) {
            const subtotal = newOrder.items.reduce((acc, item) => acc + item.total, 0);
            newOrder.subtotal = subtotal;
            newOrder.total = subtotal + (newOrder.deliveryFee || 0);
        }

        setOrders(prev => {
            const updated = [...prev, newOrder];
            setTimeout(() => {
                setActiveOrderId(newOrder.id);
                setCurrentView('order');
            }, 0);
            return updated;
        });

        try {
            const response = await api.createOrder(newOrder);
            if (response && response.dailyOrderNumber) {
                setOrders(prev => {
                    const exists = prev.find(o => o.id === newOrder.id);
                    if (exists) {
                        return prev.map(o => o.id === newOrder.id ? { ...o, dailyOrderNumber: response.dailyOrderNumber } : o);
                    } else {
                        return [{ ...newOrder, dailyOrderNumber: response.dailyOrderNumber }, ...prev];
                    }
                });
            }
        } catch (e) {
            console.error("Failed to sync new order", e);
            setOrders(prev => prev.filter(o => o.id !== newOrder.id));
            toast.error("Error al crear el pedido. Intente nuevamente.", { duration: 5000 });
            setCurrentView('start');
        } finally {
            isCreatingOrderRef.current = false;
        }
    };

    const createNewOrder = async (details: OrderDetails) => {
        if (!selectedBranchId || isCreatingOrderRef.current) return;

        // Detección de orden duplicada para el mismo cliente (< 1 min)
        const customerId = details.customer?.id;
        if (customerId) {
            const oneMinAgo = Date.now() - 60000;
            const recentOrder = filteredOrders.find(o =>
                o.status === 'active' &&
                String(o.customer?.id) === String(customerId) &&
                new Date(o.createdAt).getTime() > oneMinAgo
            );
            if (recentOrder) {
                setDuplicateWarning(recentOrder);
                setPendingDuplicateDetails(details);
                return;
            }
        }

        await executeCreateOrder(details);
    };

    const handleConfirmDuplicate = async () => {
        if (!pendingDuplicateDetails) return;
        const details = pendingDuplicateDetails;
        setDuplicateWarning(null);
        setPendingDuplicateDetails(null);
        await executeCreateOrder(details);
    };

    const handleCancelDuplicate = () => {
        setDuplicateWarning(null);
        setPendingDuplicateDetails(null);
    };

    const handleUpdateDeliveryFee = useCallback((orderId: string, fee: number) => {
        setOrders(prev => prev.map(o => {
            if (o.id === orderId) {
                const subtotal = o.items.reduce((s, i) => s + i.total, 0);
                const newTotal = subtotal + fee - (o.discount || 0);

                // Persist to backend immediately
                api.updateOrder(orderId, { deliveryFee: fee, total: newTotal }).catch(console.error);

                return { ...o, deliveryFee: fee, total: newTotal };
            }
            return o;
        }));
    }, []);

    const handleForceCloseAll = async (ordersToClose: Order[]) => {
        if (!ordersToClose.length) return;

        try {
            await Promise.all(ordersToClose.map(o => {
                // FORCE CLOSE LOGIC:
                // 1. Calculate full amount
                // 2. Add payment record (Cash) so it counts in report
                const fullAmount = o.total || 0;
                const cashPayment: Payment = {
                    method: 'Efectivo' as PaymentMethod, // Explicit cast to avoid import runtime issues
                    amount: fullAmount
                };

                return api.updateOrder(o.id, {
                    status: 'completed',
                    completedAt: new Date(),
                    payments: [cashPayment], // Overwrite/Set payments
                    amountPaid: fullAmount,
                    changeGiven: 0
                });
            }));

            await fetchAllData(); // Refresh data from server
            toast.success('PEDIDOS CERRADOS Y COBRADOS EN EFECTIVO');
        } catch (error) {
            console.error("Error force closing orders:", error);
            toast.error('ERROR AL CERRAR PEDIDOS');
        }
    };

    const handleSaveCashOpening = async (amount: number) => {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const branchId = selectedBranchId || loggedInUser?.id;
        if (!branchId) { toast.error('Selecciona una sucursal primero'); return; }

        const report: CashClosingReport = {
            date: todayStr,
            branchId: Number(branchId),
            createdAt: new Date(),
            initialCash: amount,
            totalSales: 0,
            totalCashIn: 0,
            totalChangeOut: 0,
            expectedCash: amount,
            summary: [],
            totalOrders: 0
        };

        try {
            const saved = await api.saveCashClosing(report);
            setCashClosingReports(prev => {
                const exists = prev.some(r => r.date === saved.date && r.branchId === saved.branchId);
                if (exists) return prev.map(r => (r.date === saved.date && r.branchId === saved.branchId) ? saved : r);
                return [...prev, saved];
            });
            toast.success('Apertura de caja registrada');
            setShowCashOpeningModal(false);
        } catch {
            toast.error('Error al registrar apertura');
            throw new Error('Save failed');
        }
    };

    const handleRequireCashOpening = useCallback(() => {
        setIsCashOpeningSilenced(false);
        setLastCashReminderTime(0);
        setShowCashOpeningModal(true);
    }, []);

    const handleUpdateKitchenStatus = async (orderId: string, status: KitchenStatus, chef?: string) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        const updatedOrder = { ...order, kitchenStatus: status, chef: chef || order.chef };

        // Optimistic update
        setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));

        try {
            await api.updateOrder(orderId, { kitchenStatus: status, chef: chef || order.chef });
        } catch (e) {
            console.error(e);
        }
    };

    const handleToggleItemCompletion = async (orderId: string, itemId: string) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        const updatedItems = order.items.map(i => i.id === itemId ? { ...i, completed: !i.completed } : i);
        const updatedOrder = { ...order, items: updatedItems };

        setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));

        try {
            await api.updateOrder(orderId, { items: updatedItems });
        } catch (e) { console.error(e); }
    };

    const handleCreateCustomer = async (customer: Customer): Promise<Customer> => {
        try {
            const result = await api.createCustomer(customer);
            return result;
        } catch (e) {
            console.error("Failed to create customer", e);
            throw e;
        }
    };

    const renderContent = () => {
        switch (currentView) {
            case 'start': return <StartScreen
                key={startScreenKey}
                onStartOrder={createNewOrder}
                activeOrders={filteredOrders}
                onSelectOrder={id => { setShowNewOrderWizard(false); setActiveOrderId(id); setCurrentView('order'); }}
                onShowCompleted={() => { setShowNewOrderWizard(false); setCurrentView('completed'); }}
                onShowActive={() => { setShowNewOrderWizard(false); setCurrentView('active_orders_mobile'); }}
                onManageCustomers={() => { setShowNewOrderWizard(false); setCurrentView('manage_customers'); }}
                waiters={safeWaiters}
                tables={filteredTables}
                customers={customers}
                setCustomers={setCustomers}
                orderToEdit={orderToEdit}
                onUpdateOrder={async d => {
                    const updatedOrder = { ...orderToEdit!, ...d };
                    setOrders(prev => prev.map(o => o.id === orderToEditId ? updatedOrder : o));
                    setActiveOrderId(orderToEditId);
                    setOrderToEditId(null);
                    setCurrentView('order');
                    try {
                        await api.updateOrder(orderToEditId!, updatedOrder);
                    } catch (e) {
                        console.error("Failed to update order header", e);
                    }
                }}
                onCancelEdit={() => { setActiveOrderId(orderToEditId); setOrderToEditId(null); setCurrentView('order'); }}
                onCreateCustomer={handleCreateCustomer}
                products={products}
                meats={meats}
                productExtras={productExtras}
                branches={safeBranches}
                currentBranchId={selectedBranchId}
                initialIsCreating={showNewOrderWizard}
                companySettings={companySettings}
            />;
            case 'order': return activeOrder ? <OrderScreen order={activeOrder} currentUser={loggedInUser} updateOrder={(id, items) => {
                let newKitchenStatus = activeOrder.kitchenStatus;

                // KDS RE-OPENING LOGIC: If KDS items changed and it was ready/served, reopen it
                const kdsItemsIncreased = items.some(newItem => {
                    if (newItem.product?.showInKds === false) return false;
                    const oldItem = activeOrder.items.find(i => i.id === newItem.id);
                    if (!oldItem) return true;
                    return newItem.quantity > oldItem.quantity;
                });

                if (kdsItemsIncreased && (activeOrder.kitchenStatus === 'ready' || activeOrder.kitchenStatus === 'served')) {
                    console.log('🔄 Re-opening KDS ticket due to new/increased KDS items');
                    newKitchenStatus = 'pending';
                }

                // Calculate Promotions
                const discounts = calculatePromotions(items, promotions);
                const discountTotal = discounts.reduce((s, d) => s + d.amount, 0);

                const updatedOrder = {
                    ...activeOrder,
                    items,
                    kitchenStatus: newKitchenStatus as KitchenStatus,
                    discount: discountTotal, // Add this so it saves to DB
                    manualDiscount: activeOrder.manualDiscount || 0,
                    total: Number(Math.max(0, 
                        items.reduce((s, i) => s + (Number(i.total) || 0), 0) + 
                        (Number(activeOrder.deliveryFee) || 0) - 
                        (Number(discountTotal) || 0) - 
                        (Number(activeOrder.manualDiscount) || 0)
                    ).toFixed(2))
                };

                setOrders(prev => prev.map(o => String(o.id) === String(id) ? updatedOrder : o));

                // Debounced Save to Backend
                if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
                updateTimeoutRef.current = setTimeout(() => {
                    api.updateOrder(id, updatedOrder).catch(e => {
                        console.error("Auto-save failed", e);
                        toast.error(`ERROR AL GUARDAR: ${e.message}`, { duration: 4000 });
                    });
                }, 1000);

            }} onCompleteOrder={async (id, payments, change, manualDiscount) => {
                const updatedOrder = {
                    ...activeOrder!,
                    status: 'completed' as const,
                    completedAt: new Date(),
                    payments,
                    amountPaid: payments.reduce((s, p) => s + p.amount, 0),
                    changeGiven: change,
                    manualDiscount: manualDiscount || activeOrder?.manualDiscount || 0,
                    items: activeOrder!.items.map(item => ({ ...item, completed: true }))
                };
                setOrders(prev => prev.map(o => String(o.id) === String(id) ? updatedOrder : o));
                try {
                    await api.updateOrder(id, updatedOrder);
                } catch (e) { console.error("Failed to complete order", e); }

                setActiveOrderId(null);
                setCurrentView('start');
                setStartScreenKey(prev => prev + 1); // Force StartScreen remount to refresh tables
                // @ts-ignore
            }} onBackToStart={() => { setShowNewOrderWizard(false); setCurrentView('start'); }} onStartNewOrder={() => { setActiveOrderId(null); setShowNewOrderWizard(true); setCurrentView('start'); }} onEditOrderHeader={id => { setOrderToEditId(id); setCurrentView('start'); }} categories={categories} products={products} meats={meats} productExtras={productExtras} updateDeliveryFee={handleUpdateDeliveryFee} productPopularity={productPopularity} companySettings={companySettings} onUpdateCustomerEmail={handleUpdateCustomerEmail} branches={safeBranches} promotions={promotions} waiters={safeWaiters} />
                : <div className="flex flex-col items-center justify-center h-screen bg-gray-950 px-6 text-center">
                    <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                        <span className="text-4xl animate-pulse">🔄</span>
                    </div>
                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">
                        SESIÓN <span className="text-amber-500">REINICIADA</span>
                    </h2>
                    <p className="text-gray-400 text-sm font-bold uppercase tracking-widest max-w-xs leading-relaxed opacity-70">
                        El sistema se ha refrescado. Por seguridad, vuelve al inicio para retomar la operación.
                    </p>
                    <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
                        <button
                            className="bg-amber-500 hover:bg-amber-600 text-gray-950 px-6 py-4 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-amber-900/20"
                            onClick={() => {
                                setActiveOrderId(null);
                                setCurrentView('start');
                                setStartScreenKey(prev => prev + 1);
                                fetchAllData(true);
                            }}
                        >
                            VOLVER AL MENÚ
                        </button>
                        <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em] mt-4">
                            Refresco de Seguridad
                        </p>
                    </div>
                </div>;
            case 'admin': return <AdminPanel waiters={safeWaiters} setWaiters={setWaiters} tables={safeTables} setTables={setTables} meats={meats} setMeats={setMeats} categories={categories} setCategories={setCategories} productExtras={productExtras} setProductExtras={setProductExtras} products={products} setProducts={setProducts} orders={filteredOrders} cashClosingReports={cashClosingReports} setCashClosingReports={setCashClosingReports} onOpenMasterSettings={() => setCurrentView('master_settings')} isSuperAdmin={loggedInUser?.allRoles.includes(UserRole.SuperAdmin) || false} branches={safeBranches} setBranches={setBranches} currentBranchId={selectedBranchId} customers={customers} setCustomers={setCustomers} currentAdminName={loggedInUser?.username || ''} onForceClose={handleForceCloseAll} promotions={promotions} setPromotions={setPromotions} onRequireCashOpening={handleRequireCashOpening} companySettings={companySettings} setCompanySettings={setCompanySettings} />;
            case 'completed': return <CompletedOrdersScreen orders={completedOrders} onBack={() => setCurrentView('start')} onNewOrder={() => { setActiveOrderId(null); setCurrentView('start'); }} companySettings={companySettings} onUpdateCustomerEmail={handleUpdateCustomerEmail} branches={safeBranches} />;
            case 'active_orders_mobile': return <ActiveOrdersMobileScreen orders={activeOrders} onBack={() => setCurrentView('start')} onSelectOrder={id => { setActiveOrderId(id); setCurrentView('order'); }} currentUserRole={loggedInUser?.currentRole || UserRole.Waiter} currentUserId={loggedInUser?.id} />;
            case 'kds': return <KdsScreen
                activeOrders={activeOrders.map(o => ({ ...o, items: o.items.filter(i => i.product?.showInKds !== false) }))}
                completedOrders={completedOrders.map(o => ({ ...o, items: o.items.filter(i => i.product?.showInKds !== false) }))}
                updateOrderKitchenStatus={handleUpdateKitchenStatus}
                toggleOrderItemCompletion={handleToggleItemCompletion}
                waiters={safeWaiters}
                branchId={selectedBranchId}
            />;
            case 'master_settings': return <MasterSettingsScreen settings={companySettings} setSettings={setCompanySettings} onBack={() => setCurrentView('admin')} currentUser={loggedInUser} />;
            case 'manage_customers': return <ManageCustomersScreen customers={customers} setCustomers={setCustomers} onBack={() => setCurrentView('start')} />;
            case 'feedback': return <FeedbackScreen companyName={companySettings.name} />;
            case 'delivery': return <DeliveryDashboard currentUser={loggedInUser ? { id: loggedInUser.id, username: loggedInUser.username } : undefined} currentBranchId={selectedBranchId} userRole={loggedInUser?.currentRole} onLogout={handleLogout} companyName={companySettings.name} staff={safeWaiters} />;
            case 'cashClosing': return <CashClosingScreen orders={filteredOrders} activeOrders={activeOrders} onBack={() => setCurrentView('start')} cashClosingReports={cashClosingReports} setCashClosingReports={setCashClosingReports} branchId={selectedBranchId || 1} companySettings={companySettings} cashierMode={true} />;
            case 'menu': return <CustomerPortal products={products} categories={categories} branches={safeBranches} isLoggedIn={!!loggedInUser} onBack={() => setCurrentView('start')} globalLogoUrl={companySettings.logoUrl} />;
            default: return null;
        }
    };

    // --- RENDER LOGIC ---
    const renderAppContent = () => {
        if (currentView === 'menu') return <CustomerPortal products={products} categories={categories} branches={safeBranches} isLoggedIn={!!loggedInUser} onBack={() => setCurrentView('start')} globalLogoUrl={companySettings.logoUrl} />;

        if (!loggedInUser) {
            if (currentView === 'feedback') return <FeedbackScreen companyName={companySettings.name} />;
            return <LoginScreen onLogin={handleLogin} loginErrorCount={loginErrorCount} companySettings={companySettings} successName={loginName || undefined} />;
        }

        if (currentView === 'select_branch') {
            return <BranchSelectionScreen 
                branches={safeBranches} 
                onSelectBranch={id => { setSelectedBranchId(id); navigateToRoleDefault(loggedInUser.currentRole); }} 
                onLogout={handleLogout} 
            />;
        }

        return (
            <div className="flex flex-col h-full bg-gray-950 overflow-hidden w-full">
                <Header
                    currentView={currentView}
                    onNavigate={v => {
                        setShowNewOrderWizard(false);
                        if (v === 'start') {
                            setCurrentView('start');
                            setStartScreenKey(prev => prev + 1);
                            setOrderToEditId(null);
                        } else {
                            setCurrentView(v);
                        }
                    }}
                    onLogout={handleLogout}
                    allUserRoles={loggedInUser.allRoles}
                    branchName={currentBranch?.name}
                    onInstallApp={deferredPrompt ? handleInstallApp : undefined}
                    companySettings={companySettings}
                    isConnected={isConnected}
                />
                <main className="flex-1 overflow-hidden pt-14 sm:pt-16">
                    <GlobalPullToRefresh onRefresh={() => {
    checkAndApplyUpdate(
        (msg, duration) => toast(msg, { duration }),
        { delayMs: 500 }
    );
}}>
                        {renderContent()}
                    </GlobalPullToRefresh>
                </main>
            </div>
        );
    };

    return (
        <div className="h-full w-full overflow-hidden bg-gray-950">
            {renderAppContent()}

            <NotificationToast
                title={notificationTitle || undefined}
                message={notificationMessage}
                type={notificationType}
                position={notificationPosition}
                onClose={() => { 
                    setNotificationMessage(null); 
                    setNotificationPersistent(false); 
                    setNotificationPosition('bottom');
                    setNotificationAction(null);
                }}
                persistent={notificationPersistent}
                actionLabel={notificationAction?.label}
                onAction={notificationAction?.onClick}
            />

            {duplicateWarning && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 px-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
                                <span className="text-2xl">⚠️</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-amber-400 uppercase tracking-tighter">Orden Duplicada</h3>
                                <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                                    El cliente <span className="text-white font-bold">{duplicateWarning.customer?.name}</span> ya tiene una orden activa
                                    {' '}<span className="text-amber-400 font-black">#{String(duplicateWarning.dailyOrderNumber).padStart(3, '0')}</span>
                                    {' '}creada hace{' '}
                                    <span className="text-white font-bold">{Math.max(1, Math.floor((Date.now() - new Date(duplicateWarning.createdAt).getTime()) / 1000))}s</span>.
                                </p>
                                <p className="text-xs text-gray-500 mt-1">¿Crear nueva de todas formas?</p>
                            </div>
                            <div className="flex gap-3 w-full mt-2">
                                <button
                                    onClick={handleCancelDuplicate}
                                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-black rounded-xl transition-all active:scale-95 text-sm uppercase tracking-wider"
                                >
                                    CANCELAR
                                </button>
                                <button
                                    onClick={handleConfirmDuplicate}
                                    className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl transition-all active:scale-95 text-sm uppercase tracking-wider"
                                >
                                    CREAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ExitConfirmationModal
                isOpen={showExitConfirm}
                onClose={() => setShowExitConfirm(false)}
                onConfirm={() => {
                    setShowExitConfirm(false);
                    handleLogout();
                }}
            />

            <CashOpeningModal
                isOpen={showCashOpeningModal}
                onClose={() => setShowCashOpeningModal(false)}
                onSave={handleSaveCashOpening}
                onSilence={() => {
                    setIsCashOpeningSilenced(true);
                    setShowCashOpeningModal(false);
                    toast('Recordatorios silenciados por hoy', { icon: '🔕' });
                }}
                branchName={currentBranch?.name}
            />

            <Toaster
                position="top-center"
                reverseOrder={false}
                toastOptions={{
                    style: {
                        background: 'rgba(17, 24, 39, 0.9)', 
                        color: '#fff',
                        border: '1px solid rgba(52, 211, 153, 0.5)',
                        padding: '12px 24px',
                        borderRadius: '9999px',
                        boxShadow: '0 0 20px rgba(52, 211, 153, 0.2)',
                        fontWeight: '900',
                        textTransform: 'uppercase',
                        fontStyle: 'italic',
                        fontSize: '14px',
                        letterSpacing: '0.05em'
                    },
                    success: {
                        style: {
                            border: '1px solid rgba(52, 211, 153, 0.5)',
                            color: '#34d399',
                            boxShadow: '0 0 20px rgba(52, 211, 153, 0.3)'
                        },
                        iconTheme: { primary: '#34d399', secondary: '#064e3b' }
                    },
                    error: {
                        style: {
                            border: '1px solid rgba(244, 63, 94, 0.5)',
                            color: '#fb7185',
                            boxShadow: '0 0 20px rgba(244, 63, 94, 0.3)'
                        },
                        iconTheme: { primary: '#fb7185', secondary: '#4c0519' }
                    },
                    loading: {
                        style: {
                            border: '1px solid rgba(59, 130, 246, 0.5)',
                            color: '#60a5fa',
                            boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)'
                        }
                    }
                }}
            />
        </div>
    );
};

const GlobalPullToRefresh: React.FC<{ children: React.ReactNode, onRefresh: () => Promise<void> }> = ({ children, onRefresh }) => {
    const [startY, setStartY] = useState(0);
    const [pullOffset, setPullOffset] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const PULL_THRESHOLD = 80;

    const handleTouchStart = (e: React.TouchEvent) => {
        // Only trigger if at the top of the window scroll
        if (window.scrollY === 0) {
            setStartY(e.touches[0].pageY);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (startY > 0 && !isRefreshing) {
            const currentY = e.touches[0].pageY;
            const diff = currentY - startY;
            if (diff > 0) {
                // Apply resistance
                setPullOffset(Math.min(diff * 0.4, PULL_THRESHOLD + 20));
            }
        }
    };

    const handleTouchEnd = async () => {
        if (pullOffset >= PULL_THRESHOLD) {
            setIsRefreshing(true);
            setPullOffset(PULL_THRESHOLD);
            try {
                await onRefresh();
            } finally {
                setTimeout(() => {
                    setIsRefreshing(false);
                    setPullOffset(0);
                }, 500);
            }
        } else {
            setPullOffset(0);
        }
        setStartY(0);
    };

    return (
        <div 
            className="h-full w-full relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Refresh Indicator */}
            <div 
                className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none transition-transform z-[100]"
                style={{ 
                    transform: `translateY(${pullOffset - 50}px)`, 
                    opacity: pullOffset / PULL_THRESHOLD 
                }}
            >
                <div className={`bg-amber-500 p-2.5 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.4)] border border-amber-400 ${isRefreshing ? 'animate-spin' : ''}`}>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-950" fill="none" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                </div>
            </div>

            <div className="h-full w-full overflow-hidden">
                {children}
            </div>
        </div>
    );
};

export default App;
