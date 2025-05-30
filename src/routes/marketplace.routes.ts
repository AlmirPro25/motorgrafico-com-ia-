import { Router } from 'express';
import * as MarketplaceController from '../controllers/marketplace.controller';
import { protect, AuthenticatedRequest } from '../middlewares/auth.middleware';
// import { adminProtect } from '../middlewares/admin.middleware'; // Hypothetical admin middleware

const router = Router();

// Helper for casting request for authenticated routes
const useAuth = <TParams = any, TResBody = any, TReqBody = any, TReqQuery = any>(
    handler: (req: AuthenticatedRequest<TParams, TResBody, TReqBody, TReqQuery>, res: Response, next: NextFunction) => Promise<void>
) => {
    return (req: Request<TParams, TResBody, TReqBody, TReqQuery>, res: Response, next: NextFunction) =>
        handler(req as AuthenticatedRequest<TParams, TResBody, TReqBody, TReqQuery>, res, next);
};

// --- Marketplace Item Routes ---
// POST /api/marketplace/items - List a new item
router.post('/items', protect, useAuth(MarketplaceController.listItemHandler));

// GET /api/marketplace/items - Get items with filters (public)
// Query params for filtering: ?category_id=...&search_term=...&min_price=...&max_price=...&condition=new,good&status=available&seller_id=...&sort_by=price_asc&page=1&limit=12
router.get('/items', MarketplaceController.listItemsHandler);

// GET /api/marketplace/items/{itemId} - Get item details (public)
router.get('/items/:itemId', MarketplaceController.getItemHandler);

// PUT /api/marketplace/items/{itemId} - Update item (seller only)
router.put('/items/:itemId', protect, useAuth(MarketplaceController.updateItemHandler));

// DELETE /api/marketplace/items/{itemId} - Delist/delete item (seller only)
// Query param: ?hardDelete=true for permanent deletion
router.delete('/items/:itemId', protect, useAuth(MarketplaceController.deleteItemHandler));


// --- Marketplace Category Routes ---
// GET /api/marketplace/categories - List categories (public)
// Query param: ?parent_category_id=... (or null/empty for top-level)
router.get('/categories', MarketplaceController.listCategoriesHandler);

// --- Optional Admin Routes for Categories ---
// These routes would ideally use an additional adminProtect middleware.
// For now, the isAdmin check is a placeholder within the controller.

// POST /api/marketplace/categories - Admin creates a new category
router.post('/categories', protect, useAuth(MarketplaceController.createCategoryHandler)); // protect + isAdmin in controller

// PUT /api/marketplace/categories/{categoryId} - Admin updates a category
router.put('/categories/:categoryId', protect, useAuth(MarketplaceController.updateCategoryHandler)); // protect + isAdmin

// DELETE /api/marketplace/categories/{categoryId} - Admin deletes a category
router.delete('/categories/:categoryId', protect, useAuth(MarketplaceController.deleteCategoryHandler)); // protect + isAdmin

export default router;
