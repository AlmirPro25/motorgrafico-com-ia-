export interface Like {
  post_id: string; // Foreign key to Posts table
  user_id: string; // Foreign key to Users table (user who liked the post)
  created_at: Date;
}

// DTO for creating a like (though often just postId and userId are directly used)
export interface CreateLikeDTO {
    post_id: string;
    user_id: string;
}
