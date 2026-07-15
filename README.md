# Harmony Studio Recorder

A browser-based multi-track vocal recorder for layering harmonies. Record a take,
play it back while you sing the next layer on top, then mix everything down to a
single WAV or MP3 — all client-side, no server required.

## Features

- **Multi-track recording** — record unlimited vocal layers, each as its own track.
- **Synchronized overdubbing** — while recording a new track, every previous track
  plays back in sync, scheduled against `AudioContext.currentTime` so layers stay
  aligned even with browser audio latency.
- **Latency compensation** — a slider (0–300ms) shifts new recordings earlier on
  the timeline to correct for `MediaRecorder` startup latency.
- **Channel strip per track** — rename, mute, solo, volume, and stereo pan
  (via `GainNode` / `StereoPannerNode`).
- **Waveform visualization** — every recorded track renders a min/max waveform.
- **Click-to-seek timeline** — click the ruler or any track lane to move the
  playhead; recording from that point plays everything before it in sync.
- **Mixdown & export** — sums all unmuted (or soloed) tracks via an
  `OfflineAudioContext` and exports as **WAV** or **MP3** (encoded client-side
  with `lamejs`).
- **Per-track export** — download any individual track as WAV.
- **Project save/load** — saves all tracks (including audio, as base64 WAV) plus
  volume/pan/mute/solo/offset into a single `.json` project file you can reopen
  later.
- **Input monitoring toggle** — optionally hear your mic through the output while
  recording (off by default — use headphones to avoid feedback).

## Project structure

```
harmony-studio/
├── index.html              # Vite entry HTML (loads fonts, mounts #root)
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx             # React root
    ├── App.jsx              # Layout, timeline, transport wiring
    ├── index.css            # Tailwind + console theme styles
    ├── audio/
    │   ├── AudioEngine.js    # Core engine: AudioContext, transport, recording,
    │   │                      mixing, project (de)serialization
    │   ├── wavEncoder.js      # AudioBuffer -> WAV Blob
    │   ├── mp3Encoder.js       # AudioBuffer -> MP3 Blob (lamejs)
    │   ├── waveformPeaks.js   # AudioBuffer -> min/max peaks for drawing
    │   └── download.js        # Trigger a browser file download
    ├── hooks/
    │   └── useAudioEngine.js  # React hook exposing engine state + actions
    └── components/
        ├── TransportBar.jsx   # Record/Play/Stop/Rewind, monitor, latency, time
        ├── TrackRow.jsx        # Channel strip (mute/solo/vol/pan) + waveform clip
        ├── Waveform.jsx        # SVG waveform renderer
        └── ProjectControls.jsx # Save/Load project, Export mix (WAV/MP3)
```

## How synchronization works

`AudioEngine` keeps a single `AudioContext` and a "transport clock": when you press
play or record, it picks a near-future `AudioContext.currentTime` (a small
look-ahead, ~90ms) as the synchronized start point, then schedules every track's
`AudioBufferSourceNode.start()` relative to that same instant — either delayed
(if the track starts later in the timeline) or with a buffer offset (if the
track should already be partway through). This keeps all layers sample-accurate
relative to each other regardless of UI thread jitter.

`MediaRecorder` itself isn't sample-accurate, so the new recording's position on
the timeline is set to `(playhead at record time) - (latency compensation)`. The
default compensation is 80ms; use the **LATENCY COMP.** slider in the transport
bar to tune it for your browser/hardware — record a quick clap-along test and
adjust until your new layer lines up with the previous one.

## Setup & running locally

Requires [Node.js](https://nodejs.org/) 18+.

```bash
cd harmony-studio
npm install
npm run dev
```

Open the printed local URL (e.g. `http://localhost:5173`) in Chrome, Edge, or
Firefox.

> **Microphone access requires a secure context.** `localhost` is treated as
> secure, so the dev server works out of the box. If you deploy this, it must be
> served over **HTTPS**.

### Production build

```bash
npm run build
npm run preview
```

`npm run build` outputs static files to `dist/`, which can be hosted on any static
host (Netlify, Vercel, GitHub Pages with HTTPS, etc.).

## Usage tips

1. Click the red **REC** button — your browser will ask for microphone
   permission the first time.
2. Sing your first take, then press the square **STOP** button (or REC again).
3. Press **REC** again to record a harmony layer — your first track plays back
   automatically while you sing.
4. Use **Add Track** to create an empty track slot, or the per-track **download**
   icon to grab a single layer as WAV.
5. When you're happy, use **Export WAV** or **Export MP3** under the timeline to
   render the final mix of all unmuted/soloed tracks.
6. **Save Project** to download a `.json` file containing every track's audio and
   settings; **Load Project** to restore it later (in this or another browser).

## Notes & known limitations

- Recording format depends on the browser's `MediaRecorder` support (typically
  WebM/Opus in Chrome/Firefox, MP4/AAC in Safari); recordings are decoded to
  `AudioBuffer` immediately after stopping, so playback and mixing are format
  agnostic.
- MP3 encoding runs synchronously on the main thread via `lamejs`; for very long
  sessions (many minutes) this may take a moment — the export buttons show a
  "Rendering…" state while this happens.
- The timeline currently uses a fixed zoom (40px/second). For longer sessions you
  can scroll horizontally; a zoom control would be a natural next addition.
- Project files embed raw WAV audio as base64, so saved projects can become large
  for long sessions — this is intentional to keep everything in one portable file
  with no backend.
