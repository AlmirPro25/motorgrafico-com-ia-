import { query } from '../config/db';
import {
  Group, CreateGroupDTO, UpdateGroupDTO, GroupFilterOptions, GroupPaginationOptions,
  GroupMember, GroupMemberRole,
  GroupJoinRequest, GroupJoinRequestStatus
} from './group.types';
import { PublicUserProfile } from './user.types';

const DEFAULT_PAGE_LIMIT = 10;

// --- Helper Functions ---
const mapRowToGroup = (row: any, currentUserId?: string): Group => {
  // currentUserId is used to determine is_member, current_user_role, pending_join_request
  // These fields (is_member, current_user_role, pending_join_request) are often calculated
  // in more complex queries or service layer, but a basic placeholder if joined:
  const group: Group = {
    id: row.id,
    creator_id: row.creator_id,
    name: row.name,
    description: row.description,
    profile_picture_url: row.profile_picture_url,
    cover_photo_url: row.cover_photo_url,
    type: row.type,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    member_count: parseInt(row.member_count, 10) || 0, // Assuming this is joined
    is_member: row.is_member, // Assuming this boolean is result of a subquery/join
    current_user_role: row.current_user_role, // Assuming this is result of a subquery/join
    pending_join_request: row.pending_join_request, // Assuming this is result of a subquery/join
  };
  return group;
};

const mapRowToGroupMember = (row: any): GroupMember => ({
  group_id: row.group_id,
  user_id: row.user_id,
  role: row.role,
  joined_at: new Date(row.joined_at),
  user_profile: row.user_handle ? {
      id: row.user_id,
      handle: row.user_handle,
      first_name: row.user_first_name,
      last_name: row.user_last_name,
      profile_picture_url: row.user_profile_picture_url,
  } : undefined,
});

const mapRowToGroupJoinRequest = (row: any): GroupJoinRequest => ({
  id: row.id,
  group_id: row.group_id,
  user_id: row.user_id,
  status: row.status,
  requested_at: new Date(row.requested_at),
  resolved_at: row.resolved_at ? new Date(row.resolved_at) : undefined,
  resolved_by_user_id: row.resolved_by_user_id,
  user_profile: row.user_handle ? {
      id: row.user_id,
      handle: row.user_handle,
      first_name: row.user_first_name,
      last_name: row.user_last_name,
      profile_picture_url: row.user_profile_picture_url,
  } : undefined,
  resolver_profile: row.resolver_handle ? { // If resolver info is joined
      id: row.resolved_by_user_id,
      handle: row.resolver_handle,
      // ... other resolver profile fields
  } : undefined,
});

// --- Group Functions ---
export const createGroup = async (data: CreateGroupDTO): Promise<Group> => {
  const { creator_id, name, description, profile_picture_url, cover_photo_url, type } = data;
  const sql = `
    INSERT INTO "Groups" (creator_id, name, description, profile_picture_url, cover_photo_url, type)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `;
  try {
    const { rows } = await query(sql, [creator_id, name, description, profile_picture_url, cover_photo_url, type]);
    const newGroupId = rows[0].id;
    // Creator becomes first admin member
    await createGroupMember(newGroupId, creator_id, 'admin');
    
    const newGroup = await findGroupById(newGroupId, creator_id); // Pass creator_id for context
    if (!newGroup) throw new Error('Failed to create or find group after insertion.');
    return newGroup;
  } catch (error) {
    console.error('Error creating group:', error);
    throw error;
  }
};

