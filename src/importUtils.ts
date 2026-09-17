import { LyricLine } from './types';
import { generateId } from './utils';

// Parse LRC file content
export function parseLRC(content: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{1,3}):(\d{2})[.,](\d{1,3})\]\s*(.*)/g;
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    const ms = parseInt(match[3].padEnd(3, '0'));
    const time = minutes * 60 + seconds + ms / 1000;
    const text = match[4].trim();
    
    if (text) {
      lines.push({
        id: generateId(),
        text,
        startTime: time,
        endTime: null,
      });
    }
  }
  
  return lines;
}

// Parse TTML file content
export function parseTTML(content: string): LyricLine[] {
  const lines: LyricLine[] = [];
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/xml');
    const paragraphs = doc.querySelectorAll('p[begin]');
    
    paragraphs.forEach(p => {
      const begin = p.getAttribute('begin');
      const text = p.textContent?.trim() || '';
      
      if (begin && text) {
        const time = parseTTMLTime(begin);
        if (time !== null) {
          lines.push({
            id: generateId(),
            text,
            startTime: time,
            endTime: null,
          });
        }
      }
    });
  } catch (error) {
    console.error('Failed to parse TTML:', error);
  }
  
  return lines;
}

// Parse TTML time format (HH:MM:SS.mmm or MM:SS.mmm)
function parseTTMLTime(timeStr: string): number | null {
  // HH:MM:SS.mmm
  const hmsMatch = timeStr.match(/^(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})$/);
  if (hmsMatch) {
    const h = parseInt(hmsMatch[1]);
    const m = parseInt(hmsMatch[2]);
    const s = parseInt(hmsMatch[3]);
    const ms = parseInt(hmsMatch[4].padEnd(3, '0'));
    return h * 3600 + m * 60 + s + ms / 1000;
  }
  
  // MM:SS.mmm
  const msMatch = timeStr.match(/^(\d{1,3}):(\d{2})[.,](\d{1,3})$/);
  if (msMatch) {
    const m = parseInt(msMatch[1]);
    const s = parseInt(msMatch[2]);
    const ms = parseInt(msMatch[3].padEnd(3, '0'));
    return m * 60 + s + ms / 1000;
  }
  
  return null;
}

// Read file as text
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// Import file and parse
export async function importLyricsFile(file: File): Promise<LyricLine[]> {
  const content = await readFileAsText(file);
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension === 'lrc') {
    return parseLRC(content);
  } else if (extension === 'ttml') {
    return parseTTML(content);
  }
  
  throw new Error('Unsupported file format. Please use .lrc or .ttml files.');
}
