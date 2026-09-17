import { useLanguage } from './contexts';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-strong rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold cosmic-text flex items-center gap-2">
            <span className="text-3xl">📖</span>
            {t.helpTitle}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover-overlay transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Quick Start */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span className="text-xl">🚀</span>
              {t.helpQuickStart}
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <li>{t.helpStep1}</li>
              <li>{t.helpStep2}</li>
              <li>{t.helpStep3}</li>
              <li>{t.helpStep4}</li>
              <li>{t.helpStep5}</li>
            </ol>
          </section>

          {/* Features */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span className="text-xl">✨</span>
              {t.helpFeatures}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="glass rounded-xl p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <span>🎵</span> {t.helpFeatureAudio}
                </h4>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t.helpFeatureAudioDesc}
                </p>
              </div>
              <div className="glass rounded-xl p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <span>⏱️</span> {t.helpFeatureTiming}
                </h4>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t.helpFeatureTimingDesc}
                </p>
              </div>
              <div className="glass rounded-xl p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <span>💾</span> {t.helpFeatureAutoSave}
                </h4>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t.helpFeatureAutoSaveDesc}
                </p>
              </div>
              <div className="glass rounded-xl p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <span>📥</span> {t.helpFeatureImport}
                </h4>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t.helpFeatureImportDesc}
                </p>
              </div>
              <div className="glass rounded-xl p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <span>🎯</span> {t.helpFeatureDragDrop}
                </h4>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t.helpFeatureDragDropDesc}
                </p>
              </div>
              <div className="glass rounded-xl p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <span>🌍</span> {t.helpFeatureLanguages}
                </h4>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t.helpFeatureLanguagesDesc}
                </p>
              </div>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span className="text-xl">⌨️</span>
              {t.helpShortcuts}
            </h3>
            <div className="glass rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--bg-hover)' }}>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{t.helpShortcutKey}</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{t.helpShortcutAction}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t" style={{ borderColor: 'var(--border-primary)' }}>
                    <td className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--accent-purple)' }}>Space</td>
                    <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{t.helpShortcutSync}</td>
                  </tr>
                  <tr className="border-t" style={{ borderColor: 'var(--border-primary)' }}>
                    <td className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--accent-purple)' }}>↑ / ↓</td>
                    <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{t.helpShortcutNavigate}</td>
                  </tr>
                  <tr className="border-t" style={{ borderColor: 'var(--border-primary)' }}>
                    <td className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--accent-purple)' }}>Ctrl+Z</td>
                    <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{t.helpShortcutUndo}</td>
                  </tr>
                  <tr className="border-t" style={{ borderColor: 'var(--border-primary)' }}>
                    <td className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--accent-purple)' }}>Ctrl+Shift+Z</td>
                    <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{t.helpShortcutRedo}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Export Formats */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span className="text-xl">📄</span>
              {t.helpExportFormats}
            </h3>
            <div className="space-y-2">
              <div className="glass rounded-xl p-4">
                <h4 className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>TTML</h4>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t.helpFormatTTML}
                </p>
              </div>
              <div className="glass rounded-xl p-4">
                <h4 className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>LRC</h4>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t.helpFormatLRC}
                </p>
              </div>
              <div className="glass rounded-xl p-4">
                <h4 className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>SRT</h4>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t.helpFormatSRT}
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="cosmic-btn px-6 py-2 rounded-xl text-sm font-medium"
          >
            {t.helpClose}
          </button>
        </div>
      </div>
    </div>
  );
}
