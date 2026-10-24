import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { useVidGram } from '../context/VidGramContext';
import type { MonetizationRecord, NavTab } from '../types/vidgram';
import {
  evaluateMonetizationEligibility,
  formatCurrencyFromCents,
  formatRelativeTime,
} from '../utils/vidgramLogic';

interface MonetizationViewProps {
  onNavigate: (tab: NavTab) => void;
  onRequireAuth: () => void;
}

export const MonetizationView: React.FC<MonetizationViewProps> = ({
  onNavigate,
  onRequireAuth,
}) => {
  const {
    firebaseUser,
    currentProfile,
    monetization,
    payouts,
    platformSettings,
    applyOrUpdateMonetization,
    requestCreatorPayout,
  } = useVidGram();

  const [provider, setProvider] = useState<MonetizationRecord['paymentProvider']>('none');
  const [accountRef, setAccountRef] = useState('');
  const [category, setCategory] = useState('Photography & Short Film');
  const [note, setNote] = useState('');
  const [subsEnabled, setSubsEnabled] = useState(false);
  const [giftsEnabled, setGiftsEnabled] = useState(false);
  const [adsEnabled, setAdsEnabled] = useState(true);
  const [payoutDollars, setPayoutDollars] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (monetization) {
      setProvider(monetization.paymentProvider);
      setAccountRef(monetization.payoutAccountRef);
      setCategory(monetization.contentCategory);
      setNote(monetization.applicationNote);
      setSubsEnabled(monetization.subscriptionsEnabled);
      setGiftsEnabled(monetization.giftsEnabled);
      setAdsEnabled(monetization.adsShareEnabled);
    }
  }, [monetization]);

  if (!firebaseUser || !currentProfile) {
    return (
      <div className="max-w-lg mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-4">
        <DollarSign className="w-8 h-8 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Creator Monetization</h2>
        <p className="text-xs text-slate-500">
          Sign in to check monetization eligibility, connect a legitimate payout provider, and apply for administrator review.
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

  const eligibility = evaluateMonetizationEligibility(currentProfile, {
    minFollowers: platformSettings.minFollowersForMonetization,
    minViews: platformSettings.minViewsForMonetization,
    minPosts: 3,
  });

  const isApproved = monetization?.status === 'approved';
  const hasConnectedProvider =
    Boolean(monetization) &&
    monetization!.paymentProvider !== 'none' &&
    monetization!.payoutAccountRef.trim().length >= 3;

  // Strict Anti-Fake-Earnings Integrity: $0.00 until both approved AND connected to a legitimate payment provider
  const verifiedAvailableCents =
    isApproved && hasConnectedProvider ? monetization!.verifiedBalanceCents : 0;
  const lifetimePaidCents = monetization?.lifetimePaidCents || 0;

  const myPayouts = payouts.filter((p) => p.userId === currentProfile.uid);

  const handleSaveApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (category.trim().length < 2) {
      setError('Enter your primary content category.');
      return;
    }
    setBusy(true);
    try {
      await applyOrUpdateMonetization({
        paymentProvider: provider,
        payoutAccountRef: accountRef,
        contentCategory: category,
        applicationNote: note,
        subscriptionsEnabled: subsEnabled,
        giftsEnabled: giftsEnabled,
        adsShareEnabled: adsEnabled,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save monetization settings.');
    } finally {
      setBusy(false);
    }
  };

  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cents = Math.round(Number(payoutDollars) * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      setError('Minimum payout withdrawal request is $1.00.');
      return;
    }
    setBusy(true);
    try {
      await requestCreatorPayout(cents);
      setPayoutDollars('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request payout.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
          Creator Monetization & Payouts
        </h1>
        <p className="text-xs text-slate-500">
          Transparent, fraud-verified creator monetization. Actual balances accrue only after administrator approval and verified payment provider setup.
        </p>
      </div>

      {/* Compliance Notice */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-900 dark:text-white">Zero Unverified Earnings Guarantee:</strong>{' '}
          VidGram never displays simulated or guaranteed payouts. Available balance and payout withdrawals remain at{' '}
          <span className="font-mono">$0.00</span> until your creator application is approved by the platform administrator, anti-fraud checks pass, and a legitimate payout account is connected.
        </div>
      </div>

      {/* Verified Balances Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Application Status</div>
          <div className="text-lg font-bold text-slate-900 dark:text-white capitalize mt-1 flex items-center gap-2">
            {monetization ? (
              <>
                <ShieldCheck
                  className={`w-5 h-5 ${
                    monetization.status === 'approved'
                      ? 'text-emerald-500'
                      : monetization.status === 'rejected'
                        ? 'text-rose-500'
                        : 'text-amber-500'
                  }`}
                />
                <span>{monetization.status}</span>
              </>
            ) : (
              <span>Not Applied</span>
            )}
          </div>
          {monetization?.adminReviewNote && (
            <p className="text-[11px] text-slate-500 mt-1">Note: {monetization.adminReviewNote}</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Verified Available Balance</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {formatCurrencyFromCents(verifiedAvailableCents)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {hasConnectedProvider ? `Provider: ${monetization?.paymentProvider}` : 'No payout provider connected'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Lifetime Settled Payouts</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {formatCurrencyFromCents(lifetimePaidCents)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Fraud-screened ledger</div>
        </div>
      </div>

      {/* Eligibility Meter */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Monetization Eligibility Criteria
          </h2>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {eligibility.eligible ? 'Eligible for Partner Review' : 'Building Eligibility'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <div className="flex justify-between mb-1">
              <span>Followers ({platformSettings.minFollowersForMonetization} req)</span>
              <span className="font-mono tabular-nums">{eligibility.followersProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-rose-600" style={{ width: `${eligibility.followersProgress}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span>Video Views ({platformSettings.minViewsForMonetization} req)</span>
              <span className="font-mono tabular-nums">{eligibility.viewsProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-rose-600" style={{ width: `${eligibility.viewsProgress}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span>Published Posts (3 req)</span>
              <span className="font-mono tabular-nums">{eligibility.postsProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-rose-600" style={{ width: `${eligibility.postsProgress}%` }} />
            </div>
          </div>
        </div>

        {eligibility.missingCriteria.length > 0 && (
          <ul className="text-xs text-slate-500 space-y-1 pt-1">
            {eligibility.missingCriteria.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-3 text-xs text-rose-600 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Application & Payment Provider Configuration Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleSaveApplication}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {monetization ? 'Payment Method & Program Settings' : 'Apply for Creator Monetization'}
            </h2>
          </div>

          <div>
            <label htmlFor="mon-category" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Content Category
            </label>
            <input
              id="mon-category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="mon-provider" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Legitimate Payment Provider
            </label>
            <select
              id="mon-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as MonetizationRecord['paymentProvider'])}
              className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            >
              <option value="none">Not Connected</option>
              <option value="stripe_connect">Stripe Connect Express</option>
              <option value="bank_transfer">Verified Bank Wire / IBAN</option>
              <option value="upi_verified">Verified Merchant UPI</option>
            </select>
          </div>

          <div>
            <label htmlFor="mon-acct-ref" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Merchant / Account Identifier
            </label>
            <input
              id="mon-acct-ref"
              type="text"
              value={accountRef}
              onChange={(e) => setAccountRef(e.target.value)}
              placeholder="acct_1P9x... or verified payout handle"
              className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="mon-note" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Application & Originality Statement
            </label>
            <textarea
              id="mon-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe your original video production workflow..."
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-2 text-xs">
            <label className="flex items-center justify-between py-1">
              <span>Reel Ad Revenue Share Integration</span>
              <input
                type="checkbox"
                checked={adsEnabled}
                onChange={(e) => setAdsEnabled(e.target.checked)}
                className="accent-rose-600 w-4 h-4"
              />
            </label>
            <label className="flex items-center justify-between py-1">
              <span>Creator Subscriptions Support</span>
              <input
                type="checkbox"
                checked={subsEnabled}
                onChange={(e) => setSubsEnabled(e.target.checked)}
                className="accent-rose-600 w-4 h-4"
              />
            </label>
            <label className="flex items-center justify-between py-1">
              <span>Viewer Gifts on Reels</span>
              <input
                type="checkbox"
                checked={giftsEnabled}
                onChange={(e) => setGiftsEnabled(e.target.checked)}
                className="accent-rose-600 w-4 h-4"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold disabled:opacity-50"
          >
            {busy
              ? 'Saving...'
              : monetization
                ? 'Save Monetization Settings'
                : 'Submit Monetization Application'}
          </button>
        </form>

        {/* Payout Request & History */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between gap-6">
          <form onSubmit={handlePayoutSubmit} className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Request Verified Payout
            </h2>
            <p className="text-xs text-slate-500">
              Withdrawals require administrator approval (`status: approved`), a connected payment provider, and verified available balance ≥ $1.00.
            </p>

            <div>
              <label htmlFor="payout-amt" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Withdrawal Amount (USD)
              </label>
              <input
                id="payout-amt"
                type="number"
                step="0.01"
                min="1"
                value={payoutDollars}
                onChange={(e) => setPayoutDollars(e.target.value)}
                placeholder="0.00"
                disabled={!isApproved || verifiedAvailableCents < 100}
                className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={busy || !isApproved || verifiedAvailableCents < 100}
              className="w-full min-h-[44px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold disabled:opacity-40"
            >
              Request Payout Withdrawal
            </button>
          </form>

          <div className="space-y-2.5 border-t border-slate-200 dark:border-slate-800 pt-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              Earnings & Payout Ledger ({myPayouts.length})
            </h3>
            {myPayouts.length === 0 ? (
              <p className="text-xs text-slate-500">No payout transactions recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {myPayouts.map((pay) => (
                  <div
                    key={pay.id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950"
                  >
                    <div>
                      <div className="font-mono font-semibold text-slate-900 dark:text-white">
                        {formatCurrencyFromCents(pay.amountCents)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {pay.paymentProvider} · {formatRelativeTime(pay.createdAtMs)}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 capitalize font-semibold text-slate-700 dark:text-slate-300">
                      {pay.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      {pay.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
