import React, { useState } from 'react';
import { ShieldAlert, Lock, Megaphone, Settings, Users, Flag, DollarSign } from 'lucide-react';
import { useVidGram } from '../context/VidGramContext';
import { AUTHORIZED_ADMIN_EMAIL, formatCompactNumber, formatCurrencyFromCents } from '../utils/vidgramLogic';

export const AdminDashboardView: React.FC = () => {
  const {
    firebaseUser,
    isAdmin,
    users,
    posts,
    reports,
    allMonetizations,
    payouts,
    platformSettings,
    adminUpdateUserStatus,
    adminModeratePost,
    adminResolveReport,
    adminReviewMonetization,
    adminProcessPayout,
    adminPublishAnnouncement,
    adminSavePlatformSettings,
  } = useVidGram();

  const [section, setSection] = useState<'overview' | 'users' | 'reports' | 'monetization' | 'settings'>('overview');
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [minFollowers, setMinFollowers] = useState(platformSettings.minFollowersForMonetization);
  const [minViews, setMinViews] = useState(platformSettings.minViewsForMonetization);
  const [allowReg, setAllowReg] = useState(platformSettings.allowNewRegistrations);
  const [banner, setBanner] = useState(platformSettings.maintenanceBanner);
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({});

  // Strict server-side & client-side verification gate
  if (!firebaseUser || !isAdmin) {
    return (
      <div className="max-w-lg mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
        <Lock className="w-8 h-8 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Administrator Authorization Required
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Access to VidGram Admin Tools is enforced by Zero-Trust Firestore Security Rules (`isAdmin()`). Only a verified session authenticated as <strong>{AUTHORIZED_ADMIN_EMAIL}</strong> or registered in `/admins` can read moderation queues, approve creator monetization, or alter platform settings.
        </p>
      </div>
    );
  }

  const realUsers = users.filter((u) => !u.uid.startsWith('creator_'));
  const activeUsersCount = users.filter((u) => u.isOnline).length;
  const totalViews = posts.reduce((acc, p) => acc + p.viewsCount, 0);
  const openReports = reports.filter((r) => r.status === 'open');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-6 h-6 text-emerald-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              VidGram Administrator Console
            </h1>
            <p className="text-xs text-slate-500">
              Verified Admin Session: {firebaseUser.email}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          {(
            [
              ['overview', 'Platform Stats'],
              ['users', `Users (${realUsers.length})`],
              ['reports', `Reports (${openReports.length})`],
              ['monetization', `Monetization (${allMonetizations.length})`],
              ['settings', 'Announcements & Config'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`px-3.5 py-2 min-h-[38px] rounded-lg text-xs font-semibold ${
                section === id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats + Content Moderation */}
      {section === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total Accounts', val: String(users.length) },
              { label: 'Active Online', val: String(activeUsersCount) },
              { label: 'Posts & Reels', val: String(posts.length) },
              { label: 'Total Views', val: formatCompactNumber(totalViews) },
              { label: 'Open Reports', val: String(openReports.length) },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
              >
                <div className="text-xs text-slate-500">{stat.label}</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                  {stat.val}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent Posts & Reels Moderation
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2">Author</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Caption</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {posts.map((post) => (
                    <tr key={post.id}>
                      <td className="py-2.5 font-semibold">@{post.authorUsername}</td>
                      <td className="py-2.5 capitalize">{post.mediaType}</td>
                      <td className="py-2.5 max-w-xs truncate">{post.caption || '—'}</td>
                      <td className="py-2.5 capitalize">{post.moderationStatus}</td>
                      <td className="py-2.5 text-right space-x-2">
                        {!post.id.startsWith('seed_') ? (
                          <>
                            <button
                              type="button"
                              onClick={() => adminModeratePost(post.id, 'flagged')}
                              className="text-amber-500 font-semibold hover:underline"
                            >
                              Flag
                            </button>
                            <button
                              type="button"
                              onClick={() => adminModeratePost(post.id, 'removed')}
                              className="text-rose-500 font-semibold hover:underline"
                            >
                              Remove
                            </button>
                          </>
                        ) : (
                          <span className="text-slate-400">Curated</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* User Account Management */}
      {section === 'users' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Registered User Accounts ({realUsers.length})
            </h2>
          </div>

          {realUsers.length === 0 ? (
            <p className="text-xs text-slate-500 py-6">No external user registrations yet beyond your session.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2">Username</th>
                    <th className="py-2">Display Name</th>
                    <th className="py-2">Standing</th>
                    <th className="py-2 text-right">Followers</th>
                    <th className="py-2 text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {realUsers.map((u) => (
                    <tr key={u.uid}>
                      <td className="py-3 font-semibold">@{u.username}</td>
                      <td className="py-3">{u.displayName}</td>
                      <td className="py-3 capitalize">{u.status}</td>
                      <td className="py-3 text-right font-mono tabular-nums">{u.followersCount}</td>
                      <td className="py-3 text-right space-x-2">
                        {u.uid !== firebaseUser.uid && (
                          <>
                            <button
                              type="button"
                              onClick={() => adminUpdateUserStatus(u.uid, 'active')}
                              className="text-emerald-500 font-semibold hover:underline"
                            >
                              Activate
                            </button>
                            <button
                              type="button"
                              onClick={() => adminUpdateUserStatus(u.uid, 'suspended')}
                              className="text-amber-500 font-semibold hover:underline"
                            >
                              Suspend
                            </button>
                            <button
                              type="button"
                              onClick={() => adminUpdateUserStatus(u.uid, 'banned')}
                              className="text-rose-500 font-semibold hover:underline"
                            >
                              Ban
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Moderation Reports Queue */}
      {section === 'reports' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Reported Content & Data Deletion Queue ({reports.length})
            </h2>
          </div>

          {reports.length === 0 ? (
            <p className="text-xs text-slate-500 py-6">No reports awaiting moderation.</p>
          ) : (
            <div className="space-y-3">
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white uppercase">
                      {rep.targetType} · Target ID: {rep.targetId}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">{rep.reason}</p>
                    <div className="text-[11px] text-slate-400">Status: {rep.status}</div>
                  </div>
                  {rep.status === 'open' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => adminResolveReport(rep.id, 'resolved', 'Action taken by admin')}
                        className="px-3 py-1.5 min-h-[36px] rounded-lg bg-emerald-600 text-white font-semibold"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => adminResolveReport(rep.id, 'dismissed', 'No violation found')}
                        className="px-3 py-1.5 min-h-[36px] rounded-lg border border-slate-300 dark:border-slate-700 font-semibold"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Monetization Applications & Payout Settlement */}
      {section === 'monetization' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Creator Monetization Applications ({allMonetizations.length})
              </h2>
            </div>

            {allMonetizations.length === 0 ? (
              <p className="text-xs text-slate-500">No creator applications submitted yet.</p>
            ) : (
              <div className="space-y-3">
                {allMonetizations.map((m) => {
                  const creditStr =
                    creditInputs[m.userId] ?? (m.verifiedBalanceCents / 100).toFixed(2);
                  return (
                    <div
                      key={m.userId}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">@{m.username}</span>
                        <span className="capitalize font-semibold">{m.status}</span>
                      </div>
                      <div className="text-slate-500">
                        Provider: {m.paymentProvider} ({m.payoutAccountRef || 'unlinked'}) · Category: {m.contentCategory}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-slate-500">Verified Balance ($):</label>
                        <input
                          type="number"
                          step="0.01"
                          value={creditStr}
                          onChange={(e) =>
                            setCreditInputs((prev) => ({ ...prev, [m.userId]: e.target.value }))
                          }
                          className="w-28 min-h-[34px] px-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            adminReviewMonetization(
                              m.userId,
                              'approved',
                              Math.round(Number(creditStr || 0) * 100),
                              'Verified & approved by Admin'
                            )
                          }
                          className="px-3 py-1.5 min-h-[34px] rounded-lg bg-emerald-600 text-white font-semibold"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            adminReviewMonetization(m.userId, 'rejected', 0, 'Criteria or verification incomplete')
                          }
                          className="px-3 py-1.5 min-h-[34px] rounded-lg bg-rose-600 text-white font-semibold"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Creator Payout Requests ({payouts.length})
            </h2>
            {payouts.length === 0 ? (
              <p className="text-xs text-slate-500">No payout requests queued.</p>
            ) : (
              <div className="space-y-3">
                {payouts.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        @{p.username} ·{' '}
                        <span className="font-mono">{formatCurrencyFromCents(p.amountCents)}</span>
                      </div>
                      <div className="text-slate-500">
                        {p.paymentProvider} ({p.payoutAccountRef}) · Status: {p.status}
                      </div>
                    </div>
                    {p.status === 'requested' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => adminProcessPayout(p, 'completed', 'Disbursed to provider')}
                          className="px-3 py-1.5 min-h-[36px] rounded-lg bg-emerald-600 text-white font-semibold"
                        >
                          Mark Paid
                        </button>
                        <button
                          type="button"
                          onClick={() => adminProcessPayout(p, 'declined', 'Verification mismatch')}
                          className="px-3 py-1.5 min-h-[36px] rounded-lg bg-rose-600 text-white font-semibold"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Announcements & App Configuration */}
      {section === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!annTitle.trim() || !annBody.trim()) return;
              await adminPublishAnnouncement(annTitle, annBody);
              setAnnTitle('');
              setAnnBody('');
            }}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Broadcast Platform Announcement
              </h2>
            </div>

            <div>
              <label htmlFor="ann-title" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Announcement Title
              </label>
              <input
                id="ann-title"
                type="text"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="VidGram Creator Winter Update"
                className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>

            <div>
              <label htmlFor="ann-body" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Message Body
              </label>
              <textarea
                id="ann-body"
                rows={3}
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                placeholder="Share release notes or community policy updates..."
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 min-h-[42px] rounded-xl bg-rose-600 text-white text-xs font-semibold"
            >
              Publish Announcement
            </button>
          </form>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await adminSavePlatformSettings({
                minFollowersForMonetization: minFollowers,
                minViewsForMonetization: minViews,
                allowNewRegistrations: allowReg,
                maintenanceBanner: banner,
              });
            }}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Global Platform Settings
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label htmlFor="cfg-followers" className="block font-medium mb-1">
                  Min Followers (Monetization)
                </label>
                <input
                  id="cfg-followers"
                  type="number"
                  value={minFollowers}
                  onChange={(e) => setMinFollowers(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono"
                />
              </div>
              <div>
                <label htmlFor="cfg-views" className="block font-medium mb-1">
                  Min Video Views
                </label>
                <input
                  id="cfg-views"
                  type="number"
                  value={minViews}
                  onChange={(e) => setMinViews(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="cfg-banner" className="block text-xs font-medium mb-1">
                System Notice Banner (Optional)
              </label>
              <input
                id="cfg-banner"
                type="text"
                value={banner}
                onChange={(e) => setBanner(e.target.value)}
                placeholder="Leave blank when normal"
                className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>

            <label className="flex items-center justify-between text-xs py-1">
              <span>Allow New User Registrations</span>
              <input
                type="checkbox"
                checked={allowReg}
                onChange={(e) => setAllowReg(e.target.checked)}
                className="accent-rose-600 w-4 h-4"
              />
            </label>

            <button
              type="submit"
              className="px-5 py-2.5 min-h-[42px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold"
            >
              Save Platform Settings
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
