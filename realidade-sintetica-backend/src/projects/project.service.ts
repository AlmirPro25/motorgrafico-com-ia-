import { Project, Prisma } from '@prisma/client'; // Keep Project type, Prisma for JsonValue/JsonNull
import { CreateProjectInput } from './project.validations'; // Use Zod type for input consistency

// In-memory store for projects
let mockProjectDB: Project[] = [];
let nextProjectId = 1; // Simple ID generator

/**
 * Creates a new project for a given user using in-memory mock storage.
 * @param data - The data for the new project (validated by Zod).
 * @param userId - The ID of the user creating the project.
 * @returns The created project.
 */
export const createNewProject = async (
  data: CreateProjectInput,
  userId: string
): Promise<Project> => {
  const newProject: Project = {
    id: `mockProject_${nextProjectId++}`,
    name: data.name,
    description: data.description ?? null,
    settings: (data.settings as Prisma.JsonValue) ?? Prisma.JsonNull, // Prisma.JsonNull for explicit null in JSON field
    userId: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    thumbnailUrl: data.thumbnailUrl ?? null,
    category: data.category ?? null,
    tags: data.tags ?? [], // Default to empty array if undefined
    isPublic: data.isPublic ?? false,
    version: 1, // Default version
    lastPublishedAt: null, // Default
    // Additional fields from the Project model with mock defaults
    // averageRating: null, // Assuming these are not in the current Project model from schema
    // viewCount: 0,
    // totalLikes: 0,
    // sceneDataId: null,
    // configDataId: null,
  };
  mockProjectDB.push(newProject);
  console.log('Mock DB after create:', JSON.stringify(mockProjectDB, null, 2));
  return newProject;
};

/**
 * Retrieves all projects for a given user from in-memory mock storage.
 * @param userId - The ID of the user.
 * @returns A list of projects.
 */
export const getProjectsByUserId = async (userId: string): Promise<Project[]> => {
  const projects = mockProjectDB.filter(p => p.userId === userId);
  console.log(`Mock: Fetching projects for user ${userId}, found:`, JSON.stringify(projects, null, 2));
  return projects;
};

/**
 * Retrieves details for a specific project by ID and user ID from in-memory mock storage.
 * @param projectId - The ID of the project.
 * @param userId - The ID of the user (for ownership verification).
 * @returns The project details or null if not found or not owned.
 */
export const getProjectDetails = async (projectId: string, userId: string): Promise<Project | null> => {
  const project = mockProjectDB.find(p => p.id === projectId && p.userId === userId);
  console.log(`Mock: Fetching project ${projectId} for user ${userId}, found:`, JSON.stringify(project, null, 2));
  return project || null;
};

/**
 * Updates an existing project in in-memory mock storage.
 * @param projectId - The ID of the project to update.
 * @param data - The partial data to update the project with.
 * @param userId - The ID of the user (for ownership verification).
 * @returns The updated project or null if not found or not owned.
 */
export const updateExistingProject = async (
  projectId: string,
  data: Partial<CreateProjectInput>,
  userId: string
): Promise<Project | null> => {
  const projectIndex = mockProjectDB.findIndex(p => p.id === projectId && p.userId === userId);
  if (projectIndex === -1) {
    console.log(`Mock: Project ${projectId} not found for user ${userId} during update.`);
    return null;
  }

  const existingProject = mockProjectDB[projectIndex];
  const updatedProject: Project = {
    ...existingProject,
    name: data.name ?? existingProject.name,
    description: data.description !== undefined ? data.description : existingProject.description, // Allow setting description to null
    settings: data.settings !== undefined ? (data.settings as Prisma.JsonValue) : existingProject.settings,
    thumbnailUrl: data.thumbnailUrl !== undefined ? data.thumbnailUrl : existingProject.thumbnailUrl,
    category: data.category !== undefined ? data.category : existingProject.category,
    tags: data.tags !== undefined ? data.tags : existingProject.tags, // Keep as array
    isPublic: data.isPublic !== undefined ? data.isPublic : existingProject.isPublic,
    updatedAt: new Date(),
    // version: data.version ?? existingProject.version, // Assuming version is not part of CreateProjectInput directly for now
  };

  mockProjectDB[projectIndex] = updatedProject;
  console.log(`Mock: Updated project ${projectId}`, JSON.stringify(updatedProject, null, 2));
  return updatedProject;
};

/**
 * Deletes an existing project from in-memory mock storage.
 * @param projectId - The ID of the project to delete.
 * @param userId - The ID of the user (for ownership verification).
 * @returns The deleted project or null if not found or not owned.
 */
export const deleteExistingProject = async (projectId: string, userId: string): Promise<Project | null> => {
  const projectIndex = mockProjectDB.findIndex(p => p.id === projectId && p.userId === userId);
  if (projectIndex === -1) {
    console.log(`Mock: Project ${projectId} not found for user ${userId} during delete.`);
    return null;
  }
  const deletedProject = mockProjectDB.splice(projectIndex, 1)[0];
  console.log(`Mock: Deleted project ${projectId}`, JSON.stringify(deletedProject, null, 2));
  return deletedProject;
};

/**
 * Retrieves details for a specific processing job related to a project (mocked).
 * @param jobId - The ID of the job.
 * @param projectId - The ID of the project.
 * @param userId - The ID of the user (for ownership verification, though not used in this mock).
 * @returns Null, as this is a placeholder.
 */
export const getJobDetails = async (jobId: string, projectId: string, userId: string): Promise<any | null> => {
  console.log(`Mock: Fetching job ${jobId} for project ${projectId}, user ${userId} (service placeholder - always returns null)`);
  return null;
};

// Helper function to reset the mock database (useful for testing)
export const __resetMockDB = () => {
  mockProjectDB = [];
  nextProjectId = 1;
  console.log('Mock project DB has been reset.');
};
