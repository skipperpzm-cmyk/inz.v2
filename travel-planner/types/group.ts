export type GroupRole = "member" | "admin";

export type Group = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  isPrivate: boolean;
  memberCount: number;
  avatarUrl?: string | null;
  createdBy?: string | null;
  role: GroupRole;
};

export type GroupMember = {
  id: string;
  username?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  publicId?: string | null;
  role: GroupRole;
};

export type GroupInvite = {
  id: string;
  groupId: string;
  groupName: string;
  groupAvatarUrl?: string | null;
  fromUserId: string;
  fromName?: string | null;
  fromPublicId?: string | null;
  fromAvatarUrl?: string | null;
  createdAt?: string | null;
};
