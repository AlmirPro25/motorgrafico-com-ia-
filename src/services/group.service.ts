import * as GroupDB from '../models/group.db';
import * as UserDB from '../models/user.db';
import * as PostDB from '../models/post.db'; // For group posts
import {
  Group, CreateGroupDTO, UpdateGroupDTO, GroupFilterOptions, GroupPaginationOptions,
  GroupMember, GroupMemberRole, AddMemberDTO, UpdateMemberRoleDTO,
  GroupJoinRequest, GroupJoinRequestStatus, PaginatedGroupJoinRequests, PaginatedGroupMembers, PaginatedGroups
} from '../models/group.types';
import { Post, CreatePostDTO as GenericCreatePostDTO, PaginationOptions as PostPaginationOptions } from '../models/post.types';
import { PublicUserProfile } from '../models/user.types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

// --- Group Services ---
export const createNewGroup = async (data: CreateGroupDTO): Promise<Group> => {
  const creator = await UserDB.findUserById(data.creator_id);
  if (!creator) throw new Error('Group creator not found.');
  if (!data.name || data.name.trim() === '') throw new Error('Group name is required.');
  if (!['public', 'private'].includes(data.type)) throw new Error('Invalid group type.');

  return GroupDB.createGroup(data); // createGroup in DB also adds creator as admin
};

export const getGroupDetails = async (groupId: string, currentUserId?: string): Promise<Group | null> => {
  const group = await GroupDB.findGroupById(groupId, currentUserId);
  if (!group) return null;

  // Privacy Check for private groups
  if (group.type === 'private' && (!group.is_member && group.creator_id !== currentUserId)) {
    // If user is not a member and not the creator, only return basic info for private group
    // (or nothing, depending on product decision). For now, let's return limited info.
    // Service consumer (controller) can decide what to show.
    // The GroupDB.findGroupById already populates is_member, so this check is robust.
    // For now, if not member of private group, don't return it. Stricter.
    return null;
  }
  return group;
};

export const getAllGroups = async (
  filters: GroupFilterOptions,
  pagination: GroupPaginationOptions,
  currentUserId?: string
): Promise<Group[]> => { // Consider PaginatedGroups
  filters.type = filters.type || undefined; // Allow fetching all types if not specified
  return GroupDB.findAllGroups(filters, pagination, currentUserId);
};

export const updateExistingGroup = async (
  groupId: string,
  adminUserId: string,
  updateData: UpdateGroupDTO
): Promise<Group | null> => {
  const group = await GroupDB.findGroupById(groupId, adminUserId);
  if (!group) throw new Error('Group not found.');
  if (group.current_user_role !== 'admin' && group.current_user_role !== 'moderator' && group.creator_id !== adminUserId) { // Or just check creator_id if no roles yet for simple admin
    throw new Error('User not authorized to update this group (must be admin/moderator).');
  }
  if (updateData.type && !['public', 'private'].includes(updateData.type)) {
      throw new Error('Invalid group type.');
  }
  return GroupDB.updateGroupInDB(groupId, adminUserId, updateData);
};

export const deleteExistingGroup = async (groupId: string, adminUserId: string): Promise<boolean> => {
  const group = await GroupDB.findGroupById(groupId, adminUserId);
  if (!group) throw new Error('Group not found.');
  // Typically, only the original creator can delete a group, or super-admins.
  if (group.creator_id !== adminUserId) {
    throw new Error('User not authorized to delete this group (must be original creator).');
  }
  // DB schema should handle cascade deletes for members, join requests, posts.
  // If not, implement those deletions here.
  // e.g., await PostDB.deletePostsByGroupId(groupId);
  return GroupDB.deleteGroupFromDB(groupId);
};

// --- Group Member Services ---
export const joinPublicGroup = async (groupId: string, userId: string): Promise<GroupMember> => {
    const group = await GroupDB.findGroupById(groupId, userId);
    if (!group) throw new Error('Group not found.');
    if (group.type !== 'public') throw new Error('This group is not public. Please request to join.');
    if (group.is_member) throw new Error('User is already a member of this group.');

    return GroupDB.createGroupMember(groupId, userId, 'member');
};

