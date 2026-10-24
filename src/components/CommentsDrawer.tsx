import React, { useEffect, useState } from 'react';
import { X, Send, Trash2, CornerDownRight, Flag } from 'lucide-react';
import type { PostRecord, CommentRecord } from '../types/vidgram';
import { useVidGram } from '../context/VidGramContext';
import { SafeMediaImage } from './SafeMediaImage';
import { formatRelativeTime } from '../utils/vidgramLogic';

interface CommentsDrawerProps {
  post: PostRecord | null;
  onClose: () => void;
  onRequireAuth: () => void;
}

export const CommentsDrawer: React.FC<CommentsDrawerProps> = ({ post, onClose, onRequireAuth }) => {
  const { firebaseUser, isAdmin, subscribeComments, addComment, deleteComment, submitReport } = useVidGram();
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!post) return;
    const unsub = subscribeComments(post.id, setComments);
    return () => unsub();
  }, [post, subscribeComments]);

  if (!post) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firebaseUser) {
      onRequireAuth();
      return;
    }
    if (!text.trim()) {
      setError('Write a comment before posting.');
      return;
    }
    try {
      await addComment(post, text, replyTo?.id || '');
      setText('');
      setReplyTo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post comment.');
    }
  };

  const topLevel = comments.filter((c) => !c.parentCommentId);
  const repliesByParent = new Map<string, CommentRecord[]>();
  for (const c of comments) {
    if (c.parentCommentId) {
      const arr = repliesByParent.get(c.parentCommentId) || [];
      arr.push(c);
      repliesByParent.set(c.parentCommentId, arr);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="comments-sheet-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-4"
    >
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[82vh]">
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 sm:hidden" />
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h3 id="comments-sheet-title" className="text-base font-bold text-slate-900 dark:text-white">
            Comments · <span className="tabular-nums">{comments.length}</span>
          </h3>
          <button
            type="button"
            aria-label="Close comments"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {topLevel.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No comments yet. Start the conversation below.
            </div>
          ) : (
            topLevel.map((cmt) => {
              const replies = repliesByParent.get(cmt.id) || [];
              const canDelete = firebaseUser?.uid === cmt.authorId || isAdmin;
              return (
                <div key={cmt.id} className="space-y-2.5">
                  <div className="flex items-start gap-3">
                    <SafeMediaImage
                      src={cmt.authorAvatarUrl}
                      alt={cmt.authorUsername}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          @{cmt.authorUsername}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatRelativeTime(cmt.createdAtMs)}</span>
                      </div>
                      <p className="text-sm text-slate-800 dark:text-slate-200 mt-0.5 break-words">
                        {cmt.text}
                      </p>
                      <div className="mt-1.5 flex items-center gap-4 text-xs text-slate-500">
                        <button
                          type="button"
                          onClick={() => setReplyTo(cmt)}
                          className="font-medium hover:text-slate-900 dark:hover:text-white"
                        >
                          Reply
                        </button>
                        {firebaseUser && firebaseUser.uid !== cmt.authorId && (
                          <button
                            type="button"
                            onClick={() => submitReport('comment', cmt.id, `Reported comment: ${cmt.text.slice(0, 60)}`)}
                            className="inline-flex items-center gap-1 hover:text-rose-500"
                          >
                            <Flag className="w-3 h-3" />
                            <span>Report</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            aria-label={`Delete comment by ${cmt.authorUsername}`}
                            onClick={() => deleteComment(post.id, cmt.id)}
                            className="inline-flex items-center gap-1 text-rose-500 hover:underline"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {replies.map((rep) => (
                    <div key={rep.id} className="pl-10 flex items-start gap-2.5">
                      <CornerDownRight className="w-3.5 h-3.5 text-slate-400 mt-1.5 shrink-0" />
                      <SafeMediaImage
                        src={rep.authorAvatarUrl}
                        alt={rep.authorUsername}
                        className="w-6 h-6 rounded-full object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            @{rep.authorUsername}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatRelativeTime(rep.createdAtMs)}</span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 break-words">
                          {rep.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={handleSend} className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {replyTo && (
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Replying to @{replyTo.authorUsername}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="text-rose-500 font-medium">
                Cancel
              </button>
            </div>
          )}
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <div className="flex items-center gap-2">
            <label htmlFor="comment-input" className="sr-only">
              Write a comment
            </label>
            <input
              id="comment-input"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={replyTo ? `Reply to @${replyTo.authorUsername}...` : 'Add a comment...'}
              className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
            />
            <button
              type="submit"
              aria-label="Send comment"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
