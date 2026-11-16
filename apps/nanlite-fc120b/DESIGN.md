# Nanlite FC-120B practice simulator

## Scope and references

Fixed rear-panel view using the owner's unchanged 500 × 500 WEBP. Practise power,
CCT/dimming, blackout/restore, effects and onboard menu navigation. React/TypeScript,
CSS LCD and a small canvas illumination preview; no 3D or real-device connections.
The supplied English manual is bundled as `public/manual.pdf`. Printed page N is
PDF page N+1 (49 PDF pages). Firmware on the owner's fixture is unknown; the manual's
version screenshots are examples, not a detected firmware version.

Normal sequence: power on → left dial DIM → right dial CCT/preset → MODE → select
effect with left dial → right dial selects a parameter → left dial edits it → MENU
→ right dial navigates/presses/confirms → MENU returns.

## Control contract

| Control/context | Action and feedback | Evidence/status |
| --- | --- | --- |
| POWER rocker | Switch LCD/output on/off; retain stable settings | pp.18,44 / PDF19,45; documented; exact startup delay provisional |
| MODE | Toggle CCT/EFFECT | pp.18,20 / PDF19,21; documented |
| Left dial, CCT | DIM 0–100%; press blacks out/restores previous brightness in any mode | p.19 / PDF20; documented |
| Right dial, CCT | 2700–6500K; press cycles 2700/3200/4300/5600/6500K | p.20 / PDF21; documented |
| Effect page | Right turn selects EFFECT/parameter; left edits selected field; effect selection wraps | pp.20–35 / PDF21–36; documented |
| Manual storm/explosion | Right press triggers one shot | pp.26,33–34 / PDF27,34–35; documented |
| MENU | Opens settings; returns one level; right turn selects, right press enters/sets | p.36 / PDF37; documented |
| OUTPUT MODE | MAX OUTPUT / CONSTANT OUTPUT | p.37 / PDF38; documented |
| ADDRESS/DMX | Address 1–512, CCT 8bit/ULTIMATE DMX 8bit, reduced channels, five dimming curves, smoothing | pp.7–12 / PDF8–13; documented options; address lower bound provisional |
| WIRELESS | Reset Bluetooth confirmation, protocol V1.0/V2.0 | pp.15–17 / PDF16–18; documented navigation only; no radio |
| FAN CONTROL | SMART/FULL SPEED/LOW SPEED/OFF; power caps 100/100/50/15% | p.38 / PDF39; documented |
| ROTATE SCREEN | YES/NO confirmation; rotate LCD 180° | p.39 / PDF40; documented; repeated YES toggles provisionally |
| SCREEN BRIGHTNESS | Adjustable LCD | p.40 / PDF41; documented; range 1–5 provisional |
| LANGUAGE | English / Simplified Chinese | p.41 / PDF42; documented; Chinese rendering is a simulator translation |
| FIRMWARE / VERSION | Explicit simulator-only information, no USB access or invented firmware identity | pp.42–44 / PDF43–45; unsupported hardware operation |
| RESET ALL SETTINGS | NO/YES; reset stable configuration | pp.43–44 / PDF44–45; documented; simulator reset is immediate |

No owner-confirmed corrections yet. Manual conflicts: p.7 says MODE enters menu;
use MENU per panel and p.36. Introduction says 12 effects; operating list includes
14 entries including manual storm/explosion. Use all 14. P.27 TV and p.35 WELDING
contain copied trigger text: only the explicitly manual effects trigger on press.

## Effects

All 14 effect names and parameter ranges come from pp.20–35 / PDF21–36. CCT LOOP:
DIM, CCT low/high, 2–30s. INT LOOP: DIM low/high, CCT, 2–30s. FLASH: DIM, CCT,
0.1–10s interval, 0–100% ratio. PULSE: DIM, CCT, 1–240 pulses/min. STORM AUTO:
DIM, CCT, interval low/high 1–60s. STORM MANUAL: DIM, CCT. TV: DIM low/high,
CCT, speed 1–100, shift 0–3000K. PAPARAZZI and CANDLE/FIRE: DIM (range for
candle), CCT, speed 1–100. BAD BULB adds intensity 1–100. FIREWORK and
EXPLOSION AUTO add speed/decay 1–100. EXPLOSION MANUAL has decay. WELDING:
DIM low/high, CCT, speed 1–100, pause ON/OFF.

Provisional: right dial visits range endpoints separately; DIM increment 1%, CCT
100K (2700…6500; shift 100K), time increment 1s except FLASH 0.1s. Values start
from the manual's example screens, not claimed factory defaults. CCT starts at
20%/5600K/channel001 from the supplied photo. No acceleration or long-press actions
are documented, so none are invented. Menu list clamps at ends; effect list wraps.

## State, preview and persistence

One pure reducer owns config, power, blackout, selected effect field, menu path,
draft value and trigger timestamp. Confirm commits menu edits; MENU cancels drafts.
MODE closes menus then toggles operating mode (provisional). Left turn does nothing
in settings, left press still toggles blackout. No menu timeout. Live effect changes
take effect immediately. Preview samples deterministic functions of elapsed time;
no per-frame React state. Manual trigger restarts from a captured timestamp.

Interruption contract: repeat trigger restarts; power off, MODE, effect change and
reset cancel a one-shot; menu and parameter edits leave it running with live values;
blackout hides output and cancels the shot so restore cannot replay an old flash.
WELDING pause outputs zero (provisional). No callbacks commit a completed shot.

Versioned localStorage contains stable mode, CCT/DIM, per-effect parameters and
settings. Excludes power, blackout, menu/drafts, timing and trigger; reload is off.
Unknown versions stay untouched; invalid known values are sanitized. Storage errors
are shown. No imported media. Reset replaces current known-version config.

Preview is **illustrative**, not calibrated photometry or exact firmware waveforms.
All effect parameters change its deterministic signal. Fan caps affect preview;
MAX OUTPUT has an illustrative CCT-dependent envelope, CONSTANT OUTPUT stays even.
This is not a measured output curve. DMX/radio settings are navigation practice
only and explicitly labelled; there is no DMX decoder, app pairing or USB update.

## Milestones and verification

1. Photo calibration + CCT/blackout/presets and preview; prove bounds and power.
2. Effects, parameter ranges, triggers, menus, fan caps and persistence.
3. Library/shared navigation/dev/build integration and bundled PDF.
4. Logic invariants; browser wheel/drag/keyboard/cancel/menu/recall/output checks;
   inspect desktop and narrow screenshots and combined production routes.

Completion checklist: all physical electronic controls implemented; all 14 effects
and listed settings represented; firmware/radio/DMX hardware unsupported; precision,
range-edit gestures, defaults, timing and translated LCD provisional. Browser/build
verification will be recorded in README. Physical comparison remains unverified.
