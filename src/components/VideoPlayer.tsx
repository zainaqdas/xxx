'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { toProxyUrl } from '@/lib/proxy';

interface VideoFiles {
  low?: string;
  high?: string;
  HLS?: string;
}

export default function VideoPlayer({
  files: initialFiles,
  title,
  poster,
  videoUrl,
}: {
  files: VideoFiles;
  title: string;
  poster?: string;
  videoUrl?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshCount = useRef(0);
  const [files, setFiles] = useState(initialFiles);

  // Proxied URLs
  const hlsSrc = files.HLS ? toProxyUrl(files.HLS) : '';
  const mp4Src = toProxyUrl(files.high || '') || toProxyUrl(files.low || '');
  const proxiedPoster = poster ? toProxyUrl(poster) : undefined;

  // Use HLS when available + supported, otherwise MP4
  const useHls = !!(files.HLS && hlsSrc && Hls.isSupported());
  const hasNativeHls =
    !!(files.HLS && hlsSrc && videoRef.current?.canPlayType('application/vnd.apple.mpegurl'));

  // Source for the <video> element when not using HLS.js
  const fallbackSrc = useHls || hasNativeHls ? '' : mp4Src;

  // Playback state
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [hlsLevels, setHlsLevels] = useState<{ height: number; label: string }[]>([]);
  const [currentHlsLevel, setCurrentHlsLevel] = useState(-1); // -1 = auto
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  // Available MP4 qualities for the quality selector
  const mp4Qualities: { key: 'low' | 'high'; label: string }[] = [];
  if (files.low) mp4Qualities.push({ key: 'low', label: 'SD' });
  if (files.high) mp4Qualities.push({ key: 'high', label: 'HD' });
  const isMp4Mode = !useHls && !hasNativeHls;

  // ── HLS.js setup ────────────────────────────────────────────────────────

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsSrc) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (useHls) {
      setIsLoading(true);
      setHasError(false);
      const hls = new Hls();
      hlsRef.current = hls;

      hls.loadSource(hlsSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        const levels = hls.levels.map((l) => ({
          height: l.height,
          label: l.height >= 720 ? 'HD' : l.height >= 480 ? 'SD' : `${l.height}p`,
        }));
        setHlsLevels(levels);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setCurrentHlsLevel(data.level);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Try to recover network error
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              // Fatal — destroy HLS and fall back to MP4
              hls.destroy();
              hlsRef.current = null;
              if (mp4Src) {
                video.src = mp4Src;
                video.load();
              }
              break;
          }
        }
      });
    } else if (hasNativeHls) {
      // Safari native HLS support
      video.src = hlsSrc;
      setIsLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsSrc]);

  // Cleanup HLS on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // ── HLS quality switching ───────────────────────────────────────────────

  const switchHlsLevel = (levelIndex: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelIndex;
    setCurrentHlsLevel(levelIndex);
    setShowQualityMenu(false);
  };

  // ── Source switching (MP4 mode) ─────────────────────────────────────────

  const switchMp4Quality = (q: 'low' | 'high') => {
    if (!files[q]) return;
    setCurrentSrcProxied(toProxyUrl(files[q]!));
    setShowQualityMenu(false);
  };

  // Wrapper to manage MP4 fallback src state
  const [currentSrcProxied, setCurrentSrcProxied] = useState(fallbackSrc);

  useEffect(() => {
    setCurrentSrcProxied(fallbackSrc);
  }, [fallbackSrc]);

  // When switching MP4 quality, reload the video
  useEffect(() => {
    if (videoRef.current && !useHls && !hasNativeHls && currentSrcProxied) {
      setIsLoading(true);
      setHasError(false);
      videoRef.current.src = currentSrcProxied;
      videoRef.current.load();
    }
  }, [currentSrcProxied, useHls, hasNativeHls]);

  // ── Refresh URLs ────────────────────────────────────────────────────────

  const refreshUrls = useCallback(async () => {
    if (!videoUrl || refreshCount.current >= 2) return;
    refreshCount.current += 1;
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/video-details?url=${encodeURIComponent(videoUrl)}`);
      const data = await res.json();
      if (data.success && data.result) {
        const newFiles = data.result.files;
        setFiles(newFiles);
        setHasError(false);
        // HLS will reinitialize via the effect
      }
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false);
    }
  }, [videoUrl]);

  const retry = () => {
    setHasError(false);
    setIsLoading(true);
    if (useHls && hlsRef.current) {
      hlsRef.current.startLoad();
    } else if (videoRef.current) {
      videoRef.current.load();
    }
  };

  // ── Controls visibility ─────────────────────────────────────────────────

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    if (isPlaying) {
      controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    setPipSupported(
      typeof document !== 'undefined' &&
        'pictureInPictureEnabled' in document &&
        document.pictureInPictureEnabled
    );
    return () => {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      if (volumeTimeout.current) clearTimeout(volumeTimeout.current);
    };
  }, []);

  // ── Keyboard handler ─────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    switch (e.key) {
      case ' ':
      case 'Space':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
        showControlsTemporarily();
        break;
      case 'ArrowRight':
        e.preventDefault();
        video.currentTime = Math.min(video.duration, video.currentTime + 10);
        showControlsTemporarily();
        break;
      case 'ArrowUp':
        e.preventDefault();
        video.volume = Math.min(1, video.volume + 0.1);
        video.muted = false;
        setVolume(video.volume);
        setIsMuted(false);
        showControlsTemporarily();
        break;
      case 'ArrowDown':
        e.preventDefault();
        video.volume = Math.max(0, video.volume - 0.1);
        video.muted = video.volume === 0;
        setVolume(video.volume);
        setIsMuted(video.muted);
        showControlsTemporarily();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        toggleMute();
        break;
      case '>':
      case '.':
        e.preventDefault();
        cycleSpeed(1);
        break;
      case '<':
      case ',':
        e.preventDefault();
        cycleSpeed(-1);
        break;
      case '0': case '1': case '2': case '3': case '4':
      case '5': case '6': case '7': case '8': case '9':
        e.preventDefault();
        video.currentTime = (parseInt(e.key, 10) / 9) * video.duration;
        showControlsTemporarily();
        break;
    }
  };

  const cycleSpeed = (dir: 1 | -1) => {
    const idx = speeds.indexOf(playbackRate);
    const next = idx + dir;
    if (next >= 0 && next < speeds.length) {
      setPlaybackRate(speeds[next]);
      if (videoRef.current) videoRef.current.playbackRate = speeds[next];
    }
  };

  // ── Playback handlers ────────────────────────────────────────────────────

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

  const handleProgress = () => {
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
    }
  };

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => {
    setIsPlaying(false);
    setShowControls(true);
  };
  const handleCanPlay = () => setIsLoading(false);
  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
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

  // ── Formatting ───────────────────────────────────────────────────────────

  const formatTime = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  // ── Render ───────────────────────────────────────────────────────────────

  const showVideo = !!(mp4Src || hlsSrc);

  if (!showVideo) {
    return (
      <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6 flex items-center justify-center">
        <p className="text-sm text-gray-500">No video source available</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-video bg-black rounded-xl overflow-hidden mb-6 group select-none"
      tabIndex={-1}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onKeyDown={handleKeyDown}
    >
      {/* ═══ Video element ═══ */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain cursor-pointer"
        muted
        playsInline
        poster={proxiedPoster}
        onClick={togglePlay}
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onProgress={handleProgress}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}                onError={useHls || hasNativeHls ? undefined : handleError}
        title={`Video player - ${title}`}
      >
        {!useHls && !hasNativeHls && <source src={currentSrcProxied || mp4Src} type="video/mp4" />}
        Your browser does not support HTML5 video.
      </video>

      {/* ═══ Big center play button (paused) ═══ */}
      {!isPlaying && !isLoading && !hasError && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={togglePlay}
        >
          <div className="w-16 h-16 rounded-full bg-red-600/90 flex items-center justify-center hover:bg-red-600 hover:scale-105 transition-all duration-200 shadow-lg shadow-black/50">
            <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* ═══ Loading spinner ═══ */}
      {(isLoading || isRefreshing) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="w-10 h-10 border-[3px] border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ═══ Error overlay ═══ */}
      {hasError && !isRefreshing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3 z-10">
          <svg className="w-12 h-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-gray-400">Video source expired or unavailable</p>
          <div className="flex gap-2">
            <button
              onClick={retry}
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
          </div>
        </div>
      )}

      {/* ═══ CUSTOM CONTROL BAR ═══ */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-12 px-3 pb-2 sm:px-4 sm:pb-3">
          {/* ── Progress bar ── */}
          <div className="relative mb-2 sm:mb-3 group/progress cursor-pointer" onClick={handleSeek}>
            {/* Buffered bar */}
            <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 bg-gray-600/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-500/40 rounded-full transition-all"
                style={{ width: `${bufferedPercent}%` }}
              />
            </div>
            {/* Played bar */}
            <div className="relative h-1 group-hover/progress:h-1.5 transition-all duration-150">
              <div className="w-full h-full bg-gray-600/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full relative transition-all"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-md scale-0 group-hover/progress:scale-100" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Controls row ── */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-white">
            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              className="p-1.5 hover:text-red-400 transition-colors"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Time */}
            <span className="text-xs text-gray-300 tabular-nums min-w-[90px] font-medium">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Volume */}
            <div
              className="hidden sm:flex relative items-center"
              onMouseEnter={() => {
                if (volumeTimeout.current) clearTimeout(volumeTimeout.current);
                setShowVolumeSlider(true);
              }}
              onMouseLeave={() => {
                volumeTimeout.current = setTimeout(() => setShowVolumeSlider(false), 300);
              }}
            >
              <button
                onClick={toggleMute}
                className="p-1.5 hover:text-red-400 transition-colors"
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {isMuted || volume === 0 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                ) : volume < 0.5 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM3 9v6h4l5 5V4L7 9H3zm13.5 0c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                )}
              </button>
              <div
                className={`ml-1 w-0 overflow-hidden transition-all duration-200 ${
                  showVolumeSlider ? 'w-20' : 'w-0'
                }`}
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-full h-1 accent-red-500 cursor-pointer"
                  aria-label="Volume"
                />
              </div>
            </div>

            {/* Speed control */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="px-1.5 py-1 rounded text-xs font-medium bg-gray-800/70 hover:bg-gray-700/70 transition-colors hidden sm:inline-flex items-center gap-1"
                title="Speed"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {playbackRate}x
              </button>
              {showSpeedMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSpeedMenu(false)} />
                  <div className="absolute bottom-full right-0 mb-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden min-w-[80px]">
                    {speeds.map((speed) => (
                      <button
                        key={speed}
                        onClick={() => {
                          setPlaybackRate(speed);
                          if (videoRef.current) videoRef.current.playbackRate = speed;
                          setShowSpeedMenu(false);
                        }}
                        className={`block w-full text-left px-3 py-2 text-xs transition-colors ${
                          playbackRate === speed
                            ? 'bg-red-600/20 text-red-400'
                            : 'text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        {speed}x
                        {playbackRate === speed && ' ✓'}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Quality selector */}
            {useHls && hlsLevels.length > 0 ? (
              <div className="relative">
                <button
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="px-1.5 py-1 rounded text-xs font-medium bg-gray-800/70 hover:bg-gray-700/70 transition-colors"
                  title="Quality"
                >
                  {currentHlsLevel === -1 ? 'Auto' : hlsLevels[currentHlsLevel]?.label || 'Auto'} ▾
                </button>
                {showQualityMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowQualityMenu(false)} />
                    <div className="absolute bottom-full right-0 mb-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden min-w-[100px]">
                      <button
                        onClick={() => switchHlsLevel(-1)}
                        className={`block w-full text-left px-3 py-2 text-xs transition-colors ${
                          currentHlsLevel === -1
                            ? 'bg-red-600/20 text-red-400'
                            : 'text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        Auto ✓
                      </button>
                      {hlsLevels.map((level, i) => (
                        <button
                          key={i}
                          onClick={() => switchHlsLevel(i)}
                          className={`block w-full text-left px-3 py-2 text-xs transition-colors ${
                            currentHlsLevel === i
                              ? 'bg-red-600/20 text-red-400'
                              : 'text-gray-300 hover:bg-gray-800'
                          }`}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : isMp4Mode && mp4Qualities.length > 0 ? (
              <div className="relative">
                <button
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="px-1.5 py-1 rounded text-xs font-medium bg-gray-800/70 hover:bg-gray-700/70 transition-colors"
                  title="Quality"
                >
                  {files.high ? 'HD' : 'SD'} ▾
                </button>
                {showQualityMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowQualityMenu(false)} />
                    <div className="absolute bottom-full right-0 mb-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden min-w-[100px]">
                      {mp4Qualities.map((q) => (
                        <button
                          key={q.key}
                          onClick={() => switchMp4Quality(q.key)}
                          className={`block w-full text-left px-3 py-2 text-xs transition-colors ${
                            (q.key === 'high' && files.high) || (q.key === 'low' && !files.high)
                              ? 'bg-red-600/20 text-red-400'
                              : 'text-gray-300 hover:bg-gray-800'
                          }`}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {/* Picture-in-Picture */}
            {pipSupported && (
              <button
                onClick={togglePiP}
                className="hidden sm:inline-flex p-1.5 hover:text-red-400 transition-colors"
                title="Picture in Picture"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z" />
                </svg>
              </button>
            )}

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:text-red-400 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen (F)'}
            >
              {isFullscreen ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              )}
            </button>
          </div>

          {/* Keyboard shortcuts hint (shown briefly on first interaction) */}
          <div className="hidden sm:block mt-1">
            <div className="flex items-center gap-3 text-[10px] text-gray-500/60">
              <span><kbd className="px-1 py-0.5 bg-white/5 rounded text-gray-400">Space</kbd> Play</span>
              <span><kbd className="px-1 py-0.5 bg-white/5 rounded text-gray-400">←</kbd><kbd className="px-1 py-0.5 bg-white/5 rounded text-gray-400">→</kbd> Seek</span>
              <span><kbd className="px-1 py-0.5 bg-white/5 rounded text-gray-400">F</kbd> Fullscreen</span>
              <span><kbd className="px-1 py-0.5 bg-white/5 rounded text-gray-400">M</kbd> Mute</span>
              <span><kbd className="px-1 py-0.5 bg-white/5 rounded text-gray-400">{'>'}</kbd> Speed up</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
