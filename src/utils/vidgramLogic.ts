import type { PostRecord, UserProfile } from '../types/vidgram';

export const AUTHORIZED_ADMIN_EMAIL = 'sainimanish1164@gmail.com';

export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 30);
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_.]{3,30}$/.test(username);
}

export function extractHashtags(caption: string): string[] {
  const matches = caption.match(/#[a-zA-Z0-9_]+/g) || [];
  const unique = Array.from(
    new Set(matches.map((tag) => tag.slice(1).toLowerCase().slice(0, 50)).filter(Boolean))
  );
  return unique.slice(0, 10);
}

export function extractMentions(caption: string): string[] {
  const matches = caption.match(/@[a-zA-Z0-9_.]+/g) || [];
  const unique = Array.from(
    new Set(matches.map((m) => m.slice(1).toLowerCase().slice(0, 30)).filter(Boolean))
  );
  return unique.slice(0, 5);
}

export function buildConversationId(uidA: string, uidB: string): string {
  const sorted = [uidA.trim(), uidB.trim()].sort();
  return `${sorted[0]}_${sorted[1]}`;
}

export function buildFollowEdgeId(followerId: string, followingId: string): string {
  return `${followerId.trim()}_${followingId.trim()}`;
}

export function isVerifiedAdminAccount(params: {
  email?: string | null;
  emailVerified?: boolean | null;
  inAdminRegistry?: boolean;
}): boolean {
  if (!params.emailVerified) return false;
  if (params.inAdminRegistry) return true;
  return (params.email || '').toLowerCase() === AUTHORIZED_ADMIN_EMAIL;
}

export interface MonetizationEligibilityResult {
  eligible: boolean;
  followersProgress: number;
  viewsProgress: number;
  postsProgress: number;
  missingCriteria: string[];
}

export function evaluateMonetizationEligibility(
  profile: Pick<UserProfile, 'followersCount' | 'totalViewsReceived' | 'postsCount' | 'status'>,
  thresholds: { minFollowers: number; minViews: number; minPosts?: number }
): MonetizationEligibilityResult {
  const minPosts = thresholds.minPosts ?? 3;
  const missingCriteria: string[] = [];

  if (profile.status !== 'active') {
    missingCriteria.push('Account must be in active standing');
  }
  if (profile.followersCount < thresholds.minFollowers) {
    missingCriteria.push(
      `${thresholds.minFollowers - profile.followersCount} more followers needed (${profile.followersCount}/${thresholds.minFollowers})`
    );
  }
  if (profile.totalViewsReceived < thresholds.minViews) {
    missingCriteria.push(
      `${thresholds.minViews - profile.totalViewsReceived} more video views needed (${profile.totalViewsReceived}/${thresholds.minViews})`
    );
  }
  if (profile.postsCount < minPosts) {
    missingCriteria.push(
      `${minPosts - profile.postsCount} more published posts/reels needed (${profile.postsCount}/${minPosts})`
    );
  }

  const followersProgress =
    thresholds.minFollowers <= 0
      ? 100
      : Math.min(100, Math.round((profile.followersCount / thresholds.minFollowers) * 100));
  const viewsProgress =
    thresholds.minViews <= 0
      ? 100
      : Math.min(100, Math.round((profile.totalViewsReceived / thresholds.minViews) * 100));
  const postsProgress =
    minPosts <= 0 ? 100 : Math.min(100, Math.round((profile.postsCount / minPosts) * 100));

  return {
    eligible: missingCriteria.length === 0,
    followersProgress,
    viewsProgress,
    postsProgress,
    missingCriteria,
  };
}

export interface CreatorAnalyticsSummary {
  totalPosts: number;
  totalReels: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalSaves: number;
  totalShares: number;
  engagementRatePct: number;
  bestPerforming: PostRecord[];
  buckets: { label: string; views: number; interactions: number }[];
}

export function computeCreatorAnalytics(
  posts: PostRecord[],
  rangeDays: 1 | 7 | 30,
  nowMs: number = Date.now()
): CreatorAnalyticsSummary {
  const windowMs = rangeDays * 24 * 60 * 60 * 1000;
  const filtered = posts.filter((p) => nowMs - p.createdAtMs <= windowMs || rangeDays === 30);

  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalSaves = 0;
  let totalShares = 0;
  let totalReels = 0;

  for (const post of filtered) {
    if (post.mediaType === 'reel') totalReels += 1;
    totalViews += post.viewsCount;
    totalLikes += post.likesCount;
    totalComments += post.commentsCount;
    totalSaves += post.savesCount;
    totalShares += post.sharesCount;
  }

  const totalInteractions = totalLikes + totalComments + totalSaves + totalShares;
  const denominator = Math.max(totalViews, filtered.length * 10, 1);
  const engagementRatePct = Number(((totalInteractions / denominator) * 100).toFixed(1));

  const bestPerforming = [...filtered]
    .sort((a, b) => b.viewsCount + b.likesCount * 3 - (a.viewsCount + a.likesCount * 3))
    .slice(0, 4);

  const bucketCount = rangeDays === 1 ? 6 : rangeDays === 7 ? 7 : 6;
  const stepMs = windowMs / bucketCount;
  const buckets: { label: string; views: number; interactions: number }[] = [];

  for (let i = bucketCount - 1; i >= 0; i--) {
    const start = nowMs - (i + 1) * stepMs;
    const end = nowMs - i * stepMs;
    const inBucket = posts.filter((p) => p.createdAtMs >= start && p.createdAtMs <= end);
    const dateObj = new Date(end);
    const label =
      rangeDays === 1
        ? `${dateObj.getHours().toString().padStart(2, '0')}:00`
        : `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
    buckets.push({
      label,
      views: inBucket.reduce((acc, p) => acc + p.viewsCount, 0),
      interactions: inBucket.reduce(
        (acc, p) => acc + p.likesCount + p.commentsCount + p.savesCount,
        0
      ),
    });
  }

  return {
    totalPosts: filtered.length,
    totalReels,
    totalViews,
    totalLikes,
    totalComments,
    totalSaves,
    totalShares,
    engagementRatePct,
    bestPerforming,
    buckets,
  };
}

export function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

export function formatCurrencyFromCents(cents: number): string {
  const dollars = (cents / 100).toFixed(2);
  return `$${dollars}`;
}

export function formatRelativeTime(timestampMs: number, nowMs: number = Date.now()): string {
  const diffSec = Math.max(1, Math.floor((nowMs - timestampMs) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d`;
  return new Date(timestampMs).toLocaleDateString();
}

export class SlidingWindowRateLimiter {
  private events = new Map<string, number[]>();

  constructor(
    private readonly maxEvents: number,
    private readonly windowMs: number
  ) {}

  allow(actionKey: string, nowMs: number = Date.now()): { allowed: boolean; retryAfterSec: number } {
    const history = (this.events.get(actionKey) || []).filter((ts) => nowMs - ts < this.windowMs);
    if (history.length >= this.maxEvents) {
      const oldest = history[0];
      const retryAfterSec = Math.max(1, Math.ceil((this.windowMs - (nowMs - oldest)) / 1000));
      this.events.set(actionKey, history);
      return { allowed: false, retryAfterSec };
    }
    history.push(nowMs);
    this.events.set(actionKey, history);
    return { allowed: true, retryAfterSec: 0 };
  }
}
