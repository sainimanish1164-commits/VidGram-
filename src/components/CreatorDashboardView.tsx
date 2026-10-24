import React, { useState } from 'react';
import { BarChart3, ArrowLeft, Play } from 'lucide-react';
import { useVidGram } from '../context/VidGramContext';
import type { NavTab } from '../types/vidgram';
import { computeCreatorAnalytics, formatCompactNumber } from '../utils/vidgramLogic';
import { SafeMediaImage } from './SafeMediaImage';

interface CreatorDashboardViewProps {
  onNavigate: (tab: NavTab) => void;
  onOpenReelsAt: (postId: string) => void;
  onRequireAuth: () => void;
}

export const CreatorDashboardView: React.FC<CreatorDashboardViewProps> = ({
  onNavigate,
  onOpenReelsAt,
  onRequireAuth,
}) => {
  const { firebaseUser, currentProfile, posts, follows } = useVidGram();
  const [rangeDays, setRangeDays] = useState<1 | 7 | 30>(7);

  if (!firebaseUser || !currentProfile) {
    return (
      <div className="max-w-lg mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-4">
        <BarChart3 className="w-8 h-8 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Creator Analytics Studio</h2>
        <p className="text-xs text-slate-500">
          Sign in to inspect real database-driven engagement, Reel retention, follower growth, and daily/weekly/monthly performance.
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="px-6 py-3 min-h-[46px] rounded-xl bg-rose-600 text-white text-sm font-semibold"
        >
          Sign In
        </button>
      </div>
    );
  }

  const myPosts = posts.filter((p) => p.authorId === currentProfile.uid);
  const analytics = computeCreatorAnalytics(myPosts, rangeDays);
  const myFollowerEdges = follows.filter(
    (f) => f.followingId === currentProfile.uid && f.status === 'accepted'
  );

  const maxBucketViews = Math.max(1, ...analytics.buckets.map((b) => b.views));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Profile</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Creator Analytics Dashboard
          </h1>
          <p className="text-xs text-slate-500">
            Real-time Firestore telemetry for @{currentProfile.username}
          </p>
        </div>

        {/* Date Filter Segmented Control */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          {(
            [
              [1, '24 Hours'],
              [7, '7 Days'],
              [30, '30 Days'],
            ] as const
          ).map(([days, label]) => (
            <button
              key={days}
              type="button"
              onClick={() => setRangeDays(days)}
              className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold ${
                rangeDays === days
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Followers', val: formatCompactNumber(currentProfile.followersCount) },
          { label: 'Following', val: formatCompactNumber(currentProfile.followingCount) },
          { label: 'Published Posts', val: String(analytics.totalPosts) },
          { label: 'Video Views', val: formatCompactNumber(analytics.totalViews) },
          { label: 'Likes & Comments', val: formatCompactNumber(analytics.totalLikes + analytics.totalComments) },
          { label: 'Engagement Rate', val: `${analytics.engagementRatePct}%` },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
          >
            <div className="text-xs text-slate-500">{metric.label}</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-1.5">
              {metric.val}
            </div>
          </div>
        ))}
      </div>

      {/* Views & Engagement Chart + Follower Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Video Views & Engagement ({rangeDays}d Window)
            </h2>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {analytics.totalSaves} saves · {analytics.totalShares} shares
            </span>
          </div>

          <div className="h-44 flex items-end gap-3 pt-4">
            {analytics.buckets.map((b, idx) => {
              const heightPct = Math.max(6, Math.round((b.views / maxBucketViews) * 100));
              return (
                <div key={`${b.label}-${idx}`} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-[10px] font-mono tabular-nums text-slate-400">
                    {b.views}
                  </span>
                  <div
                    className="w-full max-w-[36px] rounded-t-lg bg-rose-600/90 transition-all"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[11px] font-mono tabular-nums text-slate-500">
                    {b.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Follower Growth & Audience Breakdown
            </h2>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {myFollowerEdges.length} recent verified edges
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">Total Followers</span>
              <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                {currentProfile.followersCount}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">Short-Form Reels Published</span>
              <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                {analytics.totalReels}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">Photo Posts Published</span>
              <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                {analytics.totalPosts - analytics.totalReels}
              </span>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('monetization')}
                className="w-full min-h-[42px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold"
              >
                Open Creator Monetization & Payouts →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Best-Performing Videos & Posts Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Best-Performing Content
        </h2>

        {analytics.bestPerforming.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-xs text-slate-500">
              You have not published any photos or Reels yet. Upload your first Reel to start tracking real database views and engagement.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('create')}
              className="px-4 py-2.5 min-h-[42px] rounded-xl bg-rose-600 text-white text-xs font-semibold"
            >
              Publish First Reel
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 font-semibold">Content</th>
                  <th className="py-2.5 font-semibold">Format</th>
                  <th className="py-2.5 font-semibold text-right">Views</th>
                  <th className="py-2.5 font-semibold text-right">Likes</th>
                  <th className="py-2.5 font-semibold text-right">Comments</th>
                  <th className="py-2.5 font-semibold text-right">Saves</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {analytics.bestPerforming.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/60">
                    <td className="py-3 pr-4">
                      <button
                        type="button"
                        onClick={() => item.mediaType === 'reel' && onOpenReelsAt(item.id)}
                        className="flex items-center gap-3 text-left"
                      >
                        <SafeMediaImage
                          src={item.thumbnailUrl || item.mediaUrl}
                          alt={item.caption}
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                        <span className="font-medium text-slate-900 dark:text-white line-clamp-1 max-w-xs">
                          {item.caption || 'Untitled post'}
                        </span>
                      </button>
                    </td>
                    <td className="py-3 capitalize text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        {item.mediaType === 'reel' && <Play className="w-3 h-3" />}
                        {item.mediaType}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums">{item.viewsCount}</td>
                    <td className="py-3 text-right font-mono tabular-nums">{item.likesCount}</td>
                    <td className="py-3 text-right font-mono tabular-nums">{item.commentsCount}</td>
                    <td className="py-3 text-right font-mono tabular-nums">{item.savesCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
