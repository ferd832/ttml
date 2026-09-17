export interface LyricLine {
  id: string;
  text: string;
  startTime: number | null; // in seconds
  endTime: number | null;   // in seconds
}

export interface TrackInfo {
  title: string;
  artist: string;
  album: string;
}

export type AppMode = 'edit' | 'sync' | 'review';
