'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Trophy, Globe, Users } from 'lucide-react';

interface Championship {
  id: string;
  name: string;
  poolCount: number;
}

interface ChampionshipSelectorProps {
  championships: Championship[];
  selectedChampionships: string[];
  onChampionshipChange: (championshipIds: string[]) => void;
  loading?: boolean;
}

export default function ChampionshipSelector({ 
  championships, 
  selectedChampionships, 
  onChampionshipChange, 
  loading = false 
}: ChampionshipSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleChampionshipToggle = (championshipId: string) => {
    const isSelected = selectedChampionships.includes(championshipId);
    let newSelection: string[];
    
    if (isSelected) {
      newSelection = selectedChampionships.filter(id => id !== championshipId);
    } else {
      newSelection = [...selectedChampionships, championshipId];
    }
    
    onChampionshipChange(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedChampionships.length === championships.length) {
      onChampionshipChange([]);
    } else {
      onChampionshipChange(championships.map(c => c.id));
    }
  };

  const getChampionshipIcon = (championship: string) => {
    const champ = championship?.toLowerCase() || '';
    if (champ.includes('copa') || champ.includes('cup')) {
      return <Trophy className="w-4 h-4" />;
    }
    if (champ.includes('mundial') || champ.includes('world')) {
      return <Globe className="w-4 h-4" />;
    }
    return <Users className="w-4 h-4" />;
  };

  const getChampionshipColor = (championship: string) => {
    const champ = championship?.toLowerCase() || '';
    if (champ.includes('brasileirão') || champ.includes('serie a')) return 'text-green-400';
    if (champ.includes('copa')) return 'text-yellow-400';
    if (champ.includes('libertadores')) return 'text-blue-400';
    if (champ.includes('champions')) return 'text-purple-400';
    if (champ.includes('mundial') || champ.includes('world')) return 'text-orange-400';
    return 'text-gray-400';
  };

  const getDisplayText = () => {
    if (selectedChampionships.length === 0) {
      return 'Selecione os campeonatos';
    }
    if (selectedChampionships.length === championships.length) {
      return 'Todos os campeonatos';
    }
    if (selectedChampionships.length === 1) {
      const selected = championships.find(c => c.id === selectedChampionships[0]);
      return selected?.name || 'Campeonato selecionado';
    }
    return `${selectedChampionships.length} campeonatos selecionados`;
  };

  return (
    <div className="relative z-40" ref={dropdownRef}>
      <div className="relative z-40 bg-gradient-to-r from-green-600/20 to-blue-600/20 backdrop-blur-sm rounded-xl p-6 border border-white/10 mb-6">
        <label className="block text-white text-sm font-medium mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Filtrar por campeonatos:
        </label>
        
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={loading}
            className={`
              w-full bg-white/10 hover:bg-white/15 text-white border border-white/20 
              rounded-lg px-4 py-4 focus:outline-none focus:ring-2 focus:ring-green-500 
              transition-all duration-200 flex items-center justify-between
              ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-green-400" />
              <div className="text-left">
                <div className="font-medium">{getDisplayText()}</div>
                <div className="text-xs text-gray-400">
                  {selectedChampionships.length > 0 
                    ? `${selectedChampionships.length} de ${championships.length} selecionados`
                    : 'Nenhum campeonato selecionado'
                  }
                </div>
              </div>
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
              {/* Opção selecionar todos */}
              <button
                onClick={handleSelectAll}
                className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors duration-150 flex items-center gap-3 border-b border-white/10"
              >
                <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${
                  selectedChampionships.length === championships.length 
                    ? 'bg-green-500 border-green-500' 
                    : 'border-gray-400'
                }`}>
                  {selectedChampionships.length === championships.length && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-white">
                    {selectedChampionships.length === championships.length ? 'Desmarcar todos' : 'Selecionar todos'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {championships.length} campeonatos disponíveis
                  </div>
                </div>
              </button>

              {/* Lista de campeonatos */}
              {championships.map((championship) => {
                const isSelected = selectedChampionships.includes(championship.id);
                return (
                  <button
                    key={championship.id}
                    onClick={() => handleChampionshipToggle(championship.id)}
                    className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors duration-150 flex items-center gap-3"
                  >
                    <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${
                      isSelected ? 'bg-green-500 border-green-500' : 'border-gray-400'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    {getChampionshipIcon(championship.name)}
                    <div className="flex-1">
                      <div className="font-medium text-white">{championship.name}</div>
                      <div className={`text-xs ${getChampionshipColor(championship.name)}`}>
                        {championship.poolCount} bolão{championship.poolCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </button>
                );
              })}

              {championships.length === 0 && (
                <div className="px-4 py-6 text-center text-gray-400">
                  <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <div className="text-sm">Nenhum campeonato encontrado</div>
                  <div className="text-xs mt-1">Aguarde o carregamento dos dados</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Informações adicionais */}
        {selectedChampionships.length > 0 && (
          <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Campeonatos selecionados:</span>
              <span className="font-medium text-green-300">
                {selectedChampionships.length} de {championships.length}
              </span>
            </div>
            {selectedChampionships.length < championships.length && (
              <div className="text-xs text-gray-400 mt-2">
                Jogos de outros campeonatos não serão exibidos
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}