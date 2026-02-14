export type BoardTravelInfo = {
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
  budget?: number | null;
  checklist?: string[];
  updatedAt?: string | null;
};

export type BoardComment = {
  id: string;
  postId: string;
  groupId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  content: string;
  createdAt: string;
  cursor?: string | null;
};

export type BoardPost = {
  id: string;
  groupId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  content: string;
  createdAt: string;
  comments: BoardComment[];
  commentsCount?: number;
  hasMoreComments?: boolean;
  commentsNextCursor?: string | null;
};

export type BoardListItem = {
  groupId: string;
  groupName: string;
  groupAvatarUrl?: string | null;
  memberCount: number;
  lastActivity?: string | null;
  newPostsCount: number;
};

export type BoardDetail = {
  groupId: string;
  groupName: string;
  groupAvatarUrl?: string | null;
  ownerId: string;
  role: 'admin' | 'member';
  travelInfo: BoardTravelInfo;
};
