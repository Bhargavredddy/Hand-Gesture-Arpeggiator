import { Game } from './game.js';
import * as drumManager from './DrumManager.js';
import * as Tone from 'https://esm.sh/tone';
import * as THREE from 'three';

// References to DOM Elements
const terminalConsole = document.getElementById('terminal-console');
const trackingBadge = document.getElementById('tracking-badge');
const hudPrompt = document.getElementById('hud-prompt');

const hand1Status = document.getElementById('hand1-status');
const hand1Pitch = document.getElementById('hand1-pitch');
const hand1Height = document.getElementById('hand1-height');
const hand1HeightBar = document.getElementById('hand1-height-bar');
const hand1Volume = document.getElementById('hand1-volume');
const hand1VolumeBar = document.getElementById('hand1-volume-bar');

const hand2Status = document.getElementById('hand2-status');
const hand2Fingers = document.getElementById('hand2-fingers');
const triggerKick = document.getElementById('trigger-kick');
const triggerSnare = document.getElementById('trigger-snare');
const triggerClap = document.getElementById('trigger-clap');
const triggerHihat = document.getElementById('trigger-hihat');

const bpmSlider = document.getElementById('bpm-slider');
const bpmVal = document.getElementById('bpm-val');
const presetBtn = document.getElementById('preset-btn');
const camToggleBtn = document.getElementById('cam-toggle-btn');
const systemTimeEl = document.getElementById('system-time');

// Logger helper
function addLogLine(text, type = 'info') {
    if (!terminalConsole) return;
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    line.innerText = `[${timeStr}] ${text}`;
    terminalConsole.appendChild(line);
    
    // Auto-scroll
    terminalConsole.scrollTop = terminalConsole.scrollHeight;
    
    // Limit console length
    while (terminalConsole.children.length > 50) {
        terminalConsole.removeChild(terminalConsole.firstChild);
    }
}

// Intercept browser console logs to mirror in our UI terminal
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = function(...args) {
    originalLog.apply(console, args);
    const msg = args.join(' ');
    // Filter noise, only log interesting events
    if (msg.includes('loaded') || msg.includes('successfully') || msg.includes('started') || msg.includes('preset') || msg.includes('tracking') || msg.includes('initialized') || msg.includes('Init')) {
        addLogLine(msg, 'info');
    }
};

console.warn = function(...args) {
    originalWarn.apply(console, args);
    addLogLine(`[WARN] ${args.join(' ')}`, 'alert');
};

console.error = function(...args) {
    originalError.apply(console, args);
    addLogLine(`[FATAL] ${args.join(' ')}`, 'alert');
};

// Initialize Game
addLogLine('[SYSTEM] Starting Neural Interface core...', 'info');
const renderDiv = document.getElementById('renderDiv');
const game = new Game(renderDiv);
addLogLine('[SYSTEM] Main WebGL & CV instance created.', 'info');

// Handle Camera view toggle
let cameraVisible = true;
camToggleBtn.addEventListener('click', () => {
    if (!game.videoElement) return;
    cameraVisible = !cameraVisible;
    if (cameraVisible) {
        game.videoElement.className = 'camera-visible';
        camToggleBtn.innerText = 'CAMERA ON';
        camToggleBtn.style.borderColor = 'var(--neon-cyan)';
        addLogLine('[SYSTEM] Camera backdrop overlay enabled.', 'info');
    } else {
        game.videoElement.className = 'camera-hidden';
        camToggleBtn.innerText = 'CAMERA OFF';
        camToggleBtn.style.borderColor = 'var(--text-muted)';
        addLogLine('[SYSTEM] Camera backdrop overlay disabled.', 'info');
    }
});

// Preset cycles
presetBtn.addEventListener('click', () => {
    if (game.musicManager) {
        game.musicManager.cycleSynth();
        const presetIdx = game.musicManager.currentSynthIndex + 1;
        addLogLine(`[SYSTEM] Switched audio engine synthesizer preset to #${presetIdx}.`, 'info');
    }
});

// BPM Controls
bpmSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    bpmVal.innerText = val;
    Tone.Transport.bpm.value = val;
});

// Set initial slider values once audio engine starts
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

// Make sure controls start audio on click
document.querySelectorAll('.interactive').forEach(el => {
    el.addEventListener('click', () => {
        if (game.musicManager && !game.musicManager.isStarted) {
            game.musicManager.start().then(() => {
                addLogLine('[AUDIO] Tone.js synthesizer audio context online.', 'info');
            });
        }
    });
});

