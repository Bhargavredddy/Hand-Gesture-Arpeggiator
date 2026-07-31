/**
 * AI Main Controller Script for the Neural Arpeggiator HUD
 * 
 * This module acts as the orchestration layer between the original Game engine
 * (built with Three.js & MediaPipe) and our newly created glassmorphic HUD dashboard.
 * It polls the tracking states, coordinates, and synthesizer states in real-time,
 * updates the dynamic HTML elements, and intercepts standard console logs to display
 * them in a scrolling cyberpunk terminal simulation.
 */

import { Game } from './game.js';
import * as drumManager from './DrumManager.js';
import * as Tone from 'https://esm.sh/tone';

// ==========================================
// 1. DOM Elements Mapping & Reference Cache
// ==========================================
const terminalConsole = document.getElementById('terminal-console'); // Custom on-screen system terminal logs
const trackingBadge = document.getElementById('tracking-badge');     // Pulse badge showing LOADING/READY/ACTIVE states
const hudPrompt = document.getElementById('hud-prompt');             // Bottom prompt telling user to allow camera or click

// Left Sidebar Telemetry Indicators (Arpeggiator Engine)
const hand1Status = document.getElementById('hand1-status');         // Left hand track state (TRACKED / LOST)
const hand1Pitch = document.getElementById('hand1-pitch');           // Active musical note (e.g. C3, Eb4, MUTED)
const hand1Height = document.getElementById('hand1-height');         // Vertical height percentage string
const hand1HeightBar = document.getElementById('hand1-height-bar');   // Bar visualization representing height
const hand1Volume = document.getElementById('hand1-volume');         // Pinch volume velocity percentage string
const hand1VolumeBar = document.getElementById('hand1-volume-bar');   // Bar visualization representing volume

// Right Sidebar Telemetry Indicators (Drum Machine Engine)
const hand2Status = document.getElementById('hand2-status');         // Right hand track state (TRACKED / LOST)
const hand2Fingers = document.getElementById('hand2-fingers');       // Count of raised fingers (0 to 4)
const triggerKick = document.getElementById('trigger-kick');         // Kick drum highlight block
const triggerSnare = document.getElementById('trigger-snare');       // Snare drum highlight block
const triggerClap = document.getElementById('trigger-clap');         // Clap drum highlight block
const triggerHihat = document.getElementById('trigger-hihat');       // Hi-hat drum highlight block

// Center Dock Interactive Settings Controls
const bpmSlider = document.getElementById('bpm-slider');             // Sequencer tempo input slider
const bpmVal = document.getElementById('bpm-val');                   // BPM numeric readout string
const presetBtn = document.getElementById('preset-btn');             // Preset cyclying toggle button
const camToggleBtn = document.getElementById('cam-toggle-btn');       // Webcam background feed toggle button
const systemTimeEl = document.getElementById('system-time');         // Core clock timestamp in the footer

// ==========================================
// 2. Terminal Console Simulation Engine
// ==========================================
/**
 * Appends a log entry to the custom on-screen console box.
 * Automatically handles formatting, timestamps, auto-scroll,
 * and maintains a maximum length to prevent performance issues.
 */
function addLogLine(text, type = 'info') {
    if (!terminalConsole) return;
    const line = document.createElement('div');
    line.className = `console-line ${type}`; // Applies custom left border colors based on type
    
    // Generate standard ISO-like timestamp
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    line.innerText = `[${timeStr}] ${text}`;
    
    terminalConsole.appendChild(line);
    
    // Push the terminal scroll down to show the latest entries
    terminalConsole.scrollTop = terminalConsole.scrollHeight;
    
    // Clean up older console logs to prevent infinite memory growth
    while (terminalConsole.children.length > 50) {
        terminalConsole.removeChild(terminalConsole.firstChild);
    }
}

// Save references to browser native console loggers
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

/**
 * Override standard console.log to mirror important initialization
 * and status logs inside the webpage console terminal.
 */
console.log = function(...args) {
    originalLog.apply(console, args);
    const msg = args.join(' ');
    // Filter out noise, capturing only model loading and preset cycle updates
    if (msg.includes('loaded') || msg.includes('successfully') || msg.includes('started') || msg.includes('preset') || msg.includes('tracking') || msg.includes('initialized') || msg.includes('Init')) {
        addLogLine(msg, 'info');
    }
};

