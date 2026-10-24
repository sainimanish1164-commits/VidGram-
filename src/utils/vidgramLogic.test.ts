import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUsername,
  isValidUsername,
  extractHashtags,
  extractMentions,
  buildConversationId,
  isVerifiedAdminAccount,
  evaluateMonetizationEligibility,
  computeCreatorAnalytics,
  formatCurrencyFromCents,
  SlidingWindowRateLimiter,
} from './vidgramLogic';
import type { PostRecord } from '../types/vidgram';

test('normalizeUsername and isValidUsername enforce lowercase handle rules', () => {
  assert.equal(normalizeUsername('  Aria_Sen.99! '), 'aria_sen.99');
  assert.equal(isValidUsername('aria_sen.99'), true);
  assert.equal(isValidUsername('ab'), false);
  assert.equal(isValidUsername('InvalidCaps'), false);
});

test('extractHashtags and extractMentions deduplicate and bound counts', () => {
  const caption =
    'Golden hour in #Tokyo #Architecture #tokyo with @marcus.film and @aria.lens #dusk';
  assert.deepEqual(extractHashtags(caption), ['tokyo', 'architecture', 'dusk']);
  assert.deepEqual(extractMentions(caption), ['marcus.film', 'aria.lens']);
});

test('buildConversationId produces deterministic symmetric thread IDs', () => {
  assert.equal(buildConversationId('uid_zeta', 'uid_alpha'), 'uid_alpha_uid_zeta');
  assert.equal(buildConversationId('uid_alpha', 'uid_zeta'), 'uid_alpha_uid_zeta');
});

test('isVerifiedAdminAccount strictly requires emailVerified == true', () => {
  assert.equal(
    isVerifiedAdminAccount({ email: 'sainimanish1164@gmail.com', emailVerified: false }),
    false
  );
  assert.equal(
    isVerifiedAdminAccount({ email: 'sainimanish1164@gmail.com', emailVerified: true }),
    true
  );
  assert.equal(
    isVerifiedAdminAccount({ email: 'creator@example.com', emailVerified: true, inAdminRegistry: false }),
    false
  );
});

test('evaluateMonetizationEligibility calculates accurate progress and missing criteria', () => {
  const ineligible = evaluateMonetizationEligibility(
    { followersCount: 400, totalViewsReceived: 2500, postsCount: 2, status: 'active' },
    { minFollowers: 1000, minViews: 10000, minPosts: 3 }
  );
  assert.equal(ineligible.eligible, false);
  assert.equal(ineligible.followersProgress, 40);
  assert.equal(ineligible.viewsProgress, 25);
  assert.equal(ineligible.missingCriteria.length, 3);

  const eligible = evaluateMonetizationEligibility(
    { followersCount: 1500, totalViewsReceived: 18000, postsCount: 6, status: 'active' },
    { minFollowers: 1000, minViews: 10000, minPosts: 3 }
  );
  assert.equal(eligible.eligible, true);
  assert.equal(eligible.missingCriteria.length, 0);
});

test('computeCreatorAnalytics aggregates real post metrics and ranks best performing', () => {
  const now = 1_760_000_000_000;
  const posts: PostRecord[] = [
    {
      id: 'p1',
      authorId: 'u1',
      authorUsername: 'aria',
      authorDisplayName: 'Aria',
      authorAvatarUrl: '',
      mediaType: 'reel',
      mediaUrl: '/v1.mp4',
      thumbnailUrl: '',
      caption: 'Reel 1',
      hashtags: ['reel'],
      taggedUsernames: [],
      audioTrackName: 'Original Audio',
      visibility: 'public',
      likesCount: 50,
      commentsCount: 10,
      viewsCount: 1000,
      savesCount: 15,
      sharesCount: 5,
      moderationStatus: 'approved',
      createdAtMs: now - 3600_000,
    },
    {
      id: 'p2',
      authorId: 'u1',
      authorUsername: 'aria',
      authorDisplayName: 'Aria',
      authorAvatarUrl: '',
      mediaType: 'photo',
      mediaUrl: '/p2.jpg',
      thumbnailUrl: '',
      caption: 'Photo 2',
      hashtags: [],
      taggedUsernames: [],
      audioTrackName: '',
      visibility: 'public',
      likesCount: 20,
      commentsCount: 4,
      viewsCount: 200,
      savesCount: 6,
      sharesCount: 2,
      moderationStatus: 'approved',
      createdAtMs: now - 7200_000,
    },
  ];

  const summary = computeCreatorAnalytics(posts, 7, now);
  assert.equal(summary.totalPosts, 2);
  assert.equal(summary.totalReels, 1);
  assert.equal(summary.totalViews, 1200);
  assert.equal(summary.totalLikes, 70);
  assert.equal(summary.bestPerforming[0].id, 'p1');
  assert.equal(formatCurrencyFromCents(0), '$0.00');
});

test('SlidingWindowRateLimiter blocks rapid spam bursts', () => {
  const limiter = new SlidingWindowRateLimiter(2, 10_000);
  assert.equal(limiter.allow('comment', 1000).allowed, true);
  assert.equal(limiter.allow('comment', 2000).allowed, true);
  const blocked = limiter.allow('comment', 3000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSec, 8);
  assert.equal(limiter.allow('comment', 12000).allowed, true);
});
