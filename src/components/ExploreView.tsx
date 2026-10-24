import React, { useState } from 'react';
import { Search, Play, Heart, Lock } from 'lucide-react';
import { useVidGram } from '../context/VidGramContext';
import type { PostRecord, UserProfile } from '../types/vidgram';
import { SafeMediaImage } from './SafeMediaImage';
import { formatCompactNumber, buildFollowEdgeId } from '../utils/vidgramLogic';

interface ExploreViewProps {
  initialQuery?: string;
  onSelectUser: (user: UserProfile) => void;
  onOpenReelsAt: (postId: string) => void;
  onOpenComments: (post: PostRecord) => void;
  onRequireAuth: () => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  initialQuery = '',
  onSelectUser,
  onOpenReelsAt,
  onOpenComments,
  onRequireAuth,
}) => {
  const { firebaseUser, users, posts, follows, toggleFollowUser } = useVidGram();
  const [queryText, setQueryText] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<'grid' | 'creators' | 'trending_reels'>('grid');

  const q = queryText.trim().toLowerCase().replace(/^[@#]/, '');

  const matchedUsers = users.filter(
    (u) =>
      !q ||
      u.username.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      u.bio.toLowerCase().includes(q)
  );

  const matchedPosts = posts.filter(
    (p) =>
      !q ||
      p.caption.toLowerCase().includes(q) ||
      p.authorUsername.toLowerCase().includes(q) ||
      p.hashtags.some((h) => h.toLowerCase().includes(q))
  );

  const trendingReels = [...matchedPosts]
    .filter((p) => p.mediaType === 'reel')
    .sort((a, b) => b.viewsCount - a.viewsCount);

  const popularHashtags = Array.from(
    new Set(posts.flatMap((p) => p.hashtags))
  ).slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Search Bar & Hashtag Filter */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <label htmlFor="explore-search-input" className="sr-only">
            Search users, reels, posts, or hashtags
          </label>
          <input
            id="explore-search-input"
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search @usernames, #hashtags, creators, or Reels..."
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="grid grid-cols-3 sm:flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('grid')}
              className={`px-2.5 sm:px-3.5 py-1.5 min-h-[38px] rounded-lg text-xs font-semibold whitespace-nowrap truncate ${
                activeTab === 'grid'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Explore ({matchedPosts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('trending_reels')}
              className={`px-2.5 sm:px-3.5 py-1.5 min-h-[38px] rounded-lg text-xs font-semibold whitespace-nowrap truncate ${
                activeTab === 'trending_reels'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Reels ({trendingReels.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('creators')}
              className={`px-2.5 sm:px-3.5 py-1.5 min-h-[38px] rounded-lg text-xs font-semibold whitespace-nowrap truncate ${
                activeTab === 'creators'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Creators ({matchedUsers.length})
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 overflow-x-auto no-scrollbar">
            <span>Trending:</span>
            {popularHashtags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setQueryText(`#${tag}`)}
                className="font-medium text-rose-500 hover:underline whitespace-nowrap"
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'creators' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {matchedUsers.map((creator) => {
            const edge = firebaseUser
              ? follows.find((f) => f.id === buildFollowEdgeId(firebaseUser.uid, creator.uid))
              : undefined;
            return (
              <div
                key={creator.uid}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <SafeMediaImage
                    src={creator.avatarUrl}
                    alt={creator.username}
                    className="w-12 h-12 rounded-full object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onSelectUser(creator)}
                      className="text-sm font-bold text-slate-900 dark:text-white hover:underline flex items-center gap-1.5"
                    >
                      <span className="truncate">{creator.displayName}</span>
                      {creator.isPrivate && <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    </button>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      @{creator.username} ·{' '}
                      <span className="tabular-nums">{formatCompactNumber(creator.followersCount)}</span> followers
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">
                      {creator.bio || 'VidGram creator'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectUser(creator)}
                    className="flex-1 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    View Profile
                  </button>
                  {creator.uid !== firebaseUser?.uid && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!firebaseUser) {
                          onRequireAuth();
                          return;
                        }
                        toggleFollowUser(creator);
                      }}
                      className={`flex-1 min-h-[40px] rounded-xl text-xs font-semibold ${
                        edge
                          ? 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          : 'bg-rose-600 hover:bg-rose-500 text-white'
                      }`}
                    >
                      {edge ? (edge.status === 'pending' ? 'Requested' : 'Following') : 'Follow'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(activeTab === 'trending_reels' ? trendingReels : matchedPosts).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                item.mediaType === 'reel' ? onOpenReelsAt(item.id) : onOpenComments(item)
              }
              className="group relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 text-left"
            >
              <SafeMediaImage
                src={item.thumbnailUrl || item.mediaUrl}
                alt={item.caption || item.authorUsername}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 flex flex-col justify-between">
                <div className="flex justify-end">
                  {item.mediaType === 'reel' && (
                    <span className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white">
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </span>
                  )}
                </div>
                <div className="text-white space-y-0.5">
                  <div className="text-xs font-semibold truncate">@{item.authorUsername}</div>
                  <div className="flex items-center gap-2 text-[11px] text-white/80 tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="w-3 h-3 fill-current" />
                      {formatCompactNumber(item.likesCount)}
                    </span>
                    <span>·</span>
                    <span>{formatCompactNumber(item.viewsCount)} views</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
