import { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { formatTimeShort } from './utils';

interface AudioPlayerProps {
  audioUrl: string | null;
  audioFile: File | null;
  onTimeUpdate: (time: number) => void;
  isSyncing: boolean;
  onPlayPause: (playing: boolean) => void;
  isPlaying: boolean;
}

export interface AudioPlayerHandle {
  seekTo: (time: number) => void;
  playSegment: (start: number, end: number) => void;
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
}

async function extractWaveformPeaks(
  file: File,
  numPeaks: number
): Promise<{ peaks: number[]; duration: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);
  const duration = audioBuffer.duration;

  const blockSize = Math.floor(channelData.length / numPeaks);
  const peaks: number[] = [];

  for (let i = 0; i < numPeaks; i++) {
    const start = i * blockSize;
    let max = 0;
    for (let j = 0; j < blockSize; j++) {
      const absVal = Math.abs(channelData[start + j]);
      if (absVal > max) max = absVal;
    }
    peaks.push(max);
  }

  audioContext.close();
  return { peaks, duration };
}

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  ({ audioUrl, audioFile, onTimeUpdate, isSyncing, onPlayPause, isPlaying }, ref) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const segmentEndRef = useRef<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [isLoadingWaveform, setIsLoadingWaveform] = useState(false);

  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  const waveformPeaksRef = useRef(waveformPeaks);
  const isLoadingRef = useRef(isLoadingWaveform);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { waveformPeaksRef.current = waveformPeaks; }, [waveformPeaks]);
  useEffect(() => { isLoadingRef.current = isLoadingWaveform; }, [isLoadingWaveform]);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    seekTo: (time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        segmentEndRef.current = null;
      }
    },
    playSegment: (start: number, end: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = start;
        segmentEndRef.current = end;
        audioRef.current.play();
        onPlayPause(true);
      }
    },
    play: () => {
      if (audioRef.current) {
        segmentEndRef.current = null;
        audioRef.current.play();
        onPlayPause(true);
      }
    },
    pause: () => {
      if (audioRef.current) {
        audioRef.current.pause();
        onPlayPause(false);
      }
    },
    getCurrentTime: () => audioRef.current?.currentTime || 0,
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };

    resizeCanvas();
    const observer = new ResizeObserver(() => { resizeCanvas(); });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!audioFile) { setWaveformPeaks([]); return; }
    let cancelled = false;
    setIsLoadingWaveform(true);
    extractWaveformPeaks(audioFile, 400).then(({ peaks, duration: dur }) => {
      if (!cancelled) { setWaveformPeaks(peaks); setDuration(dur); setIsLoadingWaveform(false); }
    }).catch(() => { if (!cancelled) setIsLoadingWaveform(false); });
    return () => { cancelled = true; };
  }, [audioFile]);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    if (width === 0 || height === 0) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0a0520');
    bgGrad.addColorStop(0.5, '#0f0a2e');
    bgGrad.addColorStop(1, '#0a0520');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const nebulaGrad = ctx.createRadialGradient(width * 0.3, height * 0.5, 0, width * 0.3, height * 0.5, width * 0.5);
    nebulaGrad.addColorStop(0, 'rgba(139, 92, 246, 0.08)');
    nebulaGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = nebulaGrad;
    ctx.fillRect(0, 0, width, height);

    const peaks = waveformPeaksRef.current;
    const dur = durationRef.current;
    const time = currentTimeRef.current;
    const loading = isLoadingRef.current;

    if (peaks.length === 0) {
      ctx.fillStyle = 'rgba(167, 139, 250, 0.5)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(loading ? '✨ Анализ аудио...' : 'Нет данных', width / 2, height / 2);
      ctx.restore();
      return;
    }

    const progress = dur > 0 ? time / dur : 0;
    const numBars = peaks.length;
    const barSpacing = 1;
    const totalSpacing = barSpacing * (numBars - 1);
    const barWidth = (width - totalSpacing) / numBars;
    const centerY = height / 2;
    const maxBarHeight = height * 0.85;

    for (let i = 0; i < numBars; i++) {
      const x = i * (barWidth + barSpacing);
      const peak = peaks[i];
      const barHeight = Math.max(2, peak * maxBarHeight);
      const barProgress = i / numBars;

      let color: string;
      if (barProgress <= progress) {
        const t = barProgress;
        if (t < 0.33) color = `rgba(167, 139, 250, ${0.7 + peak * 0.3})`;
        else if (t < 0.66) color = `rgba(96, 165, 250, ${0.7 + peak * 0.3})`;
        else color = `rgba(244, 114, 182, ${0.7 + peak * 0.3})`;
      } else {
        color = `rgba(100, 100, 180, ${0.2 + peak * 0.3})`;
      }

      ctx.fillStyle = color;
      const halfHeight = barHeight / 2;
      const radius = Math.min(barWidth / 2, 1.5);

      roundedRect(ctx, x, centerY - halfHeight, barWidth, halfHeight, radius);
      ctx.fill();
      roundedRect(ctx, x, centerY, barWidth, halfHeight, radius);
      ctx.fill();

      if (barProgress <= progress && peak > 0.5) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = color;
        roundedRect(ctx, x - 1, centerY - halfHeight - 1, barWidth + 2, halfHeight + 2, radius + 1);
        ctx.fill();
        roundedRect(ctx, x - 1, centerY - 1, barWidth + 2, halfHeight + 2, radius + 1);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    const lineGrad = ctx.createLinearGradient(0, centerY, width, centerY);
    lineGrad.addColorStop(0, 'rgba(139, 92, 246, 0)');
    lineGrad.addColorStop(0.5, 'rgba(139, 92, 246, 0.3)');
    lineGrad.addColorStop(1, 'rgba(139, 92, 246, 0)');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    if (progress > 0 && progress < 1) {
      const progressX = progress * width;
      const glowGrad = ctx.createRadialGradient(progressX, centerY, 0, progressX, centerY, 20);
      glowGrad.addColorStop(0, 'rgba(167, 139, 250, 0.6)');
      glowGrad.addColorStop(0.5, 'rgba(167, 139, 250, 0.2)');
      glowGrad.addColorStop(1, 'rgba(167, 139, 250, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(progressX - 20, 0, 40, height);

      const lineGradient = ctx.createLinearGradient(progressX, 0, progressX, height);
      lineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      lineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
      lineGradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
      ctx.strokeStyle = lineGradient;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(progressX, 0);
      ctx.lineTo(progressX, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#a78bfa';
      ctx.shadowBlur = 15;
      ctx.arc(progressX, centerY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = 'rgba(167, 139, 250, 0.5)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    const markerCount = 5;
    for (let i = 0; i <= markerCount; i++) {
      const markerX = (i / markerCount) * width;
      const markerTime = (i / markerCount) * dur;
      ctx.fillText(formatTimeShort(markerTime), markerX + 3, height - 5);
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(markerX, height - 16);
      ctx.lineTo(markerX, height - 12);
      ctx.stroke();
    }

    ctx.restore();
  }, []);

  useEffect(() => {
    const animate = () => {
      drawWaveform();
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [drawWaveform]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleTimeUpdate = () => {
      const t = audio.currentTime;
      setCurrentTime(t);
      onTimeUpdate(t);
      
      // Stop at segment end
      if (segmentEndRef.current !== null && t >= segmentEndRef.current) {
        audio.pause();
        segmentEndRef.current = null;
        onPlayPause(false);
      }
    };
    
    const handleLoadedMetadata = () => { if (!waveformPeaks.length) setDuration(audio.duration); };
    const handleEnded = () => { onPlayPause(false); segmentEndRef.current = null; };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onTimeUpdate, onPlayPause, waveformPeaks.length]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    segmentEndRef.current = null;
    if (audio.paused) { audio.play(); onPlayPause(true); }
    else { audio.pause(); onPlayPause(false); }
  };

  const handleSeek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || !duration) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    audio.currentTime = (x / rect.width) * duration;
    segmentEndRef.current = null;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) audioRef.current.volume = vol;
  };

  return (
    <div className="glass rounded-2xl p-4 shadow-lg">
      <audio ref={audioRef} src={audioUrl || undefined} preload="auto" />
      
      {/* Compact waveform */}
      <canvas ref={canvasRef} className="w-full h-12 rounded-lg cursor-pointer mb-3" style={{ display: 'block' }} onClick={handleSeek} />
      
      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Play controls */}
        <div className="flex items-center gap-1">
          <button onClick={() => { if (audioRef.current) { audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5); segmentEndRef.current = null; } }} className="text-purple-300/60 hover:text-purple-200 transition-colors p-1.5 rounded-lg hover:bg-white/5" title="Назад 5 сек">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.5 3C17.15 3 21.08 6.03 22.47 10.22L20.1 11C19.05 7.81 16.04 5.5 12.5 5.5C10.54 5.5 8.77 6.22 7.38 7.38L10 10H3V3L5.6 5.6C7.45 4 9.85 3 12.5 3M10 12H18V14H10V12M10 16H15V18H10V16Z"/></svg>
          </button>
          <button onClick={togglePlay} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cosmic-btn ${isSyncing ? 'animate-pulse-cosmic' : ''}`}>
            {isPlaying ? <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg> : <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
          </button>
          <button onClick={() => { if (audioRef.current) { audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 5); segmentEndRef.current = null; } }} className="text-purple-300/60 hover:text-purple-200 transition-colors p-1.5 rounded-lg hover:bg-white/5" title="Вперёд 5 сек">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.5 3C6.85 3 2.92 6.03 1.53 10.22L3.9 11C4.95 7.81 7.96 5.5 11.5 5.5C13.46 5.5 15.23 6.22 16.62 7.38L14 10H21V3L18.4 5.6C16.55 4 14.15 3 11.5 3M14 12H6V14H14V12M14 16H9V18H14V16Z"/></svg>
          </button>
        </div>
        
        {/* Center: Time */}
        <div className="text-xs text-purple-200/60 font-mono">{formatTimeShort(currentTime)} / {formatTimeShort(duration)}</div>
        
        {/* Right: Speed and Volume */}
        <div className="flex items-center gap-2">
          <button onClick={() => { const speeds = [0.5, 0.75, 1, 1.25, 1.5]; const idx = (speeds.indexOf(playbackRate) + 1) % speeds.length; setPlaybackRate(speeds[idx]); if (audioRef.current) audioRef.current.playbackRate = speeds[idx]; }} className="px-2 py-0.5 hover-overlay border border-purple-500/20 rounded text-xs text-purple-200/70 hover:border-purple-500/40 transition-colors font-mono" title="Скорость">
            {playbackRate}x
          </button>
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-purple-300/50" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange} className="w-16 h-0.5" />
          </div>
        </div>
      </div>
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';
export default AudioPlayer;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  if (r < 0) r = 0;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
