import { useState, useRef, useCallback, useEffect } from 'react';
import { LyricLine, TrackInfo, AppMode } from './types';
import { generateTTML, generateLRC, generateSRT, downloadFile, formatTime, generateId, shiftLineTime, shiftAllTimes, parseTimeToSeconds } from './utils';
import { importLyricsFile } from './importUtils';
import AudioPlayer, { AudioPlayerHandle } from './AudioPlayer';
import StarField from './StarField';
import HelpModal from './HelpModal';
import LyricsPreview from './LyricsPreview';
import Login from './Login';
import { supabase } from './supabaseClient';
import { useUndoRedo } from './useUndoRedo';
import { useLanguage } from './contexts';
import { languageNames, Language } from './i18n';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Line Component for drag-and-drop
function SortableLine({ line, index, onUpdate, onDelete, isFiltered, searchQuery }: {
  line: LyricLine;
  index: number;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  isFiltered: boolean;
  searchQuery: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: line.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 px-5 py-3 border-b transition-colors group" {...attributes}>
      <div {...listeners} className="cursor-grab active:cursor-grabbing p-1 rounded hover-overlay" style={{ color: 'var(--text-faint)' }}>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 15h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V9H3v2zm4 4h2v-2H7v2zm0 4h2v-2H7v2zm0-8h2V9H7v2zm4-4v2h10V9H11zm0 8h10v-2H11v2zm0 4h10v-2H11v2z"/></svg>
      </div>
      <span className="text-xs w-8 text-right font-mono" style={{ color: 'var(--text-faint)' }}>{index + 1}</span>
      {line.startTime !== null && (
        <span className="text-xs font-mono px-2 py-0.5 rounded-md" style={{ color: 'var(--text-secondary)', background: 'var(--bg-active)', border: '1px solid var(--border-primary)' }}>{formatTime(line.startTime)}</span>
      )}
      <input
        type="text"
        value={line.text}
        onChange={e => onUpdate(line.id, e.target.value)}
        placeholder={`Line ${index + 1}...`}
        className="flex-1 bg-transparent border-none text-sm focus:outline-none"
        style={{ color: 'var(--text-primary)' }}
      />
      <button onClick={() => onDelete(line.id)} className="opacity-0 group-hover:opacity-100 transition-all p-1 rounded" style={{ color: 'var(--text-faint)' }}>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
    </div>
  );
}

