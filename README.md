# Hand Gesture Arpeggiator & Neural HUD Core

An interactive web application that leverages computer vision hand-tracking to control a synthesizer arpeggiator, step sequencer drum machine, and reactive audio visualizer. 

This project incorporates a premium, high-tech **Neural HUD Dashboard** overlay that provides real-time telemetry diagnostics, visual instrument controllers, and an integrated terminal log monitor.

---

## 📂 Repository File Structure

All custom dashboard files are fully additive, leaving the core engine modules intact:

```text
├── index.html            # Original game entry page (classic interface)
├── main.js               # Original entry script
├── game.js               # Core ThreeJS & MediaPipe orchestration engine
├── MusicManager.js       # Tone.js Synth presets, delays, and arpeggios
├── DrumManager.js        # Drum sample playback and 16-step sequence triggers
├── WaveformVisualizer.js # ThreeJS buffer geometry audio waveform visualizer
├── styles.css            # Classic stylesheet
│
├── ai_ui.html            # NEW: Premium Cyberpunk HUD Dashboard (New Entry Page)
├── ai_styles.css         # NEW: Cyberpunk glassmorphism layout, animations & fonts
├── ai_main.js            # NEW: Controller script interfacing the HUD and Game loop
│
├── assets/               # Audio wave assets (.wav) and OG image layouts
└── README.md             # Project documentation (this file)
```

---

## ⚡ How the Neural HUD Works

Our custom interface (`ai_ui.html`) serves as a visual wrapper overlaying the Three.js and MediaPipe rendering viewport (`#renderDiv`), providing high-fidelity controls without altering the original code structure.

### 1. Transparent Layering & Event Passthrough
- **Canvas Positioning**: The Three.js WebGL canvas and webcam video stream are layered in the background (`z-index: 1`) using absolute positioning.
- **Click Propagation**: The HUD elements (`z-index: 10`) use `pointer-events: none` on wrapper containers so that standard drag/click events propagate directly into the 3D scene. Interactive control widgets (buttons, sliders) use `pointer-events: auto` to allow direct mouse operations.

### 2. High-Tech Glassmorphism Diagnostics
- **Left Sidebar (Synth Modules)**: Queries the left-hand position values (`game.hands[0]`). Displays vertical hand height percentage representing pitch scale registers, index-to-thumb pinch distance for envelope volume, and active note name lookups.
- **Right Sidebar (Drums Modules & Console)**: Tracks right-hand finger states (`game.hands[1]`). Computes finger extension status and maps them to Step Sequencer triggers (Kick, Snare, Hi-hat, Clap).
- **Interactive Top Dock**: Binds sliders to Tone.js clock tempo (`Tone.Transport.bpm.value`) and attaches preset event cycle listeners directly to `game.musicManager.cycleSynth()`.

### 3. Native Console Mirroring
- `ai_main.js` overrides standard console outputs (`console.log`, `console.warn`, `console.error`).
- All engine actions (assets loaded, webcam permissions, hand tracking connection events, and synth preset changes) are printed into an styled, scrollable terminal logs card (`#terminal-console`) on the webpage in real-time.

---

## 🚀 Running the Project Locally

Since ES modules and MediaPipe tasks require CORS verification, you must serve the files over an HTTP server.

1. **Serve using `http-server`**:
   ```bash
   npx http-server -p 8080
   ```
2. **Access the HUD Interface**:
   Open your browser and navigate to:
   👉 `http://localhost:8080/ai_ui.html`

---

## 🎮 How to Play

1. **Initiate Core**: Click anywhere on the overlay panel or controls to boot the Tone.js audio engine.
2. **Camera Alignment**: Allow webcam permissions. The gray-scaled mirrored webcam stream will play behind the HUD.
3. **Controls**:
   - **Left Hand (Synth Arpeggio)**: Raise/lower hand in camera view to increase/decrease arpeggiator pitch. Pinch thumb and index finger to raise or lower velocity. Close hand into a fist to cycle synth models.
   - **Right Hand (Drum Machine)**: Raise fingers to activate drum sequencer tracks:
     - **Index**: Kick Drum pattern
     - **Middle**: Snare Drum pattern
     - **Ring**: Hi-hat pattern
     - **Pinky**: Clap pattern
   - **BPM Slider**: Slide to adjust BPM (tempo) in real-time.
   - **Camera Toggle**: Hide/show the camera preview layout behind the HUD.

---

<!-- File Name: README.md - Created: 2026-07-31 -->
