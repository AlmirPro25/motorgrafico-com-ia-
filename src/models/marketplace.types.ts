import { PublicUserProfile } from './user.types';

export type ItemStatus = 'available' | 'sold' | 'pending' | 'delisted';
export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';

export interface MarketplaceCategory {
  id: string; // UUID or auto-increment
  name: string;
  description?: string;
  parent_category_id?: string; // For sub-categories
  created_at: Date;
  updated_at: Date;
}

export interface MarketplaceItem {
  id: string; // UUID
  seller_id: string; // Foreign key to Users table
  category_id: string; // Foreign key to MarketplaceCategories table
  title: string;
  description?: string;
  price: number; // Consider using a decimal type or integer for cents to avoid floating point issues
  currency: string; // e.g., 'USD', 'EUR'
  condition: ItemCondition;
  status: ItemStatus;
  image_urls?: string[]; // Array of URLs for item images
  location_city?: string;
  location_state_province?: string;
  location_country?: string;
  location_zip_code?: string;
  is_negotiable?: boolean;
  is_shippable?: boolean;
  is_pickup_available?: boolean;
  created_at: Date;
  updated_at: Date;
  listed_at?: Date; // When item became 'available'

  // Populated by services/queries
  seller_profile?: PublicUserProfile;
  category_details?: MarketplaceCategory;
}

// DTOs
export interface CreateItemDTO {
  seller_id: string;
  category_id: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  condition: ItemCondition;
  image_urls?: string[];
  location_city?: string;
  location_state_province?: string;
  location_country?: string;
  location_zip_code?: string;
  is_negotiable?: boolean;
  is_shippable?: boolean;
  is_pickup_available?: boolean;
  // status is 'available' by default on creation
}

export interface UpdateItemDTO {
  category_id?: string;
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  condition?: ItemCondition;
  status?: ItemStatus; // Seller can change status (e.g., to 'sold', 'pending')
  image_urls?: string[];
  location_city?: string;
  location_state_province?: string;
  location_country?: string;
  location_zip_code?: string;
  is_negotiable?: boolean;
  is_shippable?: boolean;
  is_pickup_available?: boolean;
}

export interface CreateMarketplaceCategoryDTO {
    name: string;
    description?: string;
    parent_category_id?: string;
}

export interface UpdateMarketplaceCategoryDTO {
    name?: string;
    description?: string;
    parent_category_id?: string;
}


export interface MarketplaceFilterDTO {
  category_id?: string;
  search_term?: string;
  min_price?: number;
  max_price?: number;
  condition?: ItemCondition[]; // Allow multiple conditions
  status?: ItemStatus[];       // Allow multiple statuses
  seller_id?: string;
  location_city?: string;
  location_state_province?: string;
  location_country?: string;
  is_negotiable?: boolean;
  is_shippable?: boolean;
  is_pickup_available?: boolean;
  // Sort options can also be part of filters
  sort_by?: 'price_asc' | 'price_desc' | 'date_newest' | 'date_oldest';
}

export interface MarketplacePaginationOptions {
    page?: number;
    limit?: number;
}

export interface PaginatedMarketplaceItems {
    items: MarketplaceItem[];
    total: number;
    page: number;
    limit: number;
}

export interface PaginatedMarketplaceCategories {
    categories: MarketplaceCategory[];
    total: number;
    page: number; // If categories become very numerous
    limit: number;
}
