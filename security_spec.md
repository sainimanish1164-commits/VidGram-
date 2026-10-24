# VidGram Zero-Trust Firestore Security Specification

## 1. Data Invariants & Relationship Mapping

1. **PII Split Isolation (`/users/{userId}` vs `/users/{userId}/private/{docId}`)**:
   - Public profiles (`/users/{userId}`) NEVER store `email`, `phone`, or private settings.
   - Private PII (`email`, notification toggles) is strictly isolated in `/users/{userId}/private/info` and readable ONLY by `isOwner(userId) || isAdmin()`.
2. **Verified Server-Side Admin Authorization (`/admins/{adminUid}` + Bootstrapped Verified Email)**:
   - Admin authority is NEVER granted based on client-editable fields or unverified email strings.
   - `isAdmin()` requires `isSignedIn() && request.auth.token.email_verified == true && (exists(/databases/$(database)/documents/admins/$(request.auth.uid)) || request.auth.token.email == 'sainimanish1164@gmail.com')`.
3. **Master Gate Relational Sync**:
   - Subcollections `/posts/{postId}/likes/{userId}` and `/posts/{postId}/comments/{commentId}` verify parent `/posts/{postId}` exists via `exists()` / `get()`.
   - Subcollection `/conversations/{conversationId}/messages/{messageId}` verifies via `get()` on parent `/conversations/{conversationId}` that `request.auth.uid` is either `participantA` or `participantB`.
4. **Secure List Queries (Zero Blanket Reads)**:
   - Every `allow list` checks `resource.data` directly (without `get()`/`exists()` inside `list`):
     - `/users`: `resource.data.status == 'active' || isAdmin()`
     - `/posts`: `(resource.data.moderationStatus == 'approved' && resource.data.visibility == 'public') || (isSignedIn() && resource.data.authorId == request.auth.uid) || isAdmin()`
     - `/conversations`: `isSignedIn() && (resource.data.participantA == request.auth.uid || resource.data.participantB == request.auth.uid)`
     - `/notifications`: `isSignedIn() && resource.data.recipientId == request.auth.uid`
     - `/payouts`: `isSignedIn() && (resource.data.userId == request.auth.uid || isAdmin())`
     - `/reports`: `isSignedIn() && (resource.data.reporterId == request.auth.uid || isAdmin())`
5. **Terminal State Locking**:
   - Payouts (`status in ['completed', 'declined']`) and Reports (`status in ['resolved', 'dismissed']`) cannot be mutated by non-admins once in a terminal state.
6. **Monetization Integrity**:
   - Creators CANNOT set `status == 'approved'` or modify `verifiedBalanceCents` or `lifetimePaidCents` on `/monetization/{userId}`—only `isAdmin()` can approve monetization or credit verified balances.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)

1. **Shadow Field Injection on User Profile**: Creating `/users/u1` with extra field `isAdmin: true`.
2. **Unverified Admin Email Spoof**: Accessing `/reports` list with `email: 'sainimanish1164@gmail.com'` and `email_verified: false`.
3. **Cross-User PII Leak**: User `u2` performing `get` on `/users/u1/private/info`.
4. **Identity Spoofing on Post Creation**: User `u2` creating `/posts/p1` with `authorId: 'u1'`.
5. **Self-Approved Monetization Balance Fraud**: User `u1` creating `/monetization/u1` with `verifiedBalanceCents: 500000` or `status: 'approved'`.
6. **Terminal Payout Mutation**: User `u1` updating `/payouts/pay1` after `status == 'completed'`.
7. **Unauthorized Chat Eavesdropping**: User `u3` listing `/conversations` without filtering by `participantA == u3` or `participantB == u3`.
8. **Message Injection into Foreign Thread**: User `u3` creating `/conversations/u1_u2/messages/m1`.
9. **ID Poisoning Attack**: Creating a post with a 300-character or special-character document ID (`bad$id!`).
10. **Value Poisoning on Update**: Updating `caption` on `/posts/p1` with a 10,000-character string or boolean.
11. **Forged Client Timestamp**: Creating `/posts/p1` where `createdAt != request.time`.
12. **Unbounded Hashtag Array Exhaustion**: Creating `/posts/p1` with 25 hashtags (exceeding `size() <= 10`).
