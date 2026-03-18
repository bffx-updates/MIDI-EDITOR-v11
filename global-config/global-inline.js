// Extracted from global-config/index.html to reduce inline template parsing on ESP

// Corrige placeholder caso o firmware nao seja injetado no HTML bruto
      window.addEventListener('DOMContentLoaded', function () {
        try {
          var fwEl = document.getElementById('fwMain');
          if (!fwEl) return;
          var txt = (fwEl.textContent || fwEl.innerText || '').trim();

          if (!txt || /FIRMWARE[_-]VERSION/i.test(txt)) {
            fetch('/api/system/info')
              .then(function (r) { return r.ok ? r.json() : null; })
              .then(function (info) {
                if (info && info.firmwareVersion) {
                  fwEl.textContent = info.firmwareVersion;
                }
              })
              .catch(function () {});
          }
        } catch (e) {}
      });

function showSavedBanner() {
            const banner = document.getElementById('saveBanner');
            if (!banner) return;
            banner.style.transform = 'translate(0, 0)';
            setTimeout(() => {
                banner.style.transform = 'translate(0, -150%)';
            }, 2000);
        }

        const form = document.getElementById('globalConfigForm');
        const statusMessage = document.getElementById('statusMessage');
        const ledBrilhoButton = document.getElementById('ledBrilhoButton');
        const ledBrilhoValueDisplay = document.getElementById('ledBrilhoValueDisplay');
        let ledBrilho = 3; // 1..5 => 20..100%
        
        const modoMidiSelect = document.getElementById('modoMidi');
        let selectedBackgroundColorUint32 = 0;

        const PRESET_COLORS = [
            { name: "Vermelho", hex: "#FF0000", uint32: 0xFF0000 },
            { name: "Verde",    hex: "#00FF00", uint32: 0x00FF00 },
            { name: "Azul",     hex: "#0000FF", uint32: 0x0000FF },
            { name: "Amarelo",  hex: "#FFFF00", uint32: 0xFFFF00 },
            { name: "Roxo",     hex: "#800080", uint32: 0x800080 },
            { name: "Cyan",     hex: "#00FFFF", uint32: 0x00FFFF },
            { name: "Branco",   hex: "#FFFFFF", uint32: 0xFFFFFF },
            { name: "Laranja",  hex: "#FF5000", uint32: 0xFF5000 }, // 255, 80, 0
            { name: "Magenta",  hex: "#FF0080", uint32: 0xFF0080 }  // 255, 0, 128
        ];
        const BACKGROUND_COLORS = [...PRESET_COLORS, { name: "Preto", hex: "#000000", uint32: 0x000000 }];

        const modoMidiOptionsValues = ["GLOBAL", "AMPERO AS2", "AMPERO MINI", "HX STOMP", "A. STAGE 2", "GP-200LT", "VALETON GP5", "POCKET MASTER", "TONEX", "KEMPER PLAYER", "AMPERO MP350", "MX5", "NANO CORTEX", "QUAD CORTEX", "MODO AVANCADO", "SYNERGY AMPS", "BigSky", "BlueSky", "TimeLine", "ELCAPISTAN", "FLINT", "HX-ONE", "VTR NARCISO", "VTR LOKI"];
        const advMidiModeOptions = ["GLOBAL", "AMPERO AS2", "AMPERO MINI", "HX STOMP", "A. STAGE 2", "GP-200LT", "VALETON GP5", "POCKET MASTER", "TONEX", "KEMPER PLAYER", "AMPERO MP350", "MX5", "NANO CORTEX", "QUAD CORTEX", "SYNERGY AMPS", "BigSky", "BlueSky", "TimeLine", "ELCAPISTAN", "FLINT", "HX-ONE", "VTR NARCISO", "VTR LOKI"];
        let advMidiChData = [0, 0, 0, 0, 0];
        let advMidiChNumData = [1, 2, 3, 4, 5];

        let lockSetup = false;
        let lockGlobal = false;
        const kemperGetNamesCheckbox = document.getElementById('kemperGetNames');
        const kemperGetNamesButton = document.getElementById('kemperGetNamesBtn');
        const kemperGetNamesLabel = document.getElementById('kemperGetNamesLabel');
        const kemperAutoLoaderCheckbox = document.getElementById('kemperAutoLoader');
        const kemperAutoLoaderButton = document.getElementById('kemperAutoLoaderBtn');
        const kemperAutoLoaderLabel = document.getElementById('kemperAutoLoaderLabel');
        const kemperGetNamesWrap = document.getElementById('kemperGetNamesWrap');

        function syncKemperGetNamesButton() {
            if (!kemperGetNamesCheckbox || !kemperGetNamesButton || !kemperGetNamesLabel) return;
            const enabled = !!kemperGetNamesCheckbox.checked;
            kemperGetNamesButton.classList.toggle('rect-toggle-fx-on', enabled);
            kemperGetNamesButton.classList.toggle('rect-toggle-fx-off', !enabled);
            kemperGetNamesLabel.textContent = enabled ? 'GET NAMES ON' : 'GET NAMES OFF';
        }

        function syncKemperAutoLoaderButton() {
            if (!kemperAutoLoaderCheckbox || !kemperAutoLoaderButton || !kemperAutoLoaderLabel) return;
            const enabled = !!kemperAutoLoaderCheckbox.checked;
            kemperAutoLoaderButton.classList.toggle('rect-toggle-fx-on', enabled);
            kemperAutoLoaderButton.classList.toggle('rect-toggle-fx-off', !enabled);
            kemperAutoLoaderLabel.textContent = enabled ? 'AUTO LOADER ON' : 'AUTO LOADER OFF';
        }

        function updateKemperGetNamesVisibility(modoMidi) {
            if (!kemperGetNamesWrap) return;
            kemperGetNamesWrap.style.display = (modoMidi === 'KEMPER PLAYER') ? '' : 'none';
        }

        function initAdvMidiChDropdowns() {
            for (let i = 0; i < 5; i++) {
                const modeSelect = document.getElementById('advMidiChMode' + i);
                if (!modeSelect) continue;

                modeSelect.innerHTML = '';
                advMidiModeOptions.forEach(function(mode, idx) {
                    const option = document.createElement('option');
                    option.value = idx;
                    option.textContent = mode;
                    modeSelect.appendChild(option);
                });
                modeSelect.value = String(advMidiChData[i] || 0);

                if (!modeSelect.dataset.bound) {
                    modeSelect.addEventListener('change', function() {
                        advMidiChData[i] = parseInt(this.value, 10) || 0;
                        scheduleGlobalAutoSave();
                    });
                    modeSelect.dataset.bound = '1';
                }

                const numSelect = document.getElementById('advMidiChNum' + i);
                if (numSelect) {
                    numSelect.value = String(advMidiChNumData[i] || (i + 1));
                    if (!numSelect.dataset.bound) {
                        numSelect.addEventListener('change', function() {
                            advMidiChNumData[i] = parseInt(this.value, 10) || (i + 1);
                            scheduleGlobalAutoSave();
                        });
                        numSelect.dataset.bound = '1';
                    }
                }
            }
        }

        function updateAdvMidiChVisibility(modoMidi) {
            const wrap = document.getElementById('advMidiChWrap');
            if (!wrap) return;
            wrap.style.display = (modoMidi === 'MODO AVANCADO') ? '' : 'none';
        }

        function syncLedBrilhoUI() {
            const pct = Math.max(1, Math.min(5, parseInt(ledBrilho, 10) || 3)) * 20;
            if (ledBrilhoValueDisplay) ledBrilhoValueDisplay.textContent = pct + '%';
            if (ledBrilhoButton) ledBrilhoButton.textContent = 'ADJUST LEVEL';
        }

        function hexToUint32(hex) {
            return parseInt(hex.replace("#", ""), 16);
        }

        function uint32ToHex(uint32) {
            let hex = uint32.toString(16);
            while (hex.length < 6) {
                hex = "0" + hex;
            }
            return "#" + hex;
        }

        let selectedPresetColorsUint32 = [0,0,0,0,0,0]; // A-E + F (6 para LED NUMEROS)
        let selectedLiveModeColorUint32 = 0;
        let selectedLiveMode2ColorUint32 = 0;
        let selectedSwGlobalLedIndex = 0; // Para a cor do LED do SW Global
        let selectedSwGlobalLed2Index = 0; // Para a cor do LED2 (CC2 longo)
        let presetLevels = [true, true, true, true, true]; // A, B, C, D, E
        const PRESET_LEVEL_KEYS = ['A', 'B', 'C', 'D', 'E'];
        let ledModeNumeros = false; // false = LED LETRAS (A-F), true = LED NUMEROS (1-6)

        let swGlobalConfig = {};

        function toBooleanLoose(value, fallback = false) {
            if (typeof value === 'boolean') return value;
            if (typeof value === 'number') return value !== 0;
            if (typeof value === 'string') {
                const normalized = value.trim().toLowerCase();
                if (normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes') return true;
                if (normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no' || normalized === '') return false;
            }
            return fallback;
        }

        function normalizePresetLevels(rawLevels) {
            const fallback = [true, true, true, true, true];

            if (Array.isArray(rawLevels)) {
                return PRESET_LEVEL_KEYS.map((_, index) => toBooleanLoose(rawLevels[index], fallback[index]));
            }

            if (typeof rawLevels === 'string') {
                const compact = rawLevels.trim();
                if (compact.length >= PRESET_LEVEL_KEYS.length && /^[01TFtf]+$/.test(compact)) {
                    return PRESET_LEVEL_KEYS.map((_, index) => {
                        const ch = compact[index];
                        return ch === '1' || ch === 'T' || ch === 't';
                    });
                }
                if (compact.includes(',')) {
                    const parts = compact.split(',');
                    return PRESET_LEVEL_KEYS.map((_, index) => toBooleanLoose(parts[index], fallback[index]));
                }
            }

            if (rawLevels && typeof rawLevels === 'object') {
                return PRESET_LEVEL_KEYS.map((key, index) => {
                    if (Object.prototype.hasOwnProperty.call(rawLevels, key)) {
                        return toBooleanLoose(rawLevels[key], fallback[index]);
                    }
                    if (Object.prototype.hasOwnProperty.call(rawLevels, key.toLowerCase())) {
                        return toBooleanLoose(rawLevels[key.toLowerCase()], fallback[index]);
                    }
                    if (Object.prototype.hasOwnProperty.call(rawLevels, index)) {
                        return toBooleanLoose(rawLevels[index], fallback[index]);
                    }
                    return fallback[index];
                });
            }

            return fallback.slice();
        }

        function ensurePresetLevelsArray() {
            presetLevels = normalizePresetLevels(presetLevels);
            return presetLevels;
        }

        function normalizeSwGlobalConfig(cfg) {
            if (!cfg) return {};
            if (cfg.spin_send_pc === undefined) cfg.spin_send_pc = false;
            if (cfg.cc2 === undefined) cfg.cc2 = 0;
            if (cfg.start_value_cc2 === undefined) cfg.start_value_cc2 = false;
            if (cfg.canal_cc2 === undefined && cfg.cc2_ch !== undefined) {
                const ch = parseInt(cfg.cc2_ch, 10);
                if (!Number.isNaN(ch)) cfg.canal_cc2 = ch;
            }
            if (cfg.cc2_ch === undefined && cfg.canal_cc2 !== undefined) {
                const ch = parseInt(cfg.canal_cc2, 10);
                if (!Number.isNaN(ch)) cfg.cc2_ch = ch;
            }
            if (cfg.led2 === undefined) cfg.led2 = 0;
            if ((cfg.modo >= 19 && cfg.modo <= 21) || (cfg.modo >= 41 && cfg.modo <= 43)) {
                cfg.modo = 1;
                cfg.spin_send_pc = true;
            }
            return cfg;
        }

        function syncSpinSendPcGlobal(desiredValue, isSpinMode = true) {
            const cb = document.getElementById('spinSendPcToggle_global');
            const btn = document.getElementById('spinSendPcBtn_global');
            if (!cb || !btn) return;
            if (typeof desiredValue === 'boolean') cb.checked = desiredValue;
            const ccField = document.getElementById('ccFieldFormGroup');
            if (cb.checked) {
                btn.classList.add('active', 'pc-mode');
                btn.classList.remove('cc-mode');
                btn.setAttribute('aria-pressed','true');
                btn.textContent = 'ENVIAR PC';
                if (isSpinMode && ccField) ccField.style.display = 'none';
            } else {
                btn.classList.add('cc-mode');
                btn.classList.remove('pc-mode');
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed','false');
                btn.textContent = 'ENVIAR CC';
                if (ccField) ccField.style.display = 'block';
            }
        }

        const MODE_OPTIONS_WEB = [
            { value: 0, text: "STOMP" }, { value: 1, text: "SPIN1" }, 
            { value: 4, text: "RAMPA" }, { value: 10, text: "CUSTOM1" }, 
            { value: 17, text: "FAVORITE" },
            { value: 18, text: "TAP TEMPO" }
        ];

        function createCustomColorSelector(previewId, panelId, colorArray, storageUpdateCallback, initialColorValue, isIndexBased = false) {
            const previewElement = document.getElementById(previewId); 
            const previewBoxElement = previewElement.querySelector('.selected-color-preview-box');

            let overlayElement = document.getElementById(panelId + '-overlay');
            if (!overlayElement) {
                overlayElement = document.createElement('div');
                overlayElement.id = panelId + '-overlay';
                overlayElement.classList.add('color-options-panel-overlay');
                document.body.appendChild(overlayElement);

                const panelElement = document.createElement('div');
                panelElement.id = panelId;
                panelElement.classList.add('color-options-panel');
                overlayElement.appendChild(panelElement);
            }
            const panelElement = overlayElement.querySelector('.color-options-panel');

            panelElement.innerHTML = '';
            const titleElement = document.createElement('div');
            titleElement.classList.add('color-options-panel-title');
            titleElement.textContent = 'SELECIONE A COR';
            panelElement.appendChild(titleElement);

            colorArray.forEach((color, index) => {
                const swatch = document.createElement('div');
                swatch.classList.add('color-swatch');
                swatch.style.backgroundColor = color.hex;
                swatch.dataset.value = isIndexBased ? index : color.uint32;
                swatch.title = color.name;

                swatch.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const valueToStore = isIndexBased ? index : color.uint32;
                    if (previewBoxElement) {
                        previewBoxElement.style.backgroundImage = `linear-gradient(to right, black 2%, ${color.hex} 50%, black 98%)`;
                    } else {
                        previewElement.style.backgroundImage = `linear-gradient(to right, black 2%, ${color.hex} 50%, black 98%)`;
                    }
                    storageUpdateCallback(valueToStore);
                    overlayElement.classList.remove('active');
                    scheduleGlobalAutoSave();
                });
                panelElement.appendChild(swatch);
            });

            previewElement.addEventListener('click', (event) => {
                event.stopPropagation();
                // Close other open panels first
                document.querySelectorAll('.color-options-panel-overlay.active').forEach(openOverlay => {
                    if (openOverlay !== overlayElement) {
                        openOverlay.classList.remove('active');
                    }
                });
                // Toggle the current panel
                overlayElement.classList.toggle('active');
            });

            const initialColor = isIndexBased 
                ? (colorArray[initialColorValue] || colorArray[0])
                : (colorArray.find(c => c.uint32 === initialColorValue) || colorArray[0]);
            
            if (previewBoxElement) {
                previewBoxElement.style.backgroundImage = `linear-gradient(to right, black 2%, ${initialColor.hex} 50%, black 98%)`;
            } else {
                previewElement.style.backgroundImage = `linear-gradient(to right, black 2%, ${initialColor.hex} 50%, black 98%)`;
            }
            storageUpdateCallback(isIndexBased ? (colorArray.indexOf(initialColor)) : initialColor.uint32);
        }

        document.addEventListener('click', function(event) {
            // Close any active overlay if the click is outside of its panel
            document.querySelectorAll('.color-options-panel-overlay.active').forEach(openOverlay => {
                const panel = openOverlay.querySelector('.color-options-panel');
                if (panel && !panel.contains(event.target) && !event.target.closest('.selected-color-preview')) {
                     openOverlay.classList.remove('active');
                }
            });
        });

        function initializeCustomSelect() { return; }

        document.addEventListener('click', function(event) {
            document.querySelectorAll('.custom-select-wrapper.open').forEach(openWrapper => {
                if (!openWrapper.contains(event.target)) {
                    openWrapper.classList.remove('open');
                }
            });
            document.querySelectorAll('.color-options-panel-overlay.active').forEach(openOverlay => {
                if (event.target === openOverlay) {
                    openOverlay.style.display = 'none';
                    openOverlay.classList.remove('active');
                }
            });
        });

        window.addEventListener('load', () => {
            if (modoMidiSelect) initializeCustomSelect(modoMidiSelect);
            const selectModeInit = document.getElementById('selectModeIndex');
            if (selectModeInit) initializeCustomSelect(selectModeInit);
            initializeSwGlobalFields();

            fetch('/api/global-config/read')
                .then(response => response.json())
                .then(data => {
                    ledBrilho = data.ledBrilho || 3;
                    syncLedBrilhoUI();

                    const ledPreviewCheckbox = document.getElementById('ledPreview');
                    const ledPreviewButton = document.getElementById('ledPreviewButton');
                    if (ledPreviewCheckbox && ledPreviewButton) {
                        ledPreviewCheckbox.checked = !!data.ledPreview;
                        syncLedPreviewButton();
                    }
                    if (modoMidiSelect) {
                        const modoIdxParsed = parseInt(data.modoMidiIndex, 10);
                        const modoIdx = Number.isFinite(modoIdxParsed) ? modoIdxParsed : 0;
                        modoMidiSelect.value = modoMidiOptionsValues[modoIdx] || 'GLOBAL';
                        updateCustomSelectVisual(modoMidiSelect);
                        updateShowFxButtonVisibility(modoMidiSelect.value);
                        updateAdvMidiChVisibility(modoMidiSelect.value);
                        updateKemperGetNamesVisibility(modoMidiSelect.value);
                        if (!modoMidiSelect.dataset.bound) {
                            modoMidiSelect.addEventListener('change', function() {
                                updateShowFxButtonVisibility(this.value);
                                updateAdvMidiChVisibility(this.value);
                                updateKemperGetNamesVisibility(this.value);
                                scheduleGlobalAutoSave();
                            });
                            modoMidiSelect.dataset.bound = '1';
                        }
                    }

                    advMidiChData = Array.isArray(data.advMidiCh)
                        ? data.advMidiCh.slice(0, 5).map(value => {
                            const parsed = parseInt(value, 10);
                            return Number.isFinite(parsed) ? parsed : 0;
                        })
                        : advMidiChData;
                    while (advMidiChData.length < 5) advMidiChData.push(0);

                    advMidiChNumData = Array.isArray(data.advMidiChNum)
                        ? data.advMidiChNum.slice(0, 5).map((value, index) => {
                            const parsed = parseInt(value, 10);
                            return Number.isFinite(parsed) ? parsed : (index + 1);
                        })
                        : advMidiChNumData;
                    while (advMidiChNumData.length < 5) advMidiChNumData.push(advMidiChNumData.length + 1);
                    initAdvMidiChDropdowns();

                    if (kemperGetNamesCheckbox && kemperAutoLoaderCheckbox) {
                        kemperGetNamesCheckbox.checked = !!data.kemperGetNames;
                        kemperAutoLoaderCheckbox.checked = !!data.kemperAutoLoader;
                        syncKemperGetNamesButton();
                        syncKemperAutoLoaderButton();

                        if (kemperGetNamesButton && !kemperGetNamesButton.dataset.bound) {
                            kemperGetNamesButton.addEventListener('click', function() {
                                kemperGetNamesCheckbox.checked = !kemperGetNamesCheckbox.checked;
                                syncKemperGetNamesButton();
                                scheduleGlobalAutoSave();
                            });
                            kemperGetNamesButton.dataset.bound = '1';
                        }

                        if (kemperAutoLoaderButton && !kemperAutoLoaderButton.dataset.bound) {
                            kemperAutoLoaderButton.addEventListener('click', function() {
                                kemperAutoLoaderCheckbox.checked = !kemperAutoLoaderCheckbox.checked;
                                syncKemperAutoLoaderButton();
                                scheduleGlobalAutoSave();
                            });
                            kemperAutoLoaderButton.dataset.bound = '1';
                        }
                    }
                    // Estado inicial CADEIA: usa SHOW FX SCREEN legado (mostrarTelaFX)
                    const mostrarTelaFxCheckbox = document.getElementById('mostrarTelaFX');
                    const mostrarCadeiaCheckbox = document.getElementById('mostrarCadeia');
                    const btnMostrarCadeia = document.getElementById('btnMostrarCadeia');
                    if (mostrarTelaFxCheckbox && mostrarCadeiaCheckbox && btnMostrarCadeia) {
                        // MantÃ©m compatibilidade: back-end jÃ¡ usa mostrarTelaFX (SHOW FX SCREEN)
                        const initial = !!data.mostrarTelaFX;
                        mostrarTelaFxCheckbox.checked = initial;
                        mostrarCadeiaCheckbox.checked = initial;

                        if (initial) {
                            btnMostrarCadeia.classList.remove('rect-toggle-fx-off');
                            btnMostrarCadeia.classList.add('rect-toggle-fx-on');
                        } else {
                            btnMostrarCadeia.classList.remove('rect-toggle-fx-on');
                            btnMostrarCadeia.classList.add('rect-toggle-fx-off');
                        }

                        btnMostrarCadeia.addEventListener('click', function () {
                            const next = !mostrarCadeiaCheckbox.checked;
                            mostrarCadeiaCheckbox.checked = next;
                            mostrarTelaFxCheckbox.checked = next; // mantÃ©m SHOW FX SCREEN em sync

                            if (next) {
                                btnMostrarCadeia.classList.remove('rect-toggle-fx-off');
                                btnMostrarCadeia.classList.add('rect-toggle-fx-on');
                            } else {
                                btnMostrarCadeia.classList.remove('rect-toggle-fx-on');
                                btnMostrarCadeia.classList.add('rect-toggle-fx-off');
                            }
                            scheduleGlobalAutoSave();
                        });
                    }

                    // Estado inicial MOSTRAR SIGLA FX NO DISPLAY (3 ESTADOS)
                    // 0 = OFF (vermelho), 1 = PREVIEW (azul/sempre mostra), 2 = LIVE MODE (roxo/hÃ­brido)
                    const mostrarSiglaFxInput = document.getElementById('mostrarSiglaFX');
                    const btnMostrarSiglaFx = document.getElementById('btnMostrarSiglaFx');
                    if (mostrarSiglaFxInput && btnMostrarSiglaFx) {
                        // ObtÃ©m valor inicial do backend (0, 1 ou 2)
                        let siglaFxState = 1; // default PREVIEW
                        if (typeof data.mostrarSiglaFX === 'number') {
                            siglaFxState = data.mostrarSiglaFX;
                        } else if (typeof data.mostrarSiglaFX === 'boolean') {
                            siglaFxState = data.mostrarSiglaFX ? 1 : 0;
                        }
                        // Garante que o valor estÃ¡ entre 0-2
                        if (siglaFxState < 0 || siglaFxState > 2) siglaFxState = 1;
                        mostrarSiglaFxInput.value = siglaFxState;

                        function syncSiglaFxUI() {
                            const state = parseInt(mostrarSiglaFxInput.value);
                            const span = btnMostrarSiglaFx.querySelector('span') || btnMostrarSiglaFx;
                            
                            // Remove todas as classes
                            btnMostrarSiglaFx.classList.remove('rect-toggle-fx-off', 'rect-toggle-fx-on', 'rect-toggle-fx-live');
                            
                            if (state === 0) {
                                // OFF - vermelho
                                btnMostrarSiglaFx.classList.add('rect-toggle-fx-off');
                                span.textContent = 'SIGLA FX OFF';
                            } else if (state === 1) {
                                // PREVIEW - azul (sempre mostra)
                                btnMostrarSiglaFx.classList.add('rect-toggle-fx-on');
                                span.textContent = 'SIGLA FX PREVIEW';
                            } else { // state === 2
                                // LIVE MODE - roxo/amarelo (hÃ­brido)
                                btnMostrarSiglaFx.classList.add('rect-toggle-fx-live');
                                span.textContent = 'SIGLA FX LIVE MODE';
                            }
                        }

                        syncSiglaFxUI();

                        btnMostrarSiglaFx.addEventListener('click', function () {
                            // Cicla: 0 -> 1 -> 2 -> 0
                            let currentState = parseInt(mostrarSiglaFxInput.value);
                            currentState = (currentState + 1) % 3;
                            mostrarSiglaFxInput.value = currentState;
                            syncSiglaFxUI();
                            scheduleGlobalAutoSave();
                        });

                        // Debug opcional: mostra no console o estado carregado
                        console.log('[SIGLA FX] loaded from backend:', data.mostrarSiglaFX, '-> using:', siglaFxState);
                    }

                    // FX DISPLAY (novo): 2 botões
                    // - MODO: SIGLAS / ICONES / OFF  (0=OFF, 1=SIGLAS, 2=ICONES)
                    // - QUANDO: SEMPRE VISIVEL / LIVE MODE / NUNCA (0=SEMPRE, 1=LIVE MODE, 2=NUNCA)
                    (function initFxDisplayButtons() {
                        const fxModoInput = document.getElementById('mostrarFxModo');
                        const fxQuandoInput = document.getElementById('mostrarFxQuando');
                        const btnFxModo = document.getElementById('btnMostrarFxModo');
                        const btnFxQuando = document.getElementById('btnMostrarFxQuando');
                        const btnFxQuandoLabel = document.getElementById('btnMostrarFxQuandoLabel');
                        // Make btnFxModo optional
                        if (!fxModoInput || !fxQuandoInput || !btnFxQuando) return;

                        let fxModo = (typeof data.mostrarFxModo === 'number') ? data.mostrarFxModo : 1;
                        let fxQuando = (typeof data.mostrarFxQuando === 'number') ? data.mostrarFxQuando : 0;

                        // Fallback: legado mostrarSiglaFX (0=NUNCA, 1=SEMPRE, 2=LIVE MODE)
                        if (data.mostrarFxModo === undefined || data.mostrarFxQuando === undefined) {
                            let legacy = null;
                            if (typeof data.mostrarSiglaFX === 'number') legacy = data.mostrarSiglaFX;
                            else if (typeof data.mostrarSiglaFX === 'boolean') legacy = data.mostrarSiglaFX ? 1 : 0;

                            if (legacy !== null) {
                                // Converte: 0=NUNCA->quando=2, 1=SEMPRE->quando=0, 2=LIVE->quando=1
                                fxModo = 1; // SIGLAS (sempre ativo)
                                if (legacy === 0) {
                                    fxQuando = 2; // NUNCA
                                } else if (legacy === 2) {
                                    fxQuando = 1; // LIVE MODE
                                } else {
                                    fxQuando = 0; // SEMPRE
                                }
                            }
                        }

                        if (fxModo < 0 || fxModo > 2) fxModo = 1;
                        if (fxQuando < 0 || fxQuando > 2) fxQuando = 0;

                        fxModoInput.value = fxModo;
                        fxQuandoInput.value = fxQuando;

                        function syncFxUI() {
                            const modo = parseInt(fxModoInput.value);
                            const quando = parseInt(fxQuandoInput.value);

                            if (btnFxModo) {
                                const spanModo = btnFxModo.querySelector('span') || btnFxModo;
                                btnFxModo.classList.remove('rect-toggle-fx-off', 'rect-toggle-fx-on', 'rect-toggle-fx-live');
                                if (modo === 0) {
                                    btnFxModo.classList.add('rect-toggle-fx-off');
                                    spanModo.textContent = 'OFF';
                                } else if (modo === 1) {
                                    btnFxModo.classList.add('rect-toggle-fx-on');
                                    spanModo.textContent = 'SIGLAS';
                                } else {
                                    btnFxModo.classList.add('rect-toggle-fx-live');
                                    spanModo.textContent = 'ICONES';
                                }
                            }

                            btnFxQuando.classList.remove('rect-toggle-fx-on', 'rect-toggle-fx-live', 'rect-toggle-fx-off');
                            if (btnFxQuandoLabel) {
                                if (quando === 0) {
                                    btnFxQuando.classList.add('rect-toggle-fx-on');
                                    btnFxQuandoLabel.textContent = 'SEMPRE VISIVEL';
                                } else if (quando === 1) {
                                    btnFxQuando.classList.add('rect-toggle-fx-live');
                                    btnFxQuandoLabel.textContent = 'LIVE MODE';
                                } else {
                                    // quando === 2 -> NUNCA
                                    btnFxQuando.classList.add('rect-toggle-fx-off');
                                    btnFxQuandoLabel.textContent = 'NUNCA';
                                }
                            }

                            // Only disable if btnFxModo exists AND mode is 0. If btnFxModo is gone, assume we want control.
                            const disabled = btnFxModo ? (modo === 0) : false;
                            btnFxQuando.disabled = disabled;
                            btnFxQuando.style.opacity = disabled ? '0.55' : '1';
                        }

                        syncFxUI();

                        if (btnFxModo) {
                            btnFxModo.addEventListener('click', function () {
                                // SIGLAS -> ICONES -> OFF -> SIGLAS
                                let current = parseInt(fxModoInput.value);
                                if (current === 1) current = 2;
                                else if (current === 2) current = 0;
                                else current = 1;
                                fxModoInput.value = current;
                                syncFxUI();
                                scheduleGlobalAutoSave();
                            });
                        }

                        btnFxQuando.addEventListener('click', function () {
                            if (btnFxQuando.disabled) return;
                            let current = parseInt(fxQuandoInput.value);
                            // Ciclo: SEMPRE (0) -> LIVE MODE (1) -> NUNCA (2) -> SEMPRE (0)
                            current = (current + 1) % 3;
                            fxQuandoInput.value = current;
                            syncFxUI();
                            scheduleGlobalAutoSave();
                        });
                    })();

                    // Estado inicial BACKGROUND MODE (BACK PADRAO / BACK COLOR)
                    const bgToggle = document.getElementById('bgColorEnabled');
                    const btnBg = document.getElementById('btnBackgroundMode');
                    const btnBgLabel = document.getElementById('btnBackgroundModeLabel');
                    const bgPickerGroup = document.getElementById('backgroundColorPickerGroup');

                    if (bgToggle && btnBg && btnBgLabel) {
                        bgToggle.checked = !!data.backgroundEnabled;
                        const bgColorPreview = document.getElementById('backgroundSelectedColorPreview');
                        function syncBgUI() {
                            if (bgToggle.checked) {
                                // BACK COLOR (ON)
                                btnBg.classList.remove('rect-toggle-bg-off');
                                btnBg.classList.add('rect-toggle-bg-on');
                                btnBgLabel.textContent = 'BACK COLOR';
                                if (bgPickerGroup) bgPickerGroup.style.display = 'inline-flex';
                                if (bgColorPreview) bgColorPreview.style.display = '';
                            } else {
                                // BACK PADRAO (OFF)
                                btnBg.classList.remove('rect-toggle-bg-on');
                                btnBg.classList.add('rect-toggle-bg-off');
                                btnBgLabel.textContent = 'BACK PADRAO';
                                if (bgPickerGroup) bgPickerGroup.style.display = 'none';
                                if (bgColorPreview) bgColorPreview.style.display = 'none';
                            }
                        }
                        syncBgUI();
                        btnBg.addEventListener('click', function () {
                            bgToggle.checked = !bgToggle.checked;
                            syncBgUI();
                            scheduleGlobalAutoSave();
                        });
                    }
                    
                    // Carrega cores dos presets (A-E + F para LED NUMEROS = 6 cores)
                    ['A', 'B', 'C', 'D', 'E', 'F'].forEach((presetLetter, index) => {
                        createCustomColorSelector(
                            'preset' + presetLetter + 'SelectedColorPreview',
                            'preset' + presetLetter + 'ColorOptionsPanel',
                            PRESET_COLORS,
                            (colorUint32) => { selectedPresetColorsUint32[index] = colorUint32; },
                            data.coresPresetConfig ? data.coresPresetConfig[index] : 0,
                            false // isIndexBased = false
                        );
                    });

                    // Carrega cores do Live Mode
                    createCustomColorSelector(
                        'liveModeSelectedColorPreview',
                        'liveModeColorOptionsPanel',
                        PRESET_COLORS,
                        (colorUint32) => { selectedLiveModeColorUint32 = colorUint32; },
                        data.corLiveModeConfig,
                        false // isIndexBased = false
                    );
                    createCustomColorSelector(
                        'liveMode2SelectedColorPreview',
                        'liveMode2ColorOptionsPanel',
                        PRESET_COLORS,
                        (colorUint32) => { selectedLiveMode2ColorUint32 = colorUint32; },
                        data.corLiveMode2Config,
                        false // isIndexBased = false
                    );

                    // Estado inicial: LIVE Layer2 ON/OFF
                    const liveLayer2Checkbox = document.getElementById('liveLayer2Enabled');
                    const liveLayer2Button = document.getElementById('liveLayer2ToggleButton');
                    const liveLayer2Label = document.getElementById('liveLayer2ToggleLabel');
                    if (liveLayer2Checkbox && liveLayer2Button && liveLayer2Label) {
                        liveLayer2Checkbox.checked = (typeof data.liveLayer2Enabled === 'boolean') ? !!data.liveLayer2Enabled : false;
                        const syncLiveLayer2Button = () => {
                            const enabled = liveLayer2Checkbox.checked;
                            liveLayer2Label.textContent = enabled ? 'Layer 2 ON' : 'Layer 2 OFF';
                            liveLayer2Button.classList.toggle('off', !enabled);
                        };
                        syncLiveLayer2Button();
                        liveLayer2Button.addEventListener('click', () => {
                            liveLayer2Checkbox.checked = !liveLayer2Checkbox.checked;
                            syncLiveLayer2Button();
                            scheduleGlobalAutoSave();
                        });
                    }

                    // Carrega cor do Background
                    createCustomColorSelector(
                        'backgroundSelectedColorPreview',
                        'backgroundColorOptionsPanel',
                        BACKGROUND_COLORS,
                        (colorUint32) => { selectedBackgroundColorUint32 = colorUint32; },
                        data.backgroundColorConfig || 0x000000,
                        false // isIndexBased = false
                    );
                    
                    swGlobalConfig = normalizeSwGlobalConfig(data.swGlobal || {}); // Carrega o objeto swGlobal

                    // Mantem SW GLOBAL visivel por padrao para preservar a experiencia visual do editor
                    const swGlobalSection = document.querySelector('.section-swglobal');
                    if (swGlobalSection) {
                        const shouldShowSwGlobal = (typeof data.showSwGlobal === 'boolean') ? data.showSwGlobal : true;
                        if (shouldShowSwGlobal) {
                            swGlobalSection.style.display = '';
                            loadSwGlobalDataToUI();
                        } else {
                            swGlobalSection.style.display = 'none';
                        }
                    }

                    // Carrega estados LOCK
                    lockSetup = !!data.lockSetup;
                    lockGlobal = !!data.lockGlobal;
                    updateLockButtonsUI();
                    attachLockButtonsHandlers();

                    // Carrega LED Mode (LETRAS / NUMEROS)
                    ledModeNumeros = !!data.ledModeNumeros;
                    updateLedModeToggleUI();
                    attachLedModeToggleHandler();

                    const selectModeSelect = document.getElementById('selectModeIndex');
                    if (selectModeSelect) {
                        const logicModeParsed = parseInt(data.selectModeIndex, 10);
                        const logicMode = Number.isFinite(logicModeParsed) ? logicModeParsed : 0;
                        selectModeSelect.value = String(logicMode);
                        updateCustomSelectVisual(selectModeSelect);
                    }

                    // Carrega niveis de preset
                    presetLevels = normalizePresetLevels(data.presetLevels);
                    updatePresetLevelButtons();

                    // Carrega configuracao de INICIO AUTOMATICO
                    initAutoStartUI(data);

                    // Habilita auto-save somente apos carga completa dos dados
                    setTimeout(() => { _globalPageReady = true; }, 500);
                })
                .catch(error => {
                    console.error('Erro ao carregar configuracoes globais:', error);
                    statusMessage.textContent = 'Erro ao carregar configuracoes.';
                    statusMessage.style.color = 'red';
                    // Habilita auto-save mesmo com erro (usuario pode querer salvar manualmente)
                    _globalPageReady = true;
                });
        });

        // Funcao para mostrar/ocultar botao SHOW FX baseado no modo MIDI
        // Visivel apenas para: AMPERO AS2, A. STAGE 2, AMPERO MP350, HX STOMP
        function updateShowFxButtonVisibility(modoMidi) {
            const btnMostrarCadeia = document.getElementById('btnMostrarCadeia');
            const rowMostrarCadeia = document.getElementById('showFxChainRow');
            if (!btnMostrarCadeia && !rowMostrarCadeia) return;

            const modosComShowFx = ['AMPERO AS2', 'A. STAGE 2', 'AMPERO MP350', 'HX STOMP'];
            if (modosComShowFx.includes(modoMidi)) {
                if (rowMostrarCadeia) rowMostrarCadeia.style.display = '';
                if (btnMostrarCadeia) btnMostrarCadeia.style.display = '';
            } else {
                if (rowMostrarCadeia) rowMostrarCadeia.style.display = 'none';
                else if (btnMostrarCadeia) btnMostrarCadeia.style.display = 'none';
            }
        }

        function syncLedPreviewButton() {
            const ledPreviewCheckbox = document.getElementById('ledPreview');
            const ledPreviewButton = document.getElementById('ledPreviewButton');
            if (!ledPreviewCheckbox || !ledPreviewButton) return;

            const span = ledPreviewButton.querySelector('span') || ledPreviewButton;

            if (ledPreviewCheckbox.checked) {
                // ON - azul
                ledPreviewButton.classList.remove('rect-toggle-fx-off');
                ledPreviewButton.classList.add('rect-toggle-fx-on');
                span.textContent = 'ON';
            } else {
                // OFF - vermelho
                ledPreviewButton.classList.remove('rect-toggle-fx-on');
                ledPreviewButton.classList.add('rect-toggle-fx-off');
                span.textContent = 'OFF';
            }
        }

        (function initLedPreviewButton() {
            const ledPreviewCheckbox = document.getElementById('ledPreview');
            const ledPreviewButton = document.getElementById('ledPreviewButton');
            if (!ledPreviewCheckbox || !ledPreviewButton) return;

            syncLedPreviewButton();

            ledPreviewButton.addEventListener('click', function () {
                ledPreviewCheckbox.checked = !ledPreviewCheckbox.checked;
                syncLedPreviewButton();
                scheduleGlobalAutoSave();
            });
        })();

        // Previne submit manual do form (agora tudo e auto-save)
        form.addEventListener('submit', (event) => { event.preventDefault(); });

        async function saveGlobalConfig() {
            updateSwGlobalDataFromUI();
            const dataToSave = {
                ledBrilho: parseInt(ledBrilho),
                ledPreview: document.getElementById('ledPreview').checked,
                modoMidiIndex: modoMidiOptionsValues.indexOf(document.getElementById('modoMidi').value),
                mostrarTelaFX: document.getElementById('mostrarTelaFX').checked,
                mostrarCadeia: document.getElementById('mostrarCadeia').checked,
                mostrarFxModo: parseInt(document.getElementById('mostrarFxModo').value),
                mostrarFxQuando: parseInt(document.getElementById('mostrarFxQuando').value),
                coresPresetConfig: selectedPresetColorsUint32,
                corLiveModeConfig: selectedLiveModeColorUint32,
                corLiveMode2Config: selectedLiveMode2ColorUint32,
                liveLayer2Enabled: document.getElementById('liveLayer2Enabled') ? document.getElementById('liveLayer2Enabled').checked : true,
                kemperGetNames: document.getElementById('kemperGetNames') ? document.getElementById('kemperGetNames').checked : false,
                kemperAutoLoader: document.getElementById('kemperAutoLoader') ? document.getElementById('kemperAutoLoader').checked : false,
                backgroundEnabled: document.getElementById('bgColorEnabled') ? document.getElementById('bgColorEnabled').checked : false,
                backgroundColorConfig: selectedBackgroundColorUint32,
                selectModeIndex: parseInt(document.getElementById('selectModeIndex').value),
                swGlobal: swGlobalConfig,
                presetLevels: presetLevels,
                lockSetup: lockSetup,
                lockGlobal: lockGlobal,
                ledModeNumeros: ledModeNumeros,
                autoStartEnabled: document.getElementById('autoStartEnabled') ? document.getElementById('autoStartEnabled').checked : false,
                autoStartRow: parseInt(document.getElementById('autoStartRow')?.value || 0),
                autoStartCol: parseInt(document.getElementById('autoStartCol')?.value || 0),
                autoStartLiveMode: document.getElementById('autoStartLiveMode') ? document.getElementById('autoStartLiveMode').checked : false,
                advMidiCh: advMidiChData.slice(0, 5),
                advMidiChNum: advMidiChNumData.slice(0, 5)
            };

            try {
                const response = await fetch('/api/global-config/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataToSave)
                });
                const result = await response.json();
                if (result.success) {
                    showSavedBanner();
                } else {
                    console.warn('Erro ao salvar global:', result.message);
                }
            } catch (error) {
                console.error('Erro ao salvar configuracoes:', error);
            }
        }

        // --- AUTO-SAVE debounced ---
        let _globalAutoSaveTimer = null;
        function scheduleGlobalAutoSave() {
            if (_globalAutoSaveTimer) clearTimeout(_globalAutoSaveTimer);
            _globalAutoSaveTimer = setTimeout(() => { _globalAutoSaveTimer = null; saveGlobalConfig(); }, 1000);
        }

        // Event delegation via capture phase no body:
        // Necessario porque color panels sao appendados a document.body (fora de .grid)
        // e handlers de swatch usam stopPropagation(). Capture phase executa antes.
        let _globalPageReady = false;

        document.body.addEventListener('change', (e) => {
            if (!_globalPageReady) return;
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') scheduleGlobalAutoSave();
        }, true);
        document.body.addEventListener('input', (e) => {
            if (!_globalPageReady) return;
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') scheduleGlobalAutoSave();
        }, true);
        document.body.addEventListener('click', (e) => {
            if (!_globalPageReady) return;
            if (e.target.closest('.btn-voltar, .floating-footer-bar')) return;
            const el = e.target.closest('button, .toggle-button, .color-swatch, .swatch, .preset-level-box, .lock-btn, [data-action]');
            if (el) scheduleGlobalAutoSave();
        }, true);

        if (ledBrilhoButton) {
            ledBrilhoButton.addEventListener('click', () => {
                // ciclo 1..5 => 20..100
                ledBrilho = ledBrilho + 1;
                if (ledBrilho > 5) ledBrilho = 1;
                syncLedBrilhoUI();
                scheduleGlobalAutoSave();
            });
        }

        

        const presetLevelsContainer = document.getElementById('presetLevelsContainer');
        if (presetLevelsContainer) {
            presetLevelsContainer.addEventListener('click', (event) => {
                const target = event.target.closest('.preset-level-box');
                if (!target) return;
                const levelChar = target.dataset.level;
                const levelIndex = PRESET_LEVEL_KEYS.indexOf(levelChar);
                if (levelIndex === -1) return; // Should not happen

                const levels = ensurePresetLevelsArray();
                const currentlySelectedCount = levels.filter(Boolean).length;

                if (levels[levelIndex] && currentlySelectedCount <= 1) {
                    return; 
                }

                levels[levelIndex] = !levels[levelIndex];

                target.classList.toggle('selected', levels[levelIndex]);
                target.setAttribute('aria-pressed', levels[levelIndex] ? 'true' : 'false');
                // eslint-disable-next-line no-unused-expressions
                target.offsetHeight;

                updatePresetLevelButtons();
                scheduleGlobalAutoSave();
            });
            presetLevelsContainer.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                const target = event.target.closest('.preset-level-box');
                if (!target) return;
                event.preventDefault();
                target.click();
            });
        }

        function updatePresetLevelButtons() {
            const levels = ensurePresetLevelsArray();
            const boxes = presetLevelsContainer ? presetLevelsContainer.querySelectorAll('.preset-level-box') : [];
            boxes.forEach((box, index) => {
                const shouldBeSelected = !!levels[index];
                box.classList.toggle('selected', shouldBeSelected);
                box.setAttribute('aria-pressed', shouldBeSelected ? 'true' : 'false');
                box.setAttribute('role', 'button');
                box.setAttribute('tabindex', '0');
                // eslint-disable-next-line no-unused-expressions
                box.offsetHeight;
            });
        }


        function updateLockButtonsUI() {
            const setupBtn = document.getElementById('lockSetupBtn');
            const globalBtn = document.getElementById('lockGlobalBtn');

            if (setupBtn) {
                // selected = ATIVO (vermelho) conforme CSS atualizado
                setupBtn.classList.toggle('selected', !!lockSetup);
                setupBtn.offsetHeight;
            }
            if (globalBtn) {
                globalBtn.classList.toggle('selected', !!lockGlobal);
                globalBtn.offsetHeight;
            }
        }

        function attachLockButtonsHandlers() {
            const container = document.getElementById('lockButtonsContainer');
            if (!container) return;
            container.addEventListener('click', (event) => {
                const target = event.target.closest('.lock-button');
                if (!target) return;
                const type = target.dataset.lock; // 'setup' ou 'global'
                if (type === 'setup') {
                    lockSetup = !lockSetup;
                } else if (type === 'global') {
                    lockGlobal = !lockGlobal;
                }
                updateLockButtonsUI();
                scheduleGlobalAutoSave();
            });
        }

        // LED Mode Toggle (LETRAS / NUMEROS)
        function updateLedModeToggleUI() {
            const btn = document.getElementById('ledModeToggleButton');
            const label = document.getElementById('ledModeToggleLabel');
            const checkbox = document.getElementById('ledModeNumeros');
            const presetFColorItem = document.getElementById('presetFColorItem');
            if (btn && label) {
                if (ledModeNumeros) {
                    label.textContent = 'LED NUMEROS';
                    btn.classList.remove('rect-toggle-fx-on');
                    btn.classList.add('rect-toggle-fx-live');
                } else {
                    label.textContent = 'LED LETRAS';
                    btn.classList.remove('rect-toggle-fx-live');
                    btn.classList.add('rect-toggle-fx-on');
                }
            }
            if (checkbox) {
                checkbox.checked = ledModeNumeros;
            }
            // Show/hide 6th color picker based on mode
            if (presetFColorItem) {
                presetFColorItem.style.display = ledModeNumeros ? 'block' : 'none';
            }
            // Update all preset color labels based on mode
            const letterLabels = ['PRESET A:', 'PRESET B:', 'PRESET C:', 'PRESET D:', 'PRESET E:', 'SW 6:'];
            const numberLabels = ['SW 1:', 'SW 2:', 'SW 3:', 'SW 4:', 'SW 5:', 'SW 6:'];
            const labelIds = ['presetALabel', 'presetBLabel', 'presetCLabel', 'presetDLabel', 'presetELabel', 'presetFLabel'];
            const labels = ledModeNumeros ? numberLabels : letterLabels;
            labelIds.forEach((id, i) => {
                const el = document.getElementById(id);
                if (el) el.textContent = labels[i];
            });
        }

        function attachLedModeToggleHandler() {
            const btn = document.getElementById('ledModeToggleButton');
            if (!btn) return;
            btn.addEventListener('click', () => {
                ledModeNumeros = !ledModeNumeros;
                updateLedModeToggleUI();
                scheduleGlobalAutoSave();
            });
        }

        // INICIO AUTOMATICO - Inicializa UI e handlers
        function initAutoStartUI(data) {
            const toggleBtn = document.getElementById('autoStartToggleBtn');
            const toggleLabel = document.getElementById('autoStartToggleLabel');
            const checkbox = document.getElementById('autoStartEnabled');
            const rowInput = document.getElementById('autoStartRow');
            const colInput = document.getElementById('autoStartCol');
            const rowBtn = document.getElementById('autoStartRowBtn');
            const rowLabel = document.getElementById('autoStartRowLabel');
            const colBtn = document.getElementById('autoStartColBtn');
            const colLabel = document.getElementById('autoStartColLabel');

            if (!toggleBtn || !checkbox || !rowInput || !colInput) return;

            const rowLetters = ['A', 'B', 'C', 'D', 'E'];
            const colNumbers = ['1', '2', '3', '4', '5', '6'];

            // Carrega valores do backend
            checkbox.checked = !!data.autoStartEnabled;
            rowInput.value = data.autoStartRow || 0;
            colInput.value = data.autoStartCol || 0;

            // Sync visual do toggle ON/OFF
            function syncAutoStartToggle() {
                if (checkbox.checked) {
                    toggleBtn.classList.remove('rect-toggle-fx-off');
                    toggleBtn.classList.add('rect-toggle-fx-on');
                    toggleLabel.textContent = 'ON';
                } else {
                    toggleBtn.classList.remove('rect-toggle-fx-on');
                    toggleBtn.classList.add('rect-toggle-fx-off');
                    toggleLabel.textContent = 'OFF';
                }
            }
            syncAutoStartToggle();

            // Sync visual dos botoes de letra e numero
            function syncRowLabel() {
                if (rowLabel) {
                    const idx = parseInt(rowInput.value) || 0;
                    rowLabel.textContent = rowLetters[idx] || 'A';
                }
            }
            function syncColLabel() {
                if (colLabel) {
                    const idx = parseInt(colInput.value) || 0;
                    colLabel.textContent = colNumbers[idx] || '1';
                }
            }
            syncRowLabel();
            syncColLabel();

            // Toggle ON/OFF click
            toggleBtn.addEventListener('click', () => {
                checkbox.checked = !checkbox.checked;
                syncAutoStartToggle();
                scheduleGlobalAutoSave();
            });

            // Click handler para botao de letra - cicla A->B->C->D->E->A
            if (rowBtn) {
                rowBtn.addEventListener('click', () => {
                    let currentRow = parseInt(rowInput.value) || 0;
                    currentRow = (currentRow + 1) % rowLetters.length;
                    rowInput.value = currentRow;
                    syncRowLabel();
                    scheduleGlobalAutoSave();
                });
            }

            // Click handler para botao de numero - cicla 1->2->3->4->5->6->1
            if (colBtn) {
                colBtn.addEventListener('click', () => {
                    let currentCol = parseInt(colInput.value) || 0;
                    currentCol = (currentCol + 1) % 6;
                    colInput.value = currentCol;
                    syncColLabel();
                    scheduleGlobalAutoSave();
                });
            }

            // Botao PRESET MODE / LIVE MODE
            const liveModeBtn = document.getElementById('autoStartLiveModeBtn');
            const liveModeLabel = document.getElementById('autoStartLiveModeLabel');
            const liveModeCheckbox = document.getElementById('autoStartLiveMode');

            if (liveModeBtn && liveModeCheckbox) {
                liveModeCheckbox.checked = !!data.autoStartLiveMode;

                function syncLiveModeBtn() {
                    if (liveModeCheckbox.checked) {
                        liveModeBtn.classList.remove('rect-toggle-fx-off');
                        liveModeBtn.classList.add('rect-toggle-fx-on');
                        liveModeLabel.textContent = 'LIVE MODE';
                    } else {
                        liveModeBtn.classList.remove('rect-toggle-fx-on');
                        liveModeBtn.classList.add('rect-toggle-fx-off');
                        liveModeLabel.textContent = 'PRESET MODE';
                    }
                }
                syncLiveModeBtn();

                liveModeBtn.addEventListener('click', () => {
                    liveModeCheckbox.checked = !liveModeCheckbox.checked;
                    syncLiveModeBtn();
                    scheduleGlobalAutoSave();
                });
            }
        }

        function initializeSwGlobalFields() {
            populateSelect('switchMode', MODE_OPTIONS_WEB);
            populateNumericSelect('switchCC', 0, 127, 48);
            populateNumericSelect('switchChannel', 0, 16, 1);
            
            createCustomColorSelector(
                'selectedLedColorPreview',
                'swGlobalLedColorPanel',
                PRESET_COLORS,
                (colorIndex) => { 
                    selectedSwGlobalLedIndex = colorIndex;
                },
                0, // Cor inicial padrao (indice 0, Vermelho)
                true // isIndexBased = true
            );

            // Adiciona listeners
            document.getElementById('switchMode').addEventListener('change', function() {
                updateSwGlobalSpecificUI(this.value);
                scheduleGlobalAutoSave();
            });
            
            // Inicializa todos os selects como customizados
            ['modoMidi', 'selectModeIndex', 'switchMode', 'switchCC', 'switchChannel'].forEach(id => {
                const el = document.getElementById(id);
                if(el) {
                    // The wrapper div is now the parent of the select, so we pass the select itself.
                    initializeCustomSelect(el);
                }
            });
        }

        function loadSwGlobalDataToUI() {
            if (!swGlobalConfig) return;
            
            // Quando armazenado como RAMPA2/3/52, apresentamos como 'RAMPA' no seletor (valor 4)
            let uiModo = swGlobalConfig.modo || 0;
            if (uiModo === 5 || uiModo === 6 || uiModo === 52) uiModo = 4;
            document.getElementById('switchMode').value = uiModo;
            document.getElementById('switchCC').value = swGlobalConfig.cc || 48;
            document.getElementById('switchStart').checked = swGlobalConfig.start_value || false;
            document.getElementById('switchChannel').value = (swGlobalConfig.canal ?? 1);
            
            selectedSwGlobalLedIndex = swGlobalConfig.led || 0;
            selectedSwGlobalLed2Index = swGlobalConfig.led2 || 0;
            const initialColor = PRESET_COLORS[selectedSwGlobalLedIndex] || PRESET_COLORS[0];
            const previewBox = document.getElementById('selectedLedColorPreviewBox');
            if (previewBox) {
                previewBox.style.backgroundImage = `linear-gradient(to right, black 2%, ${initialColor.hex} 50%, black 98%)`;
            }

            updateCustomSelectVisual(document.getElementById('switchMode'));
            updateCustomSelectVisual(document.getElementById('switchCC'));
            updateCustomSelectVisual(document.getElementById('switchChannel'));

            updateSwGlobalSpecificUI(String(swGlobalConfig.modo));
            setTimeout(() => { syncSpinSendPcGlobal(!!swGlobalConfig.spin_send_pc, true); }, 0);
        }

        function updateSwGlobalDataFromUI() {
            if (!swGlobalConfig) swGlobalConfig = {};
            let modo = parseInt(document.getElementById('switchMode').value, 10);

            if (modo === 17) { // FAVORITE
                const favoriteSelect = document.getElementById('swFavoritePresetSelect_global');
                if (favoriteSelect) {
                    swGlobalConfig.cc = parseInt(favoriteSelect.value, 10);
                }
                const favToggle = document.getElementById('favoriteLiveToggle_global');
                if (favToggle) {
                    swGlobalConfig.favoriteAutoLive = !!favToggle.checked;
                }
            } else {
                swGlobalConfig.cc = parseInt(document.getElementById('switchCC').value, 10);
                // Clear favorite-only fields when not in FAVORITE
                swGlobalConfig.favoriteAutoLive = !!swGlobalConfig.favoriteAutoLive && false;
            }

            // RAMPA (UI consolidado): captura sliders e toggles de rampa
            if (modo === 4 || modo === 5 || modo === 6 || modo === 52) {
                const upEl = document.getElementById('rampUp_global');
                const dnEl = document.getElementById('rampDown_global');
                const invEl = document.getElementById('rampInvert_global');
                const autoEl = document.getElementById('rampAuto_global');
                if (upEl) swGlobalConfig.rampUp = parseInt(upEl.value, 10) || 0;
                if (dnEl) swGlobalConfig.rampDown = parseInt(dnEl.value, 10) || 0;
                if (invEl) swGlobalConfig.rampInvert = !!invEl.checked;
                if (autoEl) swGlobalConfig.rampAutoStop = !!autoEl.checked;
                // Normaliza modo para RAMPA unificado (4) na UI
                modo = 4;
            }

            // Armazena o modo final (apÃ³s tratar variantes de RAMPA)
            swGlobalConfig.modo = modo;
            
            swGlobalConfig.start_value = document.getElementById('switchStart').checked;
            const spinSendInput = document.getElementById('spinSendPcToggle_global');
            if (spinSendInput) {
                swGlobalConfig.spin_send_pc = !!spinSendInput.checked;
            } else if (swGlobalConfig.spin_send_pc === undefined) {
                swGlobalConfig.spin_send_pc = false;
            }
            {
                const chVal = parseInt(document.getElementById('switchChannel').value, 10);
                swGlobalConfig.canal = (!isNaN(chVal) && chVal >= 0 && chVal <= 16) ? chVal : 1;
            }
            swGlobalConfig.led = selectedSwGlobalLedIndex;
            // TAP TEMPO extras: capturar valores de TAP2/TAP3
            if (swGlobalConfig.modo === 18) {
                const t2cc = parseInt(document.getElementById("tap2_cc_global")?.value, 10);
                const t2ch = parseInt(document.getElementById("tap2_ch_global")?.value, 10);
                const t3cc = parseInt(document.getElementById("tap3_cc_global")?.value, 10);
                const t3ch = parseInt(document.getElementById("tap3_ch_global")?.value, 10);
                swGlobalConfig.tap2_cc = isNaN(t2cc) ? 0 : t2cc;
                swGlobalConfig.tap2_ch = isNaN(t2ch) ? 0 : t2ch;
                swGlobalConfig.tap3_cc = isNaN(t3cc) ? 0 : t3cc;
                swGlobalConfig.tap3_ch = isNaN(t3ch) ? 0 : t3ch;

                const cc2El = document.getElementById("switchCC2_global");
                if (cc2El) swGlobalConfig.cc2 = parseInt(cc2El.value, 10) || 0;
                const cc2ChEl = document.getElementById("switchChannelCC2_global");
                if (cc2ChEl) {
                    const chVal = parseInt(cc2ChEl.value, 10);
                    swGlobalConfig.canal_cc2 = (!isNaN(chVal) && chVal >= 0 && chVal <= 16) ? chVal : 1;
                    swGlobalConfig.cc2_ch = swGlobalConfig.canal_cc2;
                }
                const cc2StartEl = document.getElementById("switchCC2Start_global");
                swGlobalConfig.start_value_cc2 = !!(cc2StartEl && cc2StartEl.checked);
                swGlobalConfig.led2 = selectedSwGlobalLed2Index;
            }

            // Atualiza dados dos extras, se houver
            const modeValue = swGlobalConfig.modo;
            if (!swGlobalConfig.extras) swGlobalConfig.extras = {}; // Garante que extras exista

            if ((modeValue >= 1 && modeValue <= 3) || (modeValue >= 38 && modeValue <= 40)) { // SPIN
                const spinIndex = (modeValue >= 38) ? (modeValue - 38 + 3) : (modeValue - 1);
                if (!swGlobalConfig.extras.spin) swGlobalConfig.extras.spin = [{}, {}, {}];
                swGlobalConfig.extras.spin[spinIndex] = {
                    v1: parseInt(document.getElementById(`spinV1_${spinIndex}`)?.value, 10) || 0,
                    v2: parseInt(document.getElementById(`spinV2_${spinIndex}`)?.value, 10) || 0,
                    v3: parseInt(document.getElementById(`spinV3_${spinIndex}`)?.value, 10) || 0,
                };
            } else if (modeValue >= 7 && modeValue <= 9) { // CONTROL
                const controlIndex = modeValue - 7;
                if (!swGlobalConfig.extras.control) swGlobalConfig.extras.control = [{}, {}, {}];
                swGlobalConfig.extras.control[controlIndex] = {
                    cc: parseInt(document.getElementById(`controlCC_${controlIndex}`)?.value, 10) || 0,
                    modo_invertido: document.getElementById(`controlInvertToggle_${controlIndex}`)?.checked || false,
                };
            } else if ((modeValue >= 10 && modeValue <= 15) || (modeValue >= 22 && modeValue <= 27)) { // CUSTOM
                const customIndex = (modeValue >= 10 && modeValue <= 15) ? modeValue - 10 : modeValue - 22;
                if (!swGlobalConfig.extras.custom) swGlobalConfig.extras.custom = [{},{},{},{},{},{}];
                swGlobalConfig.extras.custom[customIndex] = {
                    valor_off: parseInt(document.getElementById(`customOff_${customIndex}`)?.value, 10) || 0,
                    valor_on: parseInt(document.getElementById(`customOn_${customIndex}`)?.value, 10) || 127,
                };
            }
        }

        function updateSwGlobalSpecificUI(modeValueStr) {
            const modeValue = parseInt(modeValueStr);
            const dynamicArea = document.getElementById('dynamicModeConfigArea');
            dynamicArea.innerHTML = '';
            dynamicArea.style.display = 'none';
            let needsInit = false;

            const ccField = document.getElementById('ccFieldFormGroup');
            if (ccField) ccField.style.display = 'block'; // Mostra por padrao
            // Restaura visibilidade padrao de Start e Canal
            try { const startEl = document.getElementById('switchStart'); startEl?.closest('.form-group')?.style && (startEl.closest('.form-group').style.display = 'block'); } catch (e) {}
            try { const chEl = document.getElementById('switchChannel'); chEl?.closest('.form-group')?.style && (chEl.closest('.form-group').style.display = 'block'); } catch (e) {}
            
            document.getElementById('swFavoritePresetContainer_global')?.remove();
            // Remove UI anterior de rampa (se existir)
            document.getElementById('rampGroup_global')?.remove();

            if (modeValue === 17) { // FAVORITE
                if(ccField) ccField.style.display = 'none';

                // Hide Start and Channel groups to match PRESET FAVORITE behavior
                try {
                    const startEl = document.getElementById('switchStart');
                    startEl?.closest('.form-group')?.style && (startEl.closest('.form-group').style.display = 'none');
                } catch (e) { /* ignore */ }
                try {
                    const chEl = document.getElementById('switchChannel');
                    chEl?.closest('.form-group')?.style && (chEl.closest('.form-group').style.display = 'none');
                } catch (e) { /* ignore */ }

                const initialFavPresetIdx = swGlobalConfig.cc || 0; // Favorite preset index is stored in the 'cc' field
                const favoriteSelectElement = createFavoritePresetSelect('global', initialFavPresetIdx);
                // Create LIVE mode toggle for FAVORITE (independent from preset one)
                const favLiveGroup = document.createElement('div');
                favLiveGroup.className = 'form-group';
                favLiveGroup.appendChild(newLabel('MODO LIVE:'));
                newToggleSwitch('favoriteLiveToggle_global', !!swGlobalConfig.favoriteAutoLive, favLiveGroup);

                const switchModeFormGroup = document.getElementById('switchMode').closest('.form-group');
                if (switchModeFormGroup) {
                    switchModeFormGroup.insertAdjacentElement('afterend', favoriteSelectElement);
                    favoriteSelectElement.insertAdjacentElement('afterend', favLiveGroup);
                } else {
                    dynamicArea.appendChild(favoriteSelectElement);
                    dynamicArea.appendChild(favLiveGroup);
                    dynamicArea.style.display = 'block';
                }
                needsInit = true;
            }

            // RAMPA: UI consolidado (subida/descida + NORMAL/INVERTIDO + AUTO STOP)
            if (modeValue === 4 || modeValue === 5 || modeValue === 6 || modeValue === 52) {
                try { const startEl = document.getElementById('switchStart'); startEl?.closest('.form-group')?.style && (startEl.closest('.form-group').style.display = 'none'); } catch (e) {}

                const upVal = (typeof swGlobalConfig.rampUp === 'number') ? swGlobalConfig.rampUp : 1000;
                const dnVal = (typeof swGlobalConfig.rampDown === 'number') ? swGlobalConfig.rampDown : 1000;
                const invVal = !!swGlobalConfig.rampInvert;
                const autoVal = (swGlobalConfig.rampAutoStop === undefined) ? true : !!swGlobalConfig.rampAutoStop;

                const rGroup = document.createElement('div');
                rGroup.className = 'extras-group';
                rGroup.id = 'rampGroup_global';
                rGroup.innerHTML = `
                    <h4>RAMPA</h4>
                    <div class="ramp-grid">
                      <div class="ramp-sliders">
                        <div class="spin-slider-container">
                          <label for="rampUp_global">Tempo SUBIDA (ms):</label>
                          <input type="range" class="spin-slider" id="rampUp_global" min="0" max="3000" step="100" value="${upVal}">
                          <span id="rampUp_global_val" class="slider-value">${upVal} ms</span>
                        </div>
                        <div class="spin-slider-container">
                          <label for="rampDown_global">Tempo DESCIDA (ms):</label>
                          <input type="range" class="spin-slider" id="rampDown_global" min="0" max="3000" step="100" value="${dnVal}">
                          <span id="rampDown_global_val" class="slider-value">${dnVal} ms</span>
                        </div>
                      </div>
                      <div>
                        <div class="ramp-toggle-row">
                          <input type="checkbox" id="rampInvert_global" style="display:none;" ${invVal? 'checked':''}>
                          <button type="button" id="rampInvertBtn_global" class="single-toggle-button" aria-pressed="${invVal? 'true':'false'}">${invVal? 'INVERTIDO':'NORMAL'}</button>
                          <input type="checkbox" id="rampAuto_global" style="display:none;" ${autoVal? 'checked':''}>
                          <button type="button" id="rampAutoBtn_global" class="single-toggle-button" aria-pressed="${autoVal? 'true':'false'}">AUTO STOP ${autoVal? 'ON':'OFF'}</button>
                        </div>
                      </div>
                    </div>
                `;
                const ledGroup = document.getElementById('selectedLedColorPreview')?.closest('.form-group');
                if (ledGroup) {
                    ledGroup.insertAdjacentElement('afterend', rGroup);
                } else {
                    dynamicArea.appendChild(rGroup); dynamicArea.style.display = 'block';
                }

                const upEl = document.getElementById('rampUp_global');
                const upValEl = document.getElementById('rampUp_global_val');
                const dnEl = document.getElementById('rampDown_global');
                const dnValEl = document.getElementById('rampDown_global_val');
                const invEl = document.getElementById('rampInvert_global');
                const invBtn = document.getElementById('rampInvertBtn_global');
                const autoEl = document.getElementById('rampAuto_global');
                const autoBtn = document.getElementById('rampAutoBtn_global');
                const updateFill = (el) => { const v = Math.max(0, Math.min(3000, parseInt(el.value,10)||0)); const p = Math.round((v/3000)*100); el.style.background = `linear-gradient(to right, #7fa6e8 ${p}%, #2a2e33 ${p}%)`; };
                if (upEl && upValEl) { updateFill(upEl); upEl.addEventListener('input', () => { upValEl.textContent = `${upEl.value} ms`; updateFill(upEl); }); }
                if (dnEl && dnValEl) { updateFill(dnEl); dnEl.addEventListener('input', () => { dnValEl.textContent = `${dnEl.value} ms`; updateFill(dnEl); }); }
                if (invEl && invBtn) {
                    const syncInv = () => { if (invEl.checked) { invBtn.classList.add('active'); invBtn.setAttribute('aria-pressed','true'); invBtn.textContent = 'INVERTIDO'; } else { invBtn.classList.remove('active'); invBtn.setAttribute('aria-pressed','false'); invBtn.textContent = 'NORMAL'; } };
                    syncInv(); invEl.addEventListener('change', syncInv);
                    invBtn.addEventListener('click',(e)=>{ e.preventDefault(); invEl.checked = !invEl.checked; syncInv(); invEl.dispatchEvent(new Event('change',{bubbles:true})); });
                }
                if (autoEl && autoBtn) {
                    const syncAuto = () => { if (autoEl.checked) { autoBtn.classList.add('active'); autoBtn.setAttribute('aria-pressed','true'); autoBtn.textContent = 'AUTO STOP ON'; } else { autoBtn.classList.remove('active'); autoBtn.setAttribute('aria-pressed','false'); autoBtn.textContent = 'AUTO STOP OFF'; } };
                    syncAuto(); autoEl.addEventListener('change', syncAuto);
                    autoBtn.addEventListener('click',(e)=>{ e.preventDefault(); autoEl.checked = !autoEl.checked; syncAuto(); autoEl.dispatchEvent(new Event('change',{bubbles:true})); });
                }
            }

            if (!swGlobalConfig.extras) { // Garante que o objeto extras exista
                swGlobalConfig.extras = { spin:[{},{},{}], control:[{},{},{}], custom:[{},{},{},{},{},{}] };
            }

            if ((modeValue >= 1 && modeValue <= 3) || (modeValue >= 38 && modeValue <= 40)) { // SPIN
                const spinIndex = (modeValue >= 38) ? (modeValue - 38 + 3) : (modeValue - 1);
                const data = swGlobalConfig.extras.spin?.[spinIndex] || {v1:0, v2:64, v3:127};
                generateSingleSpinUI(dynamicArea, data, spinIndex, !!swGlobalConfig.spin_send_pc);
                syncSpinSendPcGlobal(!!swGlobalConfig.spin_send_pc, true);
                dynamicArea.style.display = 'block';
                needsInit = true;
            } else if (modeValue >= 7 && modeValue <= 9) { // CONTROL
                const controlIndex = modeValue - 7;
                const data = swGlobalConfig.extras.control?.[controlIndex] || {cc:48, modo_invertido:false};
                generateSingleControlUI(dynamicArea, data, controlIndex);
                dynamicArea.style.display = 'block';
                needsInit = true;
            } else if ((modeValue >= 10 && modeValue <= 15) || (modeValue >= 22 && modeValue <= 27)) { // CUSTOM
                const customIndex = (modeValue >= 10 && modeValue <= 15) ? modeValue - 10 : modeValue - 22;
                const showOnlyOn = (modeValue >= 22 && modeValue <= 27);
                const data = swGlobalConfig.extras.custom?.[customIndex] || {valor_off:0, valor_on:127};
                generateSingleCustomUI(dynamicArea, data, customIndex, showOnlyOn);
                dynamicArea.style.display = 'block';
                needsInit = true;
            }
            else if (modeValue === 18) { // TAP TEMPO
                const group = document.createElement("div"); group.className = "form-group";
                group.innerHTML = '<h4>Configuracoes de TAP Adicionais</h4>';
                
                const row2 = document.createElement("div"); row2.className = "custom-inline-group";
                const t2cc = document.createElement("div"); t2cc.className = "custom-value-container";
                t2cc.appendChild(newLabel("TAP2 CC:"));
                t2cc.appendChild(newNumericInput("tap2_cc_global", 0, 127, (swGlobalConfig.tap2_cc||0)));
                row2.appendChild(t2cc);
                const t2ch = document.createElement("div"); t2ch.className = "custom-value-container";
                t2ch.appendChild(newLabel("TAP2 Canal:"));
                t2ch.appendChild(newNumericInput("tap2_ch_global", 0, 16, (swGlobalConfig.tap2_ch||0)));
                row2.appendChild(t2ch);
                group.appendChild(row2);

                const row3 = document.createElement("div"); row3.className = "custom-inline-group";
                const t3cc = document.createElement("div"); t3cc.className = "custom-value-container";
                t3cc.appendChild(newLabel("TAP3 CC:"));
                t3cc.appendChild(newNumericInput("tap3_cc_global", 0, 127, (swGlobalConfig.tap3_cc||0)));
                row3.appendChild(t3cc);
                const t3ch = document.createElement("div"); t3ch.className = "custom-value-container";
                t3ch.appendChild(newLabel("TAP3 Canal:"));
                t3ch.appendChild(newNumericInput("tap3_ch_global", 0, 16, (swGlobalConfig.tap3_ch||0)));
                row3.appendChild(t3ch);
                group.appendChild(row3);

                dynamicArea.appendChild(group);

                const cc2Group = document.createElement("div"); cc2Group.className = "form-group";
                cc2Group.innerHTML = '<h4>CC2 (toque longo)</h4>';

                const cc2Row = document.createElement("div"); cc2Row.className = "custom-inline-group";
                const cc2cc = document.createElement("div"); cc2cc.className = "custom-value-container";
                cc2cc.appendChild(newLabel("CC2:"));
                cc2cc.appendChild(newNumericInput("switchCC2_global", 0, 127, (swGlobalConfig.cc2 || 0)));
                cc2Row.appendChild(cc2cc);
                const cc2ch = document.createElement("div"); cc2ch.className = "custom-value-container";
                cc2ch.appendChild(newLabel("CH:"));
                const cc2ChVal = (typeof swGlobalConfig.canal_cc2 === 'number') ? swGlobalConfig.canal_cc2
                               : (typeof swGlobalConfig.cc2_ch === 'number') ? swGlobalConfig.cc2_ch
                               : 1;
                cc2ch.appendChild(newNumericInput("switchChannelCC2_global", 0, 16, cc2ChVal));
                cc2Row.appendChild(cc2ch);
                cc2Group.appendChild(cc2Row);

                const cc2Row2 = document.createElement("div"); cc2Row2.className = "custom-inline-group";
                const led2Cont = document.createElement("div"); led2Cont.className = "custom-value-container";
                led2Cont.appendChild(newLabel("LED2:"));
                const led2Picker = document.createElement("div");
                led2Picker.className = "custom-color-selector";
                led2Picker.style.width = "100%";
                led2Picker.innerHTML = `
                    <div id="swGlobalLed2SelectedColorPreview" class="selected-color-preview" tabindex="0">
                         <div id="swGlobalLed2SelectedColorPreviewBox" class="selected-color-preview-box"></div>
                    </div>
                    <input type="hidden" id="swGlobalLed2ColorValue" name="swGlobalLed2ColorValue">
                `;
                led2Cont.appendChild(led2Picker);
                cc2Row2.appendChild(led2Cont);

                const startWrap = document.createElement("div"); startWrap.className = "custom-value-container";
                const startInput = document.createElement("input");
                startInput.type = "checkbox";
                startInput.id = "switchCC2Start_global";
                startInput.style.display = "none";
                startInput.checked = !!swGlobalConfig.start_value_cc2;
                startWrap.appendChild(startInput);
                const startBtn = document.createElement("button");
                startBtn.type = "button";
                startBtn.id = "startToggleBtnCc2_global";
                startBtn.className = "single-toggle-button";
                startWrap.appendChild(startBtn);
                cc2Row2.appendChild(startWrap);
                cc2Group.appendChild(cc2Row2);

                dynamicArea.appendChild(cc2Group);

                selectedSwGlobalLed2Index = swGlobalConfig.led2 || 0;
                createCustomColorSelector(
                    "swGlobalLed2SelectedColorPreview",
                    "swGlobalLed2ColorPanel",
                    PRESET_COLORS,
                    (colorIndex) => { selectedSwGlobalLed2Index = colorIndex; },
                    selectedSwGlobalLed2Index,
                    true
                );

                const syncCc2Start = () => {
                    if (startInput.checked) {
                        startBtn.classList.add("active");
                        startBtn.setAttribute("aria-pressed", "true");
                        startBtn.textContent = "-INICIAR FX LIGADO-";
                    } else {
                        startBtn.classList.remove("active");
                        startBtn.setAttribute("aria-pressed", "false");
                        startBtn.textContent = "-INICIAR FX DESLIGADO-";
                    }
                };
                syncCc2Start();
                startInput.addEventListener("change", () => { syncCc2Start(); updateSwGlobalDataFromUI(); scheduleGlobalAutoSave(); });
                startBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    startInput.checked = !startInput.checked;
                    syncCc2Start();
                    startInput.dispatchEvent(new Event("change", { bubbles: true }));
                });

                dynamicArea.style.display = "block";
                needsInit = true;
            }

            if (!needsInit && dynamicArea && dynamicArea.children.length === 0) {
                const noExtra = document.createElement('div');
                noExtra.className = 'swglobal-no-extra';
                noExtra.textContent = 'Sem configuracoes adicionais para este modo.';
                dynamicArea.appendChild(noExtra);
                dynamicArea.style.display = 'block';
            }

            if (needsInit) { dynamicArea.querySelectorAll('select').forEach(el => initializeCustomSelect(el)); }
        }

        function populateSelect(id, options) {
            const select = document.getElementById(id);
            if (!select) return;
            select.innerHTML = '';
            options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.text;
                select.appendChild(option);
            });
        }

        function isChannelSelectId(id) {
            const lower = (id || '').toLowerCase();
            return lower.includes('channel') || lower.includes('_ch');
        }

        function populateNumericSelect(id, min, max, def) {
            const sel = document.getElementById(id);
            if (!sel) return;
            sel.innerHTML = '';
            const isChannelSelect = isChannelSelectId(id);
            for (let i = min; i <= max; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = (isChannelSelect && i === 0) ? 'X' : i;
                if (i === def) opt.selected = true;
                sel.appendChild(opt);
            }
        }

        function updateCustomSelectVisual() { return; }

        function newLabel(text) { const l = document.createElement('label'); l.textContent = text; return l; }
        function newNumericInput(id, min, max, value) {
            const sel = document.createElement('select');
            sel.id = id;
            const isChannelSelect = isChannelSelectId(id);
            for (let i = min; i <= max; i++) {
                const opt = document.createElement('option');
                opt.value = i; opt.textContent = (isChannelSelect && i === 0) ? 'X' : i;
                if (i === value) opt.selected = true;
                sel.appendChild(opt);
            }
            // Adiciona listener para atualizar a barra de progresso
            sel.addEventListener('change', () => updateSpinKnobVisual(id));

            const wrapper = document.createElement('div');
            wrapper.className = 'studio-select-wrapper relative';
            wrapper.dataset.selectId = id;
            wrapper.appendChild(sel);
            const chevron = document.createElement('div');
            chevron.className = 'absolute right-3 top-1/2 -translate-y-1/4 pointer-events-none text-gray-500';
            chevron.innerHTML = '<span class="material-symbols-outlined text-sm">expand_more</span>';
            wrapper.appendChild(chevron);
            return wrapper;
        }
        function newToggleSwitch(id, initialChecked, parentElement) {
            const label = document.createElement('label');
            label.className = 'toggle-label';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = id;
            input.checked = initialChecked;
            const span = document.createElement('span');
            span.className = 'toggle-switch';
            span.innerHTML = '<span class="toggle-slider"></span>';
            label.appendChild(input);
            label.appendChild(span);
            parentElement.appendChild(label);
        }
        function generateSingleSpinUI(parent, data, index, sendAsPc = false) {
            const group = document.createElement('div'); group.className = 'extras-group';
            group.innerHTML = `<h4>SPIN ${index + 1}</h4>`;

            const sendRow = document.createElement('div');
            sendRow.className = 'form-group';
            const sendLabel = newLabel('Envio:');
            sendRow.appendChild(sendLabel);
            const sendCheckbox = document.createElement('input');
            sendCheckbox.type = 'checkbox';
            sendCheckbox.id = 'spinSendPcToggle_global';
            sendCheckbox.style.display = 'none';
            sendCheckbox.checked = !!sendAsPc;
            const sendBtn = document.createElement('button');
            sendBtn.type = 'button';
            sendBtn.id = 'spinSendPcBtn_global';
            sendBtn.className = 'single-toggle-button';
            sendRow.appendChild(sendCheckbox);
            sendRow.appendChild(sendBtn);
            group.appendChild(sendRow);
            const syncSpinSend = () => {
                syncSpinSendPcGlobal(undefined, true);
                try { updateSwGlobalDataFromUI(); } catch(_) {}
                scheduleGlobalAutoSave();
            };
            sendCheckbox.addEventListener('change', syncSpinSend);
            sendBtn.addEventListener('click', (e) => { e.preventDefault(); sendCheckbox.checked = !sendCheckbox.checked; syncSpinSend(); });
            syncSpinSendPcGlobal(!!sendAsPc);

            const row = document.createElement('div'); row.className = 'spin-values-row';
            ['Valor 1:', 'Valor 2:', 'Valor 3:'].forEach((lbl, i) => {
                const item = document.createElement('div'); item.className = 'spin-value-item';
                const selectId = `spinV${i+1}_${index}`;
                item.appendChild(newLabel(lbl));
                item.appendChild(newNumericInput(selectId, 0, 127, data[`v${i+1}`]));
                
                const knobPlaceholder = document.createElement('div'); 
                knobPlaceholder.className = 'spin-knob-placeholder';
                const progressBar = document.createElement('div');
                progressBar.className = 'spin-knob-progress-bar';
                progressBar.id = `${selectId}_progress`; 
                const percentageText = document.createElement('span');
                percentageText.id = `${selectId}_text`; 
                progressBar.appendChild(percentageText);
                knobPlaceholder.appendChild(progressBar);
                item.appendChild(knobPlaceholder);

                row.appendChild(item);
                setTimeout(() => updateSpinKnobVisual(selectId), 0);
            });
            group.appendChild(row); parent.appendChild(group);
        }
        function generateSingleControlUI(parent, data, index) {
            const group = document.createElement('div'); group.className = 'extras-group';
            group.innerHTML = `<h4>CONTROL ${index + 1}</h4>`;
            const row = document.createElement('div'); row.className = 'control-inline-group';
            const ccCont = document.createElement('div'); ccCont.className = 'control-cc-container';
            ccCont.appendChild(newLabel('CC:'));
            ccCont.appendChild(newNumericInput(`controlCC_${index}`, 0, 127, data.cc));
            row.appendChild(ccCont);
            const toggleCont = document.createElement('div'); toggleCont.className = 'control-toggle-container';
            toggleCont.appendChild(newLabel('Invertido:'));
            newToggleSwitch(`controlInvertToggle_${index}`, data.modo_invertido, toggleCont);
            row.appendChild(toggleCont);
            group.appendChild(row); parent.appendChild(group);
        }
        function generateSingleCustomUI(parent, data, index, showOnlyOn) {
            const group = document.createElement('div'); group.className = 'extras-group';
            group.innerHTML = `<h4>CUSTOM ${index + 1}</h4>`;
            const row = document.createElement('div'); row.className = 'custom-inline-group';

            if (!showOnlyOn) {
                const offCont = document.createElement('div'); offCont.className = 'custom-value-container';
                const offSelectId = `customOff_${index}`;
                offCont.appendChild(newLabel('Valor OFF:'));
                offCont.appendChild(newNumericInput(offSelectId, 0, 127, data.valor_off));
                const knobOff = document.createElement('div'); knobOff.className = 'spin-knob-placeholder';
                knobOff.innerHTML = `<div class="spin-knob-progress-bar" id="${offSelectId}_progress"><span id="${offSelectId}_text"></span></div>`;
                offCont.appendChild(knobOff);
                row.appendChild(offCont);
                setTimeout(() => updateSpinKnobVisual(offSelectId), 0);
            }

            const onCont = document.createElement('div'); onCont.className = 'custom-value-container';
            const onSelectId = `customOn_${index}`;
            onCont.appendChild(newLabel('Valor ON:'));
            onCont.appendChild(newNumericInput(onSelectId, 0, 127, data.valor_on));
            const knobOn = document.createElement('div'); knobOn.className = 'spin-knob-placeholder';
            knobOn.innerHTML = `<div class="spin-knob-progress-bar" id="${onSelectId}_progress"><span id="${onSelectId}_text"></span></div>`;
            onCont.appendChild(knobOn);
            row.appendChild(onCont);
            setTimeout(() => updateSpinKnobVisual(onSelectId), 0);

            group.appendChild(row); parent.appendChild(group);
        }

        function updateSpinKnobVisual(selectId) {
            const selectElement = document.getElementById(selectId);
            const progressBar = document.getElementById(selectId + '_progress');
            const textElement = document.getElementById(selectId + '_text');
            if (selectElement && progressBar && textElement) {
                const value = parseInt(selectElement.value, 10);
                const percentage = Math.round((value / 127) * 100);
                progressBar.style.width = percentage + '%';
                textElement.textContent = percentage + '%';
            }
        }

        function createFavoritePresetSelect(swNum, initialValue = 0) {
            const originalSelectId = `swFavoritePresetSelect_${swNum}`;
            const containerId = `swFavoritePresetContainer_${swNum}`;
            
            document.getElementById(containerId)?.remove();

            const formGroup = document.createElement('div');
            formGroup.className = 'form-group'; 
            formGroup.id = containerId;

            const label = document.createElement('label');
            label.htmlFor = originalSelectId;
            label.textContent = 'Preset (A1-F6):';
            formGroup.appendChild(label);

            const select = document.createElement('select');
            select.id = originalSelectId;
            select.name = originalSelectId;

            // Gera opÃ§Ãµes em ordem linha->coluna (A1..A6, B1..B6, ..., F1..F6)
            // Valor do option = Ã­ndice global row-major: idx = r * 6 + c
            for (let r = 0; r < 5; r++) { // A..E
                for (let c = 0; c < 6; c++) { // 1..6
                    const idx = r * 6 + c;
                    const option = document.createElement('option');
                    option.value = idx;
                    option.textContent = String.fromCharCode(65 + r) + (c + 1);
                    if (idx === initialValue) option.selected = true;
                    select.appendChild(option);
                }
            }
            
            const wrapper = document.createElement('div');
            wrapper.className = 'studio-select-wrapper relative';
            wrapper.dataset.selectId = originalSelectId;
            wrapper.appendChild(select);
            const chevron = document.createElement('div');
            chevron.className = 'absolute right-3 top-1/2 -translate-y-1/4 pointer-events-none text-gray-500';
            chevron.innerHTML = '<span class="material-symbols-outlined text-sm">expand_more</span>';
            wrapper.appendChild(chevron);
            formGroup.appendChild(wrapper);

            // Initialize this new select as a custom one
            initializeCustomSelect(select);

            return formGroup;
        }
