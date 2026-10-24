/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Home,
  Compass,
  PlusSquare,
  Clapperboard,
  User as UserIcon,
  MessageCircle,
  Bell,
  BarChart3,
  DollarSign,
  ShieldAlert,
  Sun,
  Moon,
  FileText,
} from 'lucide-react';
import { VidGramProvider, useVidGram } from './context/VidGramContext';
import type { NavTab, PostRecord, ReportRecord, UserProfile } from './types/vidgram';
import { HomeFeedView } from './components/HomeFeedView';
import { ExploreView } from './components/ExploreView';
import { CreatePostView } from './components/CreatePostView';
import { ReelsView } from './components/ReelsView';
import { ProfileView } from './components/ProfileView';
import { MessagesView } from './components/MessagesView';
import { NotificationsView } from './components/NotificationsView';
import { CreatorDashboardView } from './components/CreatorDashboardView';
import { MonetizationView } from './components/MonetizationView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { LegalPoliciesView } from './components/LegalPoliciesView';
import { AuthModal } from './components/AuthModal';
import { CommentsDrawer } from './components/CommentsDrawer';
import { ReportModal } from './components/ReportModal';
import { OfflineBanner, AndroidInstallModalTrigger } from './components/PWAInstallBanner';

const VidGramShell: React.FC = () => {
  const {
    firebaseUser,
    authReady,
    currentProfile,
    isAdmin,
    darkMode,
    toggleDarkMode,
    toastMessage,
    notifications,
    conversations,
    startOrOpenConversation,
    showToast,
  } = useVidGram();

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [viewedUser, setViewedUser] = useState<UserProfile | null>(null);
  const [reelTargetId, setReelTargetId] = useState<string | null>(null);
  const [reelHashtag, setReelHashtag] = useState<string | null>(null);
  const [exploreQuery, setExploreQuery] = useState('');
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [commentPost, setCommentPost] = useState<PostRecord | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    type: ReportRecord['targetType'];
    id: string;
    label: string;
  } | null>(null);

  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const handleSelectUser = (user: UserProfile) => {
    setViewedUser(user);
    setActiveTab('profile');
  };

  const handleOpenReelsAt = (postId: string) => {
    setReelTargetId(postId);
    setActiveTab('reels');
  };

  const handleSelectHashtag = (tag: string) => {
    setExploreQuery(`#${tag}`);
    setActiveTab('explore');
  };

  const handleStartChat = async (user: UserProfile) => {
    if (!firebaseUser) {
      setAuthModalOpen(true);
      return;
    }
    try {
      const convId = await startOrOpenConversation(user);
      setActiveConvId(convId);
      setActiveTab('messages');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to start conversation.');
    }
  };

  const desktopNavItems: { id: NavTab; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'reels', label: 'Reels', icon: Clapperboard },
    { id: 'create', label: 'Create', icon: PlusSquare },
    { id: 'messages', label: 'Messages', icon: MessageCircle, badge: conversations.length },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifs },
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'creator_dashboard', label: 'Creator Studio', icon: BarChart3 },
    { id: 'monetization', label: 'Monetization', icon: DollarSign },
  ];

  if (isAdmin) {
    desktopNavItems.push({ id: 'admin', label: 'Admin Console', icon: ShieldAlert });
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile Sticky Top Header (Compact <= 54px to honor 15% mobile sticky cap) */}
      <header className="lg:hidden sticky top-0 z-30 h-13 px-4 flex items-center justify-between bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            setViewedUser(null);
            setActiveTab('home');
          }}
          className="font-display text-lg font-extrabold tracking-tight bg-gradient-to-r from-rose-500 to-amber-500 bg-clip-text text-transparent whitespace-nowrap shrink-0"
        >
          VidGram
        </button>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Android APK & Legal Guide"
            onClick={() => setActiveTab('legal')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300"
          >
            <FileText className="w-5 h-5" />
          </button>

          <button
            type="button"
            aria-label="Toggle theme"
            onClick={toggleDarkMode}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            type="button"
            aria-label="Notifications"
            onClick={() => setActiveTab('notifications')}
            className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifs > 0 && (
              <span className="absolute top-2 right-2 px-1 min-w-[16px] h-4 rounded-full bg-rose-600 text-[10px] font-bold text-white flex items-center justify-center tabular-nums">
                {unreadNotifs}
              </span>
            )}
          </button>

          <button
            type="button"
            aria-label="Messages"
            onClick={() => setActiveTab('messages')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Desktop Left Sidebar Navigation (260px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-6 justify-between z-30">
        <div className="space-y-6">
          <div className="px-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setViewedUser(null);
                setActiveTab('home');
              }}
              className="font-display text-2xl font-extrabold tracking-tight bg-gradient-to-r from-rose-500 via-rose-400 to-amber-500 bg-clip-text text-transparent whitespace-nowrap"
            >
              VidGram
            </button>
            <button
              type="button"
              aria-label="Switch color theme"
              onClick={toggleDarkMode}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <nav aria-label="Primary navigation" className="space-y-1">
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const active =
                activeTab === item.id && !(item.id === 'profile' && viewedUser !== null);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'profile') setViewedUser(null);
                    setActiveTab(item.id);
                  }}
                  className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center justify-between text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className="text-xs font-mono tabular-nums text-rose-500 font-semibold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <AndroidInstallModalTrigger compact />

          {!firebaseUser ? (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="w-full min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
            >
              Sign In / Register
            </button>
          ) : (
            <div className="px-2 flex items-center justify-between text-xs text-slate-500">
              <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                @{currentProfile?.username || 'account'}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('legal')}
                aria-label="Legal & APK build docs"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:text-slate-900 dark:hover:text-white"
              >
                <FileText className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 lg:pl-64 pb-20 lg:pb-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {!authReady ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-rose-500 border-t-transparent animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Connecting to VidGram backend...</p>
            </div>
          ) : (
            <>
              {activeTab === 'home' && (
                <HomeFeedView
                  onOpenComments={setCommentPost}
                  onOpenReport={(type, id, label) => setReportTarget({ type, id, label })}
                  onSelectUser={handleSelectUser}
                  onOpenReelsAt={handleOpenReelsAt}
                  onOpenCreate={() => setActiveTab('create')}
                  onSelectHashtag={handleSelectHashtag}
                  onRequireAuth={() => setAuthModalOpen(true)}
                />
              )}

              {activeTab === 'explore' && (
                <ExploreView
                  initialQuery={exploreQuery}
                  onSelectUser={handleSelectUser}
                  onOpenReelsAt={handleOpenReelsAt}
                  onOpenComments={setCommentPost}
                  onRequireAuth={() => setAuthModalOpen(true)}
                />
              )}

              {activeTab === 'create' && (
                <CreatePostView
                  onPublished={(type) => {
                    setReelHashtag(null);
                    setActiveTab(type === 'reel' ? 'reels' : 'home');
                  }}
                  onRequireAuth={() => setAuthModalOpen(true)}
                />
              )}

              {activeTab === 'reels' && (
                <ReelsView
                  initialPostId={reelTargetId}
                  initialHashtag={reelHashtag}
                  onOpenComments={setCommentPost}
                  onOpenReport={(type, id, label) => setReportTarget({ type, id, label })}
                  onSelectUser={handleSelectUser}
                  onRequireAuth={() => setAuthModalOpen(true)}
                />
              )}

              {activeTab === 'profile' && (
                <ProfileView
                  viewedUser={viewedUser}
                  onClearViewedUser={() => setViewedUser(null)}
                  onNavigate={setActiveTab}
                  onStartChat={handleStartChat}
                  onOpenReelsAt={handleOpenReelsAt}
                  onOpenComments={setCommentPost}
                  onOpenReport={(type, id, label) => setReportTarget({ type, id, label })}
                  onRequireAuth={() => setAuthModalOpen(true)}
                />
              )}

              {activeTab === 'messages' && (
                <MessagesView
                  activeConversationId={activeConvId}
                  onSelectConversation={setActiveConvId}
                  onOpenReport={(type, id, label) => setReportTarget({ type, id, label })}
                  onRequireAuth={() => setAuthModalOpen(true)}
                />
              )}

              {activeTab === 'notifications' && (
                <NotificationsView onRequireAuth={() => setAuthModalOpen(true)} />
              )}

              {activeTab === 'creator_dashboard' && (
                <CreatorDashboardView
                  onNavigate={setActiveTab}
                  onOpenReelsAt={handleOpenReelsAt}
                  onRequireAuth={() => setAuthModalOpen(true)}
                />
              )}

              {activeTab === 'monetization' && (
                <MonetizationView
                  onNavigate={setActiveTab}
                  onRequireAuth={() => setAuthModalOpen(true)}
                />
              )}

              {activeTab === 'admin' && <AdminDashboardView />}

              {activeTab === 'legal' && <LegalPoliciesView onNavigate={setActiveTab} />}
            </>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar: Home, Explore, Create (+), Reels, Profile (Compact 60px <= 15% cap) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-15 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center"
      >
        {(
          [
            { id: 'home', label: 'Home', icon: Home },
            { id: 'explore', label: 'Explore', icon: Compass },
            { id: 'create', label: 'Create', icon: PlusSquare },
            { id: 'reels', label: 'Reels', icon: Clapperboard },
            { id: 'profile', label: 'Profile', icon: UserIcon },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.id === 'profile') setViewedUser(null);
                setActiveTab(tab.id);
              }}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-rose-500 font-semibold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] tracking-tight whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Toast Feedback */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-20 lg:bottom-6 right-4 z-50 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 text-xs font-semibold shadow-xl border border-slate-800 dark:border-slate-200"
        >
          {toastMessage}
        </div>
      )}

      <OfflineBanner />

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      <CommentsDrawer
        post={commentPost}
        onClose={() => setCommentPost(null)}
        onRequireAuth={() => setAuthModalOpen(true)}
      />

      <ReportModal
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onRequireAuth={() => setAuthModalOpen(true)}
      />
    </div>
  );
};

export default function App() {
  return (
    <VidGramProvider>
      <VidGramShell />
    </VidGramProvider>
  );
}
