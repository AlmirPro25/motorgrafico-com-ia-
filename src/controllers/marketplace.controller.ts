import { Request, Response, NextFunction } from 'express';
import * as MarketplaceService from '../services/marketplace.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import {
  CreateItemDTO, UpdateItemDTO, MarketplaceFilterDTO, MarketplacePaginationOptions,
  CreateMarketplaceCategoryDTO, UpdateMarketplaceCategoryDTO, ItemCondition, ItemStatus
} from '../models/marketplace.types';

const getPaginationOptions = (req: Request): MarketplacePaginationOptions => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 12; // Default 12 for marketplace
    return { page: Math.max(1, page), limit: Math.max(1, Math.min(50, limit)) };
};

// --- Marketplace Item Handlers ---
export const listItemHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const dto: CreateItemDTO = { ...req.body, seller_id: req.user.userId };
        
        // Basic validation (more in service)
        if (!dto.title || !dto.category_id || dto.price === undefined || !dto.currency || !dto.condition) {
            return res.status(400).json({ error: 'Title, category_id, price, currency, and condition are required.' });
        }
        const item = await MarketplaceService.listItem(dto);
        res.status(201).json(item);
    } catch (error) {
        if (error instanceof Error && (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('required'))) {
            return res.status(400).json({ error: error.message });
        }
        next(error);
    }
};

export const listItemsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filters: MarketplaceFilterDTO = {
            category_id: req.query.category_id as string,
            search_term: req.query.search_term as string,
            min_price: req.query.min_price ? parseFloat(req.query.min_price as string) : undefined,
            max_price: req.query.max_price ? parseFloat(req.query.max_price as string) : undefined,
            condition: req.query.condition ? (req.query.condition as string).split(',') as ItemCondition[] : undefined,
            status: req.query.status ? (req.query.status as string).split(',') as ItemStatus[] : undefined,
            seller_id: req.query.seller_id as string,
            sort_by: req.query.sort_by as MarketplaceFilterDTO['sort_by'],
            // Add other filters like location from query params
        };
        const pagination = getPaginationOptions(req);
        const items = await MarketplaceService.getAllItems(filters, pagination);
        res.status(200).json(items); // TODO: Add pagination metadata
    } catch (error) {
        next(error);
    }
};

export const getItemHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const item = await MarketplaceService.getItemById(req.params.itemId);
        if (!item) return res.status(404).json({ error: 'Marketplace item not found or delisted.' });
        res.status(200).json(item);
    } catch (error) {
        next(error);
    }
};

export const updateItemHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const dto: UpdateItemDTO = req.body;
        if (Object.keys(dto).length === 0) return res.status(400).json({ error: 'No update data provided.'});
        
        const item = await MarketplaceService.updateListedItem(req.params.itemId, req.user.userId, dto);
        res.status(200).json(item);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
            if (error.message.includes('Invalid') || error.message.includes('must be')) return res.status(400).json({ error: error.message });
        }
        next(error);
    }
};

export const deleteItemHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const hardDelete = req.query.hardDelete === 'true'; // Optional: allow hard delete via query param
        await MarketplaceService.delistOrDeleteItem(req.params.itemId, req.user.userId, hardDelete);
        res.status(204).send();
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
        }
        next(error);
    }
};

// --- Marketplace Category Handlers ---
export const listCategoriesHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // parent_category_id=null for top-level, or specific ID for sub-categories
        // If query param is absent, service fetches all. If present but empty string, also all.
        const parentCategoryId = req.query.parent_category_id as string | undefined | null; 
        const categories = await MarketplaceService.getAllCategories(parentCategoryId);
        res.status(200).json(categories);
    } catch (error) {
        next(error);
    }
};

// Optional Admin Category CRUD - requires admin middleware
const isAdmin = (req: AuthenticatedRequest): boolean => {
    // Placeholder for actual admin check logic (e.g., req.user.role === 'admin')
    // This should be implemented via a proper admin role in User model and an admin middleware.
    // For now, let's assume if a user is authenticated, they can manage categories for testing.
    // In a real app, this would be a critical security check.
    console.warn("WARN: Admin check for category management is a placeholder!");
    return !!req.user; 
};

export const createCategoryHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'User not authorized (admin only).' });
        const dto: CreateMarketplaceCategoryDTO = req.body;
        if (!dto.name) return res.status(400).json({ error: 'Category name is required.' });
        const category = await MarketplaceService.createNewCategory(dto);
        res.status(201).json(category);
    } catch (error) {
        if (error instanceof Error && (error.message.includes('not found') || error.message.includes('required'))) {
            return res.status(400).json({ error: error.message });
        }
        next(error);
    }
};

export const updateCategoryHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'User not authorized (admin only).' });
        const { categoryId } = req.params;
        const dto: UpdateMarketplaceCategoryDTO = req.body;
         if (Object.keys(dto).length === 0) return res.status(400).json({ error: 'No update data provided.'});

        const category = await MarketplaceService.updateExistingCategory(categoryId, dto);
        res.status(200).json(category);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found') || error.message.includes('cannot be empty') || error.message.includes('cannot be its own parent')) {
                 return res.status(400).json({ error: error.message });
            }
        }
        next(error);
    }
};

export const deleteCategoryHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'User not authorized (admin only).' });
        const { categoryId } = req.params;
        await MarketplaceService.deleteExistingCategory(categoryId);
        res.status(204).send();
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('Cannot delete category')) return res.status(400).json({ error: error.message });
        }
        next(error);
    }
};
