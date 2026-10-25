import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X, Terminal, CheckCircle2 } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Offline mode — showing cached VidGram content</span>
    </div>
  );
};

export const AndroidInstallModalTrigger: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [openGuide, setOpenGuide] = useState(false);

  if (isInstalled) return null;

  const handleAction = async () => {
    if (isInstallable) {
      await install();
    } else {
      setOpenGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleAction}
        className={
          compact
            ? 'inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0'
            : 'inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0'
        }
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{isInstallable ? 'Install Android App' : 'Android / APK Guide'}</span>
      </button>

      {openGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="apk-guide-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-rose-500" />
                <h2 id="apk-guide-title" className="text-lg font-bold text-slate-900 dark:text-white">
                  Install VidGram on Android & Build Signed APK
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close Android APK guide"
                onClick={() => setOpenGuide(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-rose-500" />
                  <span>1. Direct Native Android APK (com.vidgram.social)</span>
                </h3>
                <p className="mt-1 text-xs leading-relaxed">
                  Download the compiled Capacitor Android debug package (
                  <code className="font-mono text-slate-800 dark:text-slate-200">app-debug.apk</code>, minSdk 24 / targetSdk 36) directly to your Android device and open it to install VidGram.
                </p>
                <div className="mt-3">
                  <a
                    href="/vidgram-debug.apk"
                    download="VidGram-debug.apk"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>Download VidGram APK (app-debug.apk)</span>
                  </a>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>2. Instant Android WebAPK Installation (Browser Menu)</span>
                </h3>
                <p className="mt-1 text-xs leading-relaxed">
                  {isIOS
                    ? 'On Safari, tap Share in the bottom toolbar and choose Add to Home Screen.'
                    : 'Open this VidGram URL in Chrome on Android, open the three-dot browser menu, and select "Install app" for standalone full-screen navigation.'}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-rose-500" />
                  <span>3. Rebuild Locally via Capacitor &amp; Gradle</span>
                </h3>
                <p className="mt-1 text-xs leading-relaxed">
                  The Capacitor Android workspace (
                  <code className="font-mono text-slate-800 dark:text-slate-200">capacitor.config.ts</code> and{' '}
                  <code className="font-mono text-slate-800 dark:text-slate-200">android/</code>) is pre-configured in this project:
                </p>
                <pre className="mt-2 p-3 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto border border-slate-800">
{`npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# Generated APK: android/app/build/outputs/apk/debug/app-debug.apk`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  4. Firebase Console Setup for Email/Password &amp; Storage
                </h3>
                <p className="mt-1 text-xs leading-relaxed">
                  Google Sign-In and Firestore Zero-Trust rules are already provisioned. To enable Email/Password registration or Cloud Storage video buckets in your Firebase Console (
                  <code className="font-mono text-slate-800 dark:text-slate-200">ultra-protocol-75v9p</code>), open Authentication &rarr; Sign-in method &rarr; Enable Email/Password, and Storage &rarr; Get Started.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setOpenGuide(false)}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
