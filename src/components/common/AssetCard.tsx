import React from 'react';
import { Asset } from '../../types/asset.types'; // Path from src/components/common/ to src/types/

// Placeholder SVGs para ícones
const ViewIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"> {/* Removed inline mr-1 for icon-only buttons */}
    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
  </svg>
);

const DeleteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"> {/* Removed inline mr-1 for icon-only buttons */}
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

type AssetCardProps = {
  asset: Asset;
  onView: (assetId: string) => void;
  onDelete: (assetId: string) => void;
};

const AssetCard: React.FC<AssetCardProps> = ({ asset, onView, onDelete }) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 ease-in-out flex flex-col"> {/* Added flex flex-col for structure */}
      <img
        src={asset.thumbnailUrl}
        alt={`Thumbnail de ${asset.name}`}
        className="w-full h-48 object-cover" // Altura fixa para a imagem, object-cover para preencher
      />
      <div className="p-4 flex-grow"> {/* Added flex-grow to allow this section to expand */}
        <h3 className="text-lg font-semibold text-primary mb-1 truncate" title={asset.name}>
          {asset.name}
        </h3>
        <span className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full mb-2 capitalize">
          {/* Using bg-green-100 text-green-800 as secondary-light/dark are not in theme */}
          {asset.type} 
        </span>
        {/* Adicionar descrição curta se disponível e desejado no futuro:
        <p className="text-sm text-gray-600 mb-3 truncate h-10">
          {asset.description || 'Sem descrição.'} 
        </p>
        */}
      </div>
      <div className="p-3 border-t border-gray-200 flex justify-end space-x-2 bg-gray-50"> {/* Adjusted padding and added bg-gray-50 */}
        <button
          onClick={() => onView(asset.id)}
          title="Visualizar"
          className="p-2 text-sm text-gray-600 hover:text-primary rounded-full hover:bg-gray-200 transition-colors duration-200" /* Added rounded-full and hover:bg for better visual feedback */
        >
          <ViewIcon />
          {/* Visualizar */}
        </button>
        <button
          onClick={() => onDelete(asset.id)}
          title="Deletar"
          className="p-2 text-sm text-gray-600 hover:text-red-600 rounded-full hover:bg-gray-200 transition-colors duration-200" /* Added rounded-full and hover:bg for better visual feedback */
        >
          <DeleteIcon />
          {/* Deletar */}
        </button>
      </div>
    </div>
  );
};

export default AssetCard;
