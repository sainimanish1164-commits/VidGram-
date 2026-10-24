import React, { useState } from 'react';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Flag,
  Play,
  MailWarning,
  Trash2,
} from 'lucide-react';
import { useVidGram } from '../context/VidGramContext';
import type { PostRecord, UserProfile } from '../types/vidgram';
import { SafeMediaImage } from './SafeMediaImage';
import { formatCompactNumber, formatRelativeTime, buildFollowEdgeId } from '../utils/vidgramLogic';

interface HomeFeedViewProps {
  onOpenComments: (post: PostRecord) => void;
  onOpenReport: (type: 'post' | 'reel', id: string, label: string) => void;
  onSelectUser: (user: UserProfile) => void;
  onOpenReelsAt: (postId: string) => void;
  onOpenCreate: () => void;
  onSelectHashtag: (tag: string) => void;
  onRequireAuth: () => void;
}

export const HomeFeedView: React.FC<HomeFeedViewProps> = ({
  onOpenComments,
  onOpenReport,
  onSelectUser,
  onOpenReelsAt,
  onOpenCreate,
  onSelectHashtag,
  onRequireAuth,
}) => {
  const {
    firebaseUser,
    currentProfile,
    posts,
    users,
    follows,
    likedPostIds,
    bookmarkedPostIds,
    announcements,
    platformSettings,
    toggleLikePost,
    toggleBookmarkPost,
    recordPostShare,
    toggleFollowUser,
    sendVerification,
    deletePost,
  } = useVidGram();

  const [feedFilter, setFeedFilter] = useState<'for_you' | 'following'>('for_you');
  const [visibleCount, setVisibleCount] = useState(6);

  const followedIds = new Set(
    follows
      .filter((f) => f.followerId === firebaseUser?.uid && f.status === 'accepted')
      .map((f) => f.followingId)
  );

  const filteredPosts = posts.filter((p) => {
    if (feedFilter === 'following') {
      return followedIds.has(p.authorId) || p.authorId === firebaseUser?.uid;
    }
    return true;
  });

  const displayedPosts = filteredPosts.slice(0, visibleCount);
  const suggestedCreators = users
    .filter((u) => u.uid !== firebaseUser?.uid && !followedIds.has(u.uid))
    .slice(0, 4);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,620px)_340px] gap-8 justify-center">
      {/* Main Feed Column */}
      <div className="space-y-6 min-w-0">
        {platformSettings.maintenanceBanner && (
          <div className="rounded-2xl border border-amber-300 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
            {platformSettings.maintenanceBanner}
          </div>
        )}

        {firebaseUser && !firebaseUser.emailVerified && (
          <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <MailWarning className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Verify <strong>{firebaseUser.email}</strong> to publish posts, Reels, and direct messages.
              </span>
            </div>
            <button
              type="button"
              onClick={sendVerification}
              className="px-3 py-2 min-h-[40px] rounded-xl bg-amber-600 text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              Resend Email
            </button>
          </div>
        )}

        {announcements.length > 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Platform Announcement · {formatRelativeTime(announcements[0].createdAtMs)}
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
              {announcements[0].title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{announcements[0].body}</p>
          </div>
        )}

        {/* Feed Mode Segmented Filter + Quick Create */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setFeedFilter('for_you')}
              className={`px-3 sm:px-4 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                feedFilter === 'for_you'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Recommended
            </button>
            <button
              type="button"
              onClick={() => setFeedFilter('following')}
              className={`px-3 sm:px-4 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                feedFilter === 'following'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Following
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenCreate}
            className="px-3.5 sm:px-4 py-2 min-h-[40px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            + Create
          </button>
        </div>

        {/* Feed Cards */}
        {displayedPosts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {feedFilter === 'following'
                ? 'No posts from accounts you follow yet'
                : 'No posts in feed yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Follow creators below or switch back to Recommended Feed to explore community photos and short-form Reels.
            </p>
            <button
              type="button"
              onClick={() => setFeedFilter('for_you')}
              className="px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold"
            >
              Explore Recommended Posts
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {displayedPosts.map((post) => {
              const isLiked = likedPostIds.has(post.id);
              const isSaved = bookmarkedPostIds.has(post.id);
              const authorObj =
                users.find((u) => u.uid === post.authorId) || {
                  uid: post.authorId,
                  username: post.authorUsername,
                  displayName: post.authorDisplayName,
                  bio: '',
                  website: '',
                  socialLink: '',
                  avatarUrl: post.authorAvatarUrl,
                  coverUrl: '',
                  isPrivate: false,
                  showOnlineStatus: true,
                  isOnline: true,
                  status: 'active' as const,
                  followersCount: 0,
                  followingCount: 0,
                  postsCount: 1,
                  totalLikesReceived: post.likesCount,
                  totalViewsReceived: post.viewsCount,
                  createdAtMs: post.createdAtMs,
                };

              const followEdge = firebaseUser
                ? follows.find((f) => f.id === buildFollowEdgeId(firebaseUser.uid, post.authorId))
                : undefined;

              return (
                <article
                  key={post.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
                >
                  {/* Post Header */}
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => onSelectUser(authorObj)}
                      className="flex items-center gap-3 text-left min-h-[44px]"
                    >
                      <SafeMediaImage
                        src={post.authorAvatarUrl}
                        alt={post.authorUsername}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      />
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                          {post.authorDisplayName}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>@{post.authorUsername}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatRelativeTime(post.createdAtMs)}</span>
                          {post.mediaType === 'reel' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Reel</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-2">
                      {post.authorId !== firebaseUser?.uid && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!firebaseUser) {
                              onRequireAuth();
                              return;
                            }
                            toggleFollowUser(authorObj);
                          }}
                          className={`px-3.5 py-1.5 min-h-[40px] rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                            followEdge
                              ? 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                              : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                          }`}
                        >
                          {followEdge
                            ? followEdge.status === 'pending'
                              ? 'Requested'
                              : 'Following'
                            : 'Follow'}
                        </button>
                      )}

                      {firebaseUser?.uid === post.authorId ? (
                        <button
                          type="button"
                          aria-label={`Delete post by ${post.authorUsername}`}
                          onClick={() => deletePost(post.id)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Report post by ${post.authorUsername}`}
                          onClick={() =>
                            onOpenReport(post.mediaType, post.id, `@${post.authorUsername}'s ${post.mediaType}`)
                          }
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-500"
                        >
                          <Flag className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Media Body */}
                  <div className="relative bg-slate-950 aspect-[4/3] overflow-hidden">
                    {post.mediaType === 'reel' && post.mediaUrl ? (
                      <video
                        src={post.mediaUrl}
                        poster={post.thumbnailUrl || undefined}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <SafeMediaImage
                        src={post.mediaUrl || post.thumbnailUrl}
                        alt={post.caption || `Post by ${post.authorUsername}`}
                        className="w-full h-full object-cover"
                      />
                    )}

                    {post.mediaType === 'reel' && (
                      <button
                        type="button"
                        onClick={() => onOpenReelsAt(post.id)}
                        className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-black/75 backdrop-blur-md text-white text-xs font-semibold hover:bg-black/90 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Watch Full Reel</span>
                      </button>
                    )}
                  </div>

                  {/* Action Bar */}
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={isLiked ? `Unlike post by ${post.authorUsername}` : `Like post by ${post.authorUsername}`}
                          onClick={() => toggleLikePost(post)}
                          className={`min-h-[44px] px-2.5 inline-flex items-center gap-1.5 rounded-xl text-xs font-semibold transition-colors ${
                            isLiked
                              ? 'text-rose-500'
                              : 'text-slate-700 dark:text-slate-200 hover:text-rose-500'
                          }`}
                        >
                          <Heart className={`w-5 h-5 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                          <span className="tabular-nums">
                            {formatCompactNumber(post.likesCount + (isLiked && post.id.startsWith('seed_') ? 1 : 0))}
                          </span>
                        </button>

                        <button
                          type="button"
                          aria-label={`Comment on post by ${post.authorUsername}`}
                          onClick={() => onOpenComments(post)}
                          className="min-h-[44px] px-2.5 inline-flex items-center gap-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white"
                        >
                          <MessageCircle className="w-5 h-5" />
                          <span className="tabular-nums">{formatCompactNumber(post.commentsCount)}</span>
                        </button>

                        <button
                          type="button"
                          aria-label={`Share post by ${post.authorUsername}`}
                          onClick={() => recordPostShare(post)}
                          className="min-h-[44px] px-2.5 inline-flex items-center gap-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white"
                        >
                          <Send className="w-5 h-5" />
                          <span className="tabular-nums">{formatCompactNumber(post.sharesCount)}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        aria-label={isSaved ? `Remove bookmark for ${post.authorUsername}` : `Bookmark post by ${post.authorUsername}`}
                        onClick={() => toggleBookmarkPost(post)}
                        className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors ${
                          isSaved ? 'text-amber-500' : 'text-slate-700 dark:text-slate-200 hover:text-amber-500'
                        }`}
                      >
                        <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    {/* Clean Unboxed Metadata Line */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>{formatCompactNumber(post.viewsCount)} views</span>
                      {post.audioTrackName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{post.audioTrackName}</span>
                        </>
                      )}
                    </div>

                    {/* Caption & Hashtags */}
                    {post.caption && (
                      <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                        <span className="font-semibold text-slate-900 dark:text-white mr-1.5">
                          @{post.authorUsername}
                        </span>
                        {post.caption}
                      </p>
                    )}

                    {post.hashtags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-rose-500 font-medium">
                        {post.hashtags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => onSelectHashtag(tag)}
                            className="hover:underline"
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}

            {visibleCount < filteredPosts.length && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 6)}
                  className="px-5 py-2.5 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
                >
                  Load More Posts
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Desktop Rail: Account Summary + Suggested Creators */}
      <aside className="hidden xl:block space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          {currentProfile ? (
            <div className="flex items-center gap-3">
              <SafeMediaImage
                src={currentProfile.avatarUrl}
                alt={currentProfile.username}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {currentProfile.displayName}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  @{currentProfile.username}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Join VidGram Creators
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Sign in to publish short-form Reels, follow creators, send voice messages, and unlock creator analytics.
              </p>
              <button
                type="button"
                onClick={onRequireAuth}
                className="w-full min-h-[42px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold"
              >
                Sign In or Register
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="text-xs font-bold text-slate-900 dark:text-white">
            Suggested Creators
          </div>
          <div className="space-y-3.5">
            {suggestedCreators.map((creator) => (
              <div key={creator.uid} className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onSelectUser(creator)}
                  className="flex items-center gap-2.5 text-left min-w-0"
                >
                  <SafeMediaImage
                    src={creator.avatarUrl}
                    alt={creator.username}
                    className="w-9 h-9 rounded-full object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {creator.displayName}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      @{creator.username} · {formatCompactNumber(creator.followersCount)} followers
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!firebaseUser) {
                      onRequireAuth();
                      return;
                    }
                    toggleFollowUser(creator);
                  }}
                  className="px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 whitespace-nowrap shrink-0"
                >
                  Follow
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
};
