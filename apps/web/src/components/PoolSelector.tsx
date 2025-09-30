'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Trophy, Users } from 'lucide-react';

interface Pool {
  id: string;
  name: string;
  code: string;
  championship: string;
}

interface PoolSelectorProps {
  pools: Pool[];
  selectedPoolId: string | null;
  onPoolChange: (poolId: string | null) => void;
  loading?: boolean;
}

export default function PoolSelector({ pools, selectedPoolId, onPoolChange, loading = false }: PoolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedPool = pools.find(pool => pool.id === selectedPoolId);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePoolSelect = (poolId: string | null) => {
    onPoolChange(poolId);
    setIsOpen(false);
  };

  const getChampionshipIcon = (championship: string) => {
    if (championship?.toLowerCase().includes('copa') || championship?.toLowerCase().includes('cup')) {
      return <Trophy className="w-4 h-4" />;
    }
    return <Users className="w-4 h-4" />;
  };

  const getChampionshipColor = (championship: string) => {
    const champ = championship?.toLowerCase() || '';
    if (champ.includes('brasileirão') || champ.includes('serie a')) return 'text-green-400';
    if (champ.includes('copa')) return 'text-yellow-400';
    if (champ.includes('libertadores')) return 'text-blue-400';
    if (champ.includes('champions')) return 'text-purple-400';
    return 'text-gray-400';
  };

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <div className="relative z-50 bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm rounded-xl p-6 border border-white/10 mb-6">
        <label className="block text-white text-sm font-medium mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Selecione seu bolão:
        </label>
        
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={loading}
            className={`
              w-full bg-white/10 hover:bg-white/15 text-white border border-white/20 
              rounded-lg px-4 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 
              transition-all duration-200 flex items-center justify-between
              ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="flex items-center gap-3">
              {selectedPool ? (
                <>
                  {getChampionshipIcon(selectedPool.championship)}
                  <div className="text-left">
                    <div className="font-medium">{selectedPool.name}</div>
                    <div className={`text-xs ${getChampionshipColor(selectedPool.championship)}`}>
                      {selectedPool.championship || 'Campeonato não definido'}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Users className="w-5 h-5 text-gray-400" />
                  <div className="text-left">
                    <div className="font-medium">Modo público</div>
                    <div className="text-xs text-gray-400">Sem bolão selecionado</div>
                  </div>
                </>
              )}
            </div>
            
            <ChevronDown 
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`} 
            />
          </button>

          {/* Dropdown */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-xl z-[1000] max-h-64 overflow-y-auto">
              {/* Opção modo público */}
              <button
                onClick={() => handlePoolSelect(null)}
                className={`
                  w-full px-4 py-3 text-left hover:bg-white/10 transition-colors duration-150
                  flex items-center gap-3 border-b border-white/10
                  ${!selectedPoolId ? 'bg-blue-600/20' : ''}
                `}
              >
                <Users className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <div className="font-medium text-white">Modo público</div>
                  <div className="text-xs text-gray-400">Visualizar jogos sem bolão</div>
                </div>
                {!selectedPoolId && (
                  <Check className="w-5 h-5 text-blue-400" />
                )}
              </button>

              {/* Lista de bolões */}
              {pools.map((pool) => (
                <button
                  key={pool.id}
                  onClick={() => handlePoolSelect(pool.id)}
                  className={`
                    w-full px-4 py-3 text-left hover:bg-white/10 transition-colors duration-150
                    flex items-center gap-3
                    ${selectedPoolId === pool.id ? 'bg-blue-600/20' : ''}
                  `}
                >
                  {getChampionshipIcon(pool.championship)}
                  <div className="flex-1">
                    <div className="font-medium text-white">{pool.name}</div>
                    <div className={`text-xs ${getChampionshipColor(pool.championship)}`}>
                      {pool.championship || 'Campeonato não definido'}
                    </div>
                    {pool.code && (
                      <div className="text-xs text-gray-500 mt-1">
                        Código: {pool.code}
                      </div>
                    )}
                  </div>
                  {selectedPoolId === pool.id && (
                    <Check className="w-5 h-5 text-blue-400" />
                  )}
                </button>
              ))}

              {pools.length === 0 && (
                <div className="px-4 py-6 text-center text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <div className="text-sm">Nenhum bolão encontrado</div>
                  <div className="text-xs mt-1">Participe de um bolão para começar</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Informações adicionais */}
        {selectedPool && (
          <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Campeonato:</span>
              <span className={`font-medium ${getChampionshipColor(selectedPool.championship)}`}>
                {selectedPool.championship || 'Não definido'}
              </span>
            </div>
            {selectedPool.code && (
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-300">Código do bolão:</span>
                <span className="font-mono text-blue-300">{selectedPool.code}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}