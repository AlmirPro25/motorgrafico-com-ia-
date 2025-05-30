import { query } from '../config/db';
import {
  MarketplaceItem, CreateItemDTO, UpdateItemDTO, MarketplaceFilterDTO, MarketplacePaginationOptions,
  MarketplaceCategory, CreateMarketplaceCategoryDTO, UpdateMarketplaceCategoryDTO, ItemStatus
} from './marketplace.types';
import { PublicUserProfile } from './user.types';

const DEFAULT_PAGE_LIMIT = 12; // Common for marketplace listings

// --- Helper Functions ---
const mapRowToMarketplaceItem = (row: any): MarketplaceItem => ({
  id: row.id,
  seller_id: row.seller_id,
  category_id: row.category_id,
  title: row.title,
  description: row.description,
  price: parseFloat(row.price), // Ensure price is float/number
  currency: row.currency,
  condition: row.condition,
  status: row.status,
  image_urls: row.image_urls || [], // Handle NULL as empty array
  location_city: row.location_city,
  location_state_province: row.location_state_province,
  location_country: row.location_country,
  location_zip_code: row.location_zip_code,
  is_negotiable: row.is_negotiable,
  is_shippable: row.is_shippable,
  is_pickup_available: row.is_pickup_available,
  created_at: new Date(row.created_at),
  updated_at: new Date(row.updated_at),
  listed_at: row.listed_at ? new Date(row.listed_at) : undefined,
  seller_profile: row.seller_handle ? {
      id: row.seller_id,
      handle: row.seller_handle,
      first_name: row.seller_first_name,
      last_name: row.seller_last_name,
      profile_picture_url: row.seller_profile_picture_url,
  } : undefined,
  category_details: row.category_name ? {
      id: row.category_id,
      name: row.category_name,
      description: row.category_description, // Assuming these are joined
      parent_category_id: row.parent_category_id,
      created_at: new Date(row.category_created_at), // Assuming joined
      updated_at: new Date(row.category_updated_at), // Assuming joined
  } : undefined,
});

const mapRowToMarketplaceCategory = (row: any): MarketplaceCategory => ({
  id: row.id,
  name: row.name,
  description: row.description,
  parent_category_id: row.parent_category_id,
  created_at: new Date(row.created_at),
  updated_at: new Date(row.updated_at),
});

// --- MarketplaceItem Functions ---
export const createMarketplaceItem = async (data: CreateItemDTO): Promise<MarketplaceItem> => {
  const {
    seller_id, category_id, title, description, price, currency, condition,
    image_urls, location_city, location_state_province, location_country, location_zip_code,
    is_negotiable, is_shippable, is_pickup_available
  } = data;
  // Status defaults to 'available', listed_at defaults to NOW()
  const sql = `
    INSERT INTO "MarketplaceItems" (
      seller_id, category_id, title, description, price, currency, condition, status,
      image_urls, location_city, location_state_province, location_country, location_zip_code,
      is_negotiable, is_shippable, is_pickup_available, listed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'available', $8, $9, $10, $11, $12, $13, $14, $15, NOW())
    RETURNING id;
  `;
  try {
    const { rows } = await query(sql, [
      seller_id, category_id, title, description, price, currency, condition,
      image_urls, location_city, location_state_province, location_country, location_zip_code,
      is_negotiable, is_shippable, is_pickup_available
    ]);
    const newItem = await findMarketplaceItemById(rows[0].id);
    if (!newItem) throw new Error('Failed to create or find item after insertion.');
    return newItem;
  } catch (error) {
    console.error('Error creating marketplace item:', error);
    throw error;
  }
};

export const findMarketplaceItemById = async (itemId: string): Promise<MarketplaceItem | null> => {
  const sql = `
    SELECT
      mi.*,
      u.handle AS seller_handle, u.first_name AS seller_first_name, u.last_name AS seller_last_name, u.profile_picture_url AS seller_profile_picture_url,
      mc.name AS category_name, mc.description AS category_description, mc.parent_category_id AS parent_category_id, mc.created_at AS category_created_at, mc.updated_at AS category_updated_at
    FROM "MarketplaceItems" mi
    JOIN "Users" u ON mi.seller_id = u.id
    JOIN "MarketplaceCategories" mc ON mi.category_id = mc.id
    WHERE mi.id = $1;
  `;
  try {
    const { rows } = await query(sql, [itemId]);
    if (rows.length === 0) return null;
    return mapRowToMarketplaceItem(rows[0]);
  } catch (error) {
    console.error(`Error finding marketplace item by ID (${itemId}):`, error);
    throw error;
  }
};

