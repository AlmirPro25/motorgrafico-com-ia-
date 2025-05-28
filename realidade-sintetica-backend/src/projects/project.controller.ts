import { Request, Response, NextFunction } from 'express';
import * as projectService from './project.service';
// Removed direct import of ProjectCreateData as it's inferred or handled by Zod type
import { createProjectSchema, CreateProjectInput } from './project.validations'; // Import Zod schema and type

export const createProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = createProjectSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid input data.',
        errors: validationResult.error.flatten().fieldErrors, // Detailed errors
      });
    }

    const projectData: CreateProjectInput = validationResult.data;

    // TEMPORARY: For now, as auth middleware isn't in place, let's use a placeholder userId
    const userId = 'clplaceholderuser123'; // Replace with actual user ID from auth
    if (!userId) {
        return res.status(401).json({ message: 'User ID not found. Authentication required.' });
    }

    const newProject = await projectService.createNewProject(projectData, userId); // projectData is now validated and typed
    res.status(201).json(newProject);
  } catch (error) {
    next(error);
  }
};

export const listProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // const userId = (req as any).user?.id; // Actual user ID from auth
    // if (!userId) {
    //   return res.status(401).json({ message: 'User ID not found. Authentication required.' });
    // }
    // const projects = await projectService.getProjectsByUserId(userId);
    // res.status(200).json(projects);
    res.status(200).json({ message: 'Projects listed (placeholder)', data: [] });
  } catch (error) {
    next(error);
  }
};

export const getProjectById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    // const userId = (req as any).user?.id; // Actual user ID from auth
    // if (!userId) {
    //   return res.status(401).json({ message: 'User ID not found. Authentication required.' });
    // }
    // const project = await projectService.getProjectDetails(projectId, userId);
    // if (!project) {
    //   return res.status(404).json({ message: 'Project not found or user not authorized.' });
    // }
    // res.status(200).json(project);
    res.status(200).json({ message: `Project ${projectId} details (placeholder)`, data: null });
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const projectData = req.body as Partial<CreateProjectInput>; // Use Partial of Zod type for updates
    // const userId = (req as any).user?.id; // Actual user ID from auth
    // if (!userId) {
    //   return res.status(401).json({ message: 'User ID not found. Authentication required.' });
    // }
    // const updatedProject = await projectService.updateExistingProject(projectId, projectData, userId);
    // if (!updatedProject) {
    //   return res.status(404).json({ message: 'Project not found or user not authorized to update.' });
    // }
    // res.status(200).json(updatedProject);
    res.status(200).json({ message: `Project ${projectId} updated (placeholder)`, data: { ...projectData } }); // projectData is Partial<CreateProjectInput>
  } catch (error) {
    next(error);
  }
};

export const deleteProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    // const userId = (req as any).user?.id; // Actual user ID from auth
    // if (!userId) {
    //   return res.status(401).json({ message: 'User ID not found. Authentication required.' });
    // }
    // const deletedProject = await projectService.deleteExistingProject(projectId, userId);
    // if (!deletedProject) {
    //   return res.status(404).json({ message: 'Project not found or user not authorized to delete.' });
    // }
    // res.status(200).json({ message: `Project ${projectId} deleted successfully.` });
    res.status(200).json({ message: `Project ${projectId} deleted (placeholder)` });
  } catch (error) {
    next(error);
  }
};

export const getJobStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, jobId } = req.params; // Assuming projectId is also part of the route
    // const userId = (req as any).user?.id; // Actual user ID from auth
    // if (!userId) {
    //   return res.status(401).json({ message: 'User ID not found. Authentication required.' });
    // }
    // const job = await projectService.getJobDetails(jobId, projectId, userId); // Pass userId for auth check in service
    // if (!job) {
    //   return res.status(404).json({ message: 'Job not found or not associated with an authorized project.' });
    // }
    // res.status(200).json(job);
    res.status(200).json({ message: `Job ${jobId} status for project ${projectId} (placeholder)`, data: null });
  } catch (error) {
    next(error);
  }
};
