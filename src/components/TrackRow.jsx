import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Headphones, Trash2, Download, Check, Pencil } from 'lucide-react';
import Waveform from './Waveform.jsx';

export default function TrackRow({
  track,
  pixelsPerSecond,
  timelineWidth,
  currentTime,
  isActiveRecording,
  onRename,
  onToggleMute,
  onToggleSolo,
  onVolumeChange,
  onPanChange,
  onDelete,
  onDownload,
  onSeek,
}) {
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(track.name);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitName = () => {
    const trimmed = nameDraft.trim();
    onRename(trimmed || track.name);
    setEditing(false);
  };

  const left = track.offset * pixelsPerSecond;
  const clipWidth = isActiveRecording
    ? Math.max(2, (currentTime - track.offset) * pixelsPerSecond)
    : track.duration * pixelsPerSecond;

  return (
    <div className="flex border-b border-console-line last:border-b-0">
      {/* Channel strip */}
      <div
        className="flex-none w-[230px] bg-console-panel border-r border-console-line p-3 flex flex-col gap-2 sticky left-0 z-20"
        style={{ borderLeft: `4px solid ${track.color}` }}
      >
        <div className="flex items-center gap-2">
          {editing ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                ref={inputRef}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && commitName()}
                className="bg-console text-cream text-sm font-display tracking-wide px-2 py-1 rounded border border-console-line w-full focus:outline-none focus:border-amber"
              />
              <button
                onClick={commitName}
                className="text-amber hover:text-cream transition-colors"
                aria-label="Save track name"
              >
                <Check size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setNameDraft(track.name);
                setEditing(true);
              }}
              className="flex items-center gap-1.5 flex-1 text-left group"
            >
              <span className="font-display text-base tracking-wide uppercase text-cream truncate">
                {track.name}
              </span>
              <Pencil
                size={12}
                className="text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-none"
              />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleMute}
            className={`px-2 py-1 rounded text-xs font-mono font-semibold border transition-colors ${
              track.muted
                ? 'bg-rec/20 border-rec text-rec'
                : 'border-console-line text-muted hover:text-cream hover:border-cream/40'
            }`}
            title="Mute"
          >
            {track.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
          <button
            onClick={onToggleSolo}
            className={`px-2 py-1 rounded text-xs font-mono font-semibold border transition-colors ${
              track.solo
                ? 'bg-amber/20 border-amber text-amber'
                : 'border-console-line text-muted hover:text-cream hover:border-cream/40'
            }`}
            title="Solo"
          >
            <Headphones size={13} />
          </button>
          <div className="flex-1" />
          <button
            onClick={onDownload}
            disabled={!track.hasBuffer}
            className="px-2 py-1 rounded text-xs border border-console-line text-muted hover:text-cream hover:border-cream/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Download track (WAV)"
          >
            <Download size={13} />
          </button>
          <button
            onClick={onDelete}
            className="px-2 py-1 rounded text-xs border border-console-line text-muted hover:text-rec hover:border-rec/60 transition-colors"
            title="Delete track"
          >
            <Trash2 size={13} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted w-6">VOL</span>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.01"
            value={track.volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          />
          <span className="text-[10px] font-mono text-muted w-8 text-right">
            {Math.round(track.volume * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted w-6">PAN</span>
          <input
            type="range"
            className="pan-slider"
            min="-1"
            max="1"
            step="0.01"
            value={track.pan}
            onChange={(e) => onPanChange(parseFloat(e.target.value))}
          />
          <span className="text-[10px] font-mono text-muted w-8 text-right">
            {track.pan === 0 ? 'C' : track.pan > 0 ? `R${Math.round(track.pan * 100)}` : `L${Math.round(-track.pan * 100)}`}
          </span>
        </div>
      </div>

      {/* Waveform timeline */}
      <div
        className="relative flex-none cursor-pointer"
        style={{ height: 88, width: timelineWidth }}
        onClick={onSeek}
      >
        {clipWidth > 0 && (
          <div
            className={`absolute top-2 bottom-2 rounded-sm overflow-hidden ${
              isActiveRecording ? 'bg-rec/15 border border-rec animate-pulse-rec' : 'bg-console-raised border border-console-line'
            }`}
            style={{ left, width: clipWidth, opacity: track.muted ? 0.35 : 1 }}
          >
            {!isActiveRecording && <Waveform peaks={track.peaks} color={track.color} height={84} />}
          </div>
        )}
      </div>
    </div>
  );
}
