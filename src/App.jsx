import React, { useRef, useState } from 'react';
import { Mic2 } from 'lucide-react';
import { useAudioEngine } from './hooks/useAudioEngine.js';
import TransportBar from './components/TransportBar.jsx';
import TrackRow from './components/TrackRow.jsx';
import ProjectControls from './components/ProjectControls.jsx';
import { downloadBlob } from './audio/download.js';

const PIXELS_PER_SECOND = 40;
const CHANNEL_STRIP_WIDTH = 230;

function formatRulerTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function App() {
  const engine = useAudioEngine();
  const timelineRef = useRef(null);
  const [micError, setMicError] = useState(null);

  const timelineWidth = Math.max(400, engine.totalDuration * PIXELS_PER_SECOND);

  const handleRecord = async () => {
    setMicError(null);
    if (engine.isRecording) {
      engine.stopRecording();
      return;
    }
    try {
      await engine.startRecording();
    } catch (err) {
      console.error(err);
      setMicError(
        'Microphone access was denied or unavailable. Allow microphone permissions and try again.'
      );
    }
  };

  const handleSeekFromEvent = (e) => {
    if (engine.isRecording) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, x / PIXELS_PER_SECOND);
    engine.seek(time);
  };

  const ruler = [];
  for (let t = 0; t <= engine.totalDuration; t += 5) {
    ruler.push(t);
  }

  const playheadLeft = CHANNEL_STRIP_WIDTH + engine.playheadTime * PIXELS_PER_SECOND;

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12">
      <div className="max-w-6xl mx-auto flex flex-col gap-5">
        {/* Header */}
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-full border-2 border-amber flex items-center justify-center text-amber ${
                engine.isPlaying ? 'animate-spin' : ''
              }`}
              style={{ animationDuration: '3s' }}
            >
              <Mic2 size={20} />
            </div>
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-wide uppercase leading-none">
                Harmony Studio <span className="text-amber">Recorder</span>
              </h1>
              <p className="text-muted text-xs font-mono tracking-wide mt-1">
                Layer takes. Build harmonies. Mix it down.
              </p>
            </div>
          </div>
        </header>

        {/* Transport */}
        <TransportBar
          isPlaying={engine.isPlaying}
          isRecording={engine.isRecording}
          playheadTime={engine.playheadTime}
          totalDuration={engine.totalDuration}
          monitorEnabled={engine.monitorEnabled}
          latencyOffsetMs={engine.latencyOffsetMs}
          hasMic={engine.hasMic}
          onPlay={engine.play}
          onStop={engine.stop}
          onRewind={engine.rewind}
          onRecord={handleRecord}
          onAddTrack={engine.addTrack}
          onMonitorToggle={engine.setMonitorEnabled}
          onLatencyChange={engine.setLatencyOffset}
        />

        {micError && (
          <div className="bg-rec/10 border border-rec text-rec text-sm font-mono px-3 py-2 rounded">
            {micError}
          </div>
        )}

        {/* Project controls */}
        <ProjectControls
          hasTracks={engine.tracks.some((t) => t.hasBuffer)}
          onSaveProject={engine.serializeProject}
          onLoadProject={engine.loadProject}
          onExportMix={engine.exportMixdown}
          onNewProject={() => {
            if (window.confirm('Start a new project? Unsaved tracks will be lost.')) {
              engine.reset();
            }
          }}
        />

        {/* Timeline */}
        <div className="bg-console-raised border border-console-line rounded-lg overflow-hidden">
          {engine.tracks.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-display text-xl uppercase tracking-wide text-cream mb-2">
                The console is quiet
              </p>
              <p className="text-muted text-sm font-mono max-w-md mx-auto">
                Press the red REC button to lay down your first take, or add an empty track to
                arrange around. Each new layer plays back the ones before it, so you can build
                harmonies on top of yourself.
              </p>
            </div>
          ) : (
            <div ref={timelineRef} className="overflow-x-auto relative">
              <div style={{ minWidth: CHANNEL_STRIP_WIDTH + timelineWidth, position: 'relative' }}>
                {/* Ruler */}
                <div className="flex sticky top-0 z-30 bg-console-raised border-b border-console-line">
                  <div
                    className="flex-none bg-console-panel border-r border-console-line sticky left-0 z-30"
                    style={{ width: CHANNEL_STRIP_WIDTH }}
                  />
                  <div
                    className="relative flex-none h-7 cursor-pointer"
                    style={{ width: timelineWidth }}
                    onClick={handleSeekFromEvent}
                  >
                    {ruler.map((t) => (
                      <div
                        key={t}
                        className="absolute top-0 h-full border-l border-console-line text-[10px] font-mono text-muted pl-1 pt-0.5"
                        style={{ left: t * PIXELS_PER_SECOND }}
                      >
                        {formatRulerTime(t)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Track rows */}
                {engine.tracks.map((track) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    pixelsPerSecond={PIXELS_PER_SECOND}
                    timelineWidth={timelineWidth}
                    currentTime={engine.playheadTime}
                    isActiveRecording={track.id === engine.recordingTrackId}
                    onRename={(name) => engine.renameTrack(track.id, name)}
                    onToggleMute={() => engine.toggleMute(track.id)}
                    onToggleSolo={() => engine.toggleSolo(track.id)}
                    onVolumeChange={(v) => engine.setTrackVolume(track.id, v)}
                    onPanChange={(p) => engine.setTrackPan(track.id, p)}
                    onDelete={() => {
                      if (track.isRecording) return;
                      engine.removeTrack(track.id);
                    }}
                    onDownload={() => {
                      const blob = engine.exportTrack(track.id, 'wav');
                      if (blob) downloadBlob(blob, `${track.name.replace(/\s+/g, '-')}.wav`);
                    }}
                    onSeek={handleSeekFromEvent}
                  />
                ))}

                {/* Playhead */}
                <div
                  className="absolute top-7 bottom-0 w-px bg-amber z-10 pointer-events-none"
                  style={{ left: playheadLeft }}
                />
              </div>
            </div>
          )}
        </div>

        <footer className="text-center text-[11px] text-muted font-mono pb-4">
          Tip: click the ruler or timeline to move the playhead. Recording starts playback of
          existing layers from that point.
        </footer>
      </div>
    </div>
  );
}
