import React, { useState } from 'react';
import { X, Flag } from 'lucide-react';
import type { ReportRecord } from '../types/vidgram';
import { useVidGram } from '../context/VidGramContext';

interface ReportModalProps {
  target: { type: ReportRecord['targetType']; id: string; label: string } | null;
  onClose: () => void;
  onRequireAuth: () => void;
}

const REPORT_REASONS = [
  'Spam, scam, or misleading engagement',
  'Harassment, bullying, or hate speech',
  'Copyright or unauthorized music/media',
  'Nudity, violence, or unsafe content',
  'Impersonation or fake account',
];

export const ReportModal: React.FC<ReportModalProps> = ({ target, onClose, onRequireAuth }) => {
  const { firebaseUser, submitReport } = useVidGram();
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  if (!target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      onRequireAuth();
      return;
    }
    setBusy(true);
    try {
      await submitReport(
        target.type,
        target.id,
        `${selectedReason}${details.trim() ? ` — ${details.trim()}` : ''}`
      );
      setDetails('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-rose-500" />
            <h3 id="report-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
              Report {target.label}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close report dialog"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
              Why are you reporting this content?
            </legend>
            {REPORT_REASONS.map((reason) => (
              <label
                key={reason}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950 text-xs text-slate-800 dark:text-slate-200"
              >
                <input
                  type="radio"
                  name="report-reason"
                  checked={selectedReason === reason}
                  onChange={() => setSelectedReason(reason)}
                  className="accent-rose-600"
                />
                <span>{reason}</span>
              </label>
            ))}
          </fieldset>

          <div>
            <label htmlFor="report-details" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Additional Context (Optional)
            </label>
            <textarea
              id="report-details"
              rows={2}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide helpful details for moderators..."
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold disabled:opacity-50"
            >
              {busy ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
