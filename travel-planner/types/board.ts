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
  boardName: string;
  groupAvatarUrl?: string | null;
  memberCount: number;
  lastActivity?: string | null;
  newPostsCount: number;
};

export type BoardDetail = {
  groupId: string;
  groupName: string;
  boardName: string;
  groupAvatarUrl?: string | null;
  ownerId: string;
  role: 'admin' | 'member';
  travelInfo: BoardTravelInfo;
};
