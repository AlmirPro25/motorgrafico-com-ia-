import React, { useState, useMemo } from 'react'; // Adicionar useMemo para otimizar a filtragem
import AssetCard from '../components/common/AssetCard';
import { Asset } from '../types/asset.types';
import InputField from '../components/common/InputField'; // Importar InputField

// Mock data for assets (assuming this is already here from previous step)
const mockAssets: Asset[] = [
  {
    id: '1',
    name: 'Mundo Fantástico Gerado',
    type: 'mundo',
    thumbnailUrl: 'https://via.placeholder.com/300x200/1A237E/FFFFFF?text=Mundo+1',
  },
  {
    id: '2',
    name: 'Personagem Guerreiro Alpha',
    type: 'personagem',
    thumbnailUrl: 'https://via.placeholder.com/300x200/64DD17/000000?text=Personagem+A',
  },
  {
    id: '3',
    name: 'Objeto Mágico Raro',
    type: 'objeto',
    thumbnailUrl: 'https://via.placeholder.com/300x200/FFCA28/000000?text=Objeto+X',
  },
  {
    id: '4',
    name: 'Renderização de Cena Noturna',
    type: 'render',
    thumbnailUrl: 'https://via.placeholder.com/300x200/455A64/FFFFFF?text=Render+XYZ',
  },
  {
    id: '5',
    name: 'Textura de Pedra Antiga',
    type: 'textura',
    thumbnailUrl: 'https://via.placeholder.com/300x200/795548/FFFFFF?text=Textura+Pedra',
  },
  { // Added for more diverse types
    id: '6',
    name: 'Mundo Desértico Vasto',
    type: 'mundo',
    thumbnailUrl: 'https://via.placeholder.com/300x200/D2691E/FFFFFF?text=Mundo+Deserto',
  },
];

// Exemplo de tipos de assets para o dropdown, derivado dos mockAssets
const assetTypes = ['todos', ...new Set(mockAssets.map(asset => asset.type.toLowerCase()))];


const LibraryPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('todos'); // 'todos' como valor padrão

  const handleViewAsset = (assetId: string) => {
    console.log('Visualizar asset (placeholder):', assetId);
    // Lógica futura: navegar para página de detalhes do asset ou abrir modal
  };

  const handleDeleteAsset = (assetId: string) => {
    console.warn('Deletar asset (placeholder):', assetId);
    // Lógica futura: chamar API para deletar e atualizar estado local
  };

  const filteredAssets = useMemo(() => {
    return mockAssets.filter(asset => {
      const nameMatch = searchTerm.toLowerCase()
        ? asset.name.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const typeMatch = selectedType !== 'todos'
        ? asset.type.toLowerCase() === selectedType.toLowerCase()
        : true;
      return nameMatch && typeMatch;
    });
  }, [searchTerm, selectedType]); // mockAssets não está na dependência pois é constante aqui

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold text-primary mb-6">
        Biblioteca de Assets Gerados
      </h1>

      {/* Seção de Filtros e Busca */}
      <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow-md"> {/* Adjusted bg and shadow */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4"> {/* Adjusted gap */}
          <InputField
            id="search-asset"
            label="Buscar por nome"
            type="text"
            placeholder="Digite o nome do asset..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div>
            <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Filtrar por tipo
            </label>
            <select
              id="type-filter"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md shadow-sm bg-white" // Added bg-white
            >
              {assetTypes.map(type => (
                <option key={type} value={type} className="capitalize">
                  {type === 'todos' ? 'Todos os Tipos' : type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grid de Assets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filteredAssets.length > 0 ? (
          filteredAssets.map(asset => ( // Usar filteredAssets aqui
            <AssetCard
              key={asset.id}
              asset={asset}
              onView={handleViewAsset}
              onDelete={handleDeleteAsset}
            />
          ))
        ) : (
          <p className="text-sm text-gray-500 col-span-full text-center py-10">
            Nenhum asset encontrado com os filtros atuais.
          </p>
        )}
      </div>
    </div>
  );
};

export default LibraryPage;
