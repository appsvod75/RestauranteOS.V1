
import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, ChartBarIcon, ClockIcon, UserIcon } from './icons';
import { api } from '../api';
import toast from 'react-hot-toast';

interface ChefStats {
    chefName: string;
    totalOrders: number;
    avgPrepTimeSeconds: number;
}

interface ChefStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchId?: number;
}

const ChefStatsModal: React.FC<ChefStatsModalProps> = ({ isOpen, onClose, branchId }) => {
    const [stats, setStats] = useState<ChefStats[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadStats();
        }
    }, [isOpen]);

    const loadStats = async () => {
        setIsLoading(true);
        try {
            // Stats for today
            const today = new Date().toLocaleDateString('en-CA');
            const data = await api.getChefPerformance({
                startDate: today,
                endDate: today,
                branchId
            });
            setStats(data);
        } catch (error) {
            console.error('Error loading chef stats:', error);
            toast.error('Error al cargar estadísticas');
        } finally {
            setIsLoading(false);
        }
    };

    const maxOrders = useMemo(() => {
        if (stats.length === 0) return 1;
        return Math.max(...stats.map(s => s.totalOrders));
    }, [stats]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return `${mins}m ${secs}s`;
    };

    if (!isOpen) return null;

    const portalRoot = document.getElementById('portal-root');
    if (!portalRoot) return null;

    return createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/95 animate-in fade-in duration-200"
                onClick={onClose}
            />

            <div className="relative bg-gray-900 border border-gray-800 rounded-[32px] w-full max-w-2xl shadow-2xl transition-all duration-200 overflow-hidden text-white">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                            <ChartBarIcon className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black italic uppercase tracking-tighter">Estadísticas de Chef</h2>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Productividad y tiempos de hoy</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-2xl transition-all active:scale-95"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-48">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Cargando datos...</p>
                        </div>
                    ) : stats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 opacity-50">
                            <ChartBarIcon className="w-12 h-12 text-gray-600 mb-4" />
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest tracking-widest">Sin datos registrados hoy</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {stats.map((chef, idx) => (
                                <div
                                    key={idx}
                                    className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700/50 hover:border-blue-500/30 transition-colors group"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-500 transition-colors">
                                                <UserIcon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white uppercase tracking-tight">{chef.chefName}</h3>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] font-black text-gray-500 uppercase">Ordenes terminadas:</span>
                                                    <span className="text-[10px] font-black text-blue-400">{chef.totalOrders}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-1 text-amber-500 mb-1">
                                                <ClockIcon className="w-3 h-3" />
                                                <span className="text-xs font-mono font-bold">{formatTime(chef.avgPrepTimeSeconds)}</span>
                                            </div>
                                            <span className="text-[9px] font-black text-gray-600 uppercase tracking-wider">Promedio prep.</span>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                                            style={{ width: `${(chef.totalOrders / maxOrders) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="p-4 bg-gray-950/50 border-t border-gray-800 flex justify-between items-center">
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">Restaurante OS - Productivity AI</p>
                    <button
                        onClick={loadStats}
                        className="text-[9px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest transition-colors"
                    >
                        Actualizar
                    </button>
                </div>
            </div>
        </div>,
        portalRoot
    );
};

export default ChefStatsModal;