// Track states for logging changes
let lastGameState = null;
let lastHand1Tracking = false;
let lastHand2Tracking = false;
let lastActiveDrumsString = '';

// Update System time clock
function updateSystemClock() {
    const now = new Date();
    systemTimeEl.innerText = now.toTimeString().split(' ')[0];
}

// Main HUD update loop
function updateHUD() {
    requestAnimationFrame(updateHUD);
    updateSystemClock();
    
    if (!game) return;

    // Sync tempo if not already done
    syncInitialBPM();

    // 1. Sync Game States
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

    // Default style camera classes if not set
    if (game.videoElement && !game.videoElement.className) {
        game.videoElement.className = 'camera-visible';
    }

    // 2. Hand #1 (Arpeggiator Engine) Telemetry
    const hand1 = game.hands[0];
    const isHand1Tracked = hand1 && hand1.landmarks !== null;
    
    if (isHand1Tracked) {
        if (!lastHand1Tracking) {
            lastHand1Tracking = true;
            addLogLine('[TRACKING] Left hand acquired - Arpeggiator link established.', 'tracking');
        }

        hand1Status.innerText = 'TRACKED';
        hand1Status.style.color = 'var(--neon-green)';

        // Calculate height (middle finger MCP height index)
        const palm = hand1.landmarks[9];
        const heightPct = Math.max(0, Math.min(100, Math.round((1 - palm.y) * 100)));
        hand1Height.innerText = `${heightPct}%`;
        hand1HeightBar.style.width = `${heightPct}%`;

        // Calculate pinch volume
        const thumbTip = hand1.landmarks[4];
        const indexTip = hand1.landmarks[8];
        const dx = thumbTip.x - indexTip.x;
        const dy = thumbTip.y - indexTip.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const velocity = Math.max(0, Math.min(1.0, distance * 5));
        const volumePct = Math.round(velocity * 100);
        hand1Volume.innerText = `${volumePct}%`;
        hand1VolumeBar.style.width = `${volumePct}%`;

        // Get Note Root (C Minor Pentatonic lookup)
        let activeNoteName = 'SILENT';
        if (hand1.isFist) {
            activeNoteName = 'MUTED (FIST)';
            hand1Pitch.style.color = 'var(--neon-purple)';
        } else if (game.musicManager && game.musicManager.activePatterns.has(0)) {
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

    // 3. Hand #2 (Drum Machine Engine) Telemetry
    const hand2 = game.hands[1];
    const isHand2Tracked = hand2 && hand2.landmarks !== null;

    if (isHand2Tracked) {
        if (!lastHand2Tracking) {
            lastHand2Tracking = true;
            addLogLine('[TRACKING] Right hand acquired - Drum machine link established.', 'tracking');
        }

        hand2Status.innerText = 'TRACKED';
        hand2Status.style.color = 'var(--neon-green)';

        // Calculate raised fingers
        const fingertips = { index: 8, middle: 12, ring: 16, pinky: 20 };
        const joints = { index: 6, middle: 10, ring: 14, pinky: 18 };
        let raisedCount = 0;
        for (const [finger, tipIdx] of Object.entries(fingertips)) {
            const jointIdx = joints[finger];
            if (hand2.landmarks[tipIdx] && hand2.landmarks[jointIdx]) {
                if (hand2.landmarks[tipIdx].y < hand2.landmarks[jointIdx].y) {
                    raisedCount++;
                }
            }
        }
        hand2Fingers.innerText = `${raisedCount} / 4`;

        // Update Drum Trigger Indicators from DrumManager
        const activeDrums = drumManager.getActiveDrums();
        
        if (activeDrums.has('kick')) triggerKick.classList.add('active-kick');
        else triggerKick.classList.remove('active-kick');

        if (activeDrums.has('snare')) triggerSnare.classList.add('active-snare');
        else triggerSnare.classList.remove('active-snare');

        if (activeDrums.has('clap')) triggerClap.classList.add('active-clap');
        else triggerClap.classList.remove('active-clap');

        if (activeDrums.has('hihat')) triggerHihat.classList.add('active-hihat');
        else triggerHihat.classList.remove('active-hihat');

        // Log active drum combinations when changed
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
        
        triggerKick.className = 'drum-trigger-box';
        triggerSnare.className = 'drum-trigger-box';
        triggerClap.className = 'drum-trigger-box';
        triggerHihat.className = 'drum-trigger-box';
        lastActiveDrumsString = '';
    }

    // Hide float prompt overlay once tracking is active and working
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

// Start updating HUD
requestAnimationFrame(updateHUD);
