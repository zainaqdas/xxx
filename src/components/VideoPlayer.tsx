'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface VideoFiles {
  low?: string;
  high?: string;
  HLS?: string;
}

interface VideoDetailsResult {
  files: VideoFiles;
  embedUrl: string;
  thumbnailUrls?: string[];
  title: string;
  [key: string]: unknown;
}

export default function VideoPlayer({
  files: initialFiles,
  embedUrl: initialEmbedUrl,
  title,
  poster,
  videoUrl,
}: {
  files: VideoFiles;
  embedUrl: string;
  title: string;
  poster?: string;
  videoUrl?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [files, setFiles] = useState(initialFiles);
  const [embedUrl, setEmbedUrl] = useState(initialEmbedUrl);
  const mp4Source = files.high || files.low;
  const [useEmbed, setUseEmbed] = useState(!mp4Source);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<'low' | 'high'>(files.high ? 'high' : 'low');
  const [currentSrc, setCurrentSrc] = useState(mp4Source || '');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshCount = useRef(0);

  useEffect(() => {
    if (videoRef.current && currentSrc) {
      setIsLoading(true);
      setHasError(false);
      videoRef.current.load();
    }
  }, [currentSrc]);

  const handleCanPlay = () => setIsLoading(false);
  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const switchQuality = (q: 'low' | 'high') => {
    if (!files[q]) return;
    setCurrentQuality(q);
    setCurrentSrc(files[q]!);
  };

  // Fetch fresh video URLs from the server when the current ones expire
  const refreshUrls = useCallback(async () => {
    if (!videoUrl || refreshCount.current >= 2) return;
    refreshCount.current += 1;
    setIsRefreshing(true);

    try {
      const res = await fetch(`/api/video-details?url=${encodeURIComponent(videoUrl)}`);
      const data = await res.json();

      if (data.success && data.result) {
        const newFiles = data.result.files;
        const newEmbedUrl = data.result.embedUrl;
        setFiles(newFiles);
        setEmbedUrl(newEmbedUrl);

        const newMp4 = newFiles.high || newFiles.low;
        if (newMp4) {
          setCurrentSrc(newMp4);
          setCurrentQuality(newFiles.high ? 'high' : 'low');
          setUseEmbed(false);
          setHasError(false);
        }
      }
    } catch {
      // Failed to refresh, let the error overlay handle it
    } finally {
      setIsRefreshing(false);
    }
  }, [videoUrl]);

  const retryMp4 = () => {
    setHasError(false);
    setUseEmbed(false);
    setIsLoading(true);
    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  // Embed fallback
  if (useEmbed) {
    return (
      <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6 relative">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; fullscreen"
          title={`Video player (embed) - ${title}`}
        />
        {mp4Source && (
          <div className="absolute bottom-4 right-4 z-10">
            <button
              onClick={() => { setUseEmbed(false); retryMp4(); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800/90 text-gray-300 hover:bg-gray-700/90 transition-colors"
            >
              Try MP4 player
            </button>
          </div>
        )}
      </div>
    );
  }

  const qualities: { key: 'low' | 'high'; label: string }[] = [];
  if (files.low) qualities.push({ key: 'low', label: 'Low' });
  if (files.high) qualities.push({ key: 'high', label: 'HD' });

  return (
    <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6 relative group">
      <video
        ref={videoRef}
        key={currentSrc}
        className="w-full h-full object-contain"
        controls
        muted
        playsInline
        poster={poster}
        onCanPlay={handleCanPlay}
        onError={handleError}
        title={`Video player - ${title}`}
      >
        <source src={currentSrc} type="video/mp4" />
        Your browser does not support HTML5 video.
      </video>

      {/* Loading overlay */}
      {(isLoading || isRefreshing) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error overlay */}
      {hasError && !isRefreshing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3 z-10">
          <p className="text-sm text-gray-400">Video source expired or unavailable</p>
          <div className="flex gap-2">
            <button
              onClick={retryMp4}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-white transition-colors"
            >
              Retry
            </button>
            {videoUrl && (
              <button
                onClick={refreshUrls}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-xs text-white transition-colors"
              >
                Refresh link
              </button>
            )}
            <button
              onClick={() => setUseEmbed(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs text-white transition-colors"
            >
              Use embed player
            </button>
          </div>
        </div>
      )}

      {/* Quality selector - always visible */}
      {qualities.length > 1 && (
        <div className="absolute bottom-4 right-4 flex gap-2 z-10">
          {qualities.map((q) => (
            <button
              key={q.key}
              onClick={() => switchQuality(q.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                currentQuality === q.key
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'bg-gray-800/90 text-gray-300 hover:bg-gray-700/90'
              }`}
            >
              {q.label}
            </button>
          ))}
          <button
            onClick={() => setUseEmbed(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-gray-800/90 text-gray-300 hover:bg-gray-700/90"
          >
            Embed
          </button>
        </div>
      )}
    </div>
  );
}
