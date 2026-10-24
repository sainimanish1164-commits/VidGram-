export type NavTab =
  | 'home'
  | 'explore'
  | 'create'
  | 'reels'
  | 'profile'
  | 'messages'
  | 'notifications'
  | 'creator_dashboard'
  | 'monetization'
  | 'admin'
  | 'legal';

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  website: string;
  socialLink: string;
  avatarUrl: string;
  coverUrl: string;
  isPrivate: boolean;
  showOnlineStatus: boolean;
  isOnline: boolean;
  status: 'active' | 'suspended' | 'banned';
  followersCount: number;
  followingCount: number;
  postsCount: number;
  totalLikesReceived: number;
  totalViewsReceived: number;
  createdAtMs: number;
}

export interface UserPrivateSettings {
  uid: string;
  email: string;
  pushNotifications: boolean;
  likesNotifications: boolean;
  commentsNotifications: boolean;
  followsNotifications: boolean;
  messagesNotifications: boolean;
}

export interface PostRecord {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string;
  mediaType: 'photo' | 'reel';
  mediaUrl: string;
  thumbnailUrl: string;
  caption: string;
  hashtags: string[];
  taggedUsernames: string[];
  audioTrackName: string;
  visibility: 'public' | 'followers';
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  savesCount: number;
  sharesCount: number;
  moderationStatus: 'approved' | 'flagged' | 'removed';
  createdAtMs: number;
}

export interface CommentRecord {
  id: string;
  postId: string;
  authorId: string;
  authorUsername: string;
  authorAvatarUrl: string;
  text: string;
  parentCommentId: string;
  moderationStatus: 'approved' | 'removed';
  createdAtMs: number;
}

export interface FollowRecord {
  id: string;
  followerId: string;
  followerUsername: string;
  followerAvatarUrl: string;
  followingId: string;
  followingUsername: string;
  followingAvatarUrl: string;
  status: 'accepted' | 'pending';
  createdAtMs: number;
}

export interface ConversationRecord {
  id: string;
  participantA: string;
  participantB: string;
  participantAName: string;
  participantBName: string;
  participantAAvatar: string;
  participantBAvatar: string;
  lastMessageText: string;
  lastSenderId: string;
  typingUid: string;
  updatedAtMs: number;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  messageType: 'text' | 'image' | 'video' | 'voice';
  text: string;
  mediaUrl: string;
  deliveryStatus: 'sent' | 'delivered' | 'read';
  isDeleted: boolean;
  createdAtMs: number;
}

export interface NotificationRecord {
  id: string;
  recipientId: string;
  actorId: string;
  actorUsername: string;
  actorAvatarUrl: string;
  type: 'like' | 'comment' | 'follow' | 'follow_request' | 'mention' | 'message' | 'system';
  targetId: string;
  message: string;
  read: boolean;
  createdAtMs: number;
}

export interface MonetizationRecord {
  userId: string;
  username: string;
  status: 'pending' | 'approved' | 'rejected';
  paymentProvider: 'none' | 'stripe_connect' | 'bank_transfer' | 'upi_verified';
  payoutAccountRef: string;
  contentCategory: string;
  applicationNote: string;
  subscriptionsEnabled: boolean;
  giftsEnabled: boolean;
  adsShareEnabled: boolean;
  verifiedBalanceCents: number;
  lifetimePaidCents: number;
  adminReviewNote: string;
  updatedAtMs: number;
}

export interface PayoutRecord {
  id: string;
  userId: string;
  username: string;
  amountCents: number;
  paymentProvider: string;
  payoutAccountRef: string;
  status: 'requested' | 'completed' | 'declined';
  adminNote: string;
  createdAtMs: number;
}

export interface ReportRecord {
  id: string;
  reporterId: string;
  targetType: 'post' | 'reel' | 'comment' | 'user' | 'data_deletion';
  targetId: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  resolutionNote: string;
  createdAtMs: number;
}

export interface AnnouncementRecord {
  id: string;
  authorId: string;
  title: string;
  body: string;
  active: boolean;
  createdAtMs: number;
}

export interface PlatformSettingsRecord {
  minFollowersForMonetization: number;
  minViewsForMonetization: number;
  allowNewRegistrations: boolean;
  maintenanceBanner: string;
}
