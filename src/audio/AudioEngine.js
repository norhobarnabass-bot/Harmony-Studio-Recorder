import { audioBufferToWav } from './wavEncoder.js';
import { audioBufferToMp3 } from './mp3Encoder.js';
import { computePeaks } from './waveformPeaks.js';

export const TRACK_COLORS = [
  '#e0a458', // amber
  '#5fb3a3', // teal
  '#d98a8a', // dusty rose
  '#9bbf8a', // sage
  '#82b6c9', // slate blue
  '#c9a4d4', // lavender
  '#e6c66b', // gold
  '#cf8f5c', // copper
];

const PEAK_BUCKETS = 600;
const LOOKAHEAD = 0.09; // seconds of scheduling lookahead

function pickMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const type of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.tracks = [];
    this.nextTrackNumber = 1;

    this.isPlaying = false;
    this.isRecording = false;
    this.recordingTrackId = null;

    this.transportStartCtxTime = 0;
    this.transportStartOffset = 0;
    this.activeSources = [];

    this.mediaStream = null;
    this.mediaRecorder = null;
    this.recordingChunks = [];

    this.monitorEnabled = false;
    this.monitorNode = null;

    this.latencyOffsetMs = 80; // default compensation for typical mic/recorder startup latency

    this._rafId = null;
    this._listeners = new Set();
  }

  // ---------- Subscription ----------
  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _notify() {
    const snapshot = this.getSnapshot();
    this._listeners.forEach((fn) => fn(snapshot));
  }

  getSnapshot() {
    return {
      tracks: this.tracks.map((t) => ({
        id: t.id,
        name: t.name,
        offset: t.offset,
        duration: t.duration,
        volume: t.volume,
        pan: t.pan,
        muted: t.muted,
        solo: t.solo,
        color: t.color,
        peaks: t.peaks,
        hasBuffer: !!t.buffer,
        isRecording: !!t.isRecording,
      })),
      isPlaying: this.isPlaying,
      isRecording: this.isRecording,
      recordingTrackId: this.recordingTrackId,
      playheadTime: this.getPlayheadTime(),
      totalDuration: this.getTotalDuration(),
      monitorEnabled: this.monitorEnabled,
      latencyOffsetMs: this.latencyOffsetMs,
      hasMic: !!this.mediaStream,
    };
  }

  // ---------- Setup ----------
  async init() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  async ensureMic() {
    await this.init();
    if (this.mediaStream) return this.mediaStream;
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Monitor path: lets the user hear themselves while recording (off by default
    // to avoid feedback - users should wear headphones if enabled).
    const source = this.ctx.createMediaStreamSource(this.mediaStream);
    this.monitorNode = this.ctx.createGain();
    this.monitorNode.gain.value = this.monitorEnabled ? 1 : 0;
    source.connect(this.monitorNode);
    this.monitorNode.connect(this.masterGain);

    this._notify();
    return this.mediaStream;
  }

  setMonitorEnabled(enabled) {
    this.monitorEnabled = enabled;
    if (this.monitorNode) {
      this.monitorNode.gain.value = enabled ? 1 : 0;
    }
    this._notify();
  }

  setLatencyOffset(ms) {
    this.latencyOffsetMs = ms;
    this._notify();
  }

  // ---------- Track management ----------
  addTrack(name) {
    const id = `track-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const color = TRACK_COLORS[this.tracks.length % TRACK_COLORS.length];
    const track = {
      id,
      name: name || `Track ${this.nextTrackNumber++}`,
      buffer: null,
      offset: this.getPlayheadTime(),
      duration: 0,
      volume: 1,
      pan: 0,
      muted: false,
      solo: false,
      color,
      peaks: null,
      isRecording: false,
    };
    this.tracks.push(track);
    this._notify();
    return track.id;
  }

  removeTrack(id) {
    if (this.recordingTrackId === id) return; // can't remove while recording
    this.tracks = this.tracks.filter((t) => t.id !== id);
    this._notify();
  }

  renameTrack(id, name) {
    const t = this.tracks.find((tr) => tr.id === id);
    if (t) {
      t.name = name;
      this._notify();
    }
  }

  setTrackVolume(id, value) {
    const t = this.tracks.find((tr) => tr.id === id);
    if (t) {
      t.volume = value;
      if (t._liveGain) t._liveGain.gain.value = value;
      this._notify();
    }
  }

  setTrackPan(id, value) {
    const t = this.tracks.find((tr) => tr.id === id);
    if (t) {
      t.pan = value;
      if (t._livePan) t._livePan.pan.value = value;
      this._notify();
    }
  }

  toggleMute(id) {
    const t = this.tracks.find((tr) => tr.id === id);
    if (t) {
      t.muted = !t.muted;
      this._notify();
      if (this.isPlaying) this._restartFromCurrent();
    }
  }

  toggleSolo(id) {
    const t = this.tracks.find((tr) => tr.id === id);
    if (t) {
      t.solo = !t.solo;
      this._notify();
      if (this.isPlaying) this._restartFromCurrent();
    }
  }

  _isAudible(track) {
    const anySolo = this.tracks.some((t) => t.solo);
    if (track.muted) return false;
    if (anySolo && !track.solo) return false;
    return true;
  }

  // ---------- Transport / timing ----------
  getPlayheadTime() {
    if (!this.ctx) return this.transportStartOffset;
    if (this.isPlaying) {
      return Math.max(
        0,
        this.transportStartOffset + (this.ctx.currentTime - this.transportStartCtxTime)
      );
    }
    return this.transportStartOffset;
  }

  getTotalDuration() {
    let max = 0;
    for (const t of this.tracks) {
      const end = t.offset + (t.duration || 0);
      if (end > max) max = end;
    }
    return Math.max(max, 20); // minimum 20s view so the timeline isn't empty
  }

  seek(time) {
    if (this.isRecording) return; // no seeking mid-recording
    const clamped = Math.max(0, time);
    if (this.isPlaying) {
      this._stopActiveSources();
      this.transportStartOffset = clamped;
      this._scheduleAllTracks();
    } else {
      this.transportStartOffset = clamped;
    }
    this._notify();
  }

  async play() {
    await this.init();
    if (this.isPlaying) return;
    this._startTransport(this.getPlayheadTime());
  }

  stop() {
    if (this.isRecording) {
      this.stopRecording();
      return;
    }
    const current = this.getPlayheadTime();
    this._stopActiveSources();
    this.isPlaying = false;
    this.transportStartOffset = current;
    this._stopClock();
    this._notify();
  }

  rewind() {
    this.stop();
    this.transportStartOffset = 0;
    this._notify();
  }

  _startTransport(fromOffset) {
    this._stopActiveSources();
    const startAt = this.ctx.currentTime + LOOKAHEAD;
    this.transportStartCtxTime = startAt;
    this.transportStartOffset = fromOffset;
    this.isPlaying = true;
    this._scheduleAllTracks();
    this._startClock();
    this._notify();
  }

  _restartFromCurrent() {
    const current = this.getPlayheadTime();
    this._stopActiveSources();
    this.transportStartOffset = current;
    const startAt = this.ctx.currentTime + LOOKAHEAD;
    this.transportStartCtxTime = startAt;
    this._scheduleAllTracks();
  }

  _scheduleAllTracks() {
    const startAt = this.transportStartCtxTime;
    const fromOffset = this.transportStartOffset;

    for (const track of this.tracks) {
      if (!track.buffer) continue;
      if (track.id === this.recordingTrackId) continue;
      if (!this._isAudible(track)) continue;

      const trackEnd = track.offset + track.buffer.duration;
      if (trackEnd <= fromOffset) continue;

      let when;
      let bufferOffset;
      if (track.offset >= fromOffset) {
        when = startAt + (track.offset - fromOffset);
        bufferOffset = 0;
      } else {
        when = startAt;
        bufferOffset = fromOffset - track.offset;
      }

      const source = this.ctx.createBufferSource();
      source.buffer = track.buffer;
      const gainNode = this.ctx.createGain();
      gainNode.gain.value = track.volume;
      const panNode = this.ctx.createStereoPanner();
      panNode.pan.value = track.pan;

      source.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(this.masterGain);

      track._liveGain = gainNode;
      track._livePan = panNode;

      source.start(Math.max(this.ctx.currentTime, when), bufferOffset);
      this.activeSources.push(source);

      source.onended = () => {
        this.activeSources = this.activeSources.filter((s) => s !== source);
      };
    }
  }

  _stopActiveSources() {
    for (const source of this.activeSources) {
      try {
        source.onended = null;
        source.stop();
      } catch (e) {
        /* already stopped */
      }
    }
    this.activeSources = [];
    for (const t of this.tracks) {
      t._liveGain = null;
      t._livePan = null;
    }
  }

  _startClock() {
    this._stopClock();
    const tick = () => {
      const playhead = this.getPlayheadTime();
      const total = this.getTotalDuration();
      if (this.isPlaying && !this.isRecording && playhead >= total) {
        this.stop();
        this.transportStartOffset = total;
        this._notify();
        return;
      }
      this._notify();
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _stopClock() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  // ---------- Recording ----------
  async startRecording(existingTrackId = null) {
    await this.ensureMic();
    if (this.isRecording) return;

    let track;
    if (existingTrackId) {
      track = this.tracks.find((t) => t.id === existingTrackId);
      if (!track) return;
      track.buffer = null;
      track.duration = 0;
      track.peaks = null;
    } else {
      const id = this.addTrack();
      track = this.tracks.find((t) => t.id === id);
    }

    const recordingStartOffset = this.getPlayheadTime();
    track.offset = Math.max(0, recordingStartOffset - this.latencyOffsetMs / 1000);
    track.isRecording = true;
    this.recordingTrackId = track.id;
    this.isRecording = true;

    // Start playback of all OTHER tracks in sync with recording.
    this._startTransport(recordingStartOffset);

    const mimeType = pickMimeType();
    this.recordingChunks = [];
    this.mediaRecorder = new MediaRecorder(this.mediaStream, mimeType ? { mimeType } : undefined);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.recordingChunks.push(e.data);
    };
    this.mediaRecorder.onstop = async () => {
      await this._finalizeRecording(track.id, mimeType);
    };
    this.mediaRecorder.start();

    this._notify();
  }

  async _finalizeRecording(trackId, mimeType) {
    const track = this.tracks.find((t) => t.id === trackId);
    if (!track) return;
    if (this.recordingChunks.length === 0) {
      track.isRecording = false;
      this.recordingTrackId = null;
      this._notify();
      return;
    }
    const blob = new Blob(this.recordingChunks, { type: mimeType || 'audio/webm' });
    const arrayBuffer = await blob.arrayBuffer();
    try {
      const decoded = await this.ctx.decodeAudioData(arrayBuffer);
      track.buffer = decoded;
      track.duration = decoded.duration;
      track.peaks = computePeaks(decoded, PEAK_BUCKETS);
    } catch (err) {
      console.error('Failed to decode recording', err);
    }
    track.isRecording = false;
    this.recordingTrackId = null;
    this._notify();
  }

  stopRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    const current = this.getPlayheadTime();
    this._stopActiveSources();
    this.isPlaying = false;
    this.transportStartOffset = current;
    this._stopClock();
    this._notify();
  }

  // ---------- Mixdown / export ----------
  async renderMix() {
    const duration = this.getTotalDuration();
    const sampleRate = this.ctx ? this.ctx.sampleRate : 44100;
    const length = Math.max(1, Math.ceil((duration + 1) * sampleRate));
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const offline = new OfflineCtx(2, length, sampleRate);

    const anySolo = this.tracks.some((t) => t.solo);
    let rendered = false;
    for (const track of this.tracks) {
      if (!track.buffer) continue;
      if (track.muted || (anySolo && !track.solo)) continue;
      const source = offline.createBufferSource();
      source.buffer = track.buffer;
      const gain = offline.createGain();
      gain.gain.value = track.volume;
      const pan = offline.createStereoPanner();
      pan.pan.value = track.pan;
      source.connect(gain);
      gain.connect(pan);
      pan.connect(offline.destination);
      source.start(track.offset);
      rendered = true;
    }
    if (!rendered) return null;
    return await offline.startRendering();
  }

  async exportMixdown(format = 'wav') {
    const buffer = await this.renderMix();
    if (!buffer) return null;
    if (format === 'mp3') return audioBufferToMp3(buffer);
    return audioBufferToWav(buffer);
  }

  exportTrack(id, format = 'wav') {
    const track = this.tracks.find((t) => t.id === id);
    if (!track || !track.buffer) return null;
    if (format === 'mp3') return audioBufferToMp3(track.buffer);
    return audioBufferToWav(track.buffer);
  }

  // ---------- Project save / load ----------
  async serializeProject() {
    const tracks = [];
    for (const t of this.tracks) {
      let audio = null;
      if (t.buffer) {
        const wav = audioBufferToWav(t.buffer);
        const arrayBuffer = await wav.arrayBuffer();
        audio = arrayBufferToBase64(arrayBuffer);
      }
      tracks.push({
        id: t.id,
        name: t.name,
        offset: t.offset,
        duration: t.duration,
        volume: t.volume,
        pan: t.pan,
        muted: t.muted,
        solo: t.solo,
        color: t.color,
        audio,
      });
    }
    return {
      version: 1,
      app: 'harmony-studio-recorder',
      savedAt: new Date().toISOString(),
      tracks,
    };
  }

  async loadProject(data) {
    await this.init();
    this.stop();
    const newTracks = [];
    for (const t of data.tracks || []) {
      let buffer = null;
      let peaks = null;
      let duration = t.duration || 0;
      if (t.audio) {
        try {
          const arrayBuffer = base64ToArrayBuffer(t.audio);
          buffer = await this.ctx.decodeAudioData(arrayBuffer);
          duration = buffer.duration;
          peaks = computePeaks(buffer, PEAK_BUCKETS);
        } catch (err) {
          console.error('Failed to decode track audio', err);
        }
      }
      newTracks.push({
        id: t.id || `track-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: t.name || 'Track',
        buffer,
        duration,
        offset: t.offset || 0,
        volume: t.volume ?? 1,
        pan: t.pan ?? 0,
        muted: !!t.muted,
        solo: !!t.solo,
        color: t.color || TRACK_COLORS[newTracks.length % TRACK_COLORS.length],
        peaks,
        isRecording: false,
      });
    }
    this.tracks = newTracks;
    this.nextTrackNumber = this.tracks.length + 1;
    this.transportStartOffset = 0;
    this._notify();
  }

  reset() {
    this.stop();
    this.tracks = [];
    this.nextTrackNumber = 1;
    this.transportStartOffset = 0;
    this._notify();
  }

  destroy() {
    this._stopClock();
    this._stopActiveSources();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
    }
    if (this.ctx) {
      this.ctx.close();
    }
  }
}
