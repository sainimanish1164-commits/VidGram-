import React, { useState } from 'react';
import {
  Globe,
  Link2,
  Lock,
  Share2,
  Edit3,
  BarChart3,
  DollarSign,
  ShieldAlert,
  Ban,
  Flag,
  Play,
  Bookmark,
  X,
  Trash2,
} from 'lucide-react';
import { useVidGram } from '../context/VidGramContext';
import type { NavTab, PostRecord, UserProfile } from '../types/vidgram';
import { SafeMediaImage } from './SafeMediaImage';
import { formatCompactNumber, buildFollowEdgeId } from '../utils/vidgramLogic';

interface ProfileViewProps {
  viewedUser: UserProfile | null;
  onClearViewedUser: () => void;
  onNavigate: (tab: NavTab) => void;
  onStartChat: (user: UserProfile) => void;
  onOpenReelsAt: (postId: string) => void;
  onOpenComments: (post: PostRecord) => void;
  onOpenReport: (type: 'user', id: string, label: string) => void;
  onRequireAuth: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  viewedUser,
  onClearViewedUser,
  onNavigate,
  onStartChat,
  onOpenReelsAt,
  onOpenComments,
  onOpenReport,
  onRequireAuth,
}) => {
  const {
    firebaseUser,
    currentProfile,
    isAdmin,
    posts,
    follows,
    bookmarkedPostIds,
    blockedUserIds,
    updateMyProfile,
    toggleFollowUser,
    toggleBlockUser,
    deleteMyAccount,
    requestDataDeletion,
    logout,
    showToast,
  } = useVidGram();

  const targetProfile = viewedUser || currentProfile;
  const isOwnProfile = Boolean(
    currentProfile && targetProfile && currentProfile.uid === targetProfile.uid
  );

  const [subTab, setSubTab] = useState<'posts' | 'reels' | 'tagged' | 'saved'>('posts');
  const [editing, setEditing] = useState(false);
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Edit form fields
  const [editUsername, setEditUsername] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editSocial, setEditSocial] = useState('');
  const [editPrivate, setEditPrivate] = useState(false);
  const [editOnline, setEditOnline] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  if (!targetProfile) {
    return (
      <div className="max-w-lg mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Sign in to view & customize your VidGram profile
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Set your unique @username, upload a profile photo and cover banner, manage public/private visibility, and access Creator Analytics.
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="px-6 py-3 min-h-[46px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold"
        >
          Sign In / Create Account
        </button>
      </div>
    );
  }

  const openEditor = () => {
    setEditUsername(targetProfile.username);
    setEditDisplayName(targetProfile.displayName);
    setEditBio(targetProfile.bio);
    setEditWebsite(targetProfile.website);
    setEditSocial(targetProfile.socialLink);
    setEditPrivate(targetProfile.isPrivate);
    setEditOnline(targetProfile.showOnlineStatus);
    setSaveErr(null);
    setEditing(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveErr(null);
    setSaveBusy(true);
    try {
      await updateMyProfile(
        {
          username: editUsername,
          displayName: editDisplayName,
          bio: editBio,
          website: editWebsite,
          socialLink: editSocial,
          isPrivate: editPrivate,
          showOnlineStatus: editOnline,
        },
        avatarFile,
        coverFile
      );
      setEditing(false);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaveBusy(false);
    }
  };

  const userPosts = posts.filter((p) => p.authorId === targetProfile.uid);
  const userReels = userPosts.filter((p) => p.mediaType === 'reel');
  const taggedPosts = posts.filter((p) =>
    p.taggedUsernames.map((t) => t.toLowerCase()).includes(targetProfile.username.toLowerCase())
  );
  const savedPosts = posts.filter((p) => bookmarkedPostIds.has(p.id));

  const computedViews =
    userPosts.reduce((sum, p) => sum + p.viewsCount, 0) || targetProfile.totalViewsReceived;
  const computedLikes =
    userPosts.reduce((sum, p) => sum + p.likesCount, 0) || targetProfile.totalLikesReceived;

  const followEdge = firebaseUser
    ? follows.find((f) => f.id === buildFollowEdgeId(firebaseUser.uid, targetProfile.uid))
    : undefined;

  const canViewContent =
    !targetProfile.isPrivate ||
    isOwnProfile ||
    followEdge?.status === 'accepted' ||
    isAdmin;

  const followersList = follows.filter(
    (f) => f.followingId === targetProfile.uid && f.status === 'accepted'
  );
  const followingList = follows.filter(
    (f) => f.followerId === targetProfile.uid && f.status === 'accepted'
  );
  const myFollowingSet = new Set(
    follows
      .filter((f) => f.followerId === firebaseUser?.uid && f.status === 'accepted')
      .map((f) => f.followingId)
  );
  const mutualFollowers = followersList.filter((f) => myFollowingSet.has(f.followerId));

  const gridItems =
    subTab === 'posts'
      ? userPosts
      : subTab === 'reels'
        ? userReels
        : subTab === 'tagged'
          ? taggedPosts
          : savedPosts;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {viewedUser && !isOwnProfile && (
        <button
          type="button"
          onClick={onClearViewedUser}
          className="text-xs font-semibold text-rose-500 hover:underline"
        >
          ← Back to My Profile
        </button>
      )}

      {/* Cover Banner + Profile Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="h-40 sm:h-52 relative bg-slate-900">
          <SafeMediaImage
            src={targetProfile.coverUrl}
            alt={`${targetProfile.displayName} cover`}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 relative z-10">
            <SafeMediaImage
              src={targetProfile.avatarUrl}
              alt={targetProfile.username}
              className="w-24 h-24 rounded-2xl object-cover border-4 border-white dark:border-slate-900 shadow-md"
            />

            <div className="flex flex-wrap items-center gap-2">
              {isOwnProfile ? (
                <>
                  <button
                    type="button"
                    onClick={openEditor}
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('creator_dashboard')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Creator Studio</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('monetization')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Monetization</span>
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => onNavigate('admin')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Admin Console</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (!firebaseUser) {
                        onRequireAuth();
                        return;
                      }
                      toggleFollowUser(targetProfile);
                    }}
                    className={`px-5 py-2 min-h-[42px] rounded-xl text-xs font-semibold ${
                      followEdge
                        ? 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                        : 'bg-rose-600 hover:bg-rose-500 text-white'
                    }`}
                  >
                    {followEdge
                      ? followEdge.status === 'pending'
                        ? 'Follow Requested'
                        : 'Following'
                      : 'Follow'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartChat(targetProfile)}
                    className="px-4 py-2 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Message
                  </button>
                  <button
                    type="button"
                    aria-label={`Block ${targetProfile.username}`}
                    onClick={() => {
                      if (!firebaseUser) {
                        onRequireAuth();
                        return;
                      }
                      toggleBlockUser(targetProfile);
                    }}
                    className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-500"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Report ${targetProfile.username}`}
                    onClick={() =>
                      onOpenReport('user', targetProfile.uid, `@${targetProfile.username}`)
                    }
                    className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-500"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </>
              )}

              <button
                type="button"
                aria-label="Share profile link"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(`${window.location.origin}/?u=${targetProfile.username}`)
                    .catch(() => {});
                  showToast(`Copied @${targetProfile.username} profile link`);
                }}
                className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bio & Metadata */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {targetProfile.displayName}
              </h1>
              {targetProfile.isPrivate && <Lock className="w-4 h-4 text-slate-400" />}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              @{targetProfile.username}
              {targetProfile.showOnlineStatus && targetProfile.isOnline ? ' · Online now' : ''}
              {blockedUserIds.has(targetProfile.uid) ? ' · Blocked' : ''}
            </div>

            {targetProfile.bio && (
              <p className="text-sm text-slate-700 dark:text-slate-200 max-w-2xl leading-relaxed">
                {targetProfile.bio}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
              {targetProfile.website && (
                <a
                  href={
                    targetProfile.website.startsWith('http')
                      ? targetProfile.website
                      : `https://${targetProfile.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-rose-500 hover:underline"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{targetProfile.website.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
              {targetProfile.socialLink && (
                <span className="inline-flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5" />
                  <span>{targetProfile.socialLink}</span>
                </span>
              )}
              {!isOwnProfile && mutualFollowers.length > 0 && (
                <span>
                  Followed by @{mutualFollowers[0].followerUsername}
                  {mutualFollowers.length > 1 ? ` + ${mutualFollowers.length - 1} mutual` : ''}
                </span>
              )}
            </div>
          </div>

          {/* Tabular Metrics Strip */}
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 gap-3 text-center sm:text-left">
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                {formatCompactNumber(Math.max(userPosts.length, targetProfile.postsCount))}
              </div>
              <div className="text-xs text-slate-500">Posts</div>
            </div>
            <button
              type="button"
              onClick={() => setFollowModal('followers')}
              className="text-center sm:text-left hover:opacity-80"
            >
              <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                {formatCompactNumber(targetProfile.followersCount)}
              </div>
              <div className="text-xs text-slate-500">Followers</div>
            </button>
            <button
              type="button"
              onClick={() => setFollowModal('following')}
              className="text-center sm:text-left hover:opacity-80"
            >
              <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                {formatCompactNumber(targetProfile.followingCount)}
              </div>
              <div className="text-xs text-slate-500">Following</div>
            </button>
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                {formatCompactNumber(computedLikes)}
              </div>
              <div className="text-xs text-slate-500">Total Likes</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                {formatCompactNumber(computedViews)}
              </div>
              <div className="text-xs text-slate-500">Video Views</div>
            </div>
          </div>

          {isOwnProfile && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 text-slate-500">
                <button
                  type="button"
                  onClick={() => onNavigate('legal')}
                  className="hover:text-slate-900 dark:hover:text-white underline"
                >
                  Privacy, Terms & Guidelines
                </button>
                <button
                  type="button"
                  onClick={() => requestDataDeletion('User requested data archive & deletion review')}
                  className="hover:text-slate-900 dark:hover:text-white underline"
                >
                  Request Data Deletion
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="text-rose-500 hover:underline inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Account</span>
                </button>
              </div>
              <button
                type="button"
                onClick={logout}
                className="font-semibold text-slate-700 dark:text-slate-300 hover:text-rose-500"
              >
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content Tabs: Posts / Reels / Tagged / Saved */}
      {!canViewContent ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center space-y-2">
          <Lock className="w-7 h-7 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            This Account is Private
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Follow @{targetProfile.username} to request access to their photos and Reels.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-fit">
            <button
              type="button"
              onClick={() => setSubTab('posts')}
              className={`px-4 py-2 min-h-[40px] rounded-lg text-xs font-semibold ${
                subTab === 'posts'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Posts ({userPosts.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('reels')}
              className={`px-4 py-2 min-h-[40px] rounded-lg text-xs font-semibold ${
                subTab === 'reels'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Reels ({userReels.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('tagged')}
              className={`px-4 py-2 min-h-[40px] rounded-lg text-xs font-semibold ${
                subTab === 'tagged'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Tagged ({taggedPosts.length})
            </button>
            {isOwnProfile && (
              <button
                type="button"
                onClick={() => setSubTab('saved')}
                className={`px-4 py-2 min-h-[40px] rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                  subTab === 'saved'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Saved ({savedPosts.length})</span>
              </button>
            )}
          </div>

          {gridItems.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-xs text-slate-500">
              No items in {subTab} yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {gridItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    item.mediaType === 'reel' ? onOpenReelsAt(item.id) : onOpenComments(item)
                  }
                  className="relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 group"
                >
                  <SafeMediaImage
                    src={item.thumbnailUrl || item.mediaUrl}
                    alt={item.caption || item.authorUsername}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {item.mediaType === 'reel' && (
                    <span className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center">
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-heading"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 id="edit-profile-heading" className="text-lg font-bold text-slate-900 dark:text-white">
                Edit Profile
              </h3>
              <button
                type="button"
                aria-label="Close edit profile"
                onClick={() => setEditing(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveErr && <p className="text-xs text-rose-500">{saveErr}</p>}

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ep-username" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Username
                  </label>
                  <input
                    id="ep-username"
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="ep-display" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Display Name
                  </label>
                  <input
                    id="ep-display"
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ep-bio" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Bio
                </label>
                <textarea
                  id="ep-bio"
                  rows={3}
                  maxLength={250}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ep-web" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Website
                  </label>
                  <input
                    id="ep-web"
                    type="url"
                    value={editWebsite}
                    onChange={(e) => setEditWebsite(e.target.value)}
                    placeholder="https://studio.example"
                    className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="ep-social" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Social Handle / Link
                  </label>
                  <input
                    id="ep-social"
                    type="text"
                    value={editSocial}
                    onChange={(e) => setEditSocial(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label className="block">
                  <span className="font-medium text-slate-600 dark:text-slate-300 block mb-1">Profile Picture</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-500"
                  />
                </label>
                <label className="block">
                  <span className="font-medium text-slate-600 dark:text-slate-300 block mb-1">Cover Banner</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-500"
                  />
                </label>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <span>Private Account (Require approval for new followers)</span>
                  <input
                    type="checkbox"
                    checked={editPrivate}
                    onChange={(e) => setEditPrivate(e.target.checked)}
                    className="accent-rose-600 w-4 h-4"
                  />
                </label>
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <span>Show Active / Online Presence in Direct Messages</span>
                  <input
                    type="checkbox"
                    checked={editOnline}
                    onChange={(e) => setEditOnline(e.target.checked)}
                    className="accent-rose-600 w-4 h-4"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 min-h-[42px] rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveBusy}
                  className="px-5 py-2 min-h-[42px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {saveBusy ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Followers / Following Modal */}
      {followModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="follow-list-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 id="follow-list-title" className="text-base font-bold text-slate-900 dark:text-white capitalize">
                {followModal}
              </h3>
              <button
                type="button"
                aria-label="Close list"
                onClick={() => setFollowModal(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {(followModal === 'followers' ? followersList : followingList).length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No {followModal} records yet.</p>
              ) : (
                (followModal === 'followers' ? followersList : followingList).map((f) => {
                  const uname = followModal === 'followers' ? f.followerUsername : f.followingUsername;
                  const avatar = followModal === 'followers' ? f.followerAvatarUrl : f.followingAvatarUrl;
                  return (
                    <div key={f.id} className="flex items-center gap-3">
                      <SafeMediaImage src={avatar} alt={uname} className="w-9 h-9 rounded-full object-cover" />
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">@{uname}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Account Deletion Dialog */}
      {confirmDeleteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-acct-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 id="delete-acct-title" className="text-base font-bold text-slate-900 dark:text-white">
              Permanently Delete Account?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This removes your VidGram profile, reserved @username, and private PII record from Firestore.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="px-4 py-2 min-h-[42px] rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteMyAccount();
                  setConfirmDeleteOpen(false);
                }}
                className="px-4 py-2 min-h-[42px] rounded-xl bg-rose-600 text-white text-xs font-semibold"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
