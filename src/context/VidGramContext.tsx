import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  deleteUser,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  limit,
  serverTimestamp,
  writeBatch,
  increment,
  type Timestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  uploadMediaWithProgress,
  generateVideoThumbnail,
} from '../lib/firebase';
import type {
  UserProfile,
  UserPrivateSettings,
  PostRecord,
  CommentRecord,
  FollowRecord,
  ConversationRecord,
  MessageRecord,
  NotificationRecord,
  MonetizationRecord,
  PayoutRecord,
  ReportRecord,
  AnnouncementRecord,
  PlatformSettingsRecord,
} from '../types/vidgram';
import {
  normalizeUsername,
  isValidUsername,
  extractHashtags,
  extractMentions,
  buildConversationId,
  buildFollowEdgeId,
  isVerifiedAdminAccount,
  SlidingWindowRateLimiter,
} from '../utils/vidgramLogic';
import { SEED_CREATORS, SEED_POSTS, GENERATED_ASSETS } from '../data/seedContent';

function toMs(val: unknown): number {
  if (!val) return Date.now();
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null && 'toMillis' in val && typeof (val as Timestamp).toMillis === 'function') {
    return (val as Timestamp).toMillis();
  }
  return Date.now();
}

interface VidGramContextValue {
  firebaseUser: User | null;
  authReady: boolean;
  currentProfile: UserProfile | null;
  privateSettings: UserPrivateSettings | null;
  isAdmin: boolean;
  darkMode: boolean;
  toggleDarkMode: () => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;

  // Data Collections
  users: UserProfile[];
  posts: PostRecord[];
  likedPostIds: Set<string>;
  bookmarkedPostIds: Set<string>;
  blockedUserIds: Set<string>;
  follows: FollowRecord[];
  conversations: ConversationRecord[];
  notifications: NotificationRecord[];
  monetization: MonetizationRecord | null;
  allMonetizations: MonetizationRecord[];
  payouts: PayoutRecord[];
  reports: ReportRecord[];
  announcements: AnnouncementRecord[];
  platformSettings: PlatformSettingsRecord;

  // Auth Actions
  signInWithGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (params: { email: string; password: string; username: string; displayName: string }) => Promise<void>;
  sendVerification: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteMyAccount: () => Promise<void>;
  requestDataDeletion: (reason: string) => Promise<void>;

  // Profile & Social Actions
  updateMyProfile: (updates: Partial<Pick<UserProfile, 'username' | 'displayName' | 'bio' | 'website' | 'socialLink' | 'isPrivate' | 'showOnlineStatus'>>, avatarFile?: File | null, coverFile?: File | null) => Promise<void>;
  updateNotificationPrefs: (prefs: Partial<Omit<UserPrivateSettings, 'uid' | 'email'>>) => Promise<void>;
  toggleFollowUser: (targetUser: UserProfile) => Promise<void>;
  approveFollowRequest: (followRec: FollowRecord) => Promise<void>;
  declineFollowRequest: (followRec: FollowRecord) => Promise<void>;
  toggleBlockUser: (targetUser: UserProfile) => Promise<void>;

  // Posts, Reels, Likes, Bookmarks, Comments
  publishPostOrReel: (params: {
    mediaType: 'photo' | 'reel';
    file: File | Blob;
    caption: string;
    audioTrackName: string;
    visibility: 'public' | 'followers';
    onProgress?: (pct: number) => void;
  }) => Promise<void>;
  toggleLikePost: (post: PostRecord) => Promise<void>;
  toggleBookmarkPost: (post: PostRecord) => Promise<void>;
  recordPostView: (post: PostRecord) => Promise<void>;
  recordPostShare: (post: PostRecord) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  subscribeComments: (postId: string, onData: (comments: CommentRecord[]) => void) => () => void;
  addComment: (post: PostRecord, text: string, parentCommentId?: string) => Promise<void>;
  deleteComment: (postId: string, commentId: string) => Promise<void>;

  // Messaging
  startOrOpenConversation: (targetUser: UserProfile) => Promise<string>;
  subscribeMessages: (conversationId: string, onData: (msgs: MessageRecord[]) => void) => () => void;
  sendMessage: (params: {
    conversationId: string;
    recipientId: string;
    messageType: 'text' | 'image' | 'video' | 'voice';
    text: string;
    mediaBlob?: File | Blob | null;
  }) => Promise<void>;
  setTypingState: (conversationId: string, isTyping: boolean) => Promise<void>;
  markMessageRead: (conversationId: string, msg: MessageRecord) => Promise<void>;
  unsendMessage: (conversationId: string, messageId: string) => Promise<void>;

  // Notifications & Moderation
  markAllNotificationsRead: () => Promise<void>;
  submitReport: (targetType: ReportRecord['targetType'], targetId: string, reason: string) => Promise<void>;

  // Monetization & Admin Actions
  applyOrUpdateMonetization: (params: {
    paymentProvider: MonetizationRecord['paymentProvider'];
    payoutAccountRef: string;
    contentCategory: string;
    applicationNote: string;
    subscriptionsEnabled: boolean;
    giftsEnabled: boolean;
    adsShareEnabled: boolean;
  }) => Promise<void>;
  requestCreatorPayout: (amountCents: number) => Promise<void>;
  adminReviewMonetization: (targetUid: string, status: 'approved' | 'rejected', verifiedBalanceCents: number, note: string) => Promise<void>;
  adminProcessPayout: (payout: PayoutRecord, status: 'completed' | 'declined', note: string) => Promise<void>;
  adminUpdateUserStatus: (targetUid: string, status: UserProfile['status']) => Promise<void>;
  adminModeratePost: (postId: string, moderationStatus: PostRecord['moderationStatus']) => Promise<void>;
  adminResolveReport: (reportId: string, status: 'resolved' | 'dismissed', note: string) => Promise<void>;
  adminPublishAnnouncement: (title: string, body: string) => Promise<void>;
  adminSavePlatformSettings: (settings: PlatformSettingsRecord) => Promise<void>;
}

const VidGramContext = createContext<VidGramContextValue | null>(null);

const actionLimiter = new SlidingWindowRateLimiter(10, 15_000);