/**
 * Override standard console.warn to capture warning alerts.
 */
console.warn = function(...args) {
    originalWarn.apply(console, args);
    addLogLine(`[WARN] ${args.join(' ')}`, 'alert');
};

/**
 * Override standard console.error to capture fatal runtime errors.
 */
console.error = function(...args) {
    originalError.apply(console, args);
    addLogLine(`[FATAL] ${args.join(' ')}`, 'alert');
};

// ==========================================
// 3. Core Engine Instantiation
// ==========================================
addLogLine('[SYSTEM] Starting Neural Interface core...', 'info');
const renderDiv = document.getElementById('renderDiv'); // Target wrapper element for the game engine
const game = new Game(renderDiv); // Spin up the Three.js and MediaPipe canvas
addLogLine('[SYSTEM] Main WebGL & CV instance created.', 'info');

// ==========================================
// 4. Interface Event Bindings
// ==========================================

// Handle camera visibility toggle (allows users to play with a clean black screen or grayscale webcam backdrop)
let cameraVisible = true;
camToggleBtn.addEventListener('click', () => {
    if (!game.videoElement) return;
    cameraVisible = !cameraVisible;
    if (cameraVisible) {
        game.videoElement.className = 'camera-visible'; // Grayscale 20% opacity style
        camToggleBtn.innerText = 'CAMERA ON';
        camToggleBtn.style.borderColor = 'var(--neon-cyan)';
        addLogLine('[SYSTEM] Camera backdrop overlay enabled.', 'info');
    } else {
        game.videoElement.className = 'camera-hidden';  // 0% opacity style
        camToggleBtn.innerText = 'CAMERA OFF';
        camToggleBtn.style.borderColor = 'var(--text-muted)';
        addLogLine('[SYSTEM] Camera backdrop overlay disabled.', 'info');
    }
});

// Bind preset button to swap synthesizers via the original MusicManager
presetBtn.addEventListener('click', () => {
    if (game.musicManager) {
        game.musicManager.cycleSynth(); // Disposes current synth and sets up FM Synth or Sawtooth pluck
        const presetIdx = game.musicManager.currentSynthIndex + 1;
        addLogLine(`[SYSTEM] Switched audio engine synthesizer preset to #${presetIdx}.`, 'info');
    }
});

// Sync user sliding events with Tone.js Transport BPM values
bpmSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    bpmVal.innerText = val;
    Tone.Transport.bpm.value = val; // Direct update of Tone.js clock speed
});

// Setup flag to ensure we set the slider position on initial load
let initialBPMSet = false;
function syncInitialBPM() {
    if (Tone.Transport && Tone.Transport.bpm && !initialBPMSet) {
        const currentBpm = Math.round(Tone.Transport.bpm.value);
        if (currentBpm > 0) {
            bpmSlider.value = currentBpm;
            bpmVal.innerText = currentBpm;
            initialBPMSet = true;
            addLogLine(`[SYSTEM] Synthesizer sequencer tempo synced at ${currentBpm} BPM.`, 'info');
        }
    }
}

// Tone.js requires a user interaction/click to run the Web Audio context
document.querySelectorAll('.interactive').forEach(el => {
    el.addEventListener('click', () => {
        if (game.musicManager && !game.musicManager.isStarted) {
            game.musicManager.start().then(() => {
                addLogLine('[AUDIO] Tone.js synthesizer audio context online.', 'info');
            });
        }
    });
});

// Cache state variables to check for changes and avoid redundant DOM writes
let lastGameState = null;
let lastHand1Tracking = false;
let lastHand2Tracking = false;
let lastActiveDrumsString = '';

// Update the system clock displayed in the footer
function updateSystemClock() {
    const now = new Date();
    systemTimeEl.innerText = now.toTimeString().split(' ')[0];
}

// ==========================================
// 5. Main Telemetry Engine & Update Loop
// ==========================================
/**
 * Main loop running at 60fps using requestAnimationFrame.
 * Inspects coordinates, tracking indices, and synth values to write them to HUD telemetry cards.
 */
