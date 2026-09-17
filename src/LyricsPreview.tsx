import { useEffect, useRef, useMemo } from 'react';
import { LyricLine } from './types';

interface LyricsPreviewProps {
  lines: LyricLine[];
  currentTime: number;
  onLineClick: (time: number) => void;
  isPlaying: boolean;
}

export default function LyricsPreview({
  lines,
  currentTime,
  onLineClick,
  isPlaying,
}: LyricsPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const lastActiveIndexRef = useRef(-1);

  // Фильтруем и сортируем ОДИН раз через useMemo
  const syncedLines = useMemo(
    () =>
      lines
        .filter((l): l is LyricLine & { startTime: number } =>
          l.text.trim() !== '' && l.startTime !== null
        )
        .sort((a, b) => a.startTime - b.startTime),
    [lines]
  );

  // Находим активную строку
  const activeIndex = useMemo(() => {
    for (let i = syncedLines.length - 1; i >= 0; i--) {
      if (currentTime >= syncedLines[i].startTime) {
        return i;
      }
    }
    return -1;
  }, [syncedLines, currentTime]);

  // Проверяем, закончилась ли песня (после последней строки)
  const isAfterLastLine = useMemo(() => {
    if (syncedLines.length === 0) return false;
    const lastLine = syncedLines[syncedLines.length - 1];
    return currentTime > lastLine.startTime + 3; // 3 секунды после последней строки
  }, [syncedLines, currentTime]);

  // Автопрокрутка
  useEffect(() => {
    if (
      activeIndex < 0 ||
      activeIndex === lastActiveIndexRef.current ||
      !activeLineRef.current ||
      !containerRef.current
    ) return;

    lastActiveIndexRef.current = activeIndex;

    const container = containerRef.current;
    const activeEl = activeLineRef.current;

    const containerHeight = container.clientHeight;
    const scrollTarget =
      activeEl.offsetTop - containerHeight / 2 + activeEl.clientHeight / 2;

    container.scrollTo({
      top: scrollTarget,
      behavior: 'smooth',
    });
  }, [activeIndex]);

  if (syncedLines.length === 0) {
    return (
      <div className="glass rounded-3xl p-12 text-center">
        <p style={{ color: 'var(--text-secondary)' }}>
          ✨ Синхронизируйте текст, чтобы увидеть предпросмотр
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
          <span className="text-2xl">🎤</span> Предпросмотр
        </h2>
        {isPlaying && (
          <span className="text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-2" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            LIVE
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="relative overflow-y-auto"
        style={{
          maxHeight: '600px',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
        }}
      >
        {/* Верхний отступ */}
        <div style={{ height: '250px' }} />

        {syncedLines.map((line, index) => {
          const isActive = index === activeIndex;
          const distance = Math.abs(index - activeIndex);

          // Фиксированный размер шрифта для всех строк
          const fontSize = '1.5rem';
          
          // Анимация растворения после последней строки
          let opacity = isActive ? 1 : Math.max(0.3, 1 - distance * 0.2);
          if (isAfterLastLine) {
            opacity = Math.max(0, 1 - (currentTime - syncedLines[syncedLines.length - 1].startTime - 3) * 0.3);
          }
          
          const blur = isActive ? 0 : Math.min(1, distance * 0.3);

          return (
            <div
              key={line.id}
              ref={isActive ? activeLineRef : null}
              onClick={() => onLineClick(line.startTime)}
              className="px-6 py-4 rounded-2xl cursor-pointer select-none"
              style={{
                opacity,
                filter: `blur(${blur}px)`,
                transform: isActive ? 'translateX(10px)' : 'translateX(0)',
                transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                transformOrigin: 'left center',
              }}
            >
              <span
                className="block"
                style={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
                  fontSize,
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: '-0.01em',
                  color: isActive ? 'var(--accent-purple)' : 'var(--text-secondary)',
                  textShadow: isActive ? '0 0 30px var(--accent-glow), 0 0 60px var(--accent-glow)' : 'none',
                  lineHeight: 1.4,
                  transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {line.text}
              </span>
            </div>
          );
        })}

        {/* Нижний отступ */}
        <div style={{ height: '250px' }} />
      </div>

      <p
        className="mt-6 pt-4 border-t text-xs text-center"
        style={{
          borderColor: 'var(--glass-border)',
          color: 'var(--text-secondary)',
        }}
      >
        💡 Кликните на строку для перемотки
      </p>
    </div>
  );
}
