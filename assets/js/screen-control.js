/**
 * screen-control.js
 * Handles screen protection (black screen) and brightness scheduling.
 */

(function () {
    let settings = {
        activeHours: { enabled: false, start: "08:00", end: "22:00" },
        brightness: { enabled: false, start: "20:00", end: "06:00", level: 50 }
    };

    let isSleeping = false;
    let wakeOverride = false;
    let wakeTimeout = null;

    // Create overlays on load
    document.addEventListener('DOMContentLoaded', () => {
        createOverlays();
        loadSettings();
        // Check every minute
        setInterval(checkSchedule, 60000);
        // Initial check
        setTimeout(checkSchedule, 1000);
    });

    function createOverlays() {
        // 1. Sleep Overlay (Black Screen)
        const sleepOverlay = document.createElement('div');
        sleepOverlay.id = 'sleep-overlay';
        Object.assign(sleepOverlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            backgroundColor: 'black', zIndex: '9999', display: 'none',
            justifyContent: 'center', alignItems: 'center', flexDirection: 'column',
            color: '#333', fontFamily: 'sans-serif'
        });

        // "Touch to wake" button/text
        const wakeBtn = document.createElement('button');
        wakeBtn.textContent = "Tap to Wake Screen";
        Object.assign(wakeBtn.style, {
            padding: '15px 30px', fontSize: '1.2rem', background: 'transparent',
            border: '2px solid #333', color: '#555', borderRadius: '50px', cursor: 'pointer'
        });

        wakeBtn.onclick = () => {
            wakeUpTemporarily();
        };

        sleepOverlay.appendChild(wakeBtn);
        document.body.appendChild(sleepOverlay);

        // 2. Brightness Overlay (Pointer-events none)
        const brightnessOverlay = document.createElement('div');
        brightnessOverlay.id = 'brightness-overlay';
        Object.assign(brightnessOverlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            backgroundColor: 'black', zIndex: '9998', pointerEvents: 'none',
            opacity: '0', transition: 'opacity 1s ease'
        });
        document.body.appendChild(brightnessOverlay);
    }

    async function loadSettings() {
        try {
            const r = await fetch('content/settings.json');
            if (r.ok) {
                settings = await r.json();
                console.log("Screen settings loaded:", settings);
                checkSchedule();
            }
        } catch (e) {
            console.log("No settings.json found or parse error. Using defaults.");
        }
    }

    function checkSchedule() {
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();

        // --- 1. Active Hours (Sleep Mode) ---
        if (settings.activeHours && settings.activeHours.enabled) {
            const startMins = timeToMins(settings.activeHours.start);
            const endMins = timeToMins(settings.activeHours.end);

            // Determine if we are "inside" the active window
            let isActive = false;
            if (startMins <= endMins) {
                // e.g. 08:00 to 22:00
                isActive = (currentMins >= startMins && currentMins < endMins);
            } else {
                // e.g. 22:00 to 02:00 (crosses midnight)
                isActive = (currentMins >= startMins || currentMins < endMins);
            }

            if (!isActive && !wakeOverride) {
                setSleep(true);
            } else {
                setSleep(false);
            }
        } else {
            setSleep(false);
        }

        // --- 2. Brightness Control ---
        if (settings.brightness && settings.brightness.enabled) {
            const startMins = timeToMins(settings.brightness.start);
            const endMins = timeToMins(settings.brightness.end);

            let isDarkTime = false;
            if (startMins <= endMins) {
                isDarkTime = (currentMins >= startMins && currentMins < endMins);
            } else {
                isDarkTime = (currentMins >= startMins || currentMins < endMins);
            }

            if (isDarkTime) {
                const opacity = 1 - (parseInt(settings.brightness.level) / 100);
                setBrightness(opacity); // 1 - level% = black overlay opacity
            } else {
                setBrightness(0);
            }
        } else {
            setBrightness(0);
        }
    }

    function setSleep(shouldSleep) {
        const overlay = document.getElementById('sleep-overlay');
        if (!overlay) return;

        if (shouldSleep) {
            if (overlay.style.display === 'none') {
                overlay.style.display = 'flex';
                console.log("Screen going to sleep...");
            }
        } else {
            if (overlay.style.display !== 'none') {
                overlay.style.display = 'none';
                console.log("Screen waking up...");
            }
        }
    }

    function setBrightness(opacity) {
        const overlay = document.getElementById('brightness-overlay');
        if (overlay) {
            overlay.style.opacity = opacity;
        }
    }

    function wakeUpTemporarily() {
        console.log("Waking up temporarily for 5 minutes...");
        wakeOverride = true;
        setSleep(false);

        if (wakeTimeout) clearTimeout(wakeTimeout);
        wakeTimeout = setTimeout(() => {
            wakeOverride = false;
            checkSchedule();
        }, 5 * 60 * 1000); // Wake for 5 minutes
    }

    function timeToMins(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

})();
