import React from 'react';
import { Play, Square, Circle, SkipBack, Plus, Headphones, Mic } from 'lucide-react';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export default function TransportBar({
  isPlaying,
  isRecording,
  playheadTime,
  totalDuration,
  monitorEnabled,
  latencyOffsetMs,
  hasMic,
  onPlay,
  onStop,
  onRewind,
  onRecord,
  onAddTrack,
  onMonitorToggle,
  onLatencyChange,
}) {
  return (
    <div className="bg-console-raised border border-console-line rounded-lg p-4 shadow-inset">
      <div className="flex flex-wrap items-center gap-4">
        {/* Transport buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRewind}
            disabled={isRecording}
            className="w-10 h-10 rounded-full flex items-center justify-center border border-console-line text-cream hover:border-amber hover:text-amber transition-colors disabled:opacity-30"
            title="Rewind to start"
          >
            <SkipBack size={16} fill="currentColor" />
          </button>

          {isPlaying || isRecording ? (
            <button
              onClick={onStop}
              className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-cream text-cream bg-console hover:bg-console-panel transition-colors"
              title="Stop"
            >
              <Square size={18} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={onPlay}
              className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-amber text-amber bg-console hover:bg-amber/10 transition-colors"
              title="Play"
            >
              <Play size={18} fill="currentColor" />
            </button>
          )}

          <button
            onClick={onRecord}
            className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${
              isRecording
                ? 'border-rec text-rec bg-rec/10 animate-pulse-rec'
                : 'border-rec/70 text-rec bg-console hover:bg-rec/10'
            }`}
            title={isRecording ? 'Recording…' : 'Record new layer'}
          >
            <Circle size={18} fill="currentColor" />
          </button>
        </div>

        {/* Time display */}
        <div className="flex items-center gap-1 font-mono text-lg bg-console border border-console-line rounded px-3 py-1.5 tabular-nums">
          <span className={isRecording ? 'text-rec' : 'text-amber'}>{formatTime(playheadTime)}</span>
          <span className="text-muted">/</span>
          <span className="text-muted">{formatTime(totalDuration)}</span>
        </div>

        <div className="flex-1" />

        {/* Monitor toggle */}
        <button
          onClick={() => onMonitorToggle(!monitorEnabled)}
          className={`flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono font-semibold transition-colors ${
            monitorEnabled
              ? 'border-amber text-amber bg-amber/10'
              : 'border-console-line text-muted hover:text-cream hover:border-cream/40'
          }`}
          title="Hear your mic input through the speakers/headphones while recording. Use headphones to avoid feedback."
        >
          <Headphones size={14} />
          MONITOR {monitorEnabled ? 'ON' : 'OFF'}
        </button>

        {/* Latency offset */}
        <div className="flex items-center gap-2 px-3 py-2 rounded border border-console-line">
          <Mic size={14} className="text-muted" />
          <label className="text-[10px] font-mono text-muted whitespace-nowrap">LATENCY COMP.</label>
          <input
            type="range"
            min="0"
            max="300"
            step="5"
            value={latencyOffsetMs}
            onChange={(e) => onLatencyChange(parseInt(e.target.value, 10))}
            className="w-24"
          />
          <span className="text-[10px] font-mono text-cream w-12 text-right">{latencyOffsetMs}ms</span>
        </div>

        {/* Add track */}
        <button
          onClick={onAddTrack}
          className="flex items-center gap-1.5 px-3 py-2 rounded border border-console-line text-cream hover:border-amber hover:text-amber transition-colors text-xs font-display uppercase tracking-wide font-semibold"
        >
          <Plus size={14} />
          Add Track
        </button>
      </div>

      {!hasMic && (
        <p className="mt-3 text-[11px] text-muted font-mono">
          Microphone access will be requested the first time you press record.
        </p>
      )}
    </div>
  );
}
