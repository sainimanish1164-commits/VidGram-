import React, { useState } from 'react';
import { ArrowLeft, Shield } from 'lucide-react';
import type { NavTab } from '../types/vidgram';
import { AndroidInstallModalTrigger } from './PWAInstallBanner';

interface LegalPoliciesViewProps {
  onNavigate: (tab: NavTab) => void;
}

export const LegalPoliciesView: React.FC<LegalPoliciesViewProps> = ({ onNavigate }) => {
  const [docTab, setDocTab] = useState<'privacy' | 'terms' | 'guidelines' | 'apk'>('privacy');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-rose-500" />
            <span>Trust, Legal & Android Build Guide</span>
          </h1>
        </div>
        <AndroidInstallModalTrigger />
      </div>

      <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-fit">
        {(
          [
            ['privacy', 'Privacy Policy'],
            ['terms', 'Terms & Conditions'],
            ['guidelines', 'Community Guidelines'],
            ['apk', 'Backend & APK Setup'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setDocTab(id)}
            className={`px-3.5 py-2 min-h-[38px] rounded-lg text-xs font-semibold ${
              docTab === id
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        {docTab === 'privacy' && (
          <>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">VidGram Privacy Policy</h2>
            <p>
              <strong>1. PII Split Isolation:</strong> Public profiles store only your chosen @username, display name, bio, avatar, and public engagement counters. Your email address and notification settings are isolated in `/users/&#123;uid&#125;/private/info` and are strictly inaccessible to other users.
            </p>
            <p>
              <strong>2. Private Account & Presence Controls:</strong> Enabling Private Account requires manual confirmation for follow requests. You may toggle Online Status visibility at any time from Edit Profile.
            </p>
            <p>
              <strong>3. Right to Erasure & Account Deletion:</strong> You can permanently delete your account or submit a formal Data Deletion Request directly from your Profile settings.
            </p>
          </>
        )}

        {docTab === 'terms' && (
          <>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Terms and Conditions</h2>
            <p>
              <strong>1. Original Content & Licensed Audio:</strong> Creators retain ownership of uploaded photos and short-form Reels. Only upload audio or music for which you hold legal rights or choose from VidGram's CC0 licensed audio library.
            </p>
            <p>
              <strong>2. Monetization & Payouts:</strong> Creator earnings are never guaranteed. Balances and payouts operate strictly after administrator verification, anti-fraud review, and connection to a verified payment provider.
            </p>
          </>
        )}

        {docTab === 'guidelines' && (
          <>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Community Guidelines</h2>
            <p>
              VidGram enforces zero tolerance for harassment, hate speech, impersonation, spam bursts, unauthorized copyrighted music, or non-consensual media. Violating accounts are subject to immediate suspension or permanent ban by Trust & Safety moderators.
            </p>
          </>
        )}

        {docTab === 'apk' && (
          <>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Backend Configuration & Android APK Packaging
            </h2>
            <p className="text-xs">
              <strong>Firebase Backend (`ultra-protocol-75v9p`):</strong> Firestore Enterprise database and Zero-Trust `firestore.rules` are already provisioned and deployed. Google OAuth works out of the box. To also allow Email/Password registration or large-file Cloud Storage uploads, enable <em>Authentication → Sign-in method → Email/Password</em> and <em>Storage</em> in your Firebase Console.
            </p>
            <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto border border-slate-800">
{`# Build Signed Android APK using Capacitor
npm install
npm run build
npx @capacitor/cli init VidGram com.vidgram.social --web-dir dist
npm install @capacitor/core @capacitor/android
npx cap add android
npx cap sync android
cd android && ./gradlew assembleRelease`}
            </pre>
          </>
        )}
      </div>
    </div>
  );
};
