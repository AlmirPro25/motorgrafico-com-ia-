import React from 'react';

type Asset = {
  id: string;
  name: string;
  type: string;
  thumbnailUrl: string;
};

type AssetCardProps = {
  asset: Asset;
  onView: (assetId: string) => void;
  onDelete: (assetId: string) => void;
};

const AssetCard: React.FC<AssetCardProps> = ({ asset, onView, onDelete }) => {
  return (
    <div className="asset-card">
      <img src={asset.thumbnailUrl} alt={asset.name} />
      <h3>{asset.name}</h3>
      <p>Type: {asset.type}</p>
      <button onClick={() => onView(asset.id)}>View</button>
      <button onClick={() => onDelete(asset.id)}>Delete</button>
    </div>
  );
};

export default AssetCard;
