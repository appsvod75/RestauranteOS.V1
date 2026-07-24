
import React, { useState, useRef } from 'react';
import { CompanySettings } from '../types';
import { SaveIcon, TrashIcon, InfoIcon, ArrowRightIcon, QrCodeIcon } from './icons';
import { QRCodeCanvas } from 'qrcode.react';
import toast from 'react-hot-toast';
import { api } from '../api';

interface MasterSettingsScreenProps {
    settings: CompanySettings;
    setSettings: React.Dispatch<React.SetStateAction<CompanySettings>>;
    onBack: () => void;
    currentUser?: any;
}

const formatPhone = (phone: string | null | undefined) => {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 8) {
        return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    }
    return phone;
};

const MasterSettingsScreen: React.FC<MasterSettingsScreenProps> = ({ settings, setSettings, onBack, currentUser }) => {
    const [formState, setFormState] = useState({
        globalStoreName: settings.name || 'RESTAURANTE',
        globalLogoUrl: settings.logoUrl || '',
        geminiApiKey: '',
        gasWebhookUrl: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    
    // Danger Zone State
    const [clearingType, setClearingType] = useState<'SALES' | 'PRODUCTS' | 'ALL' | null>(null);
    const [pin, setPin] = useState('');
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [foundCount, setFoundCount] = useState<number | null>(null);
    const [checkingCount, setCheckingCount] = useState(false);
    const [backingUp, setBackingUp] = useState(false);
    const [pinAction, setPinAction] = useState<'clear' | 'backup'>('clear');

    // Initial Load of Global Settings
    React.useEffect(() => {
        // @ts-ignore
        import('../api').then(m => m.api.getSettings()).then(globalSettings => {
            setFormState({
                globalStoreName: globalSettings.global_store_name || settings.name || 'RESTAURANTE OS',
                globalLogoUrl: globalSettings.global_logo_url || settings.logoUrl || '',
                geminiApiKey: globalSettings.gemini_api_key || '',
                gasWebhookUrl: globalSettings.gas_webhook_url || ''
            });
        }).catch(err => console.error("Error loading global settings:", err));
    }, [settings.name]);

    // Lógica para el scroll por arrastre (Drag to Scroll)
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartY(e.pageY - scrollRef.current.offsetTop);
        setScrollTop(scrollRef.current.scrollTop);
    };

    const handleMouseLeave = () => setIsDragging(false);
    const handleMouseUp = () => setIsDragging(false);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - scrollRef.current.offsetTop;
        const walk = (y - startY) * 2; // Sensibilidad del arrastre
        scrollRef.current.scrollTop = scrollTop - walk;
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const api = await import('../api').then(m => m.api);

            // Save Global Integrations -> App Config Table
            // @ts-ignore
            await api.updateSettings({
                global_store_name: formState.globalStoreName.toUpperCase(),
                global_logo_url: formState.globalLogoUrl,
                gemini_api_key: formState.geminiApiKey,
                gas_webhook_url: formState.gasWebhookUrl // Mapping frontend prop to DB key
            });

            // Update App state via setSettings (which is setCompanySettings in App.tsx)
            setSettings(prev => ({
                ...prev,
                name: formState.globalStoreName.toUpperCase(),
                logoUrl: formState.globalLogoUrl,
                geminiApiKey: formState.geminiApiKey,
                gasWebhookUrl: formState.gasWebhookUrl
            }));

            // Allow time for feedback
            setTimeout(() => {
                setIsSaving(false);
                toast.custom(
                    <div className="w-[90%] max-w-sm bg-emerald-950 text-emerald-400 px-6 py-4 rounded-full shadow-[0_0_20px_rgba(52,211,153,0.3)] flex items-center justify-center gap-3 border border-emerald-500/50 text-center pointer-events-none transition-all duration-300">
                        <span className="text-xl drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]">✅</span>
                        <span className="font-black tracking-widest uppercase italic text-lg drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">CONFIGURACIÓN GLOBAL GUARDADA</span>
                    </div>,
                    { duration: 2000, position: 'top-center' }
                );
            }, 600);
        } catch (e) {
            console.error(e);
            setIsSaving(false);
            toast.custom(
                <div className="w-[90%] max-w-sm bg-rose-950 text-rose-400 px-6 py-4 rounded-full shadow-[0_0_20px_rgba(251,113,133,0.3)] flex items-center justify-center gap-3 border border-rose-500/50 text-center pointer-events-none transition-all duration-300">
                    <span className="text-xl drop-shadow-[0_0_5px_rgba(251,113,133,0.8)]">❌</span>
                    <span className="font-black tracking-widest uppercase italic text-lg drop-shadow-[0_0_5px_rgba(251,113,133,0.5)]">ERROR AL GUARDAR</span>
                </div>,
                { duration: 3000, position: 'top-center' }
            );
        }
    };

    const handleClearRequest = async (type: 'SALES' | 'PRODUCTS' | 'ALL') => {
        if (type === 'SALES' && startDate && endDate) {
            setCheckingCount(true);
            setFoundCount(null);
            try {
                const { count } = await api.checkOrdersRange(startDate, endDate, currentUser.id);
                setFoundCount(count);
                if (count === 0) {
                    toast.error(`No hay órdenes entre ${startDate} y ${endDate}`, { duration: 3000 });
                    setCheckingCount(false);
                    return;
                }
            } catch (e) {
                console.error(e);
                toast.error('Error al verificar el rango de fechas', { duration: 3000 });
                setCheckingCount(false);
                return;
            }
            setCheckingCount(false);
        }
        setClearingType(type);
        setPinAction('clear');
        setIsPinModalOpen(true);
    };

    const handleBackupRequest = () => {
        setPinAction('backup');
        setIsPinModalOpen(true);
    };

    const confirmAction = async () => {
        if (!pin || !currentUser) return;

        if (pinAction === 'backup') {
            setBackingUp(true);
            const loading = toast.loading('Generando backup...');
            try {
                await api.backupDatabase(pin, currentUser.id);
                toast.success('BACKUP DESCARGADO EXITOSAMENTE', { id: loading });
                setIsPinModalOpen(false);
                setPin('');
            } catch (err: any) {
                console.error(err);
                toast.error(err.message || 'Error en backup', { id: loading });
            } finally {
                setBackingUp(false);
            }
            return;
        }

        if (!clearingType) return;

        const loading = toast.loading('Ejecutando limpieza...');
        try {
            await api.clearData(clearingType, pin, currentUser.id, startDate || undefined, endDate || undefined);
            
            toast.success('LIMPIEZA COMPLETADA EXITOSAMENTE', { id: loading });
            setIsPinModalOpen(false);
            setPin('');
            setClearingType(null);
            
            if (clearingType !== 'SALES') {
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Error en la limpieza', { id: loading });
        }
    };

    return (
        <div className="h-full flex flex-col max-w-2xl mx-auto p-4 sm:p-6 overflow-hidden animate-in fade-in duration-500">
            <style>{`
                input[type="date"]::-webkit-calendar-picker-indicator {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23fbbf24' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E");
                    background-size: contain;
                    background-position: center;
                    background-repeat: no-repeat;
                    cursor: pointer;
                    opacity: 1;
                    padding: 8px;
                }
                input[type="date"]::-webkit-calendar-picker-indicator:hover {
                    opacity: 0.7;
                }
                input[type="date"]::-webkit-datetime-edit-text {
                    color: #fbbf24;
                }
                input[type="date"] {
                    color-scheme: dark;
                }
            `}</style>
            {/* Header Unificado de Dos Colores */}
            <div className="flex justify-between items-center gap-4 mb-8 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="bg-gray-800 p-2.5 rounded-full hover:bg-gray-700 active:scale-90 transition-all shadow-lg border border-gray-700/50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                        CONFIG. <span className="text-amber-500">MAESTRA</span>
                    </h1>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`flex items-center gap-2 font-black py-2.5 px-6 rounded-2xl active:scale-95 transition-all text-[10px] uppercase shadow-lg shadow-green-900/20 ${isSaving ? 'bg-gray-700 text-gray-400' : 'bg-green-600 text-white hover:bg-green-500'}`}
                >
                    <SaveIcon className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                    {isSaving ? 'GUARDANDO...' : 'GUARDAR'}
                </button>
            </div>

            {/* Formulario con Drag to Scroll */}
            <div
                ref={scrollRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                className={`flex-1 overflow-y-auto pr-2 space-y-6 select-none scrollbar-hide pb-32 ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
            >
                {/* SECCIÓN: IDENTIDAD GLOBAL */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Identidad de la Aplicación</h2>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-[32px] border border-gray-700/50 shadow-xl space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Nombre Global del Negocio</label>
                            <input
                                type="text"
                                value={formState.globalStoreName}
                                onChange={e => setFormState({ ...formState, globalStoreName: e.target.value })}
                                className="w-full py-4 px-6 bg-gray-900 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 shadow-inner transition-all"
                                placeholder="EJ: RESTAURANTE OS"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Logo Global URL (Imagen principal)</label>
                            <input
                                type="text"
                                value={formState.globalLogoUrl}
                                onChange={e => setFormState({ ...formState, globalLogoUrl: e.target.value })}
                                className="w-full py-4 px-6 bg-gray-900 border-2 border-gray-700 rounded-2xl text-white font-black outline-none focus:border-amber-500 shadow-inner transition-all"
                                placeholder="https://..."
                            />
                        </div>
                    </div>
                </div>

                {/* SECCIÓN: MENÚ DIGITAL (QR) */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1 text-amber-500">
                        <QrCodeIcon className="w-4 h-4" />
                        <h2 className="text-[10px] font-black uppercase tracking-widest italic">Menú Digital (Código QR)</h2>
                    </div>
                    <div className="bg-gray-800/40 backdrop-blur-md p-8 rounded-[40px] border border-gray-700/50 shadow-xl space-y-6 text-center">
                        <div className="bg-white p-6 rounded-[32px] inline-block mx-auto shadow-2xl">
                            <QRCodeCanvas
                                id="portal-qr"
                                value={`${window.location.origin}/menu`}
                                size={2048}
                                style={{ width: 220, height: 220 }}
                                level="H"
                                includeMargin
                                imageSettings={formState.globalLogoUrl ? {
                                    src: formState.globalLogoUrl,
                                    height: 480,
                                    width: 480,
                                    excavate: true,
                                    crossOrigin: 'anonymous'
                                } : undefined}
                            />
                        </div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest italic break-all">
                            {window.location.origin}/menu
                        </p>
                        <button
                            onClick={() => {
                                const canvas = document.getElementById('portal-qr') as HTMLCanvasElement;
                                if (!canvas) { toast.error('No se encontró el código QR'); return; }
                                const pngUrl = canvas.toDataURL('image/png');
                                const a = document.createElement('a');
                                a.href = pngUrl;
                                a.download = `QR_MENU_${formState.globalStoreName.replace(/\s+/g, '_')}.png`;
                                a.click();
                                toast.success('QR Descargado correctamente');
                            }}
                            className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase italic tracking-widest transition-all active:scale-95 shadow-lg"
                        >
                            <SaveIcon className="w-4 h-4 inline mr-2 -mt-0.5" />
                            Descargar QR para imprimir
                        </button>
                        <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest italic leading-relaxed max-w-md mx-auto">
                            Este código dirigirá a tus clientes directamente a ver tus productos con fotos y descripciones.
                        </p>
                    </div>
                </div>

                {/* SECCIÓN: INTEGRACIONES */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1 text-purple-400">
                        <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                        <h2 className="text-[10px] font-black uppercase tracking-widest italic">Inteligencia Artificial & Webhooks</h2>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-[32px] border border-gray-700/50 shadow-xl space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-purple-400/70 uppercase tracking-widest ml-1 italic">Gemini Flash API Key</label>
                            <input
                                type="password"
                                value={formState.geminiApiKey}
                                onChange={e => setFormState({ ...formState, geminiApiKey: e.target.value })}
                                className="w-full py-4 px-6 bg-gray-900 border-2 border-gray-700 rounded-2xl text-white font-mono text-xs outline-none focus:border-purple-500 shadow-inner transition-all"
                                placeholder="TU_API_KEY_AQUI..."
                            />
                            <p className="text-[9px] text-gray-500 ml-1 italic leading-relaxed">Necesario para el procesamiento inteligente de pedidos por voz y texto.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-blue-400/70 uppercase tracking-widest ml-1 italic">Webhook Global de Respaldo</label>
                            <input
                                type="text"
                                value={formState.gasWebhookUrl || ''}
                                onChange={e => setFormState({ ...formState, gasWebhookUrl: e.target.value })}
                                className="w-full py-4 px-6 bg-gray-900 border-2 border-gray-700 rounded-2xl text-white font-mono text-[10px] outline-none focus:border-blue-500 shadow-inner transition-all"
                                placeholder="https://script.google.com/macros/..."
                            />
                            <p className="text-[9px] text-gray-500 ml-1 italic leading-relaxed">Este webhook se usará globalmente si una sucursal no tiene uno configurado particularmente.</p>
                        </div>
                    </div>
                </div>

                {/* SECCIÓN: MANTENIMIENTO (LIMPIEZA) */}
                <div className="space-y-4 pb-20">
                    <div className="flex items-center gap-2 px-1 text-red-500">
                        <TrashIcon className="w-4 h-4" />
                        <h2 className="text-[10px] font-black uppercase tracking-widest italic">Mantenimiento de Base de Datos</h2>
                    </div>

                    <div className="bg-gray-800/40 backdrop-blur-md p-6 rounded-[32px] border border-red-500/20 shadow-xl space-y-6">
                        <div className="flex gap-4 p-4 bg-red-500/10 rounded-2xl border border-red-500/20 items-start">
                            <InfoIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-[9px] text-red-300 font-bold uppercase leading-relaxed tracking-wide">
                                Acciones destructivas. Estos procesos borrarán datos operativos de forma irreversible. Se recomienda precaución.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {/* SALES */}
                            <div className="space-y-3 p-4 bg-orange-600/10 border border-orange-500/30 rounded-2xl transition-all">
                                <div className="flex justify-between items-center">
                                    <div className="text-left">
                                        <span className="block font-black text-[11px] uppercase italic tracking-tighter text-orange-500">Limpiar Ventas</span>
                                        <span className="block text-[8px] text-orange-500/60 font-bold uppercase tracking-widest">Borra pedidos, pagos y auditoría</span>
                                    </div>
                                    <TrashIcon className="w-5 h-5 text-orange-500/40" />
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-gray-500 uppercase italic ml-1">Desde</label>
                                        <input 
                                            type="date" 
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                            className="w-full bg-gray-950 border border-orange-500/20 rounded-lg p-2 text-[10px] text-white outline-none focus:border-orange-500/50 transition-all font-black uppercase"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-gray-500 uppercase italic ml-1">Hasta</label>
                                        <input 
                                            type="date" 
                                            value={endDate}
                                            onChange={e => setEndDate(e.target.value)}
                                            className="w-full bg-gray-950 border border-orange-500/20 rounded-lg p-2 text-[10px] text-white outline-none focus:border-orange-500/50 transition-all font-black uppercase"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleClearRequest('SALES')}
                                    disabled={checkingCount}
                                    className="w-full py-3 mt-1 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-800/50 text-white rounded-xl font-black text-[10px] uppercase italic tracking-widest transition-all active:scale-95 shadow-lg shadow-orange-900/20"
                                >
                                    {checkingCount ? 'VERIFICANDO...' : `EJECUTAR LIMPIEZA ${startDate && endDate ? 'POR RANGO' : 'TOTAL'}`}
                                </button>
                            </div>

                            {/* BACKUP */}
                            <button
                                onClick={handleBackupRequest}
                                disabled={backingUp}
                                className="w-full p-4 bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 rounded-2xl flex justify-between items-center group hover:bg-emerald-600 hover:text-white transition-all active:scale-[0.98]"
                            >
                                <div className="text-left">
                                    <span className="block font-black text-[11px] uppercase italic tracking-tighter">Descargar Backup</span>
                                    <span className="block text-[8px] opacity-60 font-bold uppercase tracking-widest">Genera y descarga un .sql de la base de datos</span>
                                </div>
                                <SaveIcon className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" />
                            </button>

                            {/* PRODUCTS */}
                            <button
                                onClick={() => handleClearRequest('PRODUCTS')}
                                className="w-full p-4 bg-purple-600/10 border border-purple-500/30 text-purple-500 rounded-2xl flex justify-between items-center group hover:bg-purple-600 hover:text-white transition-all active:scale-[0.98]"
                            >
                                <div className="text-left">
                                    <span className="block font-black text-[11px] uppercase italic tracking-tighter">Limpiar Catálogo</span>
                                    <span className="block text-[8px] opacity-60 font-bold uppercase tracking-widest">Borra productos, categorías, carnes y extras</span>
                                </div>
                                <ArrowRightIcon className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" />
                            </button>

                            {/* FULL RESET */}
                            <button
                                onClick={() => handleClearRequest('ALL')}
                                className="w-full p-5 bg-red-600/10 border-2 border-red-600/40 text-red-500 rounded-3xl flex justify-between items-center group hover:bg-red-600 hover:text-white transition-all active:scale-[0.98] mt-2 shadow-lg shadow-red-950/10"
                            >
                                <div className="text-left">
                                    <span className="block font-black text-[13px] uppercase italic tracking-tighter text-red-600 group-hover:text-white">Reset Total de Operación</span>
                                    <span className="block text-[8px] opacity-60 font-bold uppercase tracking-widest">Deja la app vacía (Mantiene usuarios/sucursales)</span>
                                </div>
                                <TrashIcon className="w-6 h-6 opacity-40 group-hover:opacity-100 transition-opacity" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* VERSION INDICATOR */}
                <div className="flex flex-col items-center justify-center pt-8 pb-12 opacity-20 hover:opacity-100 transition-opacity">
                    <p className="text-[8px] font-black text-white italic uppercase tracking-[0.3em]">
                        RestauranteOS V1
                    </p>
                    <p className="text-[7px] font-bold text-amber-500 uppercase tracking-widest mt-1">
                        Build: {localStorage.getItem('app_version') || '1.0.0-PROD'}
                    </p>
                </div>
            </div>

            {/* PIN VERIFICATION MODAL */}
            {isPinModalOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[110] p-4">
                    <div className={`rounded-[40px] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in duration-300 space-y-6 ${pinAction === 'backup' ? 'bg-gray-950 border border-emerald-500/30' : 'bg-gray-950 border border-red-500/30'}`}>
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Verificación</h2>
                            <p className={`text-[10px] font-bold uppercase tracking-widest animate-pulse ${pinAction === 'backup' ? 'text-emerald-400' : 'text-red-500'}`}>
                                {pinAction === 'backup' ? 'DESCARGARÁS UN BACKUP DE LA BASE DE DATOS' :
                                    clearingType === 'SALES' ? (startDate && endDate && foundCount !== null ? `BORRARÁS ${foundCount} VENTAS DEL ${startDate} AL ${endDate}` : 'BORRARÁS TODAS LAS VENTAS') :
                                        clearingType === 'PRODUCTS' ? 'BORRARÁS TODO TU CATÁLOGO DE PRODUCTOS' :
                                            'RESET TOTAL: BORRARÁS TODA LA OPERACIÓN'}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Ingresa PIN de SuperAdmin</label>
                            <input
                                type="password"
                                maxLength={6}
                                value={pin}
                                onChange={e => setPin(e.target.value)}
                                className="w-full py-6 bg-gray-900 border-2 border-gray-800 rounded-3xl text-white text-center text-4xl font-black tracking-[0.3em] outline-none focus:border-red-500 transition-all"
                                placeholder="••••••"
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { setIsPinModalOpen(false); setPin(''); }}
                                className="py-4 bg-gray-800 text-gray-400 rounded-2xl font-black text-[10px] uppercase italic tracking-widest hover:bg-gray-700 transition-all"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={confirmAction}
                                disabled={pin.length < 4 || backingUp}
                                className={`py-4 rounded-2xl font-black text-[10px] uppercase italic tracking-widest transition-all active:scale-95 disabled:opacity-30 ${pinAction === 'backup' ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-red-600 text-white hover:bg-red-500'}`}
                            >
                                {backingUp ? 'GENERANDO...' : pinAction === 'backup' ? 'DESCARGAR' : 'CONFIRMAR'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MasterSettingsScreen;