export const findGroupById = async (groupId: string, currentUserId?: string): Promise<Group | null> => {
  // Query needs to join member_count and, if currentUserId provided, is_member, current_user_role, pending_join_request
  const sql = `
    SELECT
      g.*,
      (SELECT COUNT(*) FROM "GroupMembers" gm WHERE gm.group_id = g.id) AS member_count
      ${currentUserId ? `,
      EXISTS(SELECT 1 FROM "GroupMembers" gm_check WHERE gm_check.group_id = g.id AND gm_check.user_id = $2) AS is_member,
      (SELECT gm_role.role FROM "GroupMembers" gm_role WHERE gm_role.group_id = g.id AND gm_role.user_id = $2) AS current_user_role,
      EXISTS(SELECT 1 FROM "GroupJoinRequests" gjr_check WHERE gjr_check.group_id = g.id AND gjr_check.user_id = $2 AND gjr_check.status = 'pending') AS pending_join_request
      ` : ', FALSE AS is_member, NULL AS current_user_role, FALSE AS pending_join_request'}
    FROM "Groups" g
    WHERE g.id = $1;
  `;
  try {
    const params = currentUserId ? [groupId, currentUserId] : [groupId];
    const { rows } = await query(sql, params);
    if (rows.length === 0) return null;
    return mapRowToGroup(rows[0], currentUserId);
  } catch (error) {
    console.error(`Error finding group by ID (${groupId}):`, error);
    throw error;
  }
};

export const findAllGroups = async (
  filters: GroupFilterOptions,
  pagination: GroupPaginationOptions,
  currentUserId?: string
): Promise<Group[]> => {
  const { page = 1, limit = DEFAULT_PAGE_LIMIT } = pagination;
  const offset = (page - 1) * limit;
  let whereClauses: string[] = [];
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (filters.type) {
    whereClauses.push(`g.type = $${paramIndex++}`);
    queryParams.push(filters.type);
  }

  if (filters.user_is_member && currentUserId) { // Ensure currentUserId if filtering by their membership
    whereClauses.push(`EXISTS (SELECT 1 FROM "GroupMembers" gm_filter WHERE gm_filter.group_id = g.id AND gm_filter.user_id = $${paramIndex++})`);
    queryParams.push(currentUserId);
  } else if (filters.discoverable && currentUserId) {
     whereClauses.push(`g.type = 'public' AND NOT EXISTS (SELECT 1 FROM "GroupMembers" gm_filter WHERE gm_filter.group_id = g.id AND gm_filter.user_id = $${paramIndex++})`);
     queryParams.push(currentUserId);
  } else if (filters.discoverable) { // Discoverable for anonymous users means public
     whereClauses.push(`g.type = 'public'`);
  }


  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const currentUserIdParamForSelect = currentUserId ? `$${paramIndex++}` : "NULL";
   if (currentUserId && !queryParams.includes(currentUserId)) queryParams.push(currentUserId);


  queryParams.push(limit, offset);

  const sql = `
    SELECT
      g.*,
      (SELECT COUNT(*) FROM "GroupMembers" gm WHERE gm.group_id = g.id) AS member_count,
      EXISTS(SELECT 1 FROM "GroupMembers" gm_check WHERE gm_check.group_id = g.id AND gm_check.user_id = ${currentUserIdParamForSelect}) AS is_member,
      (SELECT gm_role.role FROM "GroupMembers" gm_role WHERE gm_role.group_id = g.id AND gm_role.user_id = ${currentUserIdParamForSelect}) AS current_user_role,
      EXISTS(SELECT 1 FROM "GroupJoinRequests" gjr_check WHERE gjr_check.group_id = g.id AND gjr_check.user_id = ${currentUserIdParamForSelect} AND gjr_check.status = 'pending') AS pending_join_request
    FROM "Groups" g
    ${whereString}
    ORDER BY g.created_at DESC -- Or by member_count, name, etc.
    LIMIT $${paramIndex++} OFFSET $${paramIndex++};
  `;
  try {
    const { rows } = await query(sql, queryParams);
    return rows.map(row => mapRowToGroup(row, currentUserId));
  } catch (error) {
    console.error('Error finding all groups:', error);
    throw error;
  }
};

export const updateGroupInDB = async (groupId: string, adminUserId: string, data: UpdateGroupDTO): Promise<Group | null> => {
    const fields = Object.keys(data) as Array<keyof UpdateGroupDTO>;
    if (fields.length === 0) return findGroupById(groupId, adminUserId);

    const setClauses = fields.map((field, i) => `"${field}" = $${i + 1}`).join(', ');
    const values = fields.map(field => data[field]);
    values.push(groupId, adminUserId); // For WHERE clause (admin check done in service)

    const sql = `
        UPDATE "Groups"
        SET ${setClauses}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${fields.length + 1} 
        -- AND creator_id = $${fields.length + 2} -- Or check admin role in service layer
        RETURNING id;
    `;
    try {
        const { rows } = await query(sql, values);
        if (rows.length === 0) return null;
        return findGroupById(rows[0].id, adminUserId);
    } catch (error) {
        console.error(`Error updating group (${groupId}):`, error);
        throw error;
    }
};