export default function App() {
  const { language, setLanguage, t } = useLanguage();
  
  const [mode, setMode] = useState<AppMode>('edit');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const { 
    state: lines, 
    setState: setLines, 
    undo, 
    redo, 
    canUndo, 
    canRedo,
  } = useUndoRedo<LyricLine[]>([
    { id: generateId(), text: '', startTime: null, endTime: null },
  ]);
  
  const {
    state: trackInfo,
    setState: setTrackInfo,
  } = useUndoRedo<TrackInfo>({ title: '', artist: '', album: '' });
  
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSyncLine, setCurrentSyncLine] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [showImportFile, setShowImportFile] = useState(false);
  const [exportFormat, setExportFormat] = useState<'ttml' | 'lrc' | 'srt'>('ttml');
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [globalShift, setGlobalShift] = useState(0);
  const [showValidationWarning, setShowValidationWarning] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [draftData, setDraftData] = useState<{ lines: LyricLine[]; trackInfo: TrackInfo; timestamp: number } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hasStartedSync, setHasStartedSync] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const syncLineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
  
  const currentTimeRef = useRef(currentTime);
  const currentSyncLineRef = useRef(currentSyncLine);
  const linesRef = useRef(lines);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { currentSyncLineRef.current = currentSyncLine; }, [currentSyncLine]);
  useEffect(() => { linesRef.current = lines; }, [lines]);
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  // Check authentication session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Auto-save to localStorage with timestamp
  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem('ttml-lines', JSON.stringify(lines));
      localStorage.setItem('ttml-trackInfo', JSON.stringify(trackInfo));
      localStorage.setItem('ttml-timestamp', Date.now().toString());
    }, 1000);
    return () => clearTimeout(timeout);
  }, [lines, trackInfo]);

  // Load from localStorage on mount - show restore modal
  useEffect(() => {
    const savedLines = localStorage.getItem('ttml-lines');
    const savedTrackInfo = localStorage.getItem('ttml-trackInfo');
    const savedTimestamp = localStorage.getItem('ttml-timestamp');
    
    if (savedLines && savedTrackInfo) {
      try {
        const parsedLines = JSON.parse(savedLines);
        const parsedTrackInfo = JSON.parse(savedTrackInfo);
        const timestamp = savedTimestamp ? parseInt(savedTimestamp) : Date.now();
        
        // Check if there's meaningful data to restore
        const hasContent = parsedLines.some((l: LyricLine) => l.text.trim() !== '') || 
                          parsedTrackInfo.title || parsedTrackInfo.artist;
        
        if (hasContent) {
          setDraftData({ lines: parsedLines, trackInfo: parsedTrackInfo, timestamp });
          setShowRestoreModal(true);
        }
      } catch (e) {
        console.error('Failed to load saved data:', e);
      }
    }
  }, []);

  const handleRestoreDraft = () => {
    if (draftData) {
      setLines(draftData.lines);
      setTrackInfo(draftData.trackInfo);
    }
    setShowRestoreModal(false);
    setDraftData(null);
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem('ttml-lines');
    localStorage.removeItem('ttml-trackInfo');
    localStorage.removeItem('ttml-timestamp');
    setShowRestoreModal(false);
    setDraftData(null);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(file));
      setAudioFile(file);
    }
  };

  const handleTimeUpdate = useCallback((time: number) => { setCurrentTime(time); }, []);

  const addLine = () => { setLines(prev => [...prev, { id: generateId(), text: '', startTime: null, endTime: null }]); };
  const updateLineText = (id: string, text: string) => { setLines(prev => prev.map(l => l.id === id ? { ...l, text } : l)); };
  const deleteLine = (id: string) => { setLines(prev => prev.length === 1 ? prev : prev.filter(l => l.id !== id)); };

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const handleImport = () => {
    const textLines = importText.split('\n').filter(l => l.trim() !== '');
    const newLines: LyricLine[] = textLines.map(text => ({ id: generateId(), text: text.trim(), startTime: null, endTime: null }));
    if (newLines.length > 0) { setLines(newLines); setCurrentSyncLine(0); }
    setShowImport(false);
    setImportText('');
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const importedLines = await importLyricsFile(file);
      if (importedLines.length > 0) {
        setLines(importedLines);
        setCurrentSyncLine(0);
        setShowImportFile(false);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to import file');
    }
  };

  // Основная функция синхронизации строки
  const doSync = useCallback(() => {
    const currentLine = currentSyncLineRef.current;
    const currentLines = linesRef.current;
    if (currentLine >= currentLines.length) return;
    const line = currentLines[currentLine];
    if (line.text.trim() === '') { setCurrentSyncLine(prev => Math.min(prev + 1, currentLines.length - 1)); return; }
    const time = currentTimeRef.current;
    setLines(prev => prev.map((l, i) => {
      if (i === currentLine) return { ...l, startTime: time };
      if (i === currentLine - 1 && l.startTime !== null) return { ...l, endTime: time };
      return l;
    }));
    let nextLine = currentLine + 1;
    while (nextLine < currentLines.length && currentLines[nextLine].text.trim() === '') nextLine++;
    setCurrentSyncLine(Math.min(nextLine, currentLines.length - 1));
  }, []);

  const syncCurrentLine = useCallback(() => {
    // Если обратный отсчёт уже идёт, игнорируем нажатие
    if (countdown !== null) return;
    
    // Если синхронизация ещё не начиналась, запускаем обратный отсчёт
    if (!hasStartedSync) {
      setCountdown(3);
      return;
    }
    
    doSync();
  }, [hasStartedSync, countdown, doSync]);

  const markLineUnsynced = (index: number) => {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, startTime: null, endTime: null } : l));
  };

  const adjustLineTime = (index: number, delta: number) => {
    setLines(prev => prev.map((l, i) => i === index ? shiftLineTime(l, delta) : l));
  };

  const setLineTime = (index: number, timeStr: string) => {
    const seconds = parseTimeToSeconds(timeStr);
    if (seconds !== null) {
      setLines(prev => prev.map((l, i) => i === index ? { ...l, startTime: seconds } : l));
    }
  };

  const playLineSegment = (index: number) => {
    const line = lines[index];
    if (!line.startTime || !audioPlayerRef.current) return;
    
    const sortedSynced = lines
      .filter(l => l.startTime !== null)
      .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    
    const lineIdx = sortedSynced.findIndex(l => l.id === line.id);
    const endTime = line.endTime || 
      (lineIdx < sortedSynced.length - 1 ? sortedSynced[lineIdx + 1].startTime! : line.startTime + 5);
    
    audioPlayerRef.current.playSegment(line.startTime - 0.5, endTime + 0.5);
  };

  const handlePreviewLineClick = (time: number) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.seekTo(time);
      // Если не играло — запускаем воспроизведение
      if (!isPlaying) {
        audioPlayerRef.current.play();
      }
    }
  };

  const applyGlobalShift = () => {
    if (globalShift !== 0) {
      setLines(prev => shiftAllTimes(prev, globalShift));
      setGlobalShift(0);
    }
  };

  useEffect(() => {
    if (mode !== 'sync') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') { e.preventDefault(); syncCurrentLine(); }
      else if (e.code === 'ArrowDown') { e.preventDefault(); setCurrentSyncLine(prev => Math.min(prev + 1, linesRef.current.length - 1)); }
      else if (e.code === 'ArrowUp') { e.preventDefault(); setCurrentSyncLine(prev => Math.max(prev - 1, 0)); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, syncCurrentLine]);

  useEffect(() => {
    const handleUndoRedo = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleUndoRedo);
    return () => window.removeEventListener('keydown', handleUndoRedo);
  }, [undo, redo]);

  useEffect(() => {
    if (mode === 'sync' && syncLineRefs.current[currentSyncLine]) {
      syncLineRefs.current[currentSyncLine]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentSyncLine, mode]);

  // Обратный отсчёт перед синхронизацией
  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown === 0) {
      setCountdown(null);
      setHasStartedSync(true);
      // Запускаем синхронизацию после отсчёта
      setTimeout(() => {
        syncCurrentLine();
      }, 100);
      return;
    }
    
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [countdown, syncCurrentLine]);

  useEffect(() => { return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }; }, [audioUrl]);

  const handleRemoveAudio = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null); setAudioFile(null);
    setHasStartedSync(false);
    setCountdown(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = () => {
    const base = trackInfo.title || 'lyrics';
    if (exportFormat === 'ttml') {
      downloadFile(generateTTML(lines, trackInfo), `${base}.ttml`, 'application/ttml+xml');
    } else if (exportFormat === 'lrc') {
      downloadFile(generateLRC(lines), `${base}.lrc`, 'text/plain');
    } else {
      downloadFile(generateSRT(lines), `${base}.srt`, 'text/plain');
    }
    setShowExport(false);
  };

  const getExportPreview = () => {
    if (exportFormat === 'ttml') return generateTTML(lines, trackInfo);
    if (exportFormat === 'lrc') return generateLRC(lines);
    return generateSRT(lines);
  };

  const getExportFilename = () => {
    const base = trackInfo.title || 'lyrics';
    return `${base}.${exportFormat}`;
  };

  const syncProgress = lines.filter(l => l.startTime !== null).length;
  const totalLines = lines.filter(l => l.text.trim() !== '').length;
  const unsyncedLines = lines.filter(l => l.text.trim() !== '' && l.startTime === null).length;
  const syncedLines = lines.filter(l => l.startTime !== null).sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

  const filteredLines = searchQuery 
    ? lines.map((line, index) => ({ line, index })).filter(({ line }) => line.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : lines.map((line, index) => ({ line, index }));

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLines((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-purple-300">
        <div className="animate-spin-slow w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="min-h-screen relative" style={{ color: 'var(--text-primary)' }}>
      <StarField />
      <div className="relative z-10">
        <header className="glass-strong sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="w-14 h-14 relative animate-spin-slow">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    {/* Кольца Сатурна */}
                    <ellipse cx="50" cy="50" rx="45" ry="12" fill="none" stroke="url(#ringGradient1)" strokeWidth="3" opacity="0.6"/>
                    <ellipse cx="50" cy="50" rx="40" ry="10" fill="none" stroke="url(#ringGradient2)" strokeWidth="2" opacity="0.4"/>
                    
                    {/* Планета */}
                    <defs>
                      <radialGradient id="planetGradient" cx="40%" cy="40%">
                        <stop offset="0%" stopColor="#c084fc"/>
                        <stop offset="50%" stopColor="#a78bfa"/>
                        <stop offset="100%" stopColor="#7c3aed"/>
                      </radialGradient>
                      <linearGradient id="ringGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f0abfc"/>
                        <stop offset="50%" stopColor="#c084fc"/>
                        <stop offset="100%" stopColor="#a78bfa"/>
                      </linearGradient>
                      <linearGradient id="ringGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#e9d5ff"/>
                        <stop offset="100%" stopColor="#d8b4fe"/>
                      </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="20" fill="url(#planetGradient)"/>
                    
                    {/* Блик */}
                    <circle cx="42" cy="42" r="6" fill="white" opacity="0.3"/>
                  </svg>
                </div>
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 rounded-full blur opacity-30 group-hover:opacity-50 transition-opacity"></div>
              </div>
              <div>
                <h1 className="text-2xl font-black cosmic-text tracking-wider">PLANET MUSIC</h1>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-black/30 backdrop-blur-sm rounded-xl p-1 border border-purple-500/10">
              <button onClick={() => setMode('edit')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'edit' ? 'cosmic-btn text-white shadow-lg' : 'hover-overlay'}`} style={{ color: mode !== 'edit' ? 'var(--text-muted)' : undefined }}>{t.editor}</button>
              <button onClick={() => { setMode('sync'); setHasStartedSync(false); setCountdown(null); }} disabled={!audioUrl} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'sync' ? 'cosmic-btn text-white shadow-lg' : 'hover-overlay'}`} style={{ color: mode !== 'sync' ? 'var(--text-muted)' : undefined }}>{t.sync}</button>
              <button onClick={() => setMode('review')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'review' ? 'cosmic-btn text-white shadow-lg' : 'hover-overlay'}`} style={{ color: mode !== 'review' ? 'var(--text-muted)' : undefined }}>{t.review}</button>
            </div>

            <div className="flex items-center gap-2">
              {/* Help button */}
              <button
                onClick={() => setShowHelp(true)}
                className="p-2 rounded-lg hover-overlay transition-colors"
                title={t.helpButton}
              >
                <svg className="w-5 h-5" style={{ color: 'var(--text-muted)' }} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
                </svg>
              </button>

              {/* Language selector */}
              <select 
                value={language} 
                onChange={e => setLanguage(e.target.value as Language)}
                className="cosmic-input rounded-lg px-2 py-1.5 text-xs"
              >
                {Object.entries(languageNames).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>

              <div className="flex items-center gap-1 bg-black/30 backdrop-blur-sm rounded-xl p-1 border border-purple-500/10">
                <button onClick={undo} disabled={!canUndo} className={`p-2 rounded-lg transition-all hover-overlay ${canUndo ? '' : 'cursor-not-allowed'}`} style={{ color: canUndo ? 'var(--text-secondary)' : 'var(--text-faint)' }} title={t.undo}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
                </button>
                <button onClick={redo} disabled={!canRedo} className={`p-2 rounded-lg transition-all hover-overlay ${canRedo ? '' : 'cursor-not-allowed'}`} style={{ color: canRedo ? 'var(--text-secondary)' : 'var(--text-faint)' }} title={t.redo}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
                </button>
              </div>
              <button onClick={() => setShowExport(true)} className="cosmic-btn px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                {t.download}
              </button>
              
              {/* Logout button */}
              <button 
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg text-sm font-medium text-purple-200/60 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2"
                title="Выйти"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}><span className="text-lg">🪐</span>{t.trackInfo}</h3>
              <div className="space-y-2">
                <input type="text" placeholder={t.trackTitle} value={trackInfo.title} onChange={e => setTrackInfo({ ...trackInfo, title: e.target.value })} className="w-full cosmic-input rounded-xl px-4 py-2.5 text-sm" />
                <input type="text" placeholder={t.artist} value={trackInfo.artist} onChange={e => setTrackInfo({ ...trackInfo, artist: e.target.value })} className="w-full cosmic-input rounded-xl px-4 py-2.5 text-sm" />
                <input type="text" placeholder={t.albumOptional} value={trackInfo.album} onChange={e => setTrackInfo({ ...trackInfo, album: e.target.value })} className="w-full cosmic-input rounded-xl px-4 py-2.5 text-sm" />
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}><span className="text-lg">🎧</span>{t.audioFile}</h3>
              {audioUrl ? (
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{audioFile?.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{audioFile ? `${(audioFile.size / 1024 / 1024).toFixed(2)} MB` : ''}</p>
                  </div>
                  <button onClick={handleRemoveAudio} className="transition-colors p-2 rounded-lg hover-overlay" style={{ color: 'var(--text-muted)' }}>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-24 border border-dashed rounded-xl cursor-pointer transition-all" style={{ borderColor: 'var(--border-primary)' }}>
                  <svg className="w-8 h-8 mb-1" style={{ color: 'var(--text-faint)' }} fill="currentColor" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.loadAudio} ({t.audioFormats})</span>
                  <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {audioUrl && (
            <div className="mb-6">
              <AudioPlayer
                ref={audioPlayerRef}
                audioUrl={audioUrl}
                audioFile={audioFile}
                onTimeUpdate={handleTimeUpdate}
                isSyncing={mode === 'sync'}
                onPlayPause={setIsPlaying}
                isPlaying={isPlaying}
              />
            </div>
          )}

          {mode === 'sync' && (
            <div className="mb-4 glass rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                <div className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-pink-500 transition-all duration-300" style={{ width: `${totalLines > 0 ? (syncProgress / totalLines) * 100 : 0}%` }} />
              </div>
              <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{syncProgress}/{totalLines}</span>
            </div>
          )}

          {(mode === 'sync' || mode === 'review') && syncProgress > 0 && (
            <div className="mb-4 glass rounded-xl p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.globalShift}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setGlobalShift(prev => prev - 0.1)} className="px-2 py-1 rounded text-xs transition-all hover-overlay" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>-0.1s</button>
                  <button onClick={() => setGlobalShift(prev => prev - 0.5)} className="px-2 py-1 rounded text-xs transition-all hover-overlay" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>-0.5s</button>
                  <button onClick={() => setGlobalShift(prev => prev - 1)} className="px-2 py-1 rounded text-xs transition-all hover-overlay" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>-1s</button>
                </div>
                <input type="number" step="0.1" value={globalShift} onChange={e => setGlobalShift(parseFloat(e.target.value) || 0)} className="w-20 cosmic-input rounded-lg px-2 py-1 text-sm text-center font-mono" />
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{t.sec}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setGlobalShift(prev => prev + 0.1)} className="px-2 py-1 rounded text-xs transition-all hover-overlay" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>+0.1s</button>
                  <button onClick={() => setGlobalShift(prev => prev + 0.5)} className="px-2 py-1 rounded text-xs transition-all hover-overlay" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>+0.5s</button>
                  <button onClick={() => setGlobalShift(prev => prev + 1)} className="px-2 py-1 rounded text-xs transition-all hover-overlay" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>+1s</button>
                </div>
                <button onClick={applyGlobalShift} disabled={globalShift === 0} className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${globalShift !== 0 ? 'cosmic-btn text-white' : 'cursor-not-allowed'}`} style={globalShift === 0 ? { background: 'var(--bg-input)', color: 'var(--text-faint)' } : {}}>
                  {t.apply}
                </button>
              </div>
            </div>
          )}

          {mode === 'edit' && (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b flex-wrap gap-2" style={{ borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center gap-2">
                  <button onClick={addLine} className="px-4 py-2 rounded-lg text-sm transition-all hover-overlay" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>{t.addLine}</button>
                  <button onClick={() => setShowImport(true)} className="px-4 py-2 rounded-lg text-sm transition-all hover-overlay" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>{t.pasteText}</button>
                  <button onClick={() => importFileRef.current?.click()} className="px-4 py-2 rounded-lg text-sm transition-all hover-overlay" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>{t.importFile}</button>
                  <input ref={importFileRef} type="file" accept=".lrc,.ttml" onChange={handleFileImport} className="hidden" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="text" placeholder={t.search} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="cosmic-input rounded-lg px-3 py-1.5 text-sm w-40" />
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{lines.length} {t.lines}</span>
                </div>
              </div>

              <div className="max-h-[500px] overflow-y-auto">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={lines.map(l => l.id)} strategy={verticalListSortingStrategy}>
                    {filteredLines.map(({ line, index }) => (
                      <SortableLine
                        key={line.id}
                        line={line}
                        index={index}
                        onUpdate={updateLineText}
                        onDelete={deleteLine}
                        isFiltered={!!searchQuery}
                        searchQuery={searchQuery}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          )}

          {mode === 'sync' && (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-hover)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t.pressSpace.split('Space')[0]}<kbd className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--bg-active)', border: '1px solid var(--border-active)', color: 'var(--text-secondary)' }}>Space</kbd>{t.pressSpace.split('Space')[1]}</span>
                <button onClick={() => setMode('edit')} className="px-3 py-1.5 rounded-lg text-sm transition-all hover-overlay" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>{t.back}</button>
              </div>

              <div className="max-h-[500px] overflow-y-auto p-4">
                {lines.map((line, index) => (
                  <div key={line.id} ref={el => { syncLineRefs.current[index] = el; }} onClick={() => setCurrentSyncLine(index)} className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 cursor-pointer transition-all ${index === currentSyncLine ? 'glow-purple' : ''}`} style={{
                    background: index === currentSyncLine ? 'var(--bg-active)' : line.startTime !== null ? 'var(--bg-hover)' : 'transparent',
                    border: index === currentSyncLine ? '1px solid var(--border-active)' : '1px solid transparent',
                  }}>
                    <span className="text-xs w-6 text-center font-mono" style={{ color: index === currentSyncLine ? 'var(--accent-pink)' : 'var(--text-faint)' }}>{index + 1}</span>

                    {line.startTime !== null ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono px-2 py-0.5 rounded-md" style={{ color: '#93c5fd', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>{formatTime(line.startTime)}</span>
                        <button onClick={(e) => { e.stopPropagation(); adjustLineTime(index, -0.1); }} className="p-1 rounded hover-overlay transition-colors" style={{ color: 'var(--text-faint)' }} title="-0.1s">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); adjustLineTime(index, 0.1); }} className="p-1 rounded hover-overlay transition-colors" style={{ color: 'var(--text-faint)' }} title="+0.1s">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingLine(index); }} className="p-1 rounded hover-overlay transition-colors" style={{ color: 'var(--text-faint)' }} title={t.editTime}>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        </button>
                      </div>
                    ) : index === currentSyncLine ? (
                      <span className="text-xs font-mono px-2 py-0.5 rounded-md animate-pulse" style={{ color: 'var(--text-muted)', background: 'var(--bg-active)', border: '1px solid var(--border-primary)' }}>{t.waiting}</span>
                    ) : (
                      <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>--:--</span>
                    )}

                    <span className="flex-1 text-sm" style={{ color: index === currentSyncLine ? 'var(--text-primary)' : line.startTime !== null ? 'var(--text-secondary)' : 'var(--text-faint)', fontWeight: index === currentSyncLine ? 500 : 400 }}>
                      {line.text || <span className="italic" style={{ color: 'var(--text-faint)' }}>{t.emptyLine}</span>}
                    </span>

                    {line.startTime !== null && (
                      <button onClick={(e) => { e.stopPropagation(); playLineSegment(index); }} className="rounded hover-overlay transition-colors p-1" style={{ color: 'var(--text-faint)' }} title={t.listenLine}>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      </button>
                    )}

                    {line.startTime !== null && (
                      <button onClick={(e) => { e.stopPropagation(); markLineUnsynced(index); }} className="rounded transition-colors p-1" style={{ color: 'var(--text-faint)' }} title={t.resetTime}>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="px-5 py-4 border-t flex justify-center" style={{ borderColor: 'var(--border-primary)' }}>
                <button onClick={syncCurrentLine} className="px-8 py-3 cosmic-btn rounded-xl text-white font-medium flex items-center gap-2">
                  <span className="text-lg">✨</span>{t.syncLine}
                </button>
              </div>
            </div>
          )}

          {mode === 'review' && (
            <LyricsPreview
              lines={lines}
              currentTime={currentTime}
              onLineClick={handlePreviewLineClick}
              isPlaying={isPlaying}
            />
          )}
        </main>
      </div>

      {/* Restore Draft Modal */}
      {showRestoreModal && draftData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-strong rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold cosmic-text mb-4 flex items-center gap-2">
              <span className="text-xl">💾</span>
              {t.restoreDraft}
            </h3>
            <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)' }}>
              <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
                {t.foundDraft}
              </p>
              <div className="space-y-1 text-xs" style={{ color: 'var(--text-faint)' }}>
                {draftData.trackInfo.title && (
                  <p><strong>{t.trackTitle}:</strong> {draftData.trackInfo.title}</p>
                )}
                {draftData.trackInfo.artist && (
                  <p><strong>{t.artist}:</strong> {draftData.trackInfo.artist}</p>
                )}
                <p><strong>{t.lines}:</strong> {draftData.lines.filter(l => l.text.trim() !== '').length}</p>
                <p><strong>{t.synced}:</strong> {draftData.lines.filter(l => l.startTime !== null).length}</p>
                <p><strong>{t.savedAt}:</strong> {new Date(draftData.timestamp).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleDiscardDraft}
                className="flex-1 px-4 py-2 rounded-xl text-sm transition-all hover-overlay"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}
              >
                {t.discard}
              </button>
              <button 
                onClick={handleRestoreDraft}
                className="flex-1 cosmic-btn px-4 py-2 rounded-xl text-sm text-white font-medium"
              >
                {t.restore}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Line Modal */}
      {editingLine !== null && lines[editingLine] && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-strong rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold cosmic-text mb-4 flex items-center gap-2"><span className="text-xl">⏱</span>{t.editTimecode}</h3>
            <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)' }}>
              <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>{t.line} {editingLine + 1}:</p>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{lines[editingLine].text}</p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>{t.currentTime}: <span className="font-mono" style={{ color: '#93c5fd' }}>{formatTime(lines[editingLine].startTime!)}</span></p>
            </div>
            <div className="mb-4">
              <p className="text-xs mb-2" style={{ color: 'var(--text-faint)' }}>{t.quickAdjust}</p>
              <div className="grid grid-cols-4 gap-2">
                {[-1, -0.5, -0.1, 0.1, 0.5, 1, 2, 5].map(delta => (
                  <button key={delta} onClick={() => adjustLineTime(editingLine, delta)} className="px-2 py-1.5 rounded-lg text-xs font-mono transition-all" style={{
                    background: delta < 0 ? 'rgba(236, 72, 153, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                    border: `1px solid ${delta < 0 ? 'rgba(236, 72, 153, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                    color: delta < 0 ? '#f9a8d4' : '#86efac',
                  }}>
                    {delta > 0 ? '+' : ''}{delta}s
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <p className="text-xs mb-2" style={{ color: 'var(--text-faint)' }}>{t.manualInput}</p>
              <div className="flex gap-2">
                <input type="text" placeholder={formatTime(lines[editingLine].startTime!)} className="flex-1 cosmic-input rounded-xl px-4 py-2.5 text-sm font-mono" onKeyDown={e => { if (e.key === 'Enter') { setLineTime(editingLine, (e.target as HTMLInputElement).value); setEditingLine(null); } }} />
                <button onClick={() => setEditingLine(null)} className="px-4 py-2 rounded-xl text-sm transition-all hover-overlay" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>{t.close}</button>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => playLineSegment(editingLine)} className="flex-1 cosmic-btn px-4 py-2 rounded-xl text-sm text-white font-medium flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>{t.listen}
              </button>
              <button onClick={() => { if (audioPlayerRef.current && lines[editingLine].startTime) audioPlayerRef.current.seekTo(lines[editingLine].startTime!); }} className="px-4 py-2 rounded-xl text-sm transition-all hover-overlay" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>{t.goToLine}</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-strong rounded-2xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold cosmic-text mb-4 flex items-center gap-2"><span className="text-xl">📋</span>{t.pasteTextTitle}</h3>
            {syncProgress > 0 && <div className="mb-3 p-3 rounded-lg" style={{ background: 'rgba(236, 72, 153, 0.1)', border: '1px solid rgba(236, 72, 153, 0.3)' }}><p className="text-sm" style={{ color: '#f9a8d4' }}>{t.warningReplace}</p></div>}
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>{t.eachLineInfo}</p>
            <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="..." className="w-full h-64 cosmic-input rounded-xl p-4 text-sm resize-none" autoFocus />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm transition-colors" style={{ color: 'var(--text-muted)' }}>{t.cancel}</button>
              <button onClick={handleImport} className="cosmic-btn px-5 py-2 rounded-xl text-sm text-white font-medium">{t.import}</button>
            </div>
          </div>
        </div>
      )}

      {showExport && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-strong rounded-2xl p-6 w-full max-w-2xl">
            <h3 className="text-lg font-bold cosmic-text mb-4 flex items-center gap-2"><span className="text-xl">🚀</span>{t.exportTitle}</h3>

            {unsyncedLines > 0 && (
              <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                <p className="text-sm font-medium" style={{ color: '#fcd34d' }}>⚠️ {t.exportWarning}</p>
                <p className="text-xs mt-1" style={{ color: '#fde68a' }}>{t.exportWarningDesc} ({unsyncedLines} {t.lines})</p>
              </div>
            )}

            <div className="flex items-center gap-2 mb-4 rounded-xl p-1" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)' }}>
              <button onClick={() => setExportFormat('ttml')} className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${exportFormat === 'ttml' ? 'cosmic-btn text-white shadow-lg' : 'hover-overlay'}`} style={exportFormat !== 'ttml' ? { color: 'var(--text-muted)' } : {}}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>
                {t.ttml} <span className="text-xs opacity-60">{t.apple}</span>
              </button>
              <button onClick={() => setExportFormat('lrc')} className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${exportFormat === 'lrc' ? 'cosmic-btn text-white shadow-lg' : 'hover-overlay'}`} style={exportFormat !== 'lrc' ? { color: 'var(--text-muted)' } : {}}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 5h18v2H3V5zm0 6h12v2H3v-2zm0 6h18v2H3v-2z"/></svg>
                {t.lrc} <span className="text-xs opacity-60">{t.universal}</span>
              </button>
              <button onClick={() => setExportFormat('srt')} className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${exportFormat === 'srt' ? 'cosmic-btn text-white shadow-lg' : 'hover-overlay'}`} style={exportFormat !== 'srt' ? { color: 'var(--text-muted)' } : {}}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z"/></svg>
                {t.srt} <span className="text-xs opacity-60">{t.subtitles}</span>
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)' }}><div className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>{t.timecodes}</div><div className="font-mono text-lg" style={{ color: 'var(--text-primary)' }}>{syncProgress}</div></div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)' }}><div className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>{t.linesCount}</div><div className="font-mono text-lg" style={{ color: 'var(--text-primary)' }}>{lines.filter(l => l.text.trim()).length}</div></div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)' }}><div className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>{t.file}</div><div className="font-mono text-sm truncate" style={{ color: 'var(--text-primary)' }}>{getExportFilename()}</div></div>
            </div>

            <div className="rounded-xl p-3 max-h-48 overflow-y-auto mb-4" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)' }}>
              <pre className="text-xs font-mono whitespace-pre-wrap" style={{ color: 'var(--text-muted)' }}>{getExportPreview().substring(0, 1500)}{getExportPreview().length > 1500 ? '\n...' : ''}</pre>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowExport(false)} className="px-4 py-2 text-sm transition-colors" style={{ color: 'var(--text-muted)' }}>{t.cancel}</button>
              <button onClick={handleExport} disabled={syncProgress === 0} className={`px-5 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${syncProgress === 0 ? 'cursor-not-allowed' : 'cosmic-btn text-white'}`} style={syncProgress === 0 ? { background: 'var(--bg-input)', color: 'var(--text-faint)' } : {}}>
                <span>💾</span> {t.saveFile} .{exportFormat}
              </button>
            </div>
          </div>
        </div>
      )}

      {!audioUrl && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 glass-strong rounded-xl px-6 py-3 z-20">
          <p className="text-sm flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}><span className="text-lg animate-float inline-block">✨</span>{t.hint}</p>
        </div>
      )}

      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {/* Countdown Modal */}
      {countdown !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div 
              className="text-9xl font-black cosmic-text countdown-number"
              key={countdown}
            >
              {countdown > 0 ? countdown : '🎵'}
            </div>
            <p className="text-2xl mt-8" style={{ color: 'var(--text-secondary)' }}>
              {countdown > 0 ? 'Приготовьтесь...' : 'Синхронизация началась!'}
            </p>
          </div>
        </div>
      )}

      <footer className="relative z-10 mt-12 border-t" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 relative animate-spin-slow">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <ellipse cx="50" cy="50" rx="45" ry="12" fill="none" stroke="url(#ringGradient1)" strokeWidth="3" opacity="0.6"/>
                  <ellipse cx="50" cy="50" rx="40" ry="10" fill="none" stroke="url(#ringGradient2)" strokeWidth="2" opacity="0.4"/>
                  <defs>
                    <radialGradient id="planetGradient" cx="40%" cy="40%">
                      <stop offset="0%" stopColor="#c084fc"/>
                      <stop offset="50%" stopColor="#a78bfa"/>
                      <stop offset="100%" stopColor="#7c3aed"/>
                    </radialGradient>
                    <linearGradient id="ringGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f0abfc"/>
                      <stop offset="50%" stopColor="#c084fc"/>
                      <stop offset="100%" stopColor="#a78bfa"/>
                    </linearGradient>
                    <linearGradient id="ringGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#e9d5ff"/>
                      <stop offset="100%" stopColor="#d8b4fe"/>
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="20" fill="url(#planetGradient)"/>
                  <circle cx="42" cy="42" r="6" fill="white" opacity="0.3"/>
                </svg>
              </div>
              <span className="text-lg font-bold cosmic-text tracking-wider">PLANET MUSIC</span>
            </div>
            <div className="cosmic-divider w-full max-w-xs"></div>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{t.copyright}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
