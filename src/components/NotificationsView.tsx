import React, { useState } from 'react';
import { Bell, Check, Settings, UserCheck, X } from 'lucide-react';
import { useVidGram } from '../context/VidGramContext';
import { SafeMediaImage } from './SafeMediaImage';
import { formatRelativeTime } from '../utils/vidgramLogic';

interface NotificationsViewProps {
  onRequireAuth: () => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onRequireAuth }) => {
  const {
    firebaseUser,
    notifications,
    follows,
    privateSettings,
    markAllNotificationsRead,
    approveFollowRequest,
    declineFollowRequest,
    updateNotificationPrefs,
  } = useVidGram();

  const [showPrefs, setShowPrefs] = useState(false);

  if (!firebaseUser) {
    return (
      <div className="max-w-lg mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-4">
        <Bell className="w-8 h-8 text-slate-400 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Activity & Notifications</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Sign in to receive real-time notifications for likes, comments, mentions, follow requests, and messages.
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

  const incomingRequests = follows.filter(
    (f) => f.followingId === firebaseUser.uid && f.status === 'pending'
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Activity</h2>
          <p className="text-xs text-slate-500">Likes, comments, mentions, follow requests & messages</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={markAllNotificationsRead}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
          <button
            type="button"
            aria-label="Notification settings"
            onClick={() => setShowPrefs((s) => !s)}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notification Preferences Panel */}
      {showPrefs && privateSettings && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Notification Preferences
          </h3>
          {(
            [
              ['pushNotifications', 'Browser Push & Banner Alerts'],
              ['likesNotifications', 'Likes on Photos & Reels'],
              ['commentsNotifications', 'Comments & Mentions'],
              ['followsNotifications', 'New Followers & Follow Requests'],
              ['messagesNotifications', 'Direct Messages'],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-200 py-1.5"
            >
              <span>{label}</span>
              <input
                type="checkbox"
                checked={privateSettings[key]}
                onChange={(e) => updateNotificationPrefs({ [key]: e.target.checked })}
                className="accent-rose-600 w-4 h-4"
              />
            </label>
          ))}
        </div>
      )}

      {/* Pending Private Account Follow Requests */}
      {incomingRequests.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Follow Requests ({incomingRequests.length})
          </h3>
          {incomingRequests.map((req) => (
            <div key={req.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <SafeMediaImage
                  src={req.followerAvatarUrl}
                  alt={req.followerUsername}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900 dark:text-white">@{req.followerUsername}</div>
                  <div className="text-slate-500">Requested to follow you</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => approveFollowRequest(req)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[38px] rounded-xl bg-rose-600 text-white text-xs font-semibold"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Confirm</span>
                </button>
                <button
                  type="button"
                  aria-label={`Decline ${req.followerUsername}`}
                  onClick={() => declineFollowRequest(req)}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Activity Feed */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
        {notifications.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            No notifications yet. Activity on your posts, Reels, and profile will appear here in real time.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 flex items-center gap-3.5 ${
                !n.read ? 'bg-rose-50/40 dark:bg-rose-950/15' : ''
              }`}
            >
              <SafeMediaImage
                src={n.actorAvatarUrl}
                alt={n.actorUsername}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
              <div className="flex-1 min-w-0 text-xs">
                <span className="font-bold text-slate-900 dark:text-white">@{n.actorUsername}</span>{' '}
                <span className="text-slate-700 dark:text-slate-300">{n.message}</span>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {formatRelativeTime(n.createdAtMs)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
