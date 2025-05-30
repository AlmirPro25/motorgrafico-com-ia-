import { Request, Response, NextFunction } from 'express';
import * as GroupService from '../services/group.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import {
  CreateGroupDTO, UpdateGroupDTO, GroupFilterOptions, GroupPaginationOptions,
  GroupMemberRole, AddMemberDTO, UpdateMemberRoleDTO
} from '../models/group.types';
import { PostPaginationOptions, CreatePostDTO as GenericCreatePostDTO } from '../models/post.types';


const getPaginationOptions = (req: Request): GroupPaginationOptions => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    return { page: Math.max(1, page), limit: Math.max(1, Math.min(50, limit)) };
};
const getPostPaginationOptions = (req: Request): PostPaginationOptions => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    return { page: Math.max(1, page), limit: Math.max(1, Math.min(50, limit)) };
};

// --- Group Handlers ---
export const createGroupHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const dto: CreateGroupDTO = { ...req.body, creator_id: req.user.userId };
        if (!dto.name || !dto.type) return res.status(400).json({ error: 'Name and type are required.' });
        
        const group = await GroupService.createNewGroup(dto);
        res.status(201).json(group);
    } catch (error) {
        if (error instanceof Error && (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('required'))) {
            return res.status(400).json({ error: error.message });
        }
        next(error);
    }
};

export const listGroupsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUserId = (req as AuthenticatedRequest).user?.userId;
        const filters: GroupFilterOptions = {
            type: req.query.type as GroupFilterOptions['type'],
            user_is_member: req.query.user_is_member === 'true' ? currentUserId : undefined, // if true, pass currentUserId
            discoverable: req.query.discoverable === 'true' ? true : undefined,
        };
        if (req.query.user_is_member === 'true' && !currentUserId) {
             return res.status(401).json({ error: 'Authentication required to filter by your groups.' });
        }

        const pagination = getPaginationOptions(req);
        const groups = await GroupService.getAllGroups(filters, pagination, currentUserId);
        res.status(200).json(groups); // TODO: Add pagination metadata
    } catch (error) {
        next(error);
    }
};

export const getGroupDetailsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUserId = (req as AuthenticatedRequest).user?.userId;
        const group = await GroupService.getGroupDetails(req.params.groupId, currentUserId);
        if (!group) return res.status(404).json({ error: 'Group not found or not accessible.' });
        res.status(200).json(group);
    } catch (error) {
        next(error);
    }
};

export const updateGroupHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const dto: UpdateGroupDTO = req.body;
        if (Object.keys(dto).length === 0) return res.status(400).json({ error: 'No update data provided.'});
        
        const group = await GroupService.updateExistingGroup(req.params.groupId, req.user.userId, dto);
        res.status(200).json(group);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
            if (error.message.includes('Invalid')) return res.status(400).json({ error: error.message });
        }
        next(error);
    }
};

export const deleteGroupHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        await GroupService.deleteExistingGroup(req.params.groupId, req.user.userId);
        res.status(204).send();
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
        }
        next(error);
    }
};

// --- Group Member Handlers ---
export const joinOrRequestToJoinGroupHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const { groupId } = req.params;
        const group = await GroupService.getGroupDetails(groupId, req.user.userId); // Check visibility first
        if (!group) return res.status(404).json({ error: 'Group not found or not accessible.' });

        if (group.type === 'public') {
            const member = await GroupService.joinPublicGroup(groupId, req.user.userId);
            return res.status(200).json({ message: 'Successfully joined public group.', member });
        } else { // private
            const request = await GroupService.requestToJoinPrivateGroup(groupId, req.user.userId);
            return res.status(202).json({ message: 'Join request sent for private group.', request }); // 202 Accepted
        }
    } catch (error) {
         if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('already a member') || error.message.includes('already pending') || error.message.includes('is public')) {
                 return res.status(400).json({ error: error.message });
            }
        }
        next(error);
    }
};

export const leaveGroupHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        await GroupService.leaveGroup(req.params.groupId, req.user.userId);
        res.status(204).send();
    } catch (error) {
        if (error instanceof Error && (error.message.includes('not a member') || error.message.includes('not found'))) {
            return res.status(400).json({ error: error.message });
        }
        next(error);
    }
};

