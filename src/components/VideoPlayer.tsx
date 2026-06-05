'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface VideoFiles {
  low?: string;
  high?: string;
  HLS?: string;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshCount = useRef(0);
  const [files, setFiles] = useState(initialFiles);
  const [embedUrl, setEmbedUrl] = useState(initialEmbedUrl);
  const mp4Source = files.high || files.low;
  const [useEmbed, setUseEmbed] = useState(!mp4Source);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<'low' | 'high'>(files.high ? 'high' : 'low');
  const [currentSrc, setCurrentSrc] = useState(mp4Source || '');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(true); // starts muted per HTML muted attribute
  const [showControls, setShowControls] = useState(true);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);

  const qualities: { key: 'low' | 'high'; label: string }[] = [];
  if (files.low) qualities.push({ key: 'low', label: 'Low' });
  if (files.high) qualities.push({ key: 'high', label: 'HD' });

  // --- Source switching ---
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
    setShowQualityMenu(false);
  };

  // --- Refresh URLs ---
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
      // ignore
    } finally {
      setIsRefreshing(false);
    }
  }, [videoUrl]);

  const retryMp4 = () => {
    setHasError(false);
    setUseEmbed(false);
    setIsLoading(true);
    videoRef.current?.load();
  };

  // --- Controls visibility ---
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    if (isPlaying) {
      controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    setPipSupported('pictureInPictureEnabled' in document && document.pictureInPictureEnabled);
    return () => {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      if (volumeTimeout.current) clearTimeout(volumeTimeout.current);
    };
  }, []);

  // --- Playback handlers ---
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => {
    setIsPlaying(false);
    setShowControls(true);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = fraction * duration;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = v === 0;
      setIsMuted(v === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else {
        await videoRef.current.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch {
      // PiP not supported
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // --- Format time ---
  const formatTime = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // ==============================
  // EMBED FALLBACK
  // ==============================
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

  // ==============================
  // NATIVE MP4 PLAYER
  // ==============================
  return (
    <div
      ref={containerRef}
      className="aspect-video bg-black rounded-xl overflow-hidden mb-6 relative group select-none"
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        key={currentSrc}
        className="w-full h-full object-contain cursor-pointer"
        muted
        playsInline
        poster={poster}
        onClick={togglePlay}
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onError={handleError}
        title={`Video player - ${title}`}
      >
        <source src={currentSrc} type="video/mp4" />
        Your browser does not support HTML5 video.
      </video>

      {/* === OVERLAYS === */}

      {/* Big center play button (when paused) */}
      {!isPlaying && !isLoading && !hasError && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={togglePlay}
        >
          <div className="w-16 h-16 rounded-full bg-red-600/90 flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg shadow-black/50">
            <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Loading spinner */}
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
            <button onClick={retryMp4} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-white transition-colors">Retry</button>
            {videoUrl && (
              <button onClick={refreshUrls} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-xs text-white transition-colors">Refresh link</button>
            )}
            <button onClick={() => setUseEmbed(true)} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs text-white transition-colors">Use embed player</button>
          </div>
        </div>
      )}

      {/* === CUSTOM CONTROL BAR === */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Gradient background */}
        <div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-12 px-4 pb-3">
          {/* Progress bar */}
          <div
            className="w-full h-1 bg-gray-600/50 rounded-full cursor-pointer mb-3 group/progress hover:h-1.5 transition-all"
            role="progressbar"
            aria-valuenow={Math.round(currentTime)}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const step = e.key === 'ArrowRight' ? 5 : -5;
                if (videoRef.current) videoRef.current.currentTime += step;
              }
            }}
            onClick={handleSeek}
          >
            <div
              className="h-full bg-red-500 rounded-full relative transition-all"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-md" />
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2 text-white">
            {/* Play/Pause */}
            <button onClick={togglePlay} className="p-1 hover:text-red-400 transition-colors" title={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>

            {/* Time */}
            <span className="text-xs text-gray-300 tabular-nums min-w-[90px]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Volume */}
            <div
              className="relative flex items-center"
              onMouseEnter={() => { clearTimeout(volumeTimeout.current!); setShowVolumeSlider(true); }}
              onMouseLeave={() => { volumeTimeout.current = setTimeout(() => setShowVolumeSlider(false), 300); }}
            >
              <button onClick={toggleMute} className="p-1 hover:text-red-400 transition-colors" title={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted || volume === 0 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                )}
              </button>
              {showVolumeSlider && (
                <div className="ml-1 w-20">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-full h-1 accent-red-500 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Quality selector */}
            {qualities.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="px-2 py-1 rounded text-xs font-medium bg-gray-800/70 hover:bg-gray-700/70 transition-colors"
                  title="Quality"
                >
                  {currentQuality === 'high' ? 'HD' : 'SD'} ▾
                </button>
                {showQualityMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowQualityMenu(false)} />
                    <div className="absolute bottom-full right-0 mb-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden min-w-[100px]">
                      {qualities.map((q) => (
                        <button
                          key={q.key}
                          onClick={() => switchQuality(q.key)}
                          className={`block w-full text-left px-3 py-2 text-xs transition-colors ${
                            currentQuality === q.key
                              ? 'bg-red-600/20 text-red-400'
                              : 'text-gray-300 hover:bg-gray-800'
                          }`}
                        >
                          {q.label}
                          {currentQuality === q.key && ' ✓'}
                        </button>
                      ))}
                      <button
                        onClick={() => { setUseEmbed(true); setShowQualityMenu(false); }}
                        className="block w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
                      >
                        Embed
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Picture-in-Picture */}
            {pipSupported && (
              <button onClick={togglePiP} className="p-1 hover:text-red-400 transition-colors" title="Picture in Picture">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z" /></svg>
              </button>
            )}

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="p-1 hover:text-red-400 transition-colors" title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
              {isFullscreen ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
