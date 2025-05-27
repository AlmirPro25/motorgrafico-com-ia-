import { Router } from 'express';
// import * as projectController from '../projects/project.controller'; // Placeholder
// import * as assetController from '../assets/asset.controller'; // Placeholder
// import { isAuthenticated } from '../middlewares/auth.middleware'; // Placeholder

const router = Router();

// Protect all project routes
// router.use(isAuthenticated);

// Project routes
router.post('/', /* projectController.createProject */);
router.get('/', /* projectController.listProjects */);
router.get('/:projectId', /* projectController.getProjectById */);
router.put('/:projectId', /* projectController.updateProject */);
router.delete('/:projectId', /* projectController.deleteProject */);

// Asset routes nested under projects
router.get('/:projectId/assets', /* assetController.listAssets */);
router.post('/:projectId/assets', /* assetController.createAsset */);
router.get('/:projectId/assets/:assetId', /* assetController.getAssetById */);
router.put('/:projectId/assets/:assetId', /* assetController.updateAsset */);
router.delete('/:projectId/assets/:assetId', /* assetController.deleteAsset */);

// Media reference routes
router.post('/:projectId/assets/:assetId/media-references', /* assetController.addMediaReference */);

// Asset processing and job status routes
router.post('/:projectId/assets/:assetId/process', /* assetController.processAsset */);
router.get('/:projectId/jobs/:jobId', /* projectController.getJobStatus */); // Or move to a jobs.routes.ts if it becomes complex

export default router;