export const deleteGroupFromDB = async (groupId: string /* adminUserId: string */): Promise<boolean> => {
  // Service layer must verify adminUserId is creator or super-admin.
  // ON DELETE CASCADE in DB schema should handle members, join requests, group-specific posts.
  // If not, delete them here first.
  const sql = `DELETE FROM "Groups" WHERE id = $1;`;
  try {
    const result = await query(sql, [groupId]);
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error(`Error deleting group (${groupId}):`, error);
    throw error;
  }
};

// --- GroupMember Functions ---
export const createGroupMember = async (groupId: string, userId: string, role: GroupMemberRole): Promise<GroupMember> => {
  const sql = `
    INSERT INTO "GroupMembers" (group_id, user_id, role)
    VALUES ($1, $2, $3)
    ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role, joined_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  try {
    const { rows } = await query(sql, [groupId, userId, role]);
    return mapRowToGroupMember(rows[0]);
  } catch (error) {
    console.error(`Error creating/updating group member for group ${groupId}, user ${userId}:`, error);
    throw error;
  }
};

export const findGroupMember = async (groupId: string, userId: string): Promise<GroupMember | null> => {
  const sql = `
    SELECT gm.*,
           u.handle AS user_handle, u.first_name AS user_first_name, u.last_name AS user_last_name, u.profile_picture_url AS user_profile_picture_url
    FROM "GroupMembers" gm
    JOIN "Users" u ON gm.user_id = u.id
    WHERE gm.group_id = $1 AND gm.user_id = $2;
  `;
  try {
    const { rows } = await query(sql, [groupId, userId]);
    return rows.length > 0 ? mapRowToGroupMember(rows[0]) : null;
  } catch (error) {
    console.error(`Error finding group member for group ${groupId}, user ${userId}:`, error);
    throw error;
  }
};

export const updateGroupMemberRole = async (groupId: string, userId: string, role: GroupMemberRole): Promise<GroupMember | null> => {
  const sql = `
    UPDATE "GroupMembers" SET role = $3
    WHERE group_id = $1 AND user_id = $2
    RETURNING *;
  `;
  try {
    const { rows } = await query(sql, [groupId, userId, role]);
    return rows.length > 0 ? mapRowToGroupMember(rows[0]) : null;
  } catch (error) {
    console.error(`Error updating role for member ${userId} in group ${groupId}:`, error);
    throw error;
  }
};

export const deleteGroupMember = async (groupId: string, userId: string): Promise<boolean> => {
  const sql = `DELETE FROM "GroupMembers" WHERE group_id = $1 AND user_id = $2;`;
  try {
    const result = await query(sql, [groupId, userId]);
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error(`Error deleting member ${userId} from group ${groupId}:`, error);
    throw error;
  }
};

export const findGroupMembers = async (
  groupId: string,
  pagination: GroupPaginationOptions
): Promise<GroupMember[]> => {
  const { page = 1, limit = DEFAULT_PAGE_LIMIT } = pagination;
  const offset = (page - 1) * limit;
  const sql = `
    SELECT gm.*,
           u.handle AS user_handle, u.first_name AS user_first_name, u.last_name AS user_last_name, u.profile_picture_url AS user_profile_picture_url
    FROM "GroupMembers" gm
    JOIN "Users" u ON gm.user_id = u.id
    WHERE gm.group_id = $1
    ORDER BY gm.role, gm.joined_at -- Admins first, then by join date
    LIMIT $2 OFFSET $3;
  `;
  try {
    const { rows } = await query(sql, [groupId, limit, offset]);
    return rows.map(mapRowToGroupMember);
  } catch (error) {
    console.error(`Error finding members for group (${groupId}):`, error);
    throw error;
  }
};


// --- GroupJoinRequest Functions ---
export const createGroupJoinRequest = async (groupId: string, userId: string): Promise<GroupJoinRequest> => {
  const sql = `
    INSERT INTO "GroupJoinRequests" (group_id, user_id, status)
    VALUES ($1, $2, 'pending')
    ON CONFLICT (group_id, user_id) WHERE (status = 'pending') DO NOTHING -- Avoid duplicate pending requests
    RETURNING *;
  `;
  try {
    const { rows } = await query(sql, [groupId, userId]);
    if (rows.length > 0) return mapRowToGroupJoinRequest(rows[0]);
    // If conflict (already pending), fetch existing
    const existing = await findPendingJoinRequestForUser(groupId, userId);
    if (!existing) throw new Error('Failed to create or find pending join request.');
    return existing;
  } catch (error) {
    console.error(`Error creating group join request for group ${groupId}, user ${userId}:`, error);
    throw error;
  }
};

export const findGroupJoinRequestById = async (requestId: string): Promise<GroupJoinRequest | null> => {
  const sql = `
    SELECT gjr.*,
           u.handle AS user_handle, u.first_name AS user_first_name, u.last_name AS user_last_name, u.profile_picture_url AS user_profile_picture_url,
           ru.handle AS resolver_handle -- Resolver (admin who actioned)
    FROM "GroupJoinRequests" gjr
    JOIN "Users" u ON gjr.user_id = u.id
    LEFT JOIN "Users" ru ON gjr.resolved_by_user_id = ru.id
    WHERE gjr.id = $1;
  `;
  try {
    const { rows } = await query(sql, [requestId]);
    return rows.length > 0 ? mapRowToGroupJoinRequest(rows[0]) : null;
  } catch (error) {
    console.error(`Error finding group join request by ID (${requestId}):`, error);
    throw error;
  }
};

export const findPendingJoinRequestForUser = async (groupId: string, userId: string): Promise<GroupJoinRequest | null> => {
    const sql = `SELECT * FROM "GroupJoinRequests" WHERE group_id = $1 AND user_id = $2 AND status = 'pending';`;
    try {
        const { rows } = await query(sql, [groupId, userId]);
        return rows.length > 0 ? mapRowToGroupJoinRequest(rows[0]) : null;
    } catch (error) {
        console.error(`Error finding pending join request for user ${userId} in group ${groupId}:`, error);
        throw error;
    }
};

export const findPendingJoinRequestsForGroup = async (
  groupId: string,
  pagination: GroupPaginationOptions
): Promise<GroupJoinRequest[]> => {
  const { page = 1, limit = DEFAULT_PAGE_LIMIT } = pagination;
  const offset = (page - 1) * limit;
  const sql = `
    SELECT gjr.*,
           u.handle AS user_handle, u.first_name AS user_first_name, u.last_name AS user_last_name, u.profile_picture_url AS user_profile_picture_url
    FROM "GroupJoinRequests" gjr
    JOIN "Users" u ON gjr.user_id = u.id
    WHERE gjr.group_id = $1 AND gjr.status = 'pending'
    ORDER BY gjr.requested_at ASC
    LIMIT $2 OFFSET $3;
  `;
  try {
    const { rows } = await query(sql, [groupId, limit, offset]);
    return rows.map(mapRowToGroupJoinRequest);
  } catch (error) {
    console.error(`Error finding pending join requests for group (${groupId}):`, error);
    throw error;
  }
};

export const updateGroupJoinRequestStatus = async (
  requestId: string,
  status: GroupJoinRequestStatus,
  resolverUserId: string
): Promise<GroupJoinRequest | null> => {
  const sql = `
    UPDATE "GroupJoinRequests"
    SET status = $1, resolved_at = CURRENT_TIMESTAMP, resolved_by_user_id = $2
    WHERE id = $3 AND status = 'pending' -- Only update pending requests
    RETURNING *;
  `;
  try {
    const { rows } = await query(sql, [status, resolverUserId, requestId]);
    return rows.length > 0 ? mapRowToGroupJoinRequest(rows[0]) : null;
  } catch (error) {
    console.error(`Error updating group join request status (${requestId} to ${status}):`, error);
    throw error;
  }
};

// TODO: Count functions for pagination if needed.