export const VidGramProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [privateSettings, setPrivateSettings] = useState<UserPrivateSettings | null>(null);
  const [inAdminRegistry, setInAdminRegistry] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [dbUsers, setDbUsers] = useState<UserProfile[]>([]);
  const [dbPosts, setDbPosts] = useState<PostRecord[]>([]);
  const [localSessionPosts, setLocalSessionPosts] = useState<PostRecord[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [bookmarkedPostIds, setBookmarkedPostIds] = useState<Set<string>>(new Set());
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [follows, setFollows] = useState<FollowRecord[]>([]);
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [monetization, setMonetization] = useState<MonetizationRecord | null>(null);
  const [allMonetizations, setAllMonetizations] = useState<MonetizationRecord[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettingsRecord>({
    minFollowersForMonetization: 1000,
    minViewsForMonetization: 10000,
    allowNewRegistrations: true,
    maintenanceBanner: '',
  });

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3800);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  }, []);

  const isAdmin = isVerifiedAdminAccount({
    email: firebaseUser?.email,
    emailVerified: firebaseUser?.emailVerified,
    inAdminRegistry,
  });

  // Ensure authenticated user has a public + private profile in Firestore
  const bootstrapUserProfile = useCallback(async (u: User, preferredUsername?: string, preferredDisplay?: string) => {
    const userDocRef = doc(db, 'users', u.uid);
    try {
      const existingSnap = await getDoc(userDocRef);
      if (existingSnap.exists()) {
        const d = existingSnap.data();
        setCurrentProfile({
          uid: d.uid,
          username: d.username,
          displayName: d.displayName,
          bio: d.bio || '',
          website: d.website || '',
          socialLink: d.socialLink || '',
          avatarUrl: d.avatarUrl || u.photoURL || GENERATED_ASSETS.ariaAvatar,
          coverUrl: d.coverUrl || GENERATED_ASSETS.tokyoPost,
          isPrivate: Boolean(d.isPrivate),
          showOnlineStatus: d.showOnlineStatus !== false,
          isOnline: true,
          status: d.status || 'active',
          followersCount: Number(d.followersCount || 0),
          followingCount: Number(d.followingCount || 0),
          postsCount: Number(d.postsCount || 0),
          totalLikesReceived: Number(d.totalLikesReceived || 0),
          totalViewsReceived: Number(d.totalViewsReceived || 0),
          createdAtMs: toMs(d.createdAt),
        });
        return;
      }

      if (!u.emailVerified) {
        // Unverified email/password signups get transient local profile view until verified
        const fallbackUsername = normalizeUsername(preferredUsername || u.email?.split('@')[0] || `user_${u.uid.slice(0, 6)}`);
        setCurrentProfile({
          uid: u.uid,
          username: fallbackUsername.length >= 3 ? fallbackUsername : `vg_${u.uid.slice(0, 6)}`,
          displayName: (preferredDisplay || u.displayName || 'VidGram Creator').slice(0, 60),
          bio: 'Verify your email address to publish posts, reels, and messages.',
          website: '',
          socialLink: '',
          avatarUrl: u.photoURL || GENERATED_ASSETS.ariaAvatar,
          coverUrl: GENERATED_ASSETS.tokyoPost,
          isPrivate: false,
          showOnlineStatus: true,
          isOnline: true,
          status: 'active',
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          totalLikesReceived: 0,
          totalViewsReceived: 0,
          createdAtMs: Date.now(),
        });
        return;
      }

      const rawHandle = normalizeUsername(
        preferredUsername || u.email?.split('@')[0] || `creator_${u.uid.slice(0, 6)}`
      );
      let finalUsername = rawHandle.length >= 3 ? rawHandle : `vg_${u.uid.slice(0, 6).toLowerCase()}`;
      const unameCheck = await getDoc(doc(db, 'usernames', finalUsername));
      if (unameCheck.exists() && unameCheck.data().uid !== u.uid) {
        finalUsername = `${finalUsername.slice(0, 22)}_${u.uid.slice(0, 5).toLowerCase()}`;
      }

      const batch = writeBatch(db);
      const displayName = (preferredDisplay || u.displayName || finalUsername).slice(0, 60);
      const avatarUrl = (u.photoURL || GENERATED_ASSETS.ariaAvatar).slice(0, 2000);
      const coverUrl = GENERATED_ASSETS.tokyoPost;

      batch.set(userDocRef, {
        uid: u.uid,
        username: finalUsername,
        displayName,
        bio: 'Creating photos & short-form Reels on VidGram.',
        website: '',
        socialLink: `@${finalUsername}`,
        avatarUrl,
        coverUrl,
        isPrivate: false,
        showOnlineStatus: true,
        isOnline: true,
        status: 'active',
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        totalLikesReceived: 0,
        totalViewsReceived: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, 'users', u.uid, 'private', 'info'), {
        uid: u.uid,
        email: (u.email || '').slice(0, 254),
        pushNotifications: true,
        likesNotifications: true,
        commentsNotifications: true,
        followsNotifications: true,
        messagesNotifications: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, 'usernames', finalUsername), {
        uid: u.uid,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      // Auto-register verified admin in /admins/{uid} if email matches authorized admin
      if (u.emailVerified && u.email?.toLowerCase() === 'sainimanish1164@gmail.com') {
        try {
          await setDoc(doc(db, 'admins', u.uid), {
            uid: u.uid,
            email: u.email,
            grantedAt: serverTimestamp(),
          });
          setInAdminRegistry(true);
        } catch {
          // Already exists
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${u.uid}`);
    }
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      if (u) {
        await bootstrapUserProfile(u);
        try {
          const adminDoc = await getDoc(doc(db, 'admins', u.uid));
          setInAdminRegistry(adminDoc.exists());
        } catch {
          setInAdminRegistry(false);
        }
      } else {
        setCurrentProfile(null);
        setPrivateSettings(null);
        setInAdminRegistry(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [bootstrapUserProfile]);

  // Public feed & users listeners (with rule-compliant where clauses!)
  useEffect(() => {
    const postsQuery = query(
      collection(db, 'posts'),
      where('moderationStatus', '==', 'approved'),
      where('visibility', '==', 'public'),
      limit(60)
    );
    const unsubPosts = onSnapshot(
      postsQuery,
      (snap) => {
        const list: PostRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            authorId: data.authorId,
            authorUsername: data.authorUsername,
            authorDisplayName: data.authorDisplayName,
            authorAvatarUrl: data.authorAvatarUrl,
            mediaType: data.mediaType,
            mediaUrl: data.mediaUrl,
            thumbnailUrl: data.thumbnailUrl || '',
            caption: data.caption || '',
            hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
            taggedUsernames: Array.isArray(data.taggedUsernames) ? data.taggedUsernames : [],
            audioTrackName: data.audioTrackName || '',
            visibility: data.visibility || 'public',
            likesCount: Number(data.likesCount || 0),
            commentsCount: Number(data.commentsCount || 0),
            viewsCount: Number(data.viewsCount || 0),
            savesCount: Number(data.savesCount || 0),
            sharesCount: Number(data.sharesCount || 0),
            moderationStatus: data.moderationStatus || 'approved',
            createdAtMs: toMs(data.createdAt),
          };
        });
        setDbPosts(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'posts')
    );

    const usersQuery = query(collection(db, 'users'), where('status', '==', 'active'), limit(60));
    const unsubUsers = onSnapshot(
      usersQuery,
      (snap) => {
        const list: UserProfile[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: data.uid,
            username: data.username,
            displayName: data.displayName,
            bio: data.bio || '',
            website: data.website || '',
            socialLink: data.socialLink || '',
            avatarUrl: data.avatarUrl || '',
            coverUrl: data.coverUrl || '',
            isPrivate: Boolean(data.isPrivate),
            showOnlineStatus: data.showOnlineStatus !== false,
            isOnline: Boolean(data.isOnline),
            status: data.status || 'active',
            followersCount: Number(data.followersCount || 0),
            followingCount: Number(data.followingCount || 0),
            postsCount: Number(data.postsCount || 0),
            totalLikesReceived: Number(data.totalLikesReceived || 0),
            totalViewsReceived: Number(data.totalViewsReceived || 0),
            createdAtMs: toMs(data.createdAt),
          };
        });
        setDbUsers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const annQuery = query(collection(db, 'announcements'), where('active', '==', true), limit(10));
    const unsubAnn = onSnapshot(
      annQuery,
      (snap) => {
        setAnnouncements(
          snap.docs
            .map((d) => {
              const data = d.data();
              return {
                id: d.id,
                authorId: data.authorId,
                title: data.title,
                body: data.body,
                active: Boolean(data.active),
                createdAtMs: toMs(data.createdAt),
              };
            })
            .sort((a, b) => b.createdAtMs - a.createdAtMs)
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'announcements')
    );

    getDoc(doc(db, 'settings', 'global'))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setPlatformSettings({
            minFollowersForMonetization: Number(data.minFollowersForMonetization ?? 1000),
            minViewsForMonetization: Number(data.minViewsForMonetization ?? 10000),
            allowNewRegistrations: data.allowNewRegistrations !== false,
            maintenanceBanner: data.maintenanceBanner || '',
          });
        }
      })
      .catch(() => {});

    return () => {
      unsubPosts();
      unsubUsers();
      unsubAnn();
    };
  }, []);

  // User-scoped real-time listeners when authenticated
  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    const uid = firebaseUser.uid;
    const unsubs: (() => void)[] = [];

    // Live own profile
    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            setCurrentProfile({
              uid: d.uid,
              username: d.username,
              displayName: d.displayName,
              bio: d.bio || '',
              website: d.website || '',
              socialLink: d.socialLink || '',
              avatarUrl: d.avatarUrl || '',
              coverUrl: d.coverUrl || '',
              isPrivate: Boolean(d.isPrivate),
              showOnlineStatus: d.showOnlineStatus !== false,
              isOnline: Boolean(d.isOnline),
              status: d.status || 'active',
              followersCount: Number(d.followersCount || 0),
              followingCount: Number(d.followingCount || 0),
              postsCount: Number(d.postsCount || 0),
              totalLikesReceived: Number(d.totalLikesReceived || 0),
              totalViewsReceived: Number(d.totalViewsReceived || 0),
              createdAtMs: toMs(d.createdAt),
            });
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
      )
    );

    // Private PII & notification settings
    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid, 'private', 'info'),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            setPrivateSettings({
              uid: d.uid,
              email: d.email,
              pushNotifications: Boolean(d.pushNotifications),
              likesNotifications: Boolean(d.likesNotifications),
              commentsNotifications: Boolean(d.commentsNotifications),
              followsNotifications: Boolean(d.followsNotifications),
              messagesNotifications: Boolean(d.messagesNotifications),
            });
          }
        },
        () => {}
      )
    );

    // Bookmarks
    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'bookmarks'), where('userId', '==', uid)),
        (snap) => {
          setBookmarkedPostIds(new Set(snap.docs.map((d) => d.id)));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/bookmarks`)
      )
    );

    // Blocked accounts
    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'blocks'), where('blockerId', '==', uid)),
        (snap) => {
          setBlockedUserIds(new Set(snap.docs.map((d) => d.id)));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/blocks`)
      )
    );

    // Accepted + outgoing/incoming follows
    const outgoingQ = query(collection(db, 'follows'), where('followerId', '==', uid));
    const incomingQ = query(collection(db, 'follows'), where('followingId', '==', uid));
    let outMap = new Map<string, FollowRecord>();
    let inMap = new Map<string, FollowRecord>();
    const syncFollows = () => {
      const merged = new Map<string, FollowRecord>([...outMap, ...inMap]);
      setFollows(Array.from(merged.values()));
    };
    unsubs.push(
      onSnapshot(
        outgoingQ,
        (snap) => {
          outMap = new Map(
            snap.docs.map((d) => {
              const data = d.data();
              return [
                d.id,
                {
                  id: d.id,
                  followerId: data.followerId,
                  followerUsername: data.followerUsername,
                  followerAvatarUrl: data.followerAvatarUrl,
                  followingId: data.followingId,
                  followingUsername: data.followingUsername,
                  followingAvatarUrl: data.followingAvatarUrl,
                  status: data.status,
                  createdAtMs: toMs(data.createdAt),
                },
              ];
            })
          );
          syncFollows();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'follows')
      )
    );
    unsubs.push(
      onSnapshot(
        incomingQ,
        (snap) => {
          inMap = new Map(
            snap.docs.map((d) => {
              const data = d.data();
              return [
                d.id,
                {
                  id: d.id,
                  followerId: data.followerId,
                  followerUsername: data.followerUsername,
                  followerAvatarUrl: data.followerAvatarUrl,
                  followingId: data.followingId,
                  followingUsername: data.followingUsername,
                  followingAvatarUrl: data.followingAvatarUrl,
                  status: data.status,
                  createdAtMs: toMs(data.createdAt),
                },
              ];
            })
          );
          syncFollows();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'follows')
      )
    );

    // Conversations where user is participantA or participantB
    let convA = new Map<string, ConversationRecord>();
    let convB = new Map<string, ConversationRecord>();
    const syncConvs = () => {
      const merged = Array.from(new Map([...convA, ...convB]).values()).sort(
        (a, b) => b.updatedAtMs - a.updatedAtMs
      );
      setConversations(merged);
    };
    unsubs.push(
      onSnapshot(
        query(collection(db, 'conversations'), where('participantA', '==', uid)),
        (snap) => {
          convA = new Map(
            snap.docs.map((d) => {
              const data = d.data();
              return [
                d.id,
                {
                  id: d.id,
                  participantA: data.participantA,
                  participantB: data.participantB,
                  participantAName: data.participantAName,
                  participantBName: data.participantBName,
                  participantAAvatar: data.participantAAvatar,
                  participantBAvatar: data.participantBAvatar,
                  lastMessageText: data.lastMessageText,
                  lastSenderId: data.lastSenderId,
                  typingUid: data.typingUid || '',
                  updatedAtMs: toMs(data.updatedAt),
                },
              ];
            })
          );
          syncConvs();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'conversations')
      )
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, 'conversations'), where('participantB', '==', uid)),
        (snap) => {
          convB = new Map(
            snap.docs.map((d) => {
              const data = d.data();
              return [
                d.id,
                {
                  id: d.id,
                  participantA: data.participantA,
                  participantB: data.participantB,
                  participantAName: data.participantAName,
                  participantBName: data.participantBName,
                  participantAAvatar: data.participantAAvatar,
                  participantBAvatar: data.participantBAvatar,
                  lastMessageText: data.lastMessageText,
                  lastSenderId: data.lastSenderId,
                  typingUid: data.typingUid || '',
                  updatedAtMs: toMs(data.updatedAt),
                },
              ];
            })
          );
          syncConvs();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'conversations')
      )
    );

    // Notifications
    unsubs.push(
      onSnapshot(
        query(collection(db, 'notifications'), where('recipientId', '==', uid), limit(40)),
        (snap) => {
          setNotifications(
            snap.docs
              .map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  recipientId: data.recipientId,
                  actorId: data.actorId,
                  actorUsername: data.actorUsername,
                  actorAvatarUrl: data.actorAvatarUrl,
                  type: data.type,
                  targetId: data.targetId || '',
                  message: data.message,
                  read: Boolean(data.read),
                  createdAtMs: toMs(data.createdAt),
                };
              })
              .sort((a, b) => b.createdAtMs - a.createdAtMs)
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
      )
    );

    // Own Monetization Application
    unsubs.push(
      onSnapshot(
        doc(db, 'monetization', uid),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            setMonetization({
              userId: d.userId,
              username: d.username,
              status: d.status,
              paymentProvider: d.paymentProvider,
              payoutAccountRef: d.payoutAccountRef,
              contentCategory: d.contentCategory,
              applicationNote: d.applicationNote,
              subscriptionsEnabled: Boolean(d.subscriptionsEnabled),
              giftsEnabled: Boolean(d.giftsEnabled),
              adsShareEnabled: Boolean(d.adsShareEnabled),
              verifiedBalanceCents: Number(d.verifiedBalanceCents || 0),
              lifetimePaidCents: Number(d.lifetimePaidCents || 0),
              adminReviewNote: d.adminReviewNote || '',
              updatedAtMs: toMs(d.updatedAt),
            });
          } else {
            setMonetization(null);
          }
        },
        () => {}
      )
    );

    // Payouts (admin sees all, creator sees own)
    const payoutsQ = isAdmin
      ? query(collection(db, 'payouts'), limit(50))
      : query(collection(db, 'payouts'), where('userId', '==', uid), limit(30));
    unsubs.push(
      onSnapshot(
        payoutsQ,
        (snap) => {
          setPayouts(
            snap.docs
              .map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  userId: data.userId,
                  username: data.username,
                  amountCents: Number(data.amountCents || 0),
                  paymentProvider: data.paymentProvider,
                  payoutAccountRef: data.payoutAccountRef,
                  status: data.status,
                  adminNote: data.adminNote || '',
                  createdAtMs: toMs(data.createdAt),
                };
              })
              .sort((a, b) => b.createdAtMs - a.createdAtMs)
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'payouts')
      )
    );

    // Reports & Admin Monetization Queue
    const reportsQ = isAdmin
      ? query(collection(db, 'reports'), limit(60))
      : query(collection(db, 'reports'), where('reporterId', '==', uid), limit(20));
    unsubs.push(
      onSnapshot(
        reportsQ,
        (snap) => {
          setReports(
            snap.docs
              .map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  reporterId: data.reporterId,
                  targetType: data.targetType,
                  targetId: data.targetId,
                  reason: data.reason,
                  status: data.status,
                  resolutionNote: data.resolutionNote || '',
                  createdAtMs: toMs(data.createdAt),
                };
              })
              .sort((a, b) => b.createdAtMs - a.createdAtMs)
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'reports')
      )
    );

    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'monetization'), limit(60)),
          (snap) => {
            setAllMonetizations(
              snap.docs.map((d) => {
                const data = d.data();
                return {
                  userId: data.userId,
                  username: data.username,
                  status: data.status,
                  paymentProvider: data.paymentProvider,
                  payoutAccountRef: data.payoutAccountRef,
                  contentCategory: data.contentCategory,
                  applicationNote: data.applicationNote,
                  subscriptionsEnabled: Boolean(data.subscriptionsEnabled),
                  giftsEnabled: Boolean(data.giftsEnabled),
                  adsShareEnabled: Boolean(data.adsShareEnabled),
                  verifiedBalanceCents: Number(data.verifiedBalanceCents || 0),
                  lifetimePaidCents: Number(data.lifetimePaidCents || 0),
                  adminReviewNote: data.adminReviewNote || '',
                  updatedAtMs: toMs(data.updatedAt),
                };
              })
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'monetization')
        )
      );
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [authReady, firebaseUser, isAdmin]);

  // Combine database users + curated seed creators (deduped by uid)
  const users = React.useMemo(() => {
    const map = new Map<string, UserProfile>();
    for (const c of SEED_CREATORS) map.set(c.uid, c);
    for (const u of dbUsers) map.set(u.uid, u);
    if (currentProfile) map.set(currentProfile.uid, currentProfile);
    return Array.from(map.values()).filter((u) => !blockedUserIds.has(u.uid));
  }, [dbUsers, currentProfile, blockedUserIds]);

  const posts = React.useMemo(() => {
    const map = new Map<string, PostRecord>();
    for (const p of SEED_POSTS) map.set(p.id, p);
    for (const p of dbPosts) map.set(p.id, p);
    for (const p of localSessionPosts) map.set(p.id, p);
    return Array.from(map.values())
      .filter((p) => p.moderationStatus !== 'removed' && !blockedUserIds.has(p.authorId))
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [dbPosts, localSessionPosts, blockedUserIds]);

  // Auth Handlers
  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    await bootstrapUserProfile(cred.user);
    showToast(`Signed in as @${cred.user.displayName || cred.user.email}`);
  };

  const signInEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    await bootstrapUserProfile(cred.user);
    showToast('Signed in to VidGram');
  };

  const signUpEmail = async (params: {
    email: string;
    password: string;
    username: string;
    displayName: string;
  }) => {
    if (!platformSettings.allowNewRegistrations) {
      throw new Error('New registrations are temporarily paused by platform administrator.');
    }
    const cleanUser = normalizeUsername(params.username);
    if (!isValidUsername(cleanUser)) {
      throw new Error('Username must be 3–30 characters using lowercase letters, numbers, dots, or underscores.');
    }
    const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
    await sendEmailVerification(cred.user);
    await bootstrapUserProfile(cred.user, cleanUser, params.displayName.trim());
    showToast('Account created! Check your inbox to verify your email address.');
  };

  const sendVerification = async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
    showToast('Verification email sent. Refresh after verifying.');
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
    showToast('Password reset link sent to your email.');
  };

  const logout = async () => {
    if (firebaseUser && currentProfile && firebaseUser.emailVerified) {
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          isOnline: false,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Ignore if doc doesn't exist
      }
    }
    await signOut(auth);
    showToast('Signed out');
  };

  const deleteMyAccount = async () => {
    if (!auth.currentUser || !currentProfile) return;
    const uid = auth.currentUser.uid;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', uid, 'private', 'info'));
      batch.delete(doc(db, 'usernames', currentProfile.username));
      batch.delete(doc(db, 'users', uid));
      await batch.commit();
      await deleteUser(auth.currentUser);
      showToast('Your VidGram account and profile data have been deleted.');
    } catch (error) {
      showToast('Re-authenticate recently before permanent account deletion, or submit a Data Deletion Request.');
      throw error;
    }
  };

  const requestDataDeletion = async (reason: string) => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      showToast('Sign in with a verified account to submit a formal data deletion request.');
      return;
    }
    const reportId = `del_${firebaseUser.uid}_${Date.now()}`;
    try {
      await setDoc(doc(db, 'reports', reportId), {
        reporterId: firebaseUser.uid,
        targetType: 'data_deletion',
        targetId: firebaseUser.uid,
        reason: (reason.trim() || 'User requested full personal data erasure').slice(0, 400),
        status: 'open',
        resolutionNote: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('Data deletion request logged for compliance processing.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `reports/${reportId}`);
    }
  };

  const requireVerifiedAuth = (): User => {
    if (!firebaseUser) {
      throw new Error('Sign in with Google or Email to perform this action.');
    }
    if (!firebaseUser.emailVerified) {
      throw new Error('Please verify your email address first (or sign in with Google).');
    }
    if (currentProfile?.status === 'suspended' || currentProfile?.status === 'banned') {
      throw new Error(`Your account is currently ${currentProfile.status}.`);
    }
    return firebaseUser;
  };

  const updateMyProfile: VidGramContextValue['updateMyProfile'] = async (
    updates,
    avatarFile,
    coverFile
  ) => {
    const u = requireVerifiedAuth();
    if (!currentProfile) return;

    let nextUsername = currentProfile.username;
    if (updates.username && normalizeUsername(updates.username) !== currentProfile.username) {
      const candidate = normalizeUsername(updates.username);
      if (!isValidUsername(candidate)) {
        throw new Error('Username must be 3–30 lowercase characters (a-z, 0-9, ., _).');
      }
      const snap = await getDoc(doc(db, 'usernames', candidate));
      if (snap.exists() && snap.data().uid !== u.uid) {
        throw new Error(`@${candidate} is already taken.`);
      }
      nextUsername = candidate;
    }

    let avatarUrl = currentProfile.avatarUrl;
    if (avatarFile) {
      avatarUrl = await uploadMediaWithProgress(avatarFile, 'avatars', u.uid);
    }
    let coverUrl = currentProfile.coverUrl;
    if (coverFile) {
      coverUrl = await uploadMediaWithProgress(coverFile, 'avatars', u.uid);
    }

    try {
      const batch = writeBatch(db);
      if (nextUsername !== currentProfile.username) {
        batch.delete(doc(db, 'usernames', currentProfile.username));
        batch.set(doc(db, 'usernames', nextUsername), {
          uid: u.uid,
          createdAt: serverTimestamp(),
        });
      }
      batch.update(doc(db, 'users', u.uid), {
        username: nextUsername,
        displayName: (updates.displayName ?? currentProfile.displayName).trim().slice(0, 60),
        bio: (updates.bio ?? currentProfile.bio).slice(0, 250),
        website: (updates.website ?? currentProfile.website).trim().slice(0, 200),
        socialLink: (updates.socialLink ?? currentProfile.socialLink).trim().slice(0, 200),
        avatarUrl: avatarUrl.slice(0, 2000),
        coverUrl: coverUrl.slice(0, 2000),
        isPrivate: updates.isPrivate ?? currentProfile.isPrivate,
        showOnlineStatus: updates.showOnlineStatus ?? currentProfile.showOnlineStatus,
        isOnline: true,
        postsCount: currentProfile.postsCount,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      showToast('Profile saved');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${u.uid}`);
    }
  };

  const updateNotificationPrefs: VidGramContextValue['updateNotificationPrefs'] = async (prefs) => {
    const u = requireVerifiedAuth();
    if (!privateSettings) return;
    try {
      await updateDoc(doc(db, 'users', u.uid, 'private', 'info'), {
        pushNotifications: prefs.pushNotifications ?? privateSettings.pushNotifications,
        likesNotifications: prefs.likesNotifications ?? privateSettings.likesNotifications,
        commentsNotifications: prefs.commentsNotifications ?? privateSettings.commentsNotifications,
        followsNotifications: prefs.followsNotifications ?? privateSettings.followsNotifications,
        messagesNotifications: prefs.messagesNotifications ?? privateSettings.messagesNotifications,
        updatedAt: serverTimestamp(),
      });
      showToast('Notification settings updated');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${u.uid}/private/info`);
    }
  };

  const publishPostOrReel: VidGramContextValue['publishPostOrReel'] = async ({
    mediaType,
    file,
    caption,
    audioTrackName,
    visibility,
    onProgress,
  }) => {
    const rate = actionLimiter.allow('publish');
    if (!rate.allowed) {
      throw new Error(`Please wait ${rate.retryAfterSec}s before publishing again.`);
    }
    const u = requireVerifiedAuth();
    if (!currentProfile) throw new Error('Profile loading, try again in a moment.');

    onProgress?.(10);
    const mediaUrl = await uploadMediaWithProgress(
      file,
      mediaType === 'reel' ? 'reels' : 'posts',
      u.uid,
      onProgress
    );

    let thumbnailUrl = mediaType === 'photo' ? mediaUrl : GENERATED_ASSETS.mountainReelPoster;
    if (mediaType === 'reel') {
      const generatedThumb = await generateVideoThumbnail(file);
      if (generatedThumb && generatedThumb.length <= 2400) {
        thumbnailUrl = generatedThumb;
      }
    }

    const hashtags = extractHashtags(caption);
    const taggedUsernames = extractMentions(caption);
    const postId = `post_${u.uid.slice(0, 8)}_${Date.now()}`;

    if (mediaUrl.startsWith('blob:')) {
      // Keep local blob URL alive in current session AND persist metadata with safe fallback URL if needed
      const sessionPost: PostRecord = {
        id: postId,
        authorId: u.uid,
        authorUsername: currentProfile.username,
        authorDisplayName: currentProfile.displayName,
        authorAvatarUrl: currentProfile.avatarUrl,
        mediaType,
        mediaUrl,
        thumbnailUrl,
        caption: caption.slice(0, 1000),
        hashtags,
        taggedUsernames,
        audioTrackName: audioTrackName.slice(0, 120),
        visibility,
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        savesCount: 0,
        sharesCount: 0,
        moderationStatus: 'approved',
        createdAtMs: Date.now(),
      };
      setLocalSessionPosts((prev) => [sessionPost, ...prev]);
    }

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'posts', postId), {
        authorId: u.uid,
        authorUsername: currentProfile.username,
        authorDisplayName: currentProfile.displayName,
        authorAvatarUrl: currentProfile.avatarUrl,
        mediaType,
        mediaUrl: mediaUrl.slice(0, 2500),
        thumbnailUrl: thumbnailUrl.slice(0, 2500),
        caption: caption.slice(0, 1000),
        hashtags,
        taggedUsernames,
        audioTrackName: audioTrackName.slice(0, 120),
        visibility,
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        savesCount: 0,
        sharesCount: 0,
        moderationStatus: 'approved',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'users', u.uid), {
        postsCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      showToast(mediaType === 'reel' ? 'Reel published to VidGram!' : 'Photo shared to feed!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `posts/${postId}`);
    }
  };

  const toggleLikePost = async (post: PostRecord) => {
    const alreadyLiked = likedPostIds.has(post.id);
    // Optimistic state for both seed & DB posts
    setLikedPostIds((prev) => {
      const next = new Set(prev);
      if (alreadyLiked) next.delete(post.id);
      else next.add(post.id);
      return next;
    });

    if (!firebaseUser || !firebaseUser.emailVerified || post.id.startsWith('seed_')) {
      if (!firebaseUser) showToast('Liked locally — sign in to sync likes across devices');
      return;
    }

    const likeRef = doc(db, 'posts', post.id, 'likes', firebaseUser.uid);
    const postRef = doc(db, 'posts', post.id);
    try {
      const batch = writeBatch(db);
      if (alreadyLiked) {
        batch.delete(likeRef);
        batch.update(postRef, {
          likesCount: Math.max(0, post.likesCount - 1),
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(likeRef, {
          userId: firebaseUser.uid,
          postId: post.id,
          createdAt: serverTimestamp(),
        });
        batch.update(postRef, {
          likesCount: post.likesCount + 1,
          updatedAt: serverTimestamp(),
        });
        if (post.authorId !== firebaseUser.uid && currentProfile) {
          const notifId = `like_${post.id}_${firebaseUser.uid}`;
          batch.set(doc(db, 'notifications', notifId), {
            recipientId: post.authorId,
            actorId: firebaseUser.uid,
            actorUsername: currentProfile.username,
            actorAvatarUrl: currentProfile.avatarUrl,
            type: 'like',
            targetId: post.id,
            message: `liked your ${post.mediaType === 'reel' ? 'Reel' : 'photo'}.`,
            read: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posts/${post.id}/likes/${firebaseUser.uid}`);
    }
  };

  const toggleBookmarkPost = async (post: PostRecord) => {
    const alreadySaved = bookmarkedPostIds.has(post.id);
    setBookmarkedPostIds((prev) => {
      const next = new Set(prev);
      if (alreadySaved) next.delete(post.id);
      else next.add(post.id);
      return next;
    });

    if (!firebaseUser || !firebaseUser.emailVerified || post.id.startsWith('seed_')) {
      showToast(alreadySaved ? 'Removed from saved items' : 'Saved to bookmarks');
      return;
    }

    const bmRef = doc(db, 'users', firebaseUser.uid, 'bookmarks', post.id);
    try {
      const batch = writeBatch(db);
      if (alreadySaved) {
        batch.delete(bmRef);
        batch.update(doc(db, 'posts', post.id), {
          savesCount: Math.max(0, post.savesCount - 1),
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(bmRef, {
          userId: firebaseUser.uid,
          postId: post.id,
          createdAt: serverTimestamp(),
        });
        batch.update(doc(db, 'posts', post.id), {
          savesCount: post.savesCount + 1,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      showToast(alreadySaved ? 'Removed from saved' : 'Saved to bookmarks');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}/bookmarks/${post.id}`);
    }
  };

  const recordPostView = async (post: PostRecord) => {
    if (!firebaseUser || !firebaseUser.emailVerified || post.id.startsWith('seed_')) return;
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        viewsCount: post.viewsCount + 1,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Non-blocking view increment
    }
  };

  const recordPostShare = async (post: PostRecord) => {
    const shareUrl = `${window.location.origin}/?post=${encodeURIComponent(post.id)}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
    showToast('Share link copied to clipboard');
    if (!firebaseUser || !firebaseUser.emailVerified || post.id.startsWith('seed_')) return;
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        sharesCount: post.sharesCount + 1,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Non-blocking
    }
  };

  const deletePost = async (postId: string) => {
    const u = requireVerifiedAuth();
    setLocalSessionPosts((prev) => prev.filter((p) => p.id !== postId));
    if (postId.startsWith('seed_')) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      await updateDoc(doc(db, 'users', u.uid), {
        postsCount: Math.max(0, (currentProfile?.postsCount || 1) - 1),
        updatedAt: serverTimestamp(),
      });
      showToast('Post deleted');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${postId}`);
    }
  };

  const subscribeComments = useCallback(
    (postId: string, onData: (comments: CommentRecord[]) => void) => {
      if (postId.startsWith('seed_')) {
        onData([
          {
            id: 'seed_c1',
            postId,
            authorId: 'creator_marcus_film',
            authorUsername: 'marcus.film',
            authorAvatarUrl: GENERATED_ASSETS.marcusAvatar,
            text: 'Love the tonal range and composition on this frame.',
            parentCommentId: '',
            moderationStatus: 'approved',
            createdAtMs: Date.now() - 1800_000,
          },
        ]);
        return () => {};
      }
      const q = query(
        collection(db, 'posts', postId, 'comments'),
        where('moderationStatus', '==', 'approved'),
        where('postId', '==', postId),
        limit(50)
      );
      return onSnapshot(
        q,
        (snap) => {
          const list: CommentRecord[] = snap.docs
            .map((d) => {
              const data = d.data();
              return {
                id: d.id,
                postId: data.postId,
                authorId: data.authorId,
                authorUsername: data.authorUsername,
                authorAvatarUrl: data.authorAvatarUrl,
                text: data.text,
                parentCommentId: data.parentCommentId || '',
                moderationStatus: data.moderationStatus,
                createdAtMs: toMs(data.createdAt),
              };
            })
            .sort((a, b) => a.createdAtMs - b.createdAtMs);
          onData(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `posts/${postId}/comments`)
      );
    },
    []
  );

  const addComment = async (post: PostRecord, text: string, parentCommentId = '') => {
    const rate = actionLimiter.allow('comment');
    if (!rate.allowed) throw new Error(`Slow down! Try again in ${rate.retryAfterSec}s.`);
    const cleanText = text.trim().slice(0, 500);
    if (!cleanText) return;
    const u = requireVerifiedAuth();
    if (!currentProfile) return;

    if (post.id.startsWith('seed_')) {
      showToast('Comment posted! Create a live post to store persistent comment threads.');
      return;
    }

    const commentId = `cmt_${u.uid.slice(0, 6)}_${Date.now()}`;
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'posts', post.id, 'comments', commentId), {
        postId: post.id,
        authorId: u.uid,
        authorUsername: currentProfile.username,
        authorAvatarUrl: currentProfile.avatarUrl,
        text: cleanText,
        parentCommentId: parentCommentId.slice(0, 128),
        moderationStatus: 'approved',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'posts', post.id), {
        commentsCount: post.commentsCount + 1,
        updatedAt: serverTimestamp(),
      });
      if (post.authorId !== u.uid) {
        batch.set(doc(db, 'notifications', `cmt_${commentId}`), {
          recipientId: post.authorId,
          actorId: u.uid,
          actorUsername: currentProfile.username,
          actorAvatarUrl: currentProfile.avatarUrl,
          type: 'comment',
          targetId: post.id,
          message: `commented: "${cleanText.slice(0, 80)}"`,
          read: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `posts/${post.id}/comments/${commentId}`);
    }
  };

  const deleteComment = async (postId: string, commentId: string) => {
    requireVerifiedAuth();
    if (postId.startsWith('seed_')) return;
    try {
      await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
      showToast('Comment removed');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${postId}/comments/${commentId}`);
    }
  };

  // Follow / Unfollow / Private Follow Requests
  const toggleFollowUser = async (targetUser: UserProfile) => {
    const u = requireVerifiedAuth();
    if (!currentProfile || targetUser.uid === u.uid) return;

    if (targetUser.uid.startsWith('creator_')) {
      const edgeId = buildFollowEdgeId(u.uid, targetUser.uid);
      const existsLocal = follows.find((f) => f.id === edgeId);
      if (existsLocal) {
        setFollows((prev) => prev.filter((f) => f.id !== edgeId));
        showToast(`Unfollowed @${targetUser.username}`);
      } else {
        const status = targetUser.isPrivate ? 'pending' : 'accepted';
        setFollows((prev) => [
          ...prev,
          {
            id: edgeId,
            followerId: u.uid,
            followerUsername: currentProfile.username,
            followerAvatarUrl: currentProfile.avatarUrl,
            followingId: targetUser.uid,
            followingUsername: targetUser.username,
            followingAvatarUrl: targetUser.avatarUrl,
            status,
            createdAtMs: Date.now(),
          },
        ]);
        showToast(
          status === 'pending'
            ? `Follow request sent to private account @${targetUser.username}`
            : `Following @${targetUser.username}`
        );
      }
      return;
    }

    const edgeId = buildFollowEdgeId(u.uid, targetUser.uid);
    const existingEdge = follows.find((f) => f.id === edgeId);
    try {
      const batch = writeBatch(db);
      if (existingEdge) {
        batch.delete(doc(db, 'follows', edgeId));
        if (existingEdge.status === 'accepted') {
          batch.update(doc(db, 'users', targetUser.uid), {
            followersCount: Math.max(0, targetUser.followersCount - 1),
            updatedAt: serverTimestamp(),
          });
          batch.update(doc(db, 'users', u.uid), {
            followingCount: Math.max(0, currentProfile.followingCount - 1),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
        showToast(`Unfollowed @${targetUser.username}`);
      } else {
        const status: 'accepted' | 'pending' = targetUser.isPrivate ? 'pending' : 'accepted';
        batch.set(doc(db, 'follows', edgeId), {
          followerId: u.uid,
          followerUsername: currentProfile.username,
          followerAvatarUrl: currentProfile.avatarUrl,
          followingId: targetUser.uid,
          followingUsername: targetUser.username,
          followingAvatarUrl: targetUser.avatarUrl,
          status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (status === 'accepted') {
          batch.update(doc(db, 'users', targetUser.uid), {
            followersCount: targetUser.followersCount + 1,
            updatedAt: serverTimestamp(),
          });
          batch.update(doc(db, 'users', u.uid), {
            followingCount: currentProfile.followingCount + 1,
            updatedAt: serverTimestamp(),
          });
        }
        batch.set(doc(db, 'notifications', `flw_${edgeId}_${Date.now()}`), {
          recipientId: targetUser.uid,
          actorId: u.uid,
          actorUsername: currentProfile.username,
          actorAvatarUrl: currentProfile.avatarUrl,
          type: status === 'pending' ? 'follow_request' : 'follow',
          targetId: u.uid,
          message:
            status === 'pending'
              ? 'requested to follow your private account.'
              : 'started following you.',
          read: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        showToast(status === 'pending' ? 'Follow request sent' : `Following @${targetUser.username}`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `follows/${edgeId}`);
    }
  };

  const approveFollowRequest = async (followRec: FollowRecord) => {
    const u = requireVerifiedAuth();
    if (!currentProfile) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'follows', followRec.id), {
        status: 'accepted',
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'users', u.uid), {
        followersCount: currentProfile.followersCount + 1,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      showToast(`Approved @${followRec.followerUsername}'s follow request`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `follows/${followRec.id}`);
    }
  };

  const declineFollowRequest = async (followRec: FollowRecord) => {
    requireVerifiedAuth();
    try {
      await deleteDoc(doc(db, 'follows', followRec.id));
      showToast('Follow request declined');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `follows/${followRec.id}`);
    }
  };

  const toggleBlockUser = async (targetUser: UserProfile) => {
    const u = requireVerifiedAuth();
    const isBlocked = blockedUserIds.has(targetUser.uid);
    const blockRef = doc(db, 'users', u.uid, 'blocks', targetUser.uid);
    try {
      if (isBlocked) {
        await deleteDoc(blockRef);
        showToast(`Unblocked @${targetUser.username}`);
      } else {
        await setDoc(blockRef, {
          blockerId: u.uid,
          blockedUid: targetUser.uid,
          blockedUsername: targetUser.username,
          createdAt: serverTimestamp(),
        });
        showToast(`Blocked @${targetUser.username}`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}/blocks/${targetUser.uid}`);
    }
  };

  // Real-time Messaging
  const startOrOpenConversation = async (targetUser: UserProfile): Promise<string> => {
    const u = requireVerifiedAuth();
    if (!currentProfile) throw new Error('Profile loading');
    if (targetUser.uid.startsWith('creator_')) {
      throw new Error(
        `@${targetUser.username} is a showcase creator profile. Invite or search a registered VidGram user to start live encrypted Firestore chat.`
      );
    }
    const convId = buildConversationId(u.uid, targetUser.uid);
    const convRef = doc(db, 'conversations', convId);
    const existing = await getDoc(convRef);
    if (!existing.exists()) {
      const sorted = [u.uid, targetUser.uid].sort();
      const isA = sorted[0] === u.uid;
      try {
        await setDoc(convRef, {
          participantA: sorted[0],
          participantB: sorted[1],
          participantAName: isA ? currentProfile.username : targetUser.username,
          participantBName: isA ? targetUser.username : currentProfile.username,
          participantAAvatar: isA ? currentProfile.avatarUrl : targetUser.avatarUrl,
          participantBAvatar: isA ? targetUser.avatarUrl : currentProfile.avatarUrl,
          lastMessageText: 'Conversation started',
          lastSenderId: u.uid,
          typingUid: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `conversations/${convId}`);
      }
    }
    return convId;
  };

  const subscribeMessages = useCallback(
    (conversationId: string, onData: (msgs: MessageRecord[]) => void) => {
      if (!firebaseUser) return () => {};
      const uid = firebaseUser.uid;
      let sentMap = new Map<string, MessageRecord>();
      let recvMap = new Map<string, MessageRecord>();
      const sync = () => {
        const merged = Array.from(new Map([...sentMap, ...recvMap]).values()).sort(
          (a, b) => a.createdAtMs - b.createdAtMs
        );
        onData(merged);
      };

      const unsubSent = onSnapshot(
        query(collection(db, 'conversations', conversationId, 'messages'), where('senderId', '==', uid)),
        (snap) => {
          sentMap = new Map(
            snap.docs.map((d) => {
              const data = d.data();
              return [
                d.id,
                {
                  id: d.id,
                  conversationId: data.conversationId,
                  senderId: data.senderId,
                  recipientId: data.recipientId,
                  messageType: data.messageType,
                  text: data.text,
                  mediaUrl: data.mediaUrl || '',
                  deliveryStatus: data.deliveryStatus,
                  isDeleted: Boolean(data.isDeleted),
                  createdAtMs: toMs(data.createdAt),
                },
              ];
            })
          );
          sync();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `conversations/${conversationId}/messages`)
      );

      const unsubRecv = onSnapshot(
        query(collection(db, 'conversations', conversationId, 'messages'), where('recipientId', '==', uid)),
        (snap) => {
          recvMap = new Map(
            snap.docs.map((d) => {
              const data = d.data();
              return [
                d.id,
                {
                  id: d.id,
                  conversationId: data.conversationId,
                  senderId: data.senderId,
                  recipientId: data.recipientId,
                  messageType: data.messageType,
                  text: data.text,
                  mediaUrl: data.mediaUrl || '',
                  deliveryStatus: data.deliveryStatus,
                  isDeleted: Boolean(data.isDeleted),
                  createdAtMs: toMs(data.createdAt),
                },
              ];
            })
          );
          sync();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `conversations/${conversationId}/messages`)
      );

      return () => {
        unsubSent();
        unsubRecv();
      };
    },
    [firebaseUser]
  );

  const sendMessage: VidGramContextValue['sendMessage'] = async ({
    conversationId,
    recipientId,
    messageType,
    text,
    mediaBlob,
  }) => {
    const rate = actionLimiter.allow('message');
    if (!rate.allowed) throw new Error(`Wait ${rate.retryAfterSec}s before sending more messages.`);
    const u = requireVerifiedAuth();
    if (!currentProfile) return;

    let mediaUrl = '';
    if (mediaBlob) {
      mediaUrl = await uploadMediaWithProgress(mediaBlob, 'messages', u.uid);
    }

    const msgId = `msg_${u.uid.slice(0, 6)}_${Date.now()}`;
    const preview =
      messageType === 'text'
        ? text.trim().slice(0, 120)
        : `Sent a ${messageType} message`;

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'conversations', conversationId, 'messages', msgId), {
        conversationId,
        senderId: u.uid,
        recipientId,
        messageType,
        text: text.trim().slice(0, 1500),
        mediaUrl: mediaUrl.slice(0, 2500),
        deliveryStatus: 'delivered',
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'conversations', conversationId), {
        lastMessageText: preview,
        lastSenderId: u.uid,
        typingUid: '',
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'notifications', `msg_${msgId}`), {
        recipientId,
        actorId: u.uid,
        actorUsername: currentProfile.username,
        actorAvatarUrl: currentProfile.avatarUrl,
        type: 'message',
        targetId: conversationId,
        message: preview,
        read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `conversations/${conversationId}/messages/${msgId}`);
    }
  };

  const setTypingState = async (conversationId: string, isTyping: boolean) => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    try {
      await updateDoc(doc(db, 'conversations', conversationId), {
        typingUid: isTyping ? firebaseUser.uid : '',
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Ignore transient typing errors
    }
  };

  const markMessageRead = async (conversationId: string, msg: MessageRecord) => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    if (msg.recipientId !== firebaseUser.uid || msg.deliveryStatus === 'read') return;
    try {
      await updateDoc(doc(db, 'conversations', conversationId, 'messages', msg.id), {
        deliveryStatus: 'read',
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Ignore
    }
  };

  const unsendMessage = async (conversationId: string, messageId: string) => {
    requireVerifiedAuth();
    try {
      await updateDoc(doc(db, 'conversations', conversationId, 'messages', messageId), {
        isDeleted: true,
        text: 'Message unsent',
        mediaUrl: '',
        updatedAt: serverTimestamp(),
      });
      showToast('Message unsent');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${conversationId}/messages/${messageId}`);
    }
  };

  const markAllNotificationsRead = async () => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      for (const n of unread) {
        batch.update(doc(db, 'notifications', n.id), {
          read: true,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications');
    }
  };

  const submitReport = async (
    targetType: ReportRecord['targetType'],
    targetId: string,
    reason: string
  ) => {
    const u = requireVerifiedAuth();
    const reportId = `rep_${u.uid.slice(0, 6)}_${Date.now()}`;
    try {
      await setDoc(doc(db, 'reports', reportId), {
        reporterId: u.uid,
        targetType,
        targetId,
        reason: reason.trim().slice(0, 400),
        status: 'open',
        resolutionNote: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('Report submitted to VidGram Trust & Safety');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `reports/${reportId}`);
    }
  };

  // Monetization & Admin Implementations
  const applyOrUpdateMonetization: VidGramContextValue['applyOrUpdateMonetization'] = async (
    params
  ) => {
    const u = requireVerifiedAuth();
    if (!currentProfile) return;
    const refDoc = doc(db, 'monetization', u.uid);
    try {
      if (!monetization) {
        await setDoc(refDoc, {
          userId: u.uid,
          username: currentProfile.username,
          status: 'pending',
          paymentProvider: params.paymentProvider,
          payoutAccountRef: params.payoutAccountRef.trim().slice(0, 160),
          contentCategory: params.contentCategory.trim().slice(0, 80),
          applicationNote: params.applicationNote.trim().slice(0, 500),
          subscriptionsEnabled: params.subscriptionsEnabled,
          giftsEnabled: params.giftsEnabled,
          adsShareEnabled: params.adsShareEnabled,
          verifiedBalanceCents: 0,
          lifetimePaidCents: 0,
          adminReviewNote: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast('Monetization application submitted for administrator verification');
      } else {
        await updateDoc(refDoc, {
          paymentProvider: params.paymentProvider,
          payoutAccountRef: params.payoutAccountRef.trim().slice(0, 160),
          contentCategory: params.contentCategory.trim().slice(0, 80),
          applicationNote: params.applicationNote.trim().slice(0, 500),
          subscriptionsEnabled: params.subscriptionsEnabled,
          giftsEnabled: params.giftsEnabled,
          adsShareEnabled: params.adsShareEnabled,
          updatedAt: serverTimestamp(),
        });
        showToast('Monetization settings saved');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `monetization/${u.uid}`);
    }
  };

  const requestCreatorPayout = async (amountCents: number) => {
    const u = requireVerifiedAuth();
    if (!currentProfile || !monetization) {
      throw new Error('Complete monetization setup first.');
    }
    if (monetization.status !== 'approved') {
      throw new Error('Monetization application must be approved by an administrator first.');
    }
    if (monetization.paymentProvider === 'none' || !monetization.payoutAccountRef.trim()) {
      throw new Error('Connect a verified payment provider and account reference before requesting payouts.');
    }
    if (amountCents < 100 || amountCents > monetization.verifiedBalanceCents) {
      throw new Error('Requested payout exceeds verified available balance.');
    }
    const payoutId = `pay_${u.uid.slice(0, 6)}_${Date.now()}`;
    try {
      await setDoc(doc(db, 'payouts', payoutId), {
        userId: u.uid,
        username: currentProfile.username,
        amountCents,
        paymentProvider: monetization.paymentProvider,
        payoutAccountRef: monetization.payoutAccountRef,
        status: 'requested',
        adminNote: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('Payout withdrawal request submitted');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `payouts/${payoutId}`);
    }
  };

  const adminReviewMonetization = async (
    targetUid: string,
    status: 'approved' | 'rejected',
    verifiedBalanceCents: number,
    note: string
  ) => {
    if (!isAdmin) throw new Error('Unauthorized administrator action.');
    try {
      await updateDoc(doc(db, 'monetization', targetUid), {
        status,
        verifiedBalanceCents: Math.max(0, Math.round(verifiedBalanceCents)),
        adminReviewNote: note.trim().slice(0, 400),
        updatedAt: serverTimestamp(),
      });
      showToast(`Creator monetization marked ${status}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `monetization/${targetUid}`);
    }
  };

  const adminProcessPayout = async (
    payout: PayoutRecord,
    status: 'completed' | 'declined',
    note: string
  ) => {
    if (!isAdmin) throw new Error('Unauthorized administrator action.');
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'payouts', payout.id), {
        status,
        adminNote: note.trim().slice(0, 300),
        updatedAt: serverTimestamp(),
      });
      if (status === 'completed') {
        const monDoc = await getDoc(doc(db, 'monetization', payout.userId));
        if (monDoc.exists()) {
          const curBal = Number(monDoc.data().verifiedBalanceCents || 0);
          const curPaid = Number(monDoc.data().lifetimePaidCents || 0);
          batch.update(doc(db, 'monetization', payout.userId), {
            verifiedBalanceCents: Math.max(0, curBal - payout.amountCents),
            lifetimePaidCents: curPaid + payout.amountCents,
            updatedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
      showToast(`Payout ${status}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payouts/${payout.id}`);
    }
  };

  const adminUpdateUserStatus = async (targetUid: string, status: UserProfile['status']) => {
    if (!isAdmin) throw new Error('Unauthorized administrator action.');
    try {
      await updateDoc(doc(db, 'users', targetUid), {
        status,
        updatedAt: serverTimestamp(),
      });
      showToast(`User account set to ${status}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  const adminModeratePost = async (
    postId: string,
    moderationStatus: PostRecord['moderationStatus']
  ) => {
    if (!isAdmin) throw new Error('Unauthorized administrator action.');
    try {
      await updateDoc(doc(db, 'posts', postId), {
        moderationStatus,
        updatedAt: serverTimestamp(),
      });
      showToast(`Post status updated to ${moderationStatus}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${postId}`);
    }
  };

  const adminResolveReport = async (
    reportId: string,
    status: 'resolved' | 'dismissed',
    note: string
  ) => {
    if (!isAdmin) throw new Error('Unauthorized administrator action.');
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status,
        resolutionNote: note.trim().slice(0, 300),
        updatedAt: serverTimestamp(),
      });
      showToast(`Report ${status}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
    }
  };

  const adminPublishAnnouncement = async (title: string, body: string) => {
    if (!isAdmin || !firebaseUser) throw new Error('Unauthorized administrator action.');
    const annId = `ann_${Date.now()}`;
    try {
      await setDoc(doc(db, 'announcements', annId), {
        authorId: firebaseUser.uid,
        title: title.trim().slice(0, 120),
        body: body.trim().slice(0, 1000),
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('Platform announcement published');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `announcements/${annId}`);
    }
  };

  const adminSavePlatformSettings = async (settings: PlatformSettingsRecord) => {
    if (!isAdmin || !firebaseUser) throw new Error('Unauthorized administrator action.');
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        minFollowersForMonetization: Math.max(0, Math.round(settings.minFollowersForMonetization)),
        minViewsForMonetization: Math.max(0, Math.round(settings.minViewsForMonetization)),
        allowNewRegistrations: settings.allowNewRegistrations,
        maintenanceBanner: settings.maintenanceBanner.trim().slice(0, 240),
        updatedBy: firebaseUser.uid,
        updatedAt: serverTimestamp(),
      });
      setPlatformSettings(settings);
      showToast('Global platform settings saved');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/global');
    }
  };

  return (
    <VidGramContext.Provider
      value={{
        firebaseUser,
        authReady,
        currentProfile,
        privateSettings,
        isAdmin,
        darkMode,
        toggleDarkMode,
        toastMessage,
        showToast,
        users,
        posts,
        likedPostIds,
        bookmarkedPostIds,
        blockedUserIds,
        follows,
        conversations,
        notifications,
        monetization,
        allMonetizations,
        payouts,
        reports,
        announcements,
        platformSettings,
        signInWithGoogle,
        signInEmail,
        signUpEmail,
        sendVerification,
        resetPassword,
        logout,
        deleteMyAccount,
        requestDataDeletion,
        updateMyProfile,
        updateNotificationPrefs,
        toggleFollowUser,
        approveFollowRequest,
        declineFollowRequest,
        toggleBlockUser,
        publishPostOrReel,
        toggleLikePost,
        toggleBookmarkPost,
        recordPostView,
        recordPostShare,
        deletePost,
        subscribeComments,
        addComment,
        deleteComment,
        startOrOpenConversation,
        subscribeMessages,
        sendMessage,
        setTypingState,
        markMessageRead,
        unsendMessage,
        markAllNotificationsRead,
        submitReport,
        applyOrUpdateMonetization,
        requestCreatorPayout,
        adminReviewMonetization,
        adminProcessPayout,
        adminUpdateUserStatus,
        adminModeratePost,
        adminResolveReport,
        adminPublishAnnouncement,
        adminSavePlatformSettings,
      }}
    >
      {children}
    </VidGramContext.Provider>
  );
};

export function useVidGram() {
  const ctx = useContext(VidGramContext);
  if (!ctx) throw new Error('useVidGram must be used inside VidGramProvider');
  return ctx;
}
