export type TravelInfoType = 'flight' | 'accommodation' | 'transport' | 'documents' | 'transfer';

export type TravelInfoFlight = {
  flightNumber?: string;
  flightDate?: string;
  departureTime?: string;
  from?: string;
  to?: string;
  airline?: string;
};

export type TravelInfoAccommodation = {
  propertyName?: string;
  address?: string;
  checkInDate?: string;
  checkInTime?: string;
  checkOutDate?: string;
  checkOutTime?: string;
  reservationNumber?: string;
};

export type TravelInfoTransport = {
  mode?: string;
  departureTime?: string;
  from?: string;
  to?: string;
};

export type TravelInfoDocuments = {
  notes?: string;
  items?: Array<{
    id: string;
    name: string;
    fileName?: string | null;
    fileUrl?: string | null;
    filePath?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
  }>;
};

export type TravelInfoDetails = {
  flight?: TravelInfoFlight;
  accommodation?: TravelInfoAccommodation;
  transport?: TravelInfoTransport;
  documents?: TravelInfoDocuments;
  transfer?: TravelInfoTransport;
};

export type BoardTravelInfo = {
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
  budget?: number | null;
  checklist?: string[];
  details?: TravelInfoDetails;
  updatedAt?: string | null;
};

export type BoardComment = {
  id: string;
  postId: string;
  boardId?: string;
  groupId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  content: string;
  createdAt: string;
  cursor?: string | null;
};

export type TripActivity = {
  id: string;
  dayId: string;
  time?: string | null;
  title: string;
  description?: string | null;
  cost?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type TripDay = {
  id: string;
  boardId: string;
  dayNumber: number;
  title?: string | null;
  date?: string | null;
  location?: string | null;
  description?: string | null;
  accommodation?: string | null;
  estimatedBudget?: number | null;
  activities: TripActivity[];
  createdAt: string;
  updatedAt: string;
};

export type ComposerState = {
  content: string;
  selectionStart: number;
  selectionEnd: number;
  mentions: string[];
};

export type BoardPostMention = {
  userId: string;
  name: string;
  username?: string | null;
};

export type BoardPostAttachment = {
  id: string;
  name: string;
  kind: 'image' | 'file';
  mimeType?: string | null;
  dataUrl?: string | null;
};

export type BoardPost = {
  id: string;
  boardId?: string;
  groupId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  content: string;
  attachments?: BoardPostAttachment[];
  mentions?: BoardPostMention[];
  createdAt: string;
  comments: BoardComment[];
  commentsCount?: number;
  hasMoreComments?: boolean;
  commentsNextCursor?: string | null;
};

export type BoardGroupListItem = {
  groupId: string;
  groupName: string;
  groupAvatarUrl?: string | null;
  memberCount: number;
  boardCount: number;
  lastActivity?: string | null;
};

export type BoardListItem = {
  id?: string;
  groupId: string;
  groupName?: string;
  boardName?: string;
  memberCount?: number;
  newPostsCount?: number;
  title?: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  createdByName?: string;
  createdByAvatarUrl?: string | null;
  postCount?: number;
  lastActivity?: string | null;
};

export type BoardModerator = {
  id: string;
  username?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  publicId?: string | null;
  assignedBy?: string | null;
  createdAt?: string | null;
};

export type BoardDetail = {
  id: string;
  groupId: string;
  groupName: string;
  boardName: string;
  boardDescription?: string | null;
  groupAvatarUrl?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  role: 'admin' | 'member';
  isOwner?: boolean;
  isModerator?: boolean;
  canModerate?: boolean;
  isArchived?: boolean;
  travelInfo: BoardTravelInfo;
};
