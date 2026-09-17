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

  // 1. Фильтруем и сортируем ОДИН раз через useMemo
  const syncedLines = useMemo(
    () =>
      lines
        .filter((l): l is LyricLine & { startTime: number } =>
          l.text.trim() !== '' && l.startTime !== null
        )
        .sort((a, b) => a.startTime - b.startTime),
    [lines]
  );

  // 2. Находим активную строку по syncedLines (не по lines!)
  const activeIndex = useMemo(() => {
    for (let i = syncedLines.length - 1; i >= 0; i--) {
      if (currentTime >= syncedLines[i].startTime) {
        return i;
      }
    }
    return -1;
  }, [syncedLines, currentTime]);

  // 3. Автопрокрутка — плавная прокрутка всегда
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
      behavior: 'smooth', // Всегда плавная прокрутка
    });
  }, [activeIndex]);

  // 4. Проверяем, закончилось ли воспроизведение (после последней строки)
  const lastLineTime = syncedLines.length > 0 
    ? syncedLines[syncedLines.length - 1].startTime 
    : 0;
  const isAfterLastLine = activeIndex === syncedLines.length - 1 && currentTime > lastLineTime + 3;

  if (syncedLines.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <p style={{ color: 'var(--text-secondary)' }}>
          ✨ Синхронизируйте текст, чтобы увидеть предпросмотр
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          🎤 Предпросмотр
        </h2>
        {isPlaying && (
          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }}>
            ● LIVE
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="relative overflow-y-auto"
        style={{
          maxHeight: '500px',
          // Градиентное затухание сверху и снизу (как в Apple Music)
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
        }}
      >
        {/* Верхний отступ — чтобы первая строка могла быть по центру */}
        <div style={{ height: '200px' }} />

        {syncedLines.map((line, index) => {
          const isActive = index === activeIndex;
          const distance = Math.abs(index - activeIndex);

          // Плавное затухание: чем дальше от активной, тем прозрачнее
          // Если после последней строки - затухаем всё
          let opacity = isActive ? 1 : Math.max(0.3, 1 - distance * 0.2);
          if (isAfterLastLine) {
            opacity = Math.max(0, 1 - (currentTime - lastLineTime - 3) * 0.3);
          }
          
          // Минимальный scale для плавности
          const scale = isActive ? 1.02 : 1;
          const blur = isActive ? 0 : Math.min(1, distance * 0.3);

          return (
            <div
              key={line.id}
              ref={isActive ? activeLineRef : null}
              onClick={() => onLineClick(line.startTime)}
              className="px-4 py-3 rounded-xl cursor-pointer select-none"
              style={{
                opacity,
                transform: `scale(${scale})`,
                filter: `blur(${blur}px)`,
                transition: 'all 0.6s cubic-bezier(0.25, 0.1, 0.25, 1)',
                transformOrigin: 'left center',
              }}
            >
              <span
                className="block"
                style={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
                  fontSize: isActive ? '1.5rem' : '1.2rem',
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: isActive ? '-0.01em' : '0',
                  color: isActive
                    ? 'var(--accent-purple)'
                    : 'var(--text-secondary)',
                  textShadow: isActive
                    ? '0 0 20px var(--accent-glow)'
                    : 'none',
                  transition: 'all 0.6s cubic-bezier(0.25, 0.1, 0.25, 1)',
                  lineHeight: 1.4,
                }}
              >
                {line.text}
              </span>
            </div>
          );
        })}

        {/* Нижний отступ — чтобы последняя строка могла быть по центру */}
        <div style={{ height: '200px' }} />
      </div>

      <p
        className="mt-4 pt-3 border-t text-xs text-center"
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
