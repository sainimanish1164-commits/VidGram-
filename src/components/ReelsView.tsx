import React, { useEffect, useState } from 'react';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  ChevronUp,
  ChevronDown,
  Music2,
  Volume2,
  VolumeX,
  Flag,
  Search,
} from 'lucide-react';
import { useVidGram } from '../context/VidGramContext';
import type { PostRecord, UserProfile } from '../types/vidgram';
import { SafeMediaImage } from './SafeMediaImage';
import { formatCompactNumber, buildFollowEdgeId } from '../utils/vidgramLogic';

interface ReelsViewProps {
  initialPostId?: string | null;
  initialHashtag?: string | null;
  onOpenComments: (post: PostRecord) => void;
  onOpenReport: (type: 'reel', id: string, label: string) => void;
  onSelectUser: (user: UserProfile) => void;
  onRequireAuth: () => void;
}

export const ReelsView: React.FC<ReelsViewProps> = ({
  initialPostId,
  initialHashtag,
  onOpenComments,
  onOpenReport,
  onSelectUser,
  onRequireAuth,
}) => {
  const {
    firebaseUser,
    posts,
    users,
    follows,
    likedPostIds,
    bookmarkedPostIds,
    toggleLikePost,
    toggleBookmarkPost,
    recordPostView,
    recordPostShare,
    toggleFollowUser,
  } = useVidGram();

  const [hashtagFilter, setHashtagFilter] = useState(initialHashtag || '');
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const allReels = posts.filter((p) => {
    const matchesType = p.mediaType === 'reel';
    if (!matchesType) return false;
    if (!hashtagFilter.trim()) return true;
    const clean = hashtagFilter.replace(/^#/, '').toLowerCase();
    return (
      p.hashtags.some((h) => h.includes(clean)) ||
      p.caption.toLowerCase().includes(clean)
    );
  });

  useEffect(() => {
    if (initialHashtag) setHashtagFilter(initialHashtag);
  }, [initialHashtag]);

  useEffect(() => {
    if (initialPostId) {
      const idx = allReels.findIndex((r) => r.id === initialPostId);
      if (idx >= 0) setActiveIndex(idx);
    }
  }, [initialPostId, allReels.length]);

  const currentReel = allReels[activeIndex] || allReels[0] || null;

  useEffect(() => {
    if (currentReel) {
      recordPostView(currentReel);
    }
  }, [currentReel?.id]);

  const goPrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };
  const goNext = () => {
    setActiveIndex((prev) => (prev < allReels.length - 1 ? prev + 1 : prev));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Hashtag Search Filter for Reels */}
      <div className="w-full max-w-md flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <label htmlFor="reels-hashtag-search" className="sr-only">
            Filter Reels by hashtag
          </label>
          <input
            id="reels-hashtag-search"
            type="text"
            value={hashtagFilter}
            onChange={(e) => {
              setHashtagFilter(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search Reels by #hashtag (e.g. alpine, tokyo)"
            className="w-full min-h-[42px] pl-10 pr-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
          />
        </div>
        {hashtagFilter && (
          <button
            type="button"
            onClick={() => setHashtagFilter('')}
            className="px-3 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300"
          >
            Clear
          </button>
        )}
      </div>

      {!currentReel ? (
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No Reels match #{hashtagFilter}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Clear the hashtag filter or upload a new short video from Create (+).
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          {/* Vertical 9:16 Full-Height Reel Viewport */}
          <div
            onTouchStart={(e) => setTouchStartY(e.touches[0].clientY)}
            onTouchEnd={(e) => {
              if (touchStartY === null) return;
              const delta = touchStartY - e.changedTouches[0].clientY;
              if (delta > 45) goNext();
              else if (delta < -45) goPrev();
              setTouchStartY(null);
            }}
            className="relative w-[min(92vw,400px)] aspect-[9/16] max-h-[78vh] rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl select-none"
          >
            {currentReel.mediaUrl ? (
              <video
                key={currentReel.id}
                src={currentReel.mediaUrl}
                poster={currentReel.thumbnailUrl || undefined}
                autoPlay
                loop
                muted={muted}
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              /* Animated Ken-Burns Cinema Frame for curated high-res Reel posters */
              <div className="w-full h-full overflow-hidden">
                <SafeMediaImage
                  src={currentReel.thumbnailUrl}
                  alt={currentReel.caption}
                  className="w-full h-full object-cover scale-105 transition-transform duration-700"
                />
              </div>
            )}

            {/* Top Overlay Controls */}
            <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent">
              <div className="text-xs font-semibold text-white/90 tabular-nums">
                Reel {activeIndex + 1} / {allReels.length} · {formatCompactNumber(currentReel.viewsCount)} views
              </div>
              <button
                type="button"
                aria-label={muted ? 'Unmute Reel audio' : 'Mute Reel audio'}
                onClick={() => setMuted((m) => !m)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/70"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Right Vertical Engagement Stack */}
            <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-3">
              <button
                type="button"
                aria-label="Like Reel"
                onClick={() => toggleLikePost(currentReel)}
                className="flex flex-col items-center gap-1 min-h-[48px] min-w-[48px] justify-center text-white"
              >
                <span className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center">
                  <Heart
                    className={`w-5 h-5 ${
                      likedPostIds.has(currentReel.id) ? 'fill-rose-500 text-rose-500' : 'text-white'
                    }`}
                  />
                </span>
                <span className="text-[11px] font-semibold tabular-nums">
                  {formatCompactNumber(
                    currentReel.likesCount +
                      (likedPostIds.has(currentReel.id) && currentReel.id.startsWith('seed_') ? 1 : 0)
                  )}
                </span>
              </button>

              <button
                type="button"
                aria-label="Comment on Reel"
                onClick={() => onOpenComments(currentReel)}
                className="flex flex-col items-center gap-1 min-h-[48px] min-w-[48px] justify-center text-white"
              >
                <span className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" />
                </span>
                <span className="text-[11px] font-semibold tabular-nums">
                  {formatCompactNumber(currentReel.commentsCount)}
                </span>
              </button>

              <button
                type="button"
                aria-label="Bookmark Reel"
                onClick={() => toggleBookmarkPost(currentReel)}
                className="flex flex-col items-center gap-1 min-h-[48px] min-w-[48px] justify-center text-white"
              >
                <span className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center">
                  <Bookmark
                    className={`w-5 h-5 ${
                      bookmarkedPostIds.has(currentReel.id) ? 'fill-amber-400 text-amber-400' : ''
                    }`}
                  />
                </span>
                <span className="text-[11px] font-semibold tabular-nums">
                  {formatCompactNumber(currentReel.savesCount)}
                </span>
              </button>

              <button
                type="button"
                aria-label="Share Reel"
                onClick={() => recordPostShare(currentReel)}
                className="flex flex-col items-center gap-1 min-h-[48px] min-w-[48px] justify-center text-white"
              >
                <span className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </span>
                <span className="text-[11px] font-semibold tabular-nums">
                  {formatCompactNumber(currentReel.sharesCount)}
                </span>
              </button>

              <button
                type="button"
                aria-label="Report Reel"
                onClick={() =>
                  onOpenReport('reel', currentReel.id, `@${currentReel.authorUsername}'s Reel`)
                }
                className="min-h-[44px] min-w-[44px] rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-rose-400"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>

            {/* Bottom Measured Contrast Scrim + Creator Info */}
            <div className="absolute bottom-0 inset-x-0 p-4 pt-16 bg-gradient-to-t from-black/90 via-black/55 to-transparent text-white space-y-2.5 pr-16">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const found = users.find((u) => u.uid === currentReel.authorId);
                    if (found) onSelectUser(found);
                  }}
                  className="flex items-center gap-2 text-left"
                >
                  <SafeMediaImage
                    src={currentReel.authorAvatarUrl}
                    alt={currentReel.authorUsername}
                    className="w-9 h-9 rounded-full object-cover border border-white/40"
                  />
                  <span className="text-sm font-bold">@{currentReel.authorUsername}</span>
                </button>

                {currentReel.authorId !== firebaseUser?.uid && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!firebaseUser) {
                        onRequireAuth();
                        return;
                      }
                      const target = users.find((u) => u.uid === currentReel.authorId);
                      if (target) toggleFollowUser(target);
                    }}
                    className="px-3 py-1 min-h-[34px] rounded-lg border border-white/60 text-xs font-semibold hover:bg-white hover:text-slate-900 transition-colors"
                  >
                    {firebaseUser &&
                    follows.some(
                      (f) => f.id === buildFollowEdgeId(firebaseUser.uid, currentReel.authorId)
                    )
                      ? 'Following'
                      : 'Follow'}
                  </button>
                )}
              </div>

              <p className="text-xs text-white/90 line-clamp-2 leading-relaxed">
                {currentReel.caption}
              </p>

              {currentReel.audioTrackName && (
                <div className="flex items-center gap-1.5 text-[11px] text-white/80">
                  <Music2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{currentReel.audioTrackName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Vertical Swipe / Stepper Controls */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              aria-label="Previous Reel"
              disabled={activeIndex === 0}
              onClick={goPrev}
              className="min-h-[48px] min-w-[48px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-200 disabled:opacity-35 hover:border-rose-500 transition-colors"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              type="button"
              aria-label="Next Reel"
              disabled={activeIndex >= allReels.length - 1}
              onClick={goNext}
              className="min-h-[48px] min-w-[48px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-200 disabled:opacity-35 hover:border-rose-500 transition-colors"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
