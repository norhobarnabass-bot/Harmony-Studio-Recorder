import React, { useRef, useState } from 'react';
import { Save, FolderOpen, FileAudio, FilePlus2 } from 'lucide-react';
import { downloadBlob } from '../audio/download.js';

export default function ProjectControls({
  onSaveProject,
  onLoadProject,
  onExportMix,
  onNewProject,
  hasTracks,
}) {
  const fileInputRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const project = await onSaveProject();
      const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
      downloadBlob(blob, `harmony-project-${Date.now()}.json`);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      await onLoadProject(data);
    } catch (err) {
      console.error('Failed to load project file', err);
      alert('That file could not be read as a Harmony Studio project.');
    } finally {
      e.target.value = '';
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const blob = await onExportMix(format);
      if (!blob) {
        alert('Add at least one recorded track before exporting a mix.');
        return;
      }
      const ext = format === 'mp3' ? 'mp3' : 'wav';
      downloadBlob(blob, `harmony-mixdown-${Date.now()}.${ext}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={onNewProject}
        className="flex items-center gap-1.5 px-3 py-2 rounded border border-console-line text-muted hover:text-cream hover:border-cream/40 transition-colors text-xs font-display uppercase tracking-wide font-semibold"
        title="Clear all tracks and start fresh"
      >
        <FilePlus2 size={14} />
        New
      </button>

      <button
        onClick={handleSave}
        disabled={!hasTracks || saving}
        className="flex items-center gap-1.5 px-3 py-2 rounded border border-console-line text-cream hover:border-amber hover:text-amber transition-colors text-xs font-display uppercase tracking-wide font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
        title="Save the full project (all tracks + settings) as a file"
      >
        <Save size={14} />
        {saving ? 'Saving…' : 'Save Project'}
      </button>

      <button
        onClick={handleLoadClick}
        className="flex items-center gap-1.5 px-3 py-2 rounded border border-console-line text-cream hover:border-amber hover:text-amber transition-colors text-xs font-display uppercase tracking-wide font-semibold"
        title="Load a previously saved project file"
      >
        <FolderOpen size={14} />
        Load Project
      </button>
      <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileChange} className="hidden" />

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono text-muted uppercase mr-1">Mix Down</span>
        <button
          onClick={() => handleExport('wav')}
          disabled={!hasTracks || exporting}
          className="flex items-center gap-1.5 px-3 py-2 rounded border border-console-line text-cream hover:border-amber hover:text-amber transition-colors text-xs font-display uppercase tracking-wide font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <FileAudio size={14} />
          {exporting ? 'Rendering…' : 'Export WAV'}
        </button>
        <button
          onClick={() => handleExport('mp3')}
          disabled={!hasTracks || exporting}
          className="flex items-center gap-1.5 px-3 py-2 rounded border border-amber text-amber hover:bg-amber/10 transition-colors text-xs font-display uppercase tracking-wide font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <FileAudio size={14} />
          {exporting ? 'Rendering…' : 'Export MP3'}
        </button>
      </div>
    </div>
  );
}