function updateHUD() {
    requestAnimationFrame(updateHUD);
    updateSystemClock();
    
    if (!game) return;

    // Sync original tempo defaults
    syncInitialBPM();

    // 5a. Process Game Engine State Changes
    if (game.gameState !== lastGameState) {
        lastGameState = game.gameState;
        if (game.gameState === 'loading') {
            trackingBadge.innerHTML = '<span></span> LOADING MODEL';
            trackingBadge.style.color = 'var(--neon-orange)';
            trackingBadge.style.borderColor = 'var(--neon-orange)';
            trackingBadge.style.background = 'rgba(249, 115, 22, 0.1)';
            hudPrompt.innerText = 'SYSTEM INITIALIZING... PLEASE GRANT CAMERA PERMISSION';
        } else if (game.gameState === 'ready') {
            trackingBadge.innerHTML = '<span></span> SYSTEM READY';
            trackingBadge.style.color = 'var(--neon-cyan)';
            trackingBadge.style.borderColor = 'var(--neon-cyan)';
            trackingBadge.style.background = 'rgba(6, 182, 212, 0.1)';
            hudPrompt.innerText = 'READY - CLICK OVERLAY CONTROLS TO INITIALIZE AUDIO ENGINE';
        } else if (game.gameState === 'tracking') {
            trackingBadge.innerHTML = '<span></span> TRACKING ONLINE';
            trackingBadge.style.color = 'var(--neon-green)';
            trackingBadge.style.borderColor = 'var(--neon-green)';
            trackingBadge.style.background = 'rgba(16, 185, 129, 0.1)';
            hudPrompt.innerText = 'TRACKING ONLINE - RAISE HANDS TO GENERATE MUSIC';
        } else if (game.gameState === 'error') {
            trackingBadge.innerHTML = '<span></span> ERROR';
            trackingBadge.style.color = 'var(--neon-red)';
            trackingBadge.style.borderColor = 'var(--neon-red)';
            trackingBadge.style.background = 'rgba(239, 68, 68, 0.1)';
            hudPrompt.innerText = 'FATAL MODEL ERROR - CLICK SCREEN TO REBOOT INTERFACE';
        }
        addLogLine(`[SYSTEM] Interface state changed to: ${game.gameState.toUpperCase()}`, 'info');
    }

    // Force base styling on game video element if loading completes
    if (game.videoElement && !game.videoElement.className) {
        game.videoElement.className = 'camera-visible';
    }

    // 5b. Left Hand (Arpeggiator Engine) Telemetry
    const hand1 = game.hands[0];
    const isHand1Tracked = hand1 && hand1.landmarks !== null; // Non-null landmarks indicate successful tracking
    
    if (isHand1Tracked) {
        if (!lastHand1Tracking) {
            lastHand1Tracking = true;
            addLogLine('[TRACKING] Left hand acquired - Arpeggiator link established.', 'tracking');
        }

        hand1Status.innerText = 'TRACKED';
        hand1Status.style.color = 'var(--neon-green)';

        // Vertical Position parsing: index 9 represents MIDDLE_FINGER_MCP (used as palm center)
        const palm = hand1.landmarks[9];
        // Mirror MediaPipe coordinates (0 represents top, so 1 - palm.y is vertical height)
        const heightPct = Math.max(0, Math.min(100, Math.round((1 - palm.y) * 100)));
        hand1Height.innerText = `${heightPct}%`;
        hand1HeightBar.style.width = `${heightPct}%`;

        // Volume distance calculation: thumb (tip 4) to index finger (tip 8)
        const thumbTip = hand1.landmarks[4];
        const indexTip = hand1.landmarks[8];
        const dx = thumbTip.x - indexTip.x;
        const dy = thumbTip.y - indexTip.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Calculate velocity exactly like the engine (clamped 0 to 1)
        const velocity = Math.max(0, Math.min(1.0, distance * 5));
        const volumePct = Math.round(velocity * 100);
        hand1Volume.innerText = `${volumePct}%`;
        hand1VolumeBar.style.width = `${volumePct}%`;

        // Read active note parameters from MusicManager
        let activeNoteName = 'SILENT';
        if (hand1.isFist) {
            activeNoteName = 'MUTED (FIST)'; // Fist closes/mutes the pattern
            hand1Pitch.style.color = 'var(--neon-purple)';
        } else if (game.musicManager && game.musicManager.activePatterns.has(0)) {
            // Read active note from the arpeggiator pattern Map
            activeNoteName = game.musicManager.activePatterns.get(0).currentRoot || 'SILENT';
            hand1Pitch.style.color = 'var(--neon-cyan)';
        }
        hand1Pitch.innerText = activeNoteName;
    } else {
        if (lastHand1Tracking) {
            lastHand1Tracking = false;
            addLogLine('[TRACKING] Left hand connection lost.', 'alert');
        }
        hand1Status.innerText = 'LOST';
        hand1Status.style.color = 'var(--neon-red)';
        hand1Pitch.innerText = '--';
        hand1Pitch.style.color = 'var(--text-muted)';
        hand1Height.innerText = '0%';
        hand1HeightBar.style.width = '0%';
        hand1Volume.innerText = '0%';
        hand1VolumeBar.style.width = '0%';
    }

    // 5c. Right Hand (Drum Machine Engine) Telemetry
    const hand2 = game.hands[1];
    const isHand2Tracked = hand2 && hand2.landmarks !== null;

    if (isHand2Tracked) {
        if (!lastHand2Tracking) {
            lastHand2Tracking = true;
            addLogLine('[TRACKING] Right hand acquired - Drum machine link established.', 'tracking');
        }

        hand2Status.innerText = 'TRACKED';
        hand2Status.style.color = 'var(--neon-green)';

        // Raised finger count parser (Index [8], Middle [12], Ring [16], Pinky [20])
        const fingertips = { index: 8, middle: 12, ring: 16, pinky: 20 };
        const joints = { index: 6, middle: 10, ring: 14, pinky: 18 }; // Joint below tips used to confirm extensions
        let raisedCount = 0;
        for (const [finger, tipIdx] of Object.entries(fingertips)) {
            const jointIdx = joints[finger];
            if (hand2.landmarks[tipIdx] && hand2.landmarks[jointIdx]) {
                // If tip Y is less than joint Y (tip is higher on the screen), it's raised
                if (hand2.landmarks[tipIdx].y < hand2.landmarks[jointIdx].y) {
                    raisedCount++;
                }
            }
        }
        hand2Fingers.innerText = `${raisedCount} / 4`;

        // Update neon highlight boxes on drum trigger elements
        const activeDrums = drumManager.getActiveDrums();
        
        if (activeDrums.has('kick')) triggerKick.classList.add('active-kick');
        else triggerKick.classList.remove('active-kick');

        if (activeDrums.has('snare')) triggerSnare.classList.add('active-snare');
        else triggerSnare.classList.remove('active-snare');

        if (activeDrums.has('clap')) triggerClap.classList.add('active-clap');
        else triggerClap.classList.remove('active-clap');

        if (activeDrums.has('hihat')) triggerHihat.classList.add('active-hihat');
        else triggerHihat.classList.remove('active-hihat');

        // Capture drum trigger changes and log them to the scrolling console
        const activeDrumsString = Array.from(activeDrums).sort().join(', ');
        if (activeDrumsString !== lastActiveDrumsString) {
            lastActiveDrumsString = activeDrumsString;
            if (activeDrumsString) {
                addLogLine(`[TRACKING] Active drums updated: ${activeDrumsString.toUpperCase()}`, 'tracking');
            } else {
                addLogLine('[TRACKING] Active drums: NONE (all finger triggers off)', 'tracking');
            }
        }
    } else {
        if (lastHand2Tracking) {
            lastHand2Tracking = false;
            addLogLine('[TRACKING] Right hand connection lost.', 'alert');
        }
        hand2Status.innerText = 'LOST';
        hand2Status.style.color = 'var(--neon-red)';
        hand2Fingers.innerText = '0 / 4';
        
        // Remove neon states from trigger selectors
        triggerKick.className = 'drum-trigger-box';
        triggerSnare.className = 'drum-trigger-box';
        triggerClap.className = 'drum-trigger-box';
        triggerHihat.className = 'drum-trigger-box';
        lastActiveDrumsString = '';
    }

    // 5d. Toggle bottom prompt visibility
    // Hide it once at least one hand is actively tracking, show otherwise.
    if (game.gameState === 'tracking' && (isHand1Tracked || isHand2Tracked)) {
        if (hudPrompt.style.display !== 'none') {
            hudPrompt.style.display = 'none';
        }
    } else {
        if (hudPrompt.style.display === 'none') {
            hudPrompt.style.display = 'block';
        }
    }
}

// Start core loop
requestAnimationFrame(updateHUD);

// File Name: ai_main.js - Created: 2026-07-31
