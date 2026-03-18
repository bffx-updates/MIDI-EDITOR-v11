# CLAUDE.md — bfmidi-editor_codex

This file provides guidance to Claude Code when working with code in this directory.

## Project Overview

**BFMIDI Editor Externo** is a standalone web editor for the BFMIDI firmware, communicating with the device over USB via the WebMIDI + Web Serial browser APIs.

- **No build system** — pure vanilla ES modules (HTML/CSS/JS), served as static files.
- **Browser requirements** — Chrome or Edge (desktop) with HTTPS or localhost.
- **Connection mode** — WebMIDI sends SysEx to activate editor mode; Web Serial (115200 baud) carries the JSON command protocol defined in `USB_EDITOR.h`.

## Entry Points

| File | Role |
|------|------|
| `index.html` | Main shell (sidebar + iframe). **Primary entry point.** Uses `js/launcher.js`. |
| `main/index.html` | Legacy firmware-parity "Main" screen (read-only display mirror). |
| `preset-config/index.html` | Preset editor (parity page, loaded inside iframe). |
| `global-config/index.html` | Global config editor (parity page). |
| `system/index.html` | System page — board selection, NVS erase, hardware tests (parity page). |
| `savesystem/index.html` | Legacy redirect for board-save flow. |

## Architecture: Parity Bridge

The pages under `preset-config/`, `global-config/`, `system/`, and `main/` are **parity pages**: HTML/CSS/JS extracted from the firmware's embedded web interface (`*_HTML.h`, `*_CSS.h`, `*_JS.h`) to maintain visual and structural parity with the device's built-in WiFi editor.

These pages use `fetch()` to talk to the device, but when loaded inside the shell iframe, `fetch()` is intercepted by the **parity bridge client** and routed over USB instead of HTTP:

```
Parity page (iframe)
  └─ parity-bridge-client.js  patches window.fetch
       └─ window.parent.BFMIDIExternalBridge.request()   (set by launcher.js)
            └─ ParityBridgeHost (parity-bridge-host.js)
                 └─ BFMIDIProtocol.enviarComando()  (protocol.js)
                      └─ Web Serial → BFMIDI firmware USB_EDITOR.h
```

When a parity page is opened **directly** (not inside the iframe), `parity-bridge-client.js` is loaded but finds no parent bridge, and `fetch()` fails gracefully — signalling the user to navigate from the shell.

## Key JS Modules

| File | Purpose |
|------|---------|
| `js/launcher.js` | Shell entry: sidebar navigation, iframe management, Connect/Disconnect toolbar, `window.BFMIDIExternalBridge` registration. |
| `js/app.js` | Standalone app entry (alternative SPA shell, not used in iframe mode). |
| `js/connection.js` | `ConnectionManager` — orchestrates WebMIDI (SysEx) + Web Serial with port heuristics and auto-reconnect. |
| `js/protocol.js` | `BFMIDIProtocol` — queued JSON-over-serial request/response, 115200 baud, newline-delimited. |
| `js/parity-bridge-host.js` | `ParityBridgeHost` — translates HTTP-style API calls into serial commands, implements the full REST-like API surface (presets, global config, system info, backup, hardware tests, WiFi stubs). |
| `js/parity-bridge-client.js` | Fetch interceptor injected into parity pages; patches `window.fetch` to route API calls to `window.parent.BFMIDIExternalBridge`. |
| `js/state.js` | Lightweight reactive state store (`appState`, `setState`, `subscribe`). |
| `js/pages/*.js` | Page renderers for the standalone SPA shell (home, presets, globals, system). |
| `js/components/*.js` | Reusable UI components: toast, modal, loading-spinner, color-picker, custom-select, toggle-button. |

## CSS Structure

| File | Purpose |
|------|---------|
| `css/variables.css` | Design tokens (colors, spacing, typography). |
| `css/base.css` | Reset and global element styles. |
| `css/components.css` | Shared component styles (buttons, badges, chips, etc.). |
| `css/layout.css` | Shell layout (sidebar, toolbar, iframe container). |
| `css/pages/*.css` | Per-page overrides (home, presets, globals, system). |
| `css/visual-refresh-*.css` | Visual refresh layers applied to parity pages. |

## Connection Flow

1. **WebMIDI**: request access, send SysEx `F0 7D 42 46 01 F7` (broadcast to all outputs) to trigger editor mode on firmware.
2. **Web Serial**: auto-detect port by VID/PID heuristics (Espressif `0x303a:0x80c2` preferred), then open at 115200 baud.
3. **Ping**: send `{"cmd":"ping"}\n`, expect `{"ok":true,"data":{...}}` within 1.4 s. Up to 10 rounds with retry SysEx in between.
4. On success: reload the iframe to the active parity page.
5. On disconnect: send `{"cmd":"exit_editor"}\n`, send SysEx exit `F0 7D 42 46 00 F7`.

Saved VID/PID stored in `localStorage` (`bfmidi_last_port`) for 90 days to skip the port chooser on reconnect.

## PWA / Service Worker

- `manifest.json` — PWA manifest (icons, display mode).
- `sw.js` — Service worker, cache name `bfmidi-editor-vN`. **Increment version in `sw.js` on any asset change** to bust the cache.
- Service worker is unregistered automatically on localhost to prevent stale cache during development.

## Parity Bridge API Surface

`ParityBridgeHost` (`parity-bridge-host.js`) maps these HTTP paths to serial commands:

| HTTP path | Method | Serial command |
|-----------|--------|----------------|
| `/api/system/info` | GET | `get_info` + `get_board` |
| `/api/host-status` | GET | `get_info` |
| `/api/midi-monitor` | GET | in-memory buffer |
| `/api/midi-monitor/clear` | POST | in-memory clear |
| `/api/global-config/read` | GET | `get_global` |
| `/api/global-config/save` | POST | `set_global` + `refresh_current` |
| `/get-single-preset-data` | GET | `get_preset` |
| `/save-single-preset-data` | POST | `set_preset` |
| `/refresh-display-only` | GET | `refresh_display` |
| `/set-active-config-preset` | GET | `activate_preset` |
| `/savesystem` | GET | `set_board` + `restart` |
| `/api/system/nvs-erase` | POST | `nvs_erase` |
| `/api/hardware-test/leds/start` | POST | `hw_led_start` |
| `/api/hardware-test/leds/stop` | POST | `hw_led_stop` |
| `/api/hardware-test/display/start` | POST | `hw_display_start` |
| `/api/hardware-test/display/stop` | POST | `hw_display_stop` |
| `/api/hardware-test/midi/pc` | POST | `hw_midi_pc` |
| `/api/backup` | GET | full preset dump (30 presets × 2 layers) |
| `/api/wifi/*` | any | stub — returns USB-mode placeholders |

## Important Notes

- **No npm / no bundler** — edit files directly, no compile step.
- **Parity pages must not import shell modules** — they run in an iframe and rely solely on `parity-bridge-client.js` (injected via `<script>` tag) to communicate with the parent.
- **Preset grid**: 6 buttons × 5 levels × 2 layers = 60 presets per layer.
- **NVS byte approximation**: the serial protocol does not expose raw NVS byte counts; `ParityBridgeHost.mapSystemInfo()` approximates them as `entries × 32 bytes`.
- **SW cache version**: update `CACHE_NAME` in `sw.js` whenever any cached asset changes.
- **`ref_design/`** — static HTML reference screenshots; not served, for design reference only.
- **`MAIN_SCREEN.h`** — copy of the firmware display header kept here for reference when updating the parity display logic.
