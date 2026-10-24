import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Mic,
  StopCircle,
  Image as ImageIcon,
  Trash2,
  CheckCheck,
  Flag,
  MessageSquarePlus,
} from 'lucide-react';
import { useVidGram } from '../context/VidGramContext';
import type { MessageRecord, UserProfile } from '../types/vidgram';
import { SafeMediaImage } from './SafeMediaImage';
import { formatRelativeTime } from '../utils/vidgramLogic';

interface MessagesViewProps {
  activeConversationId: string | null;
  onSelectConversation: (convId: string) => void;
  onOpenReport: (type: 'user', id: string, label: string) => void;
  onRequireAuth: () => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  activeConversationId,
  onSelectConversation,
  onOpenReport,
  onRequireAuth,
}) => {
  const {
    firebaseUser,
    users,
    conversations,
    startOrOpenConversation,
    subscribeMessages,
    sendMessage,
    setTypingState,
    markMessageRead,
    unsendMessage,
    showToast,
  } = useVidGram();

  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [text, setText] = useState('');
  const [recordingVoice, setRecordingVoice] = useState(false);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedConv =
    conversations.find((c) => c.id === activeConversationId) || conversations[0] || null;

  useEffect(() => {
    if (!selectedConv) {
      setMessages([]);
      return;
    }
    const unsub = subscribeMessages(selectedConv.id, (list) => {
      setMessages(list);
      for (const m of list) {
        if (m.recipientId === firebaseUser?.uid && m.deliveryStatus !== 'read') {
          markMessageRead(selectedConv.id, m);
        }
      }
    });
    return () => unsub();
  }, [selectedConv?.id, firebaseUser?.uid, subscribeMessages]);

  if (!firebaseUser) {
    return (
      <div className="max-w-lg mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Direct Messages & Voice Notes
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Sign in to start real-time private conversations with delivery receipts, voice notes, and media sharing.
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="px-6 py-3 min-h-[46px] rounded-xl bg-rose-600 text-white text-sm font-semibold"
        >
          Sign In to Message
        </button>
      </div>
    );
  }

  const registeredPeers = users.filter(
    (u) => u.uid !== firebaseUser.uid && !u.uid.startsWith('creator_')
  );

  const peerUid = selectedConv
    ? selectedConv.participantA === firebaseUser.uid
      ? selectedConv.participantB
      : selectedConv.participantA
    : '';
  const peerName = selectedConv
    ? selectedConv.participantA === firebaseUser.uid
      ? selectedConv.participantBName
      : selectedConv.participantAName
    : '';
  const peerAvatar = selectedConv
    ? selectedConv.participantA === firebaseUser.uid
      ? selectedConv.participantBAvatar
      : selectedConv.participantAAvatar
    : '';
  const peerProfile = users.find((u) => u.uid === peerUid);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConv || !text.trim()) return;
    setError(null);
    const body = text;
    setText('');
    try {
      await sendMessage({
        conversationId: selectedConv.id,
        recipientId: peerUid,
        messageType: 'text',
        text: body,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message');
    }
  };

  const handleMediaAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConv) return;
    const isVideo = file.type.startsWith('video/');
    try {
      await sendMessage({
        conversationId: selectedConv.id,
        recipientId: peerUid,
        messageType: isVideo ? 'video' : 'image',
        text: isVideo ? 'Shared a video' : 'Shared a photo',
        mediaBlob: file,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Media upload failed');
    }
  };

  const toggleVoiceNote = async () => {
    if (!selectedConv) return;
    if (recordingVoice) {
      voiceRecorderRef.current?.stop();
      setRecordingVoice(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const rec = new MediaRecorder(stream);
      voiceRecorderRef.current = rec;
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        await sendMessage({
          conversationId: selectedConv.id,
          recipientId: peerUid,
          messageType: 'voice',
          text: 'Voice message',
          mediaBlob: blob,
        });
      };
      rec.start();
      setRecordingVoice(true);
    } catch {
      showToast('Microphone unavailable in preview frame.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 min-h-[70vh]">
      {/* Left Conversations List */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Messages</h2>
          <span className="text-xs text-slate-500 tabular-nums">{conversations.length} threads</span>
        </div>

        {/* Start New Chat with Registered Users */}
        {registeredPeers.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-500">Quick Start Chat</div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {registeredPeers.slice(0, 6).map((peer) => (
                <button
                  key={peer.uid}
                  type="button"
                  onClick={async () => {
                    const id = await startOrOpenConversation(peer);
                    onSelectConversation(id);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium whitespace-nowrap shrink-0"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5 text-rose-500" />
                  <span>@{peer.username}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-1.5">
          {conversations.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 leading-relaxed">
              No active conversations yet. Open any registered VidGram user profile and tap <strong>Message</strong> to begin chatting in real time.
            </div>
          ) : (
            conversations.map((conv) => {
              const name =
                conv.participantA === firebaseUser.uid
                  ? conv.participantBName
                  : conv.participantAName;
              const avatar =
                conv.participantA === firebaseUser.uid
                  ? conv.participantBAvatar
                  : conv.participantAAvatar;
              const active = selectedConv?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => onSelectConversation(conv.id)}
                  className={`w-full p-3 rounded-xl flex items-center gap-3 text-left transition-colors ${
                    active
                      ? 'bg-slate-100 dark:bg-slate-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-950'
                  }`}
                >
                  <SafeMediaImage src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        @{name}
                      </span>
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {formatRelativeTime(conv.updatedAtMs)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {conv.typingUid && conv.typingUid !== firebaseUser.uid
                        ? 'Typing...'
                        : conv.lastMessageText}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Active Thread Panel */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
        {!selectedConv ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Select a conversation
            </h3>
            <p className="text-xs text-slate-500 max-w-xs">
              Private threads are protected by Zero-Trust participant rules so only the two participants can read or send messages.
            </p>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SafeMediaImage src={peerAvatar} alt={peerName} className="w-9 h-9 rounded-full object-cover" />
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">@{peerName}</div>
                  <div className="text-[11px] text-slate-500">
                    {selectedConv.typingUid && selectedConv.typingUid !== firebaseUser.uid
                      ? 'Typing now...'
                      : peerProfile?.showOnlineStatus && peerProfile.isOnline
                        ? 'Active now'
                        : 'Encrypted 1:1 thread'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                aria-label={`Report @${peerName}`}
                onClick={() => onOpenReport('user', peerUid, `@${peerName}`)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.map((msg) => {
                const mine = msg.senderId === firebaseUser.uid;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-xs space-y-2 ${
                        msg.isDeleted
                          ? 'bg-slate-100 dark:bg-slate-800/60 italic text-slate-400'
                          : mine
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {!msg.isDeleted && msg.messageType === 'image' && msg.mediaUrl && (
                        <SafeMediaImage src={msg.mediaUrl} alt="Shared attachment" className="rounded-xl max-h-56 object-cover" />
                      )}
                      {!msg.isDeleted && msg.messageType === 'video' && msg.mediaUrl && (
                        <video src={msg.mediaUrl} controls playsInline className="rounded-xl max-h-56" />
                      )}
                      {!msg.isDeleted && msg.messageType === 'voice' && msg.mediaUrl && (
                        <audio src={msg.mediaUrl} controls className="max-w-full h-9" />
                      )}
                      <p className="leading-relaxed break-words">{msg.text}</p>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{formatRelativeTime(msg.createdAtMs)}</span>
                      {mine && !msg.isDeleted && (
                        <>
                          <span className="inline-flex items-center gap-0.5">
                            <CheckCheck className="w-3 h-3" />
                            {msg.deliveryStatus}
                          </span>
                          <button
                            type="button"
                            onClick={() => unsendMessage(selectedConv.id, msg.id)}
                            className="hover:text-rose-500 inline-flex items-center gap-0.5"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                            <span>Unsend</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {error && <p className="px-5 text-xs text-rose-500">{error}</p>}

            {/* Composer */}
            <form
              onSubmit={handleSendText}
              className="p-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
            >
              <label
                aria-label="Send photo or video attachment"
                className="cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ImageIcon className="w-4 h-4" />
                <input type="file" accept="image/*,video/*" onChange={handleMediaAttach} className="sr-only" />
              </label>

              <button
                type="button"
                aria-label={recordingVoice ? 'Stop voice recording' : 'Record voice message'}
                onClick={toggleVoiceNote}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border ${
                  recordingVoice
                    ? 'border-rose-500 bg-rose-600 text-white'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {recordingVoice ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <label htmlFor="chat-msg-input" className="sr-only">
                Message text
              </label>
              <input
                id="chat-msg-input"
                type="text"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setTypingState(selectedConv.id, e.target.value.length > 0);
                }}
                onBlur={() => setTypingState(selectedConv.id, false)}
                placeholder="Write a message..."
                className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
              />

              <button
                type="submit"
                aria-label="Send message"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-rose-600 hover:bg-rose-500 text-white"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