export const findAllMarketplaceItems = async (
  filters: MarketplaceFilterDTO,
  pagination: MarketplacePaginationOptions
): Promise<MarketplaceItem[]> => {
  const { page = 1, limit = DEFAULT_PAGE_LIMIT } = pagination;
  const offset = (page - 1) * limit;
  let whereClauses: string[] = ["mi.status != 'delisted'"]; // Default: don't show delisted items unless specified
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (filters.category_id) {
    whereClauses.push(`mi.category_id = $${paramIndex++}`);
    queryParams.push(filters.category_id);
  }
  if (filters.search_term) {
    whereClauses.push(`(mi.title ILIKE $${paramIndex++} OR mi.description ILIKE $${paramIndex})`); // Same param index for OR
    queryParams.push(`%${filters.search_term}%`);
  }
  if (filters.min_price !== undefined) {
    whereClauses.push(`mi.price >= $${paramIndex++}`);
    queryParams.push(filters.min_price);
  }
  if (filters.max_price !== undefined) {
    whereClauses.push(`mi.price <= $${paramIndex++}`);
    queryParams.push(filters.max_price);
  }
  if (filters.condition && filters.condition.length > 0) {
    whereClauses.push(`mi.condition IN (${filters.condition.map(() => `$${paramIndex++}`).join(', ')})`);
    queryParams.push(...filters.condition);
  }
  if (filters.status && filters.status.length > 0) {
    // Override default delisted filter if status is explicitly passed
    whereClauses = whereClauses.filter(c => c !== "mi.status != 'delisted'");
    whereClauses.push(`mi.status IN (${filters.status.map(() => `$${paramIndex++}`).join(', ')})`);
    queryParams.push(...filters.status);
  }
  if (filters.seller_id) {
    whereClauses.push(`mi.seller_id = $${paramIndex++}`);
    queryParams.push(filters.seller_id);
  }
  // Add location filters here if needed (city, state, country)

  let orderByClause = 'ORDER BY mi.listed_at DESC'; // Default sort
  if (filters.sort_by) {
      switch(filters.sort_by) {
          case 'price_asc': orderByClause = 'ORDER BY mi.price ASC, mi.listed_at DESC'; break;
          case 'price_desc': orderByClause = 'ORDER BY mi.price DESC, mi.listed_at DESC'; break;
          case 'date_newest': orderByClause = 'ORDER BY mi.listed_at DESC'; break;
          case 'date_oldest': orderByClause = 'ORDER BY mi.listed_at ASC'; break;
      }
  }
  
  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  queryParams.push(limit, offset);

  const sql = `
    SELECT
      mi.*,
      u.handle AS seller_handle, u.first_name AS seller_first_name, u.last_name AS seller_last_name, u.profile_picture_url AS seller_profile_picture_url,
      mc.name AS category_name -- Only basic category name for list view for now
    FROM "MarketplaceItems" mi
    JOIN "Users" u ON mi.seller_id = u.id
    JOIN "MarketplaceCategories" mc ON mi.category_id = mc.id
    ${whereString}
    ${orderByClause}
    LIMIT $${paramIndex++} OFFSET $${paramIndex++};
  `;
  try {
    const { rows } = await query(sql, queryParams);
    return rows.map(mapRowToMarketplaceItem);
  } catch (error) {
    console.error('Error finding all marketplace items:', error);
    throw error;
  }
};

export const updateMarketplaceItemInDB = async (itemId: string, sellerId: string, data: UpdateItemDTO): Promise<MarketplaceItem | null> => {
  const fields = Object.keys(data) as Array<keyof UpdateItemDTO>;
  if (fields.length === 0) return findMarketplaceItemById(itemId);

  const setClauses = fields.map((field, i) => `"${field}" = $${i + 1}`).join(', ');
  const values = fields.map(field => data[field]);
  values.push(itemId, sellerId); // For WHERE clause

  const sql = `
    UPDATE "MarketplaceItems"
    SET ${setClauses}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${fields.length + 1} AND seller_id = $${fields.length + 2}
    RETURNING id;
  `;
  try {
    const { rows } = await query(sql, values);
    if (rows.length === 0) return null; // Not found or not owner
    return findMarketplaceItemById(rows[0].id);
  } catch (error) {
    console.error(`Error updating marketplace item (${itemId}):`, error);
    throw error;
  }
};

