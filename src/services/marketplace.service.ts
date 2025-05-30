import * as MarketplaceDB from '../models/marketplace.db';
import * as UserDB from '../models/user.db'; // For seller validation
import * as CategoryDB from '../models/marketplace.db'; // Using same DB file for categories
import {
  MarketplaceItem, CreateItemDTO, UpdateItemDTO, MarketplaceFilterDTO, MarketplacePaginationOptions, PaginatedMarketplaceItems,
  MarketplaceCategory, CreateMarketplaceCategoryDTO, UpdateMarketplaceCategoryDTO, PaginatedMarketplaceCategories, ItemStatus, ItemCondition
} from '../models/marketplace.types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;

// --- Marketplace Item Services ---
export const listItem = async (data: CreateItemDTO): Promise<MarketplaceItem> => {
  const seller = await UserDB.findUserById(data.seller_id);
  if (!seller) throw new Error('Seller not found.');

  const category = await CategoryDB.findMarketplaceCategoryById(data.category_id);
  if (!category) throw new Error('Category not found.');

  if (!data.title || data.title.trim() === '') throw new Error('Item title is required.');
  if (data.price === undefined || data.price < 0) throw new Error('Item price must be a non-negative number.');
  if (!data.currency || data.currency.trim().length !== 3) throw new Error('Valid 3-letter currency code is required.');
  if (!data.condition || !['new', 'like_new', 'good', 'fair', 'poor'].includes(data.condition)) {
    throw new Error('Invalid item condition specified.');
  }
  // Add more validation as needed (e.g., image URLs, location details)

  return MarketplaceDB.createMarketplaceItem(data);
};

export const getItemById = async (itemId: string): Promise<MarketplaceItem | null> => {
  const item = await MarketplaceDB.findMarketplaceItemById(itemId);
  if (!item || item.status === 'delisted') { // Do not show delisted items directly by ID unless admin
      return null;
  }
  return item;
};

export const getAllItems = async (
  filters: MarketplaceFilterDTO,
  pagination: MarketplacePaginationOptions
): Promise<MarketplaceItem[]> => { // Consider PaginatedMarketplaceItems
  filters.status = filters.status || ['available', 'pending', 'sold']; // Default visible statuses
  return MarketplaceDB.findAllMarketplaceItems(filters, pagination);
};

export const updateListedItem = async (
  itemId: string,
  sellerId: string, // User attempting update
  updateData: UpdateItemDTO
): Promise<MarketplaceItem | null> => {
  const item = await MarketplaceDB.findMarketplaceItemById(itemId);
  if (!item) throw new Error('Marketplace item not found.');
  if (item.seller_id !== sellerId) {
    throw new Error('User not authorized to update this item.');
  }

  if (updateData.category_id) {
    const category = await CategoryDB.findMarketplaceCategoryById(updateData.category_id);
    if (!category) throw new Error('New category not found.');
  }
  if (updateData.price !== undefined && updateData.price < 0) throw new Error('Price must be non-negative.');
  if (updateData.currency && updateData.currency.trim().length !== 3) throw new Error('Valid 3-letter currency code is required.');
  if (updateData.condition && !['new', 'like_new', 'good', 'fair', 'poor'].includes(updateData.condition)) {
    throw new Error('Invalid item condition specified.');
  }
  if (updateData.status && !['available', 'sold', 'pending', 'delisted'].includes(updateData.status)) {
    throw new Error('Invalid item status specified.');
  }

  return MarketplaceDB.updateMarketplaceItemInDB(itemId, sellerId, updateData);
};

export const delistOrDeleteItem = async (itemId: string, sellerId: string, hardDelete: boolean = false): Promise<boolean> => {
  const item = await MarketplaceDB.findMarketplaceItemById(itemId);
  if (!item) throw new Error('Marketplace item not found.');
  if (item.seller_id !== sellerId) {
    throw new Error('User not authorized to modify this item.');
  }

  if (hardDelete) {
    return MarketplaceDB.deleteMarketplaceItemFromDB(itemId, sellerId);
  } else {
    // Soft delete by changing status to 'delisted'
    const updatedItem = await MarketplaceDB.updateMarketplaceItemInDB(itemId, sellerId, { status: 'delisted' });
    return !!updatedItem;
  }
};

// --- Marketplace Category Services ---
export const createNewCategory = async (data: CreateMarketplaceCategoryDTO /*, adminUserId: string */): Promise<MarketplaceCategory> => {
  // TODO: Add admin role check for adminUserId if this is an admin-only action
  if (!data.name || data.name.trim() === '') throw new Error('Category name is required.');
  if (data.parent_category_id) {
      const parentCategory = await CategoryDB.findMarketplaceCategoryById(data.parent_category_id);
      if (!parentCategory) throw new Error('Parent category not found.');
  }
  return CategoryDB.createMarketplaceCategory(data);
};

export const getAllCategories = async (parentCategoryId?: string | null): Promise<MarketplaceCategory[]> => {
  // `null` for top-level, `undefined` for all, or a specific ID for sub-categories
  return CategoryDB.findAllMarketplaceCategories(parentCategoryId === null ? undefined : parentCategoryId);
};


export const getCategoryById = async (categoryId: string): Promise<MarketplaceCategory | null> => {
  return CategoryDB.findMarketplaceCategoryById(categoryId);
};

export const updateExistingCategory = async (
  categoryId: string,
  updateData: UpdateMarketplaceCategoryDTO
  /*, adminUserId: string */
): Promise<MarketplaceCategory | null> => {
  // TODO: Add admin role check
  const category = await CategoryDB.findMarketplaceCategoryById(categoryId);
  if (!category) throw new Error('Category not found.');
  if (updateData.name !== undefined && updateData.name.trim() === '') throw new Error('Category name cannot be empty.');
  if (updateData.parent_category_id) {
      if (updateData.parent_category_id === categoryId) throw new Error('Category cannot be its own parent.');
      const parentCategory = await CategoryDB.findMarketplaceCategoryById(updateData.parent_category_id);
      if (!parentCategory) throw new Error('Parent category not found.');
  }
  return CategoryDB.updateMarketplaceCategoryInDB(categoryId, updateData);
};

export const deleteExistingCategory = async (categoryId: string /*, adminUserId: string */): Promise<boolean> => {
  // TODO: Add admin role check
  const category = await CategoryDB.findMarketplaceCategoryById(categoryId);
  if (!category) throw new Error('Category not found.');

  // Check if category is in use by any items or as a parent.
  // This is a simplified check. A real app might need more robust checks or allow re-assigning items.
  const itemsInCategory = await MarketplaceDB.findAllMarketplaceItems({ category_id: categoryId }, {limit: 1});
  if (itemsInCategory.length > 0) {
      throw new Error('Cannot delete category: it is currently associated with marketplace items.');
  }
  const childCategories = await CategoryDB.findAllMarketplaceCategories(categoryId);
   if (childCategories.length > 0) {
      throw new Error('Cannot delete category: it has sub-categories. Delete or re-assign them first.');
  }

  return CategoryDB.deleteMarketplaceCategoryFromDB(categoryId);
};
