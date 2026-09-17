import { LyricLine, TrackInfo } from './types';

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function formatTimeShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatTimeLRC(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function formatTimeSRT(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

// Parse time string like "00:01:23.456" or "01:23.456" to seconds
export function parseTimeToSeconds(timeStr: string): number | null {
  const trimmed = timeStr.trim();
  
  // Format: HH:MM:SS.mmm
  const hmsMatch = trimmed.match(/^(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})$/);
  if (hmsMatch) {
    const h = parseInt(hmsMatch[1]);
    const m = parseInt(hmsMatch[2]);
    const s = parseInt(hmsMatch[3]);
    const ms = parseInt(hmsMatch[4].padEnd(3, '0'));
    return h * 3600 + m * 60 + s + ms / 1000;
  }

  // Format: MM:SS.mmm
  const msMatch = trimmed.match(/^(\d{1,3}):(\d{2})[.,](\d{1,3})$/);
  if (msMatch) {
    const m = parseInt(msMatch[1]);
    const s = parseInt(msMatch[2]);
    const ms = parseInt(msMatch[3].padEnd(3, '0'));
    return m * 60 + s + ms / 1000;
  }

  // Format: seconds (plain number)
  const secMatch = trimmed.match(/^(\d+)[.,](\d{1,3})$/);
  if (secMatch) {
    const s = parseInt(secMatch[1]);
    const ms = parseInt(secMatch[2].padEnd(3, '0'));
    return s + ms / 1000;
  }

  return null;
}

// Shift a single line's time by delta seconds
export function shiftLineTime(line: LyricLine, delta: number): LyricLine {
  const newStart = line.startTime !== null ? Math.max(0, line.startTime + delta) : null;
  const newEnd = line.endTime !== null ? Math.max(0, line.endTime + delta) : null;
  return { ...line, startTime: newStart, endTime: newEnd };
}

// Shift all lines' times by delta seconds
export function shiftAllTimes(lines: LyricLine[], delta: number): LyricLine[] {
  return lines.map(line => shiftLineTime(line, delta));
}

export function generateLRC(lines: LyricLine[]): string {
  const sortedLines = lines
    .filter(l => l.text.trim() !== '' && l.startTime !== null)
    .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

  const bodyLines = sortedLines.map(line => {
    return `[${formatTimeLRC(line.startTime!)}] ${line.text}`;
  }).join('\n');

  return bodyLines + '\n';
}

export function generateTTML(lines: LyricLine[], trackInfo: TrackInfo): string {
  const sortedLines = lines
    .filter(l => l.text.trim() !== '' && l.startTime !== null)
    .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

  const bodyLines = sortedLines.map((line, index) => {
    const start = formatTime(line.startTime!);
    const end = line.endTime !== null
      ? formatTime(line.endTime)
      : index < sortedLines.length - 1
        ? formatTime(sortedLines[index + 1].startTime!)
        : formatTime(line.startTime! + 5);

    return `\t<p begin="${start}" end="${end}">${escapeXml(line.text)}</p>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:itunes="http://itunes.apple.com/lyric-ttml-extensions" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xml:lang="en-US">
  <head>
    <metadata>
      <ttm:title>${escapeXml(trackInfo.title)}</ttm:title>
    </metadata>
    <ttm:agent xml:id="voice1" type="person">
      <ttm:name type="full">${escapeXml(trackInfo.artist)}</ttm:name>
    </ttm:agent>
  </head>
  <body>
    <div>
${bodyLines}
    </div>
  </body>
</tt>`;
}

export function generateSRT(lines: LyricLine[]): string {
  const sortedLines = lines
    .filter(l => l.text.trim() !== '' && l.startTime !== null)
    .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

  return sortedLines.map((line, index) => {
    const start = formatTimeSRT(line.startTime!);
    const end = line.endTime !== null
      ? formatTimeSRT(line.endTime)
      : index < sortedLines.length - 1
        ? formatTimeSRT(sortedLines[index + 1].startTime!)
        : formatTimeSRT(line.startTime! + 5);
    return `${index + 1}\n${start} --> ${end}\n${line.text}\n`;
  }).join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}