// Can be a soft delete (update status to 'delisted') or hard delete
export const deleteMarketplaceItemFromDB = async (itemId: string, sellerId: string): Promise<boolean> => {
  // This is a hard delete. For soft delete, use updateMarketplaceItemInDB to change status.
  const sql = `DELETE FROM "MarketplaceItems" WHERE id = $1 AND seller_id = $2;`;
  try {
    const result = await query(sql, [itemId, sellerId]);
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error(`Error deleting marketplace item (${itemId}):`, error);
    throw error;
  }
};

// --- MarketplaceCategory Functions ---
export const createMarketplaceCategory = async (data: CreateMarketplaceCategoryDTO): Promise<MarketplaceCategory> => {
  const { name, description, parent_category_id } = data;
  const sql = `
    INSERT INTO "MarketplaceCategories" (name, description, parent_category_id)
    VALUES ($1, $2, $3) RETURNING *;
  `;
  try {
    const { rows } = await query(sql, [name, description, parent_category_id]);
    return mapRowToMarketplaceCategory(rows[0]);
  } catch (error) {
    console.error('Error creating marketplace category:', error);
    throw error;
  }
};

export const findAllMarketplaceCategories = async (parentCategoryId?: string): Promise<MarketplaceCategory[]> => {
  let sql = 'SELECT * FROM "MarketplaceCategories"';
  const params: any[] = [];
  if (parentCategoryId === null || parentCategoryId === undefined) { // Fetch top-level categories
      sql += ' WHERE parent_category_id IS NULL ORDER BY name ASC;';
  } else if (parentCategoryId) { // Fetch sub-categories for a given parent
      sql += ' WHERE parent_category_id = $1 ORDER BY name ASC;';
      params.push(parentCategoryId);
  } else { // Fetch all categories if parentCategoryId is explicitly set to empty string or not provided in a way that implies filtering
      sql += ' ORDER BY name ASC;';
  }
  
  try {
    const { rows } = await query(sql, params);
    return rows.map(mapRowToMarketplaceCategory);
  } catch (error) {
    console.error('Error finding all marketplace categories:', error);
    throw error;
  }
};

export const findMarketplaceCategoryById = async (categoryId: string): Promise<MarketplaceCategory | null> => {
  const sql = `SELECT * FROM "MarketplaceCategories" WHERE id = $1;`;
  try {
    const { rows } = await query(sql, [categoryId]);
    return rows.length > 0 ? mapRowToMarketplaceCategory(rows[0]) : null;
  } catch (error) {
    console.error(`Error finding marketplace category by ID (${categoryId}):`, error);
    throw error;
  }
};

export const updateMarketplaceCategoryInDB = async (categoryId: string, data: UpdateMarketplaceCategoryDTO): Promise<MarketplaceCategory | null> => {
  const { name, description, parent_category_id } = data;
  // Ensure at least one field is being updated
  if (name === undefined && description === undefined && parent_category_id === undefined) {
    return findMarketplaceCategoryById(categoryId);
  }
  const sql = `
    UPDATE "MarketplaceCategories"
    SET name = COALESCE($1, name), description = COALESCE($2, description), parent_category_id = COALESCE($3, parent_category_id), updated_at = CURRENT_TIMESTAMP
    WHERE id = $4 RETURNING *;
  `;
  try {
    const { rows } = await query(sql, [name, description, parent_category_id, categoryId]);
    return rows.length > 0 ? mapRowToMarketplaceCategory(rows[0]) : null;
  } catch (error) {
    console.error(`Error updating marketplace category (${categoryId}):`, error);
    throw error;
  }
};

export const deleteMarketplaceCategoryFromDB = async (categoryId: string): Promise<boolean> => {
  // Consider implications: what happens to items in this category?
  // Option 1: Disallow delete if items exist.
  // Option 2: Set items' category_id to NULL or a default 'Uncategorized' category. (Requires items to allow NULL category_id or a default category)
  // Option 3: Cascade delete items (dangerous).
  // For now, simple delete. Service layer should check if category is in use.
  const sql = `DELETE FROM "MarketplaceCategories" WHERE id = $1;`;
  try {
    const result = await query(sql, [categoryId]);
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error(`Error deleting marketplace category (${categoryId}):`, error);
    throw error;
  }
};

// TODO: Count functions for pagination if needed.
// export const countAllMarketplaceItems = async (filters: MarketplaceFilterDTO): Promise<number> => { ... }
