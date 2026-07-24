
import React from 'react';
import { Branch } from '../types';
import { StoreIcon } from './icons';

interface BranchSelectionScreenProps {
    branches: Branch[];
    onSelectBranch: (branchId: number) => void;
    onLogout: () => void;
}

const BranchSelectionScreen: React.FC<BranchSelectionScreenProps> = ({ branches, onSelectBranch, onLogout }) => {
    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
            <h1 className="text-3xl md:text-4xl font-bold text-amber-400 mb-2 text-center">Seleccionar Sucursal</h1>
            <p className="text-gray-400 mb-8 text-center">Elige en qué ubicación deseas trabajar hoy.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl">
                {branches.filter(b => b.isActive).map(branch => (
                    <button
                        key={branch.id}
                        onClick={() => onSelectBranch(branch.id)}
                        className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-amber-500 rounded-xl p-6 flex flex-col items-center gap-4 transition-all transform hover:-translate-y-1 shadow-lg group"
                    >
                        <div className="bg-gray-700 group-hover:bg-amber-600 p-4 rounded-full transition-colors">
                            <StoreIcon className="w-10 h-10 text-white" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-white mb-1">{branch.name}</h3>
                            {branch.address && <p className="text-sm text-gray-400">{branch.address}</p>}
                        </div>
                    </button>
                ))}
            </div>

            <button 
                onClick={onLogout}
                className="mt-12 text-gray-500 hover:text-white transition-colors underline"
            >
                Cerrar Sesión / Cancelar
            </button>
        </div>
    );
};

export default BranchSelectionScreen;
