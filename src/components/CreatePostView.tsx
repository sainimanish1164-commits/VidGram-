import React, { useRef, useState } from 'react';
import { Upload, Video, Image as ImageIcon, Camera, StopCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { useVidGram } from '../context/VidGramContext';
import { ROYALTY_FREE_AUDIO_TRACKS } from '../data/seedContent';
import { extractHashtags, extractMentions } from '../utils/vidgramLogic';

interface CreatePostModalProps {
  onPublished: (type: 'photo' | 'reel') => void;
  onRequireAuth: () => void;
}

export const CreatePostView: React.FC<CreatePostModalProps> = ({ onPublished, onRequireAuth }) => {
  const { firebaseUser, publishPostOrReel } = useVidGram();
  const [mediaType, setMediaType] = useState<'photo' | 'reel'>('reel');
  const [selectedFile, setSelectedFile] = useState<File | Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [audioTrack, setAudioTrack] = useState(ROYALTY_FREE_AUDIO_TRACKS[0].label);
  const [visibility, setVisibility] = useState<'public' | 'followers'>('public');
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live Camera Recorder for Reels
  const [recording, setRecording] = useState(false);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 40 * 1024 * 1024) {
      setError('Media file must be under 40 MB for mobile playback optimization.');
      return;
    }
    const isVid = file.type.startsWith('video/');
    setMediaType(isVid ? 'reel' : 'photo');
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const startCameraCapture = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      });
      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play();
      }
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        setSelectedFile(blob);
        setMediaType('reel');
        setPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setRecording(true);
    } catch {
      setError('Camera permission unavailable in this browser frame. Select a video or photo from gallery instead.');
    }
  };

  const stopCameraCapture = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firebaseUser) {
      onRequireAuth();
      return;
    }
    if (!selectedFile) {
      setError('Select a photo/video from your device or record a short Reel first.');
      return;
    }
    try {
      setUploadPct(5);
      await publishPostOrReel({
        mediaType,
        file: selectedFile,
        caption,
        audioTrackName: mediaType === 'reel' ? audioTrack : '',
        visibility,
        onProgress: setUploadPct,
      });
      setSelectedFile(null);
      setPreviewUrl('');
      setCaption('');
      setUploadPct(null);
      onPublished(mediaType);
    } catch (err) {
      setUploadPct(null);
      setError(err instanceof Error ? err.message : 'Upload failed.');
    }
  };

  const parsedTags = extractHashtags(caption);
  const parsedMentions = extractMentions(caption);

  return (
    <div className="max-w-2xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Create Post or Short Reel
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Supports MP4, WebM, MOV, JPG, PNG & WebP with automatic thumbnail generation
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setMediaType('photo')}
            className={`px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
              mediaType === 'photo'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photo</span>
          </button>
          <button
            type="button"
            onClick={() => setMediaType('reel')}
            className={`px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
              mediaType === 'reel'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Reel</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-3 text-xs text-rose-700 dark:text-rose-300"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Media Picker / Recorder Zone */}
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-6 text-center space-y-4">
          {recording ? (
            <div className="space-y-3">
              <video
                ref={liveVideoRef}
                muted
                playsInline
                className="w-56 aspect-[9/16] mx-auto rounded-2xl bg-black object-cover"
              />
              <button
                type="button"
                onClick={stopCameraCapture}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-rose-600 text-white text-xs font-semibold"
              >
                <StopCircle className="w-4 h-4" />
                <span>Stop Recording</span>
              </button>
            </div>
          ) : previewUrl ? (
            <div className="space-y-3">
              {mediaType === 'reel' ? (
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  className="max-h-80 mx-auto rounded-xl bg-black"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Upload preview"
                  className="max-h-80 mx-auto rounded-xl object-contain"
                />
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl('');
                }}
                className="text-xs font-semibold text-rose-500 hover:underline"
              >
                Choose a different file
              </button>
            </div>
          ) : (
            <div className="space-y-3 py-4">
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Select {mediaType === 'reel' ? 'short video' : 'photo'} from gallery or record live
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold">
                  <Upload className="w-4 h-4" />
                  <span>Select from Gallery</span>
                  <input
                    type="file"
                    accept={mediaType === 'reel' ? 'video/mp4,video/webm,video/quicktime' : 'image/*,video/*'}
                    onChange={handleFilePick}
                    className="sr-only"
                  />
                </label>

                {mediaType === 'reel' && (
                  <button
                    type="button"
                    onClick={startCameraCapture}
                    className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Record Camera Reel</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Caption & Hashtags */}
        <div>
          <label htmlFor="create-caption" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Caption, #Hashtags & @Mentions
          </label>
          <textarea
            id="create-caption"
            rows={3}
            maxLength={1000}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Describe your moment... Add #reels #photography or tag @aria.lens"
            className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
          />
          {(parsedTags.length > 0 || parsedMentions.length > 0) && (
            <div className="mt-1.5 text-xs text-slate-500">
              {parsedTags.length > 0 && <span>Hashtags: #{parsedTags.join(' #')} </span>}
              {parsedMentions.length > 0 && <span>· Tagged: @{parsedMentions.join(' @')}</span>}
            </div>
          )}
        </div>

        {/* Legally Licensed Royalty-Free Audio Selector for Reels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mediaType === 'reel' && (
            <div>
              <label htmlFor="create-audio" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Licensed Audio Track (CC0 Permitted)
              </label>
              <select
                id="create-audio"
                value={audioTrack}
                onChange={(e) => setAudioTrack(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
              >
                {ROYALTY_FREE_AUDIO_TRACKS.map((track) => (
                  <option key={track.id} value={track.label}>
                    {track.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="create-visibility" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Audience Visibility
            </label>
            <select
              id="create-visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'public' | 'followers')}
              className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            >
              <option value="public">Public (Feed & Explore)</option>
              <option value="followers">Followers Only</option>
            </select>
          </div>
        </div>

        {/* Upload Progress Bar */}
        {uploadPct !== null && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300 tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-rose-500" />
                Optimizing & uploading media...
              </span>
              <span>{uploadPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-rose-600 transition-all duration-200"
                style={{ width: `${uploadPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={uploadPct !== null}
            className="px-6 py-3 min-h-[46px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {uploadPct !== null
              ? `Uploading (${uploadPct}%)...`
              : mediaType === 'reel'
                ? 'Publish Reel'
                : 'Publish Photo'}
          </button>
        </div>
      </form>
    </div>
  );
};