export const requestToJoinPrivateGroup = async (groupId: string, userId: string): Promise<GroupJoinRequest> => {
    const group = await GroupDB.findGroupById(groupId, userId);
    if (!group) throw new Error('Group not found.');
    if (group.type !== 'private') throw new Error('This group is public, you can join directly.');
    if (group.is_member) throw new Error('User is already a member of this group.');
    if (group.pending_join_request) throw new Error('Join request already pending for this user and group.');

    return GroupDB.createGroupJoinRequest(groupId, userId);
};

export const leaveGroup = async (groupId: string, userId: string): Promise<boolean> => {
    const member = await GroupDB.findGroupMember(groupId, userId);
    if (!member) throw new Error('User is not a member of this group.');
    // Prevent admin/creator from leaving if they are the sole admin (complex rule, for later)
    // For now, allow leaving.
    return GroupDB.deleteGroupMember(groupId, userId);
};

export const addGroupMemberByAdmin = async (groupId: string, adminUserId: string, newMemberUserId: string, role: GroupMemberRole): Promise<GroupMember> => {
    const adminMember = await GroupDB.findGroupMember(groupId, adminUserId);
    if (!adminMember || (adminMember.role !== 'admin' && adminMember.role !== 'moderator')) {
        throw new Error('User not authorized to add members (must be admin/moderator).');
    }
    const userToAdd = await UserDB.findUserById(newMemberUserId);
    if (!userToAdd) throw new Error('User to add not found.');

    const existingMembership = await GroupDB.findGroupMember(groupId, newMemberUserId);
    if (existingMembership) throw new Error('User is already a member of this group.');

    if (!['admin', 'moderator', 'member'].includes(role)) throw new Error('Invalid role specified.');


    return GroupDB.createGroupMember(groupId, newMemberUserId, role);
};

export const removeGroupMemberByAdmin = async (groupId: string, adminUserId: string, memberToRemoveId: string): Promise<boolean> => {
    const adminMember = await GroupDB.findGroupMember(groupId, adminUserId);
    if (!adminMember || (adminMember.role !== 'admin' && adminMember.role !== 'moderator')) {
        throw new Error('User not authorized to remove members (must be admin/moderator).');
    }
    if (adminUserId === memberToRemoveId) throw new Error('Admin cannot remove themselves using this function. Use "Leave Group".');
    // Add check: ensure not removing the last admin (if group should always have an admin)

    return GroupDB.deleteGroupMember(groupId, memberToRemoveId);
};

export const updateGroupMemberRoleByAdmin = async (groupId: string, adminUserId: string, targetMemberId: string, newRole: GroupMemberRole): Promise<GroupMember | null> => {
    const adminMember = await GroupDB.findGroupMember(groupId, adminUserId);
    if (!adminMember || adminMember.role !== 'admin') { // Only admins can change roles
        throw new Error('User not authorized to change member roles (must be admin).');
    }
    if (adminUserId === targetMemberId && newRole !== 'admin') throw new Error('Admin cannot demote themselves from admin role if they are the only admin or via this method.');
    if (!['admin', 'moderator', 'member'].includes(newRole)) throw new Error('Invalid role specified.');

    return GroupDB.updateGroupMemberRole(groupId, targetMemberId, newRole);
};

export const getGroupMembers = async (groupId: string, pagination: GroupPaginationOptions, currentUserId?: string): Promise<GroupMember[]> => { // Consider PaginatedGroupMembers
    const group = await getGroupDetails(groupId, currentUserId); // Handles privacy for viewing group itself
    if (!group) throw new Error('Group not found or not accessible.');
    // Further privacy: who can see member list? (e.g. members only for private groups)
    // Current getGroupDetails already restricts access to private groups for non-members.
    return GroupDB.findGroupMembers(groupId, pagination);
};


// --- Group Join Request Services ---
export const getPendingJoinRequestsForGroup = async (groupId: string, adminUserId: string, pagination: GroupPaginationOptions): Promise<GroupJoinRequest[]> => { // Consider Paginated
    const adminMember = await GroupDB.findGroupMember(groupId, adminUserId);
    if (!adminMember || (adminMember.role !== 'admin' && adminMember.role !== 'moderator')) {
        throw new Error('User not authorized to view join requests (must be admin/moderator).');
    }
    return GroupDB.findPendingJoinRequestsForGroup(groupId, pagination);
};

