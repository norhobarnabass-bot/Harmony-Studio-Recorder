import { useEffect, useRef, useState, useCallback } from 'react';
import { AudioEngine } from '../audio/AudioEngine.js';

export function useAudioEngine() {
  const engineRef = useRef(null);
  if (!engineRef.current) {
    engineRef.current = new AudioEngine();
  }
  const engine = engineRef.current;

  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot());

  useEffect(() => {
    const unsubscribe = engine.subscribe(setSnapshot);
    return () => {
      unsubscribe();
      engine.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addTrack = useCallback(() => engine.addTrack(), [engine]);
  const removeTrack = useCallback((id) => engine.removeTrack(id), [engine]);
  const renameTrack = useCallback((id, name) => engine.renameTrack(id, name), [engine]);
  const setTrackVolume = useCallback((id, v) => engine.setTrackVolume(id, v), [engine]);
  const setTrackPan = useCallback((id, v) => engine.setTrackPan(id, v), [engine]);
  const toggleMute = useCallback((id) => engine.toggleMute(id), [engine]);
  const toggleSolo = useCallback((id) => engine.toggleSolo(id), [engine]);

  const play = useCallback(() => engine.play(), [engine]);
  const stop = useCallback(() => engine.stop(), [engine]);
  const rewind = useCallback(() => engine.rewind(), [engine]);
  const seek = useCallback((t) => engine.seek(t), [engine]);

  const startRecording = useCallback((trackId) => engine.startRecording(trackId), [engine]);
  const stopRecording = useCallback(() => engine.stopRecording(), [engine]);
  const setMonitorEnabled = useCallback((v) => engine.setMonitorEnabled(v), [engine]);
  const setLatencyOffset = useCallback((v) => engine.setLatencyOffset(v), [engine]);
  const ensureMic = useCallback(() => engine.ensureMic(), [engine]);

  const exportMixdown = useCallback((format) => engine.exportMixdown(format), [engine]);
  const exportTrack = useCallback((id, format) => engine.exportTrack(id, format), [engine]);
  const serializeProject = useCallback(() => engine.serializeProject(), [engine]);
  const loadProject = useCallback((data) => engine.loadProject(data), [engine]);
  const reset = useCallback(() => engine.reset(), [engine]);

  return {
    ...snapshot,
    addTrack,
    removeTrack,
    renameTrack,
    setTrackVolume,
    setTrackPan,
    toggleMute,
    toggleSolo,
    play,
    stop,
    rewind,
    seek,
    startRecording,
    stopRecording,
    setMonitorEnabled,
    setLatencyOffset,
    ensureMic,
    exportMixdown,
    exportTrack,
    serializeProject,
    loadProject,
    reset,
  };
}
