// src/types/asset.types.ts
export interface Asset {
  id: string;
  name: string;
  type: string; // e.g., 'mundo', 'personagem', 'objeto'
  thumbnailUrl: string;
  // Poderia adicionar outros campos no futuro, como:
  // description?: string;
  // createdAt?: Date;
  // status?: 'draft' | 'processing' | 'ready' | 'error';
}