export const approveGroupJoinRequest = async (joinRequestId: string, adminUserId: string): Promise<GroupMember> => {
    const request = await GroupDB.findGroupJoinRequestById(joinRequestId);
    if (!request || request.status !== 'pending') throw new Error('Join request not found or not pending.');

    const adminMember = await GroupDB.findGroupMember(request.group_id, adminUserId);
    if (!adminMember || (adminMember.role !== 'admin' && adminMember.role !== 'moderator')) {
        throw new Error('User not authorized to approve join requests.');
    }

    await GroupDB.updateGroupJoinRequestStatus(joinRequestId, 'approved', adminUserId);
    return GroupDB.createGroupMember(request.group_id, request.user_id, 'member'); // Add user as member
};

export const declineGroupJoinRequest = async (joinRequestId: string, adminUserId: string): Promise<GroupJoinRequest | null> => {
    const request = await GroupDB.findGroupJoinRequestById(joinRequestId);
    if (!request || request.status !== 'pending') throw new Error('Join request not found or not pending.');

    const adminMember = await GroupDB.findGroupMember(request.group_id, adminUserId);
    if (!adminMember || (adminMember.role !== 'admin' && adminMember.role !== 'moderator')) {
        throw new Error('User not authorized to decline join requests.');
    }
    return GroupDB.updateGroupJoinRequestStatus(joinRequestId, 'declined', adminUserId);
};


// --- Group Post Services ---
export const createPostInGroup = async (
    groupId: string,
    userId: string, // Post creator
    postData: Omit<GenericCreatePostDTO, 'user_id' | 'group_id' | 'privacy_level'> // privacy_level determined by group or fixed
): Promise<Post> => {
    const member = await GroupDB.findGroupMember(groupId, userId);
    if (!member) throw new Error('User must be a member to post in this group.');
    // Could add role check if only certain roles can post.

    const group = await GroupDB.findGroupById(groupId, userId);
    if (!group) throw new Error('Group not found.');
    // If group is private, user being a member is already confirmed.

    const fullPostData: GenericCreatePostDTO = {
        ...postData,
        user_id: userId,
        group_id: groupId,
        // For group posts, privacy_level is often implicitly 'group_members_only'.
        // Or it could be 'public' if the group is public and allows public posts.
        // For simplicity, let's assume group posts are 'private' to the group (not using PostPrivacy type directly here).
        // The `Posts` table's `privacy_level` might need a 'group' type or similar, or be nullable for group posts.
        // For now, let's set a default that implies group-level privacy.
        // This needs careful schema consideration for `Posts.privacy_level` when `group_id` is present.
        // Let's assume `privacy_level` for group posts is handled by `group_id` presence and group type.
        // We can set it to 'private' or a special value like 'group_context'.
        // For now, let's assume the service creating the post sets a sensible default or it's handled by PostDB.createPost
        privacy_level: 'private', // This 'private' means "private to the group context", not user private.
                                 // This needs alignment with how PostService.getPostById handles privacy for group posts.
    };
    return PostDB.createPost(fullPostData);
};

export const getPostsForGroup = async (
    groupId: string,
    currentUserId: string, // User viewing the posts
    pagination: PostPaginationOptions
): Promise<Post[]> => {
    const group = await getGroupDetails(groupId, currentUserId); // Checks if user can see group
    if (!group) throw new Error('Group not found or not accessible.');

    // If group is private, getGroupDetails already confirmed membership for currentUserId.
    // If group is public, anyone can see posts.
    return PostDB.findPostsByGroupId(groupId, pagination, currentUserId);
};

// Utility to check permissions (can be expanded)
export const isGroupAdmin = async (groupId: string, userId: string): Promise<boolean> => {
    const member = await GroupDB.findGroupMember(groupId, userId);
    return !!member && (member.role === 'admin' || member.role === 'moderator');
};

export const isGroupMember = async (groupId: string, userId: string): Promise<boolean> => {
    const member = await GroupDB.findGroupMember(groupId, userId);
    return !!member;
};