export const listGroupMembersHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUserId = (req as AuthenticatedRequest).user?.userId;
        const pagination = getPaginationOptions(req);
        const members = await GroupService.getGroupMembers(req.params.groupId, pagination, currentUserId);
        res.status(200).json(members);
    } catch (error) {
        if (error instanceof Error && (error.message.includes('not found') || error.message.includes('not accessible'))) {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
};

export const addMemberByAdminHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const { groupId } = req.params;
        const { userId: newMemberUserId, role } = req.body as { userId: string, role: GroupMemberRole };
        if (!newMemberUserId || !role) return res.status(400).json({ error: 'userId and role for new member are required.' });

        const member = await GroupService.addGroupMemberByAdmin(groupId, req.user.userId, newMemberUserId, role);
        res.status(201).json(member);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found') || error.message.includes('Invalid role') || error.message.includes('already a member')) {
                 return res.status(400).json({ error: error.message });
            }
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
        }
        next(error);
    }
};

export const updateMemberRoleByAdminHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const { groupId, memberUserId } = req.params;
        const { role } = req.body as { role: GroupMemberRole };
        if (!role) return res.status(400).json({ error: 'New role is required.' });

        const member = await GroupService.updateGroupMemberRoleByAdmin(groupId, req.user.userId, memberUserId, role);
        res.status(200).json(member);
    } catch (error) {
         if (error instanceof Error) {
            if (error.message.includes('not found') || error.message.includes('Invalid role') || error.message.includes('cannot demote')) {
                 return res.status(400).json({ error: error.message });
            }
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
        }
        next(error);
    }
};

export const removeMemberByAdminHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const { groupId, memberUserId } = req.params;
        await GroupService.removeGroupMemberByAdmin(groupId, req.user.userId, memberUserId);
        res.status(204).send();
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found') || error.message.includes('cannot remove themselves')) {
                 return res.status(400).json({ error: error.message });
            }
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
        }
        next(error);
    }
};

// --- Group Join Request Handlers ---
export const listJoinRequestsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const { groupId } = req.params;
        const pagination = getPaginationOptions(req);
        const requests = await GroupService.getPendingJoinRequestsForGroup(groupId, req.user.userId, pagination);
        res.status(200).json(requests);
    } catch (error) {
        if (error instanceof Error && error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
        next(error);
    }
};

export const approveJoinRequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const { joinRequestId } = req.params; // Assuming joinRequestId is in path
        const member = await GroupService.approveGroupJoinRequest(joinRequestId, req.user.userId);
        res.status(200).json({ message: 'Join request approved. User added as member.', member });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found') || error.message.includes('not pending')) return res.status(400).json({ error: error.message });
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
        }
        next(error);
    }
};

export const declineJoinRequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const { joinRequestId } = req.params;
        const request = await GroupService.declineGroupJoinRequest(joinRequestId, req.user.userId);
        res.status(200).json({ message: 'Join request declined.', request });
    } catch (error) {
         if (error instanceof Error) {
            if (error.message.includes('not found') || error.message.includes('not pending')) return res.status(400).json({ error: error.message });
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
        }
        next(error);
    }
};

// --- Group Post Handlers ---
export const createGroupPostHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const { groupId } = req.params;
        const postData: Omit<GenericCreatePostDTO, 'user_id' | 'group_id' | 'privacy_level'> = req.body;
        if (!postData.content_text && !postData.content_image_url && !postData.content_video_url) {
            return res.status(400).json({ error: 'Post content (text, image, or video) is required.' });
        }
        const post = await GroupService.createPostInGroup(groupId, req.user.userId, postData);
        res.status(201).json(post);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('must be a member') || error.message.includes('Group not found')) {
                return res.status(403).json({ error: error.message });
            }
        }
        next(error);
    }
};

export const listGroupPostsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { groupId } = req.params;
        const currentUserId = (req as AuthenticatedRequest).user?.userId; // For like status & group access
        if (!currentUserId) return res.status(401).json({error: 'User not authenticated.'}); // Must be logged in to see group posts usually

        const pagination = getPostPaginationOptions(req);
        const posts = await GroupService.getPostsForGroup(groupId, currentUserId, pagination);
        res.status(200).json(posts);
    } catch (error) {
        if (error instanceof Error && (error.message.includes('not found') || error.message.includes('not accessible'))) {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
};
