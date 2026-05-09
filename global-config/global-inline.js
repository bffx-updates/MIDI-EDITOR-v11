    <script>
        function showSavedBanner() {
            const bannerId = 'saveBanner';
            let banner = document.getElementById(bannerId);
            if (!banner) {
                banner = document.createElement('div');
                banner.id = bannerId;
                banner.className = 'save-banner';
                banner.setAttribute('aria-hidden', 'true');
                banner.textContent = 'SALVO!';
                document.body.appendChild(banner);
            }
            banner.classList.add('show');
            banner.setAttribute('aria-hidden', 'false');
            banner.style.display = 'block';
            // Hide after 500ms (fade out quickly)
            setTimeout(() => {
                banner.classList.remove('show');
                banner.setAttribute('aria-hidden', 'true');
                setTimeout(() => { banner.style.display = 'none'; }, 150);
            }, 500);
        }

        const form = document.getElementById('globalConfigForm');
        const statusMessage = document.getElementById('statusMessage');
        const ledBrilhoButton = document.getElementById('ledBrilhoButton');
        let ledBrilho = 3; // 1..5 => 20..100%
        
        const modoMidiSelect = document.getElementById('modoMidi');
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
        const modoMidiOptionsValues = ["GLOBAL", "AMPERO AS2", "AMPERO MINI", "HX STOMP", "A. STAGE 2", "GP-200LT", "VALETON GP5", "POCKET MASTER", "TONEX", "KEMPER PLAYER", "AMPERO MP350", "MX5", "NANO CORTEX", "QUAD CORTEX", "MODO AVANCADO", "SYNERGY AMPS", "BigSky", "BlueSky", "TimeLine", "ELCAPISTAN", "FLINT", "HX-ONE", "VTR NARCISO", "VTR LOKI", "VTR KAILANI", "BFMiDi - Keyboard"];
        // Modos amigaveis disponiveis para cada canal no MODO AVANCADO (exclui MODO AVANCADO de si mesmo)
        const advMidiModeOptions = ["GLOBAL", "AMPERO AS2", "AMPERO MINI", "HX STOMP", "A. STAGE 2", "GP-200LT", "VALETON GP5", "POCKET MASTER", "TONEX", "KEMPER PLAYER", "AMPERO MP350", "MX5", "NANO CORTEX", "QUAD CORTEX", "SYNERGY AMPS", "BigSky", "BlueSky", "TimeLine", "ELCAPISTAN", "FLINT", "HX-ONE", "VTR NARCISO", "VTR LOKI", "VTR KAILANI", "BFMiDi - Keyboard"];
        let advMidiChData = [0,0,0,0,0]; // indices into modoMidiOptionsValues (0-13)
        let advMidiChNumData = [1,2,3,4,5]; // MIDI channel numbers (1-16)

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
        let ledModeNumeros = false; // false = LED LETRAS (A-F), true = LED NUMEROS (1-6)

        let swGlobalConfig = {};
        let globalConfigBootstrapping = true;
        let globalAutoSaveTimer = null;
        let globalSaveInFlight = false;
        let globalSaveQueued = false;
        let lastGlobalSavedPayload = '';
        const kemperGetNamesCheckbox = document.getElementById('kemperGetNames');
        const kemperGetNamesButton = document.getElementById('kemperGetNamesBtn');
        const kemperGetNamesLabel = document.getElementById('kemperGetNamesLabel');
        const kemperGetNamesWrap = document.getElementById('kemperGetNamesWrap');
        const kemperRigManagerModeCheckbox = document.getElementById('kemperRigManagerMode');
        const kemperRigManagerModeButton = document.getElementById('kemperRigManagerModeBtn');
        const kemperRigManagerModeLabel = document.getElementById('kemperRigManagerModeLabel');

        function dispatchSyntheticChange(el) {
            if (!el) return;
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function syncKemperGetNamesButton() {
            if (!kemperGetNamesCheckbox || !kemperGetNamesButton || !kemperGetNamesLabel) return;
            const enabled = !!kemperGetNamesCheckbox.checked;
            kemperGetNamesButton.classList.toggle('rect-toggle-fx-on', enabled);
            kemperGetNamesButton.classList.toggle('rect-toggle-fx-off', !enabled);
            kemperGetNamesLabel.textContent = enabled ? 'GET NAMES ON' : 'GET NAMES OFF';
        }

        function syncKemperRigManagerModeButton() {
            if (!kemperRigManagerModeCheckbox || !kemperRigManagerModeButton || !kemperRigManagerModeLabel) return;
            const enabled = !!kemperRigManagerModeCheckbox.checked;
            kemperRigManagerModeButton.classList.toggle('rect-toggle-fx-on', enabled);
            kemperRigManagerModeButton.classList.toggle('rect-toggle-fx-off', !enabled);
            kemperRigManagerModeLabel.textContent = enabled ? 'MODO RECONECT' : 'MODO NORMAL';
        }

        function updateKemperGetNamesVisibility(modoMidi) {
            if (!kemperGetNamesWrap) return;
            kemperGetNamesWrap.style.display = (modoMidi === 'KEMPER PLAYER') ? '' : 'none';
        }

        function buildCustomSelectOption(selectElement, optionNode, wrapper, refreshFn) {
            const customOption = document.createElement('div');
            customOption.classList.add('custom-option');
            customOption.textContent = optionNode.text;
            customOption.dataset.value = optionNode.value;

            if (optionNode.disabled) {
                customOption.classList.add('separator');
                customOption.setAttribute('aria-hidden', 'true');
                return customOption;
            }

            if (optionNode.selected) customOption.classList.add('selected');
            customOption.addEventListener('click', (e) => {
                e.stopPropagation();
                selectElement.value = optionNode.value;
                refreshFn();
                wrapper.classList.remove('open');
                selectElement.dispatchEvent(new Event('change', { bubbles: true }));
            });
            return customOption;
        }

        function initAdvMidiChDropdowns() {
            for (let i = 0; i < 5; i++) {
                const sel = document.getElementById('advMidiChMode' + i);
                if (!sel) continue;
                sel.innerHTML = '';
                advMidiModeOptions.forEach(function(mode, idx) {
                    const opt = document.createElement('option');
                    opt.value = idx;
                    opt.textContent = mode;
                    sel.appendChild(opt);
                });
                sel.value = advMidiChData[i] || 0;
                sel.addEventListener('change', function() {
                    advMidiChData[i] = parseInt(this.value, 10);
                });
                // Channel number dropdown
                const numSel = document.getElementById('advMidiChNum' + i);
                if (numSel) {
                    numSel.value = advMidiChNumData[i] || (i + 1);
                    numSel.addEventListener('change', function() {
                        advMidiChNumData[i] = parseInt(this.value, 10);
                    });
                }
                
                // Inicializa o visual customizado
                if (typeof initializeCustomSelect === 'function') {
                    if (numSel) {
                        initializeCustomSelect(numSel);
                        updateCustomSelectVisual(numSel);
                    }
                    initializeCustomSelect(sel);
                    updateCustomSelectVisual(sel);
                }
            }
        }

        function updateAdvMidiChVisibility(modoMidi) {
            const wrap = document.getElementById('advMidiChWrap');
            if (!wrap) return;
            wrap.style.display = (modoMidi === 'MODO AVANCADO') ? '' : 'none';
        }

        function requestGlobalAutoSave(delayMs = 500) {
            return;
        }

        function buildGlobalConfigPayload() {
            const formData = new FormData(form);
            updateSwGlobalDataFromUI(); // Garante que os dados da UI estao no objeto JS
            return {
                ledBrilho: parseInt(ledBrilho),
                ledPreview: document.getElementById('ledPreview').checked,
                modoMidiIndex: modoMidiOptionsValues.indexOf(formData.get('modoMidi')),
                // SHOW FX SCREEN legado (usado pelo firmware para tela/cadeia FX)
                mostrarTelaFX: document.getElementById('mostrarTelaFX').checked,
                // CADEIA segue o mesmo estado (para uso futuro se necessario)
                mostrarCadeia: document.getElementById('mostrarCadeia').checked,
                // SIGLA FX controla apenas exibicao das siglas FX na MAIN SCREEN (0=OFF, 1=PREVIEW, 2=LIVE MODE)
                mostrarFxModo: parseInt(document.getElementById('mostrarFxModo').value),
                mostrarFxQuando: parseInt(document.getElementById('mostrarFxQuando').value),

                coresPresetConfig: selectedPresetColorsUint32,
                corLiveModeConfig: selectedLiveModeColorUint32,
                corLiveMode2Config: selectedLiveMode2ColorUint32,
                liveLayer2Enabled: document.getElementById('liveLayer2Enabled') ? document.getElementById('liveLayer2Enabled').checked : true,
                kemperGetNames: kemperGetNamesCheckbox ? kemperGetNamesCheckbox.checked : false,
                kemperRigManagerMode: kemperRigManagerModeCheckbox ? kemperRigManagerModeCheckbox.checked : false,
                selectModeIndex: parseInt(formData.get('selectModeIndex')),
                swGlobal: swGlobalConfig, // Adiciona o objeto completo do SW Global
                presetLevels: presetLevels,
                // LED Mode (LETRAS / NUMEROS)
                ledModeNumeros: ledModeNumeros,
                // INICIO AUTOMATICO
                autoStartEnabled: document.getElementById('autoStartEnabled') ? document.getElementById('autoStartEnabled').checked : false,
                autoStartRow: parseInt(document.getElementById('autoStartRow')?.value || 0),
                autoStartCol: parseInt(document.getElementById('autoStartCol')?.value || 0),
                autoStartLiveMode: document.getElementById('autoStartLiveMode') ? document.getElementById('autoStartLiveMode').checked : false,
                advMidiCh: advMidiChData.slice(0, 5),
                advMidiChNum: advMidiChNumData.slice(0, 5),
                expCC: parseInt(document.getElementById('expCC')?.value || 11),
                expCanal: parseInt(document.getElementById('expCanal')?.value || 1)
            };
        }

        function submitGlobalConfig(options = {}) {
            const silent = !!options.silent;
            const force = !!options.force;
            if (!form) return Promise.resolve(false);

            const dataToSave = buildGlobalConfigPayload();
            const payloadKey = JSON.stringify(dataToSave);
            if (!force && payloadKey === lastGlobalSavedPayload) {
                return Promise.resolve(false);
            }

            if (globalSaveInFlight) {
                globalSaveQueued = true;
                return Promise.resolve(false);
            }

            globalSaveInFlight = true;
            if (!silent) {
                statusMessage.textContent = 'Salvando...';
                statusMessage.style.color = 'orange';
            }

            return fetch('/api/global-config/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSave)
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    lastGlobalSavedPayload = payloadKey;
                    if (!silent) {
                        statusMessage.textContent = 'Configuracoes salvas com sucesso!';
                        statusMessage.style.color = 'green';
                        setTimeout(() => { statusMessage.textContent = ''; }, 5000);
                    }
                    setTimeout(() => {
                        showSavedBanner();
                    }, 100);
                    return true;
                }

                statusMessage.textContent = 'Erro ao salvar: ' + (result.message || 'Erro desconhecido.');
                statusMessage.style.color = 'red';
                setTimeout(() => { statusMessage.textContent = ''; }, 5000);
                return false;
            })
            .catch(error => {
                console.error('Erro ao salvar configuracoes:', error);
                statusMessage.textContent = 'Erro de comunicacao ao salvar.';
                statusMessage.style.color = 'red';
                setTimeout(() => { statusMessage.textContent = ''; }, 5000);
                return false;
            })
            .finally(() => {
                globalSaveInFlight = false;
                if (globalSaveQueued) {
                    globalSaveQueued = false;
                    submitGlobalConfig({ silent: true });
                }
            });
        }

        function normalizeSwGlobalConfig(cfg) {
            if (!cfg) return {};
            if (cfg.spin_send_pc === undefined) cfg.spin_send_pc = false;
            if (cfg.cc2 === undefined) cfg.cc2 = 0;
            if (cfg.tap_mode2 === undefined) cfg.tap_mode2 = false;
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
                    requestGlobalAutoSave(220);
                    overlayElement.classList.remove('active');
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

        function initializeCustomSelect(selectElement) {
            if (!selectElement) return;
            
            // Find the wrapper. The HTML might already have it.
            let wrapper = selectElement.closest('.custom-select-wrapper');
            
            // If the wrapper already has the trigger, it's initialized.
            if (wrapper && wrapper.querySelector('.custom-select-trigger')) {
                return;
            }

            // If no wrapper, create one and move the select inside.
            if (!wrapper) {
                wrapper = document.createElement('div');
                wrapper.classList.add('custom-select-wrapper');
                selectElement.parentNode.insertBefore(wrapper, selectElement);
                wrapper.appendChild(selectElement);
            }

            const trigger = document.createElement('div');
            trigger.classList.add('custom-select-trigger');
            wrapper.appendChild(trigger);

            const optionsPanel = document.createElement('div');
            optionsPanel.classList.add('custom-options-panel');
            wrapper.appendChild(optionsPanel);

            function updateTriggerText() {
                const selectedOption = selectElement.options[selectElement.selectedIndex];
                trigger.textContent = selectedOption ? selectedOption.text : '';
                const currentCustomSelected = optionsPanel.querySelector('.custom-option.selected');
                if (currentCustomSelected) currentCustomSelected.classList.remove('selected');
                const newCustomSelected = Array.from(optionsPanel.children).find(opt => opt.dataset.value === selectElement.value);
                if (newCustomSelected) newCustomSelected.classList.add('selected');
            }

            Array.from(selectElement.options).forEach(optionNode => {
                optionsPanel.appendChild(buildCustomSelectOption(selectElement, optionNode, wrapper, updateTriggerText));
            });

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                // Fecha outros dropdowns abertos
                document.querySelectorAll('.custom-select-wrapper.open').forEach(openWrapper => {
                    if (openWrapper !== wrapper) {
                        openWrapper.classList.remove('open');
                    }
                });
                // Alterna o estado do dropdown atual
                wrapper.classList.toggle('open');
            });

            updateTriggerText();
        }

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
            initializeSwGlobalFields();

            fetch('/api/global-config/read')
                .then(response => response.json())
                .then(data => {
                    ledBrilho = data.ledBrilho || 3;
                    if (ledBrilhoButton) {
                        const pct = ledBrilho * 20;
                        ledBrilhoButton.textContent = 'BRILHO LED ' + pct + '%';
                    }

                    const ledPreviewCheckbox = document.getElementById('ledPreview');
                    const ledPreviewButton = document.getElementById('ledPreviewButton');
                    if (ledPreviewCheckbox && ledPreviewButton) {
                        ledPreviewCheckbox.checked = !!data.ledPreview;
                        syncLedPreviewButton();
                    }
                    if (modoMidiSelect) {
                        modoMidiSelect.value = modoMidiOptionsValues[data.modoMidiIndex];
                        updateCustomSelectVisual(modoMidiSelect);
                        // Atualiza visibilidade do botao SHOW FX baseado no modo MIDI
                        updateShowFxButtonVisibility(modoMidiSelect.value);
                        if (kemperGetNamesCheckbox) {
                            kemperGetNamesCheckbox.checked = !!data.kemperGetNames;
                            syncKemperGetNamesButton();
                        }
                        if (kemperRigManagerModeCheckbox) {
                            kemperRigManagerModeCheckbox.checked = !!data.kemperRigManagerMode;
                            syncKemperRigManagerModeButton();
                        }
                        updateKemperGetNamesVisibility(modoMidiSelect.value);
                        // MODO AVANCADO: carrega dados per-channel
                        if (data.advMidiCh && Array.isArray(data.advMidiCh)) {
                            for (let i = 0; i < 5; i++) {
                                advMidiChData[i] = (typeof data.advMidiCh[i] === 'number') ? data.advMidiCh[i] : 0;
                            }
                        }
                        if (data.advMidiChNum && Array.isArray(data.advMidiChNum)) {
                            for (let i = 0; i < 5; i++) {
                                advMidiChNumData[i] = (typeof data.advMidiChNum[i] === 'number') ? data.advMidiChNum[i] : (i + 1);
                            }
                        }
                        initAdvMidiChDropdowns();
                        updateAdvMidiChVisibility(modoMidiSelect.value);
                        // Adiciona listener para mudanca de modo MIDI
                        modoMidiSelect.addEventListener('change', function() {
                            updateShowFxButtonVisibility(this.value);
                            updateKemperGetNamesVisibility(this.value);
                            updateAdvMidiChVisibility(this.value);
                        });
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
                            dispatchSyntheticChange(mostrarCadeiaCheckbox);
                            dispatchSyntheticChange(mostrarTelaFxCheckbox);
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
                                dispatchSyntheticChange(fxModoInput);
                            });
                        }

                        btnFxQuando.addEventListener('click', function () {
                            if (btnFxQuando.disabled) return;
                            let current = parseInt(fxQuandoInput.value);
                            // Ciclo: SEMPRE (0) -> LIVE MODE (1) -> NUNCA (2) -> SEMPRE (0)
                            current = (current + 1) % 3;
                            fxQuandoInput.value = current;
                            syncFxUI();
                            dispatchSyntheticChange(fxQuandoInput);
                        });
                    })();

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
                            dispatchSyntheticChange(liveLayer2Checkbox);
                        });
                    }

                    swGlobalConfig = normalizeSwGlobalConfig(data.swGlobal || {}); // Carrega o objeto swGlobal

                    // Esconde card SW GLOBAL para placas que nao tem TAP_FULL (7S e 4S)
                    const boardName = data.boardName || '';
                    const boards7S = ['BFMIDI-1 7S_A1', 'BFMIDI-1 7S_B1', 'BFMIDI-1 7S_C1', 'BFMIDI-2 7S', 'BFMIDI-1 4S', 'BFMIDI-3 7S'];
                    const swGlobalSection = document.querySelector('.section-swglobal');
                    if (swGlobalSection) {
                        if (boards7S.includes(boardName)) {
                            swGlobalSection.style.display = 'block';
                            loadSwGlobalDataToUI();
                        } else {
                            swGlobalSection.style.display = 'none';
                        }
                    }

                    // Mostra card PEDAL DE EXPRESSAO apenas para BFMIDI-3 6S
                    const expSection = document.querySelector('.section-exp');
                    if (expSection) {
                        if (boardName === 'BFMIDI-3 6S') {
                            expSection.style.display = 'block';
                            initExpPedalCard(data);
                        } else {
                            expSection.style.display = 'none';
                        }
                    }

                    // Carrega LED Mode (LETRAS / NUMEROS)
                    ledModeNumeros = !!data.ledModeNumeros;
                    updateLedModeToggleUI();
                    attachLedModeToggleHandler();

                    const selectModeSelect = document.getElementById('selectModeIndex');
                    if (selectModeSelect) {
                        selectModeSelect.value = data.selectModeIndex;
                        updateCustomSelectVisual(selectModeSelect);
                    }

                    // Carrega niveis de preset
                    if (data.presetLevels) {
                        presetLevels = data.presetLevels;
                        updatePresetLevelButtons();
                    }

                    // Carrega configuracao de INICIO AUTOMATICO
                    initAutoStartUI(data);

                    // Baseline para deduplicar autosave sem gravar na carga inicial
                    lastGlobalSavedPayload = JSON.stringify(buildGlobalConfigPayload());
                    globalConfigBootstrapping = false;
                })
                .catch(error => {
                    console.error('Erro ao carregar configuracoes globais:', error);
                    statusMessage.textContent = 'Erro ao carregar configuracoes.';
                    statusMessage.style.color = 'red';
                    globalConfigBootstrapping = false;
                });
        });

        // Funcao para mostrar/ocultar botao SHOW FX baseado no modo MIDI
        // Visivel apenas para: AMPERO AS2, A. STAGE 2, AMPERO MP350, HX STOMP
        function updateShowFxButtonVisibility(modoMidi) {
            const btnMostrarCadeia = document.getElementById('btnMostrarCadeia');
            if (!btnMostrarCadeia) return;

            const modosComShowFx = ['AMPERO AS2', 'A. STAGE 2', 'AMPERO MP350', 'HX STOMP'];
            if (modosComShowFx.includes(modoMidi)) {
                btnMostrarCadeia.style.display = '';
            } else {
                btnMostrarCadeia.style.display = 'none';
            }
        }

        function initExpPedalCard(data) {
            // Popula select CC (0-127)
            const ccSel = document.getElementById('expCC');
            const chSel = document.getElementById('expCanal');
            if (ccSel && ccSel.options.length === 0) {
                for (let i = 0; i <= 127; i++) {
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.textContent = i;
                    ccSel.appendChild(opt);
                }
            }
            if (chSel && chSel.options.length === 0) {
                for (let i = 1; i <= 16; i++) {
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.textContent = i;
                    chSel.appendChild(opt);
                }
            }
            if (ccSel) { ccSel.value = data.expCC !== undefined ? data.expCC : 11; updateCustomSelectVisual(ccSel); }
            if (chSel) { chSel.value = data.expCanal !== undefined ? data.expCanal : 1; updateCustomSelectVisual(chSel); }

            // Mostra valores calibrados atuais nos botoes
            const calMinInput = document.getElementById('expCalMin');
            const calMaxInput = document.getElementById('expCalMax');
            const cal0Label = document.getElementById('expCal0Label');
            const cal100Label = document.getElementById('expCal100Label');
            if (calMinInput && data.expCalMin !== undefined) calMinInput.value = data.expCalMin;
            if (calMaxInput && data.expCalMax !== undefined) calMaxInput.value = data.expCalMax;
            if (cal0Label && data.expCalMin !== undefined) cal0Label.textContent = 'CALIBRAR 0% [' + data.expCalMin + ']';
            if (cal100Label && data.expCalMax !== undefined) cal100Label.textContent = 'CALIBRAR 100% [' + data.expCalMax + ']';

            // Botao CALIBRAR 0%
            const cal0Btn = document.getElementById('expCal0Btn');
            if (cal0Btn && !cal0Btn._expInitDone) {
                cal0Btn._expInitDone = true;
                cal0Btn.addEventListener('click', function () {
                    cal0Btn.disabled = true;
                    fetch('/api/exp-calibrate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'min' })
                    })
                    .then(function (r) { return r.ok ? r.json() : null; })
                    .then(function (res) {
                        if (res && res.value !== undefined) {
                            if (calMinInput) calMinInput.value = res.value;
                            if (cal0Label) cal0Label.textContent = 'CALIBRAR 0% [' + res.value + ']';
                        }
                    })
                    .catch(function () {})
                    .finally(function () { cal0Btn.disabled = false; });
                });
            }

            // Botao CALIBRAR 100%
            const cal100Btn = document.getElementById('expCal100Btn');
            if (cal100Btn && !cal100Btn._expInitDone) {
                cal100Btn._expInitDone = true;
                cal100Btn.addEventListener('click', function () {
                    cal100Btn.disabled = true;
                    fetch('/api/exp-calibrate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'max' })
                    })
                    .then(function (r) { return r.ok ? r.json() : null; })
                    .then(function (res) {
                        if (res && res.value !== undefined) {
                            if (calMaxInput) calMaxInput.value = res.value;
                            if (cal100Label) cal100Label.textContent = 'CALIBRAR 100% [' + res.value + ']';
                        }
                    })
                    .catch(function () {})
                    .finally(function () { cal100Btn.disabled = false; });
                });
            }

            // Polling da barra de progresso (inicia ao abrir o card)
            if (!window._expBarPollTimer) {
                window._expBarPollTimer = setInterval(function () {
                    const expSection = document.querySelector('.section-exp');
                    if (!expSection || expSection.style.display === 'none') return;
                    fetch('/api/exp-adc')
                        .then(function (r) { return r.ok ? r.json() : null; })
                        .then(function (res) {
                            if (!res || !res.ok) return;
                            const bar = document.getElementById('expPedalBar');
                            const lbl = document.getElementById('expAdcRawLabel');
                            if (bar) bar.style.width = res.pct + '%';
                            if (lbl) lbl.textContent = 'ADC: ' + res.raw;
                        })
                        .catch(function () {});
                }, 100);
            }
        }

        (function initKemperGetNamesButton() {
            if (!kemperGetNamesCheckbox || !kemperGetNamesButton) return;

            syncKemperGetNamesButton();

            kemperGetNamesButton.addEventListener('click', function () {
                kemperGetNamesCheckbox.checked = !kemperGetNamesCheckbox.checked;
                syncKemperGetNamesButton();
                dispatchSyntheticChange(kemperGetNamesCheckbox);
            });
        })();

        (function initKemperRigManagerModeButton() {
            if (!kemperRigManagerModeCheckbox || !kemperRigManagerModeButton) return;

            syncKemperRigManagerModeButton();

            kemperRigManagerModeButton.addEventListener('click', function () {
                kemperRigManagerModeCheckbox.checked = !kemperRigManagerModeCheckbox.checked;
                syncKemperRigManagerModeButton();
                dispatchSyntheticChange(kemperRigManagerModeCheckbox);
            });
        })();

        function syncLedPreviewButton() {
            const ledPreviewCheckbox = document.getElementById('ledPreview');
            const ledPreviewButton = document.getElementById('ledPreviewButton');
            if (!ledPreviewCheckbox || !ledPreviewButton) return;

            const span = ledPreviewButton.querySelector('span') || ledPreviewButton;

            if (ledPreviewCheckbox.checked) {
                // ON - azul
                ledPreviewButton.classList.remove('rect-toggle-fx-off');
                ledPreviewButton.classList.add('rect-toggle-fx-on');
                span.textContent = 'LED PREVIEW ON';
            } else {
                // OFF - vermelho
                ledPreviewButton.classList.remove('rect-toggle-fx-on');
                ledPreviewButton.classList.add('rect-toggle-fx-off');
                span.textContent = 'LED PREVIEW OFF';
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
                dispatchSyntheticChange(ledPreviewCheckbox);
            });
        })();

        (function initGlobalFooterMenu() {
            document.getElementById('btnNavPreset')?.addEventListener('click', () => { window.location.href = '/preset-config'; });
            document.getElementById('btnNavGlobal')?.addEventListener('click', () => { window.location.href = '/global-config'; });
            document.getElementById('btnNavSystem')?.addEventListener('click', () => { window.location.href = '/system'; });

            document.getElementById('btnSalvarFooter')?.addEventListener('click', () => {
                submitGlobalConfig({ silent: false, force: true });
            });
        })();

        if (form) {
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                submitGlobalConfig({ silent: false, force: true });
            });

            form.addEventListener('change', () => {
                requestGlobalAutoSave();
            });

            form.addEventListener('input', () => {
                requestGlobalAutoSave();
            });
        }
        if (ledBrilhoButton) {
            ledBrilhoButton.addEventListener('click', () => {
                // ciclo 1..5 => 20..100
                ledBrilho = ledBrilho + 1;
                if (ledBrilho > 5) ledBrilho = 1;
                const pct = ledBrilho * 20;
                ledBrilhoButton.textContent = 'BRILHO LED ' + pct + '%';
                requestGlobalAutoSave();
            });
        }

        

        const presetLevelsContainer = document.getElementById('presetLevelsContainer');
        const presetLevelMap = ['A', 'B', 'C', 'D', 'E'];
        if (presetLevelsContainer) {
            presetLevelsContainer.addEventListener('click', (event) => {
                const target = event.target.closest('.preset-level-box');
                if (!target) return;
                const levelChar = target.dataset.level;
                const levelIndex = presetLevelMap.indexOf(levelChar);
                if (levelIndex === -1) return; // Should not happen

                const currentlySelectedCount = presetLevels.filter(Boolean).length;

                if (presetLevels[levelIndex] && currentlySelectedCount <= 1) {
                    return; 
                }

                presetLevels[levelIndex] = !presetLevels[levelIndex];

                target.classList.toggle('selected', presetLevels[levelIndex]);
                // eslint-disable-next-line no-unused-expressions
                target.offsetHeight;

                updatePresetLevelButtons();
                requestGlobalAutoSave();
            });
        }

        function updatePresetLevelButtons() {
            const boxes = presetLevelsContainer ? presetLevelsContainer.querySelectorAll('.preset-level-box') : [];
            boxes.forEach((box, index) => {
                const shouldBeSelected = !!presetLevels[index];
                box.classList.toggle('selected', shouldBeSelected);
                // eslint-disable-next-line no-unused-expressions
                box.offsetHeight;
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
                requestGlobalAutoSave();
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
                    let idx = parseInt(rowInput.value) || 0;
                    if (idx < 0 || idx >= rowLetters.length) {
                        idx = 0;
                        rowInput.value = 0;
                    }
                    rowLabel.textContent = rowLetters[idx];
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
                dispatchSyntheticChange(checkbox);
            });

            // Click handler para botao de letra - cicla A->B->C->D->E->A
            if (rowBtn) {
                rowBtn.addEventListener('click', () => {
                    let currentRow = parseInt(rowInput.value) || 0;
                    currentRow = (currentRow + 1) % 5;
                    rowInput.value = currentRow;
                    syncRowLabel();
                    dispatchSyntheticChange(rowInput);
                });
            }

            // Click handler para botao de numero - cicla 1->2->3->4->5->6->1
            if (colBtn) {
                colBtn.addEventListener('click', () => {
                    let currentCol = parseInt(colInput.value) || 0;
                    currentCol = (currentCol + 1) % 6;
                    colInput.value = currentCol;
                    syncColLabel();
                    dispatchSyntheticChange(colInput);
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
                    dispatchSyntheticChange(liveModeCheckbox);
                });
            }
        }

        function initializeSwGlobalFields() {
            populateSelect('switchMode', MODE_OPTIONS_WEB);
            populateNumericSelect('switchCC', 0, 127, 0);
            populateNumericSelect('switchChannel', 0, 16, 0);
            
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
            });
            
            // Inicializa todos os selects como customizados
            ['modoMidi', 'selectModeIndex', 'switchMode', 'switchCC', 'switchChannel'].forEach(id => {
                const el = document.getElementById(id);
                if(el) {
                    // The wrapper div is now the parent of the select, so we pass the select itself.
                    initializeCustomSelect(el);
                }
            });

            // Start toggle button (igual ao PRESET)
            (function(){
                const syncStartBtn = () => {
                    const cb = document.getElementById('switchStart');
                    const btn = document.getElementById('startToggleBtn');
                    if (!cb || !btn) return;
                    if (cb.checked) {
                        btn.classList.add('active');
                        btn.setAttribute('aria-pressed','true');
                        btn.textContent = 'INICIAR LIGADO';
                    } else {
                        btn.classList.remove('active');
                        btn.setAttribute('aria-pressed','false');
                        btn.textContent = 'INICIAR DESLIGADO';
                    }
                };
                const cb = document.getElementById('switchStart');
                const btn = document.getElementById('startToggleBtn');
                if (cb && btn) {
                    syncStartBtn();
                    cb.addEventListener('change', syncStartBtn);
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        cb.checked = !cb.checked;
                        syncStartBtn();
                        cb.dispatchEvent(new Event('change', { bubbles: true }));
                    });
                }
                window._syncStartBtn = syncStartBtn;
            })();
        }

        function loadSwGlobalDataToUI() {
            if (!swGlobalConfig) return;
            
            // Quando armazenado como RAMPA2/3/52, apresentamos como 'RAMPA' no seletor (valor 4)
            let uiModo = swGlobalConfig.modo || 0;
            if (uiModo === 5 || uiModo === 6 || uiModo === 52) uiModo = 4;
            document.getElementById('switchMode').value = uiModo;
            document.getElementById('switchCC').value = (swGlobalConfig.cc ?? 0);
            document.getElementById('switchStart').checked = swGlobalConfig.start_value || false;
            if (window._syncStartBtn) window._syncStartBtn();
            document.getElementById('switchChannel').value = (swGlobalConfig.canal ?? 0);

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
                const tapM2BtnG = document.getElementById("tapMode2Btn_global");
                swGlobalConfig.tap_mode2 = tapM2BtnG ? tapM2BtnG.classList.contains("active") : false;

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
            if (ccField) ccField.style.display = ''; // Mostra por padrao
            // Restaura visibilidade padrao de Start e Canal
            try { const startEl = document.getElementById('switchStart'); startEl?.closest('.form-group')?.style && (startEl.closest('.form-group').style.display = ''); } catch (e) {}
            try { const chEl = document.getElementById('switchChannel'); chEl?.closest('.form-group')?.style && (chEl.closest('.form-group').style.display = ''); } catch (e) {}
            
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
                const data = swGlobalConfig.extras.control?.[controlIndex] || {cc:0, modo_invertido:false};
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

                // MODO TAP toggle (MODO 1 / MODO 2)
                const tapModeRow = document.createElement("div"); tapModeRow.className = "form-group start-group-centered"; tapModeRow.style.marginTop = "8px";
                const tapModeBtn_g = document.createElement("button"); tapModeBtn_g.type = "button"; tapModeBtn_g.id = "tapMode2Btn_global";
                const isTapMode2_g = !!(swGlobalConfig.tap_mode2);
                tapModeBtn_g.className = "single-toggle-button" + (isTapMode2_g ? " active" : "");
                tapModeBtn_g.setAttribute("aria-pressed", isTapMode2_g ? "true" : "false");
                tapModeBtn_g.textContent = isTapMode2_g ? "MODO 2" : "MODO 1";
                tapModeBtn_g.addEventListener("click", function() {
                    const isOn = tapModeBtn_g.classList.toggle("active");
                    tapModeBtn_g.setAttribute("aria-pressed", isOn ? "true" : "false");
                    tapModeBtn_g.textContent = isOn ? "MODO 2" : "MODO 1";
                    updateSwGlobalDataFromUI();
                });
                tapModeRow.appendChild(tapModeBtn_g);
                group.appendChild(tapModeRow);

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
                startInput.addEventListener("change", () => { syncCc2Start(); updateSwGlobalDataFromUI(); });
                startBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    startInput.checked = !startInput.checked;
                    syncCc2Start();
                    startInput.dispatchEvent(new Event("change", { bubbles: true }));
                });

                dynamicArea.style.display = "block";
                needsInit = true;
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

        function getModeForChannelGlobal(channel) {
            const currentMode = document.getElementById('modoMidi') ? document.getElementById('modoMidi').value : "GLOBAL";
            if (currentMode !== "MODO AVANCADO") return currentMode;
            const ch = parseInt(channel, 10);
            for (let i = 0; i < 5; i++) {
                if (advMidiChNumData[i] === ch) {
                    return advMidiModeOptions[advMidiChData[i] || 0] || "GLOBAL";
                }
            }
            return advMidiModeOptions[advMidiChData[0] || 0] || "GLOBAL";
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
                let txt = i;
                if (isChannelSelect && i === 0) {
                    txt = 'X';
                } else if (isChannelSelect && i > 0) {
                    const cellMode = getModeForChannelGlobal(i);
                    if (cellMode && cellMode !== "GLOBAL") {
                        txt = `${i} - ${cellMode}`;
                    }
                }
                opt.textContent = txt;
                if (i === def) opt.selected = true;
                sel.appendChild(opt);
            }
            // Sync the custom-select visual after repopulating options
            updateCustomSelectVisual(sel);
        }

        function updateCustomSelectVisual(selectElement) {
            if (!selectElement) return;
            const wrapper = selectElement.closest('.custom-select-wrapper');
            if (!wrapper) return;
            const trigger = wrapper.querySelector('.custom-select-trigger');
            const optionsPanel = wrapper.querySelector('.custom-options-panel');
            if (trigger) {
                trigger.textContent = selectElement.options[selectElement.selectedIndex]?.text || '';
            }
            // Rebuild the options panel to keep it in sync
            if (optionsPanel) {
                optionsPanel.innerHTML = '';
                Array.from(selectElement.options).forEach(optionNode => {
                    optionsPanel.appendChild(buildCustomSelectOption(selectElement, optionNode, wrapper, function() {
                        updateCustomSelectVisual(selectElement);
                    }));
                });
            }
        }

        function newLabel(text) { const l = document.createElement('label'); l.textContent = text; return l; }
        
        function newNumericInput(id, min, max, value) {
            const sel = document.createElement('select');
            sel.id = id;
            const isChannelSelect = isChannelSelectId(id);
            for (let i = min; i <= max; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                let txt = i;
                if (isChannelSelect && i === 0) {
                    txt = 'X';
                } else if (isChannelSelect && i > 0) {
                    const cellMode = getModeForChannelGlobal(i);
                    if (cellMode && cellMode !== "GLOBAL") {
                        txt = `${i} - ${cellMode}`;
                    }
                }
                opt.textContent = txt;
                if (i === value) opt.selected = true;
                sel.appendChild(opt);
            }
            // Adiciona listener para atualizar a barra de progresso
            sel.addEventListener('change', () => updateSpinKnobVisual(id));

            const wrapper = document.createElement('div');
            wrapper.className = 'custom-select-wrapper';
            wrapper.dataset.selectId = id;
            wrapper.appendChild(sel);
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
            wrapper.className = 'custom-select-wrapper';
            wrapper.dataset.selectId = originalSelectId;
            wrapper.appendChild(select);
            formGroup.appendChild(wrapper);

            // Initialize this new select as a custom one
            initializeCustomSelect(select);

            return formGroup;
        }

        // ====================================================================
        // BACK IMAGES (drag-and-drop, redimensiona via canvas, sobe como JPG)
        // ====================================================================
        const NUM_BACK_SLOTS_UI = 5;

        async function detectBackImageDims() {
            // Padrao 320x240 (BFMIDI 1/2). Se /api/system/info disponibilizar boardModel,
            // usamos 480x320 para BFMIDI3.
            let w = 320, h = 240, model = '';
            try {
                const r = await fetch('/api/system/info');
                if (r.ok) {
                    const info = await r.json();
                    model = (info && (info.boardModel || info.boardName || info.boardVersion) || '').toString();
                    if (/BFMIDI[\s\-]?3/i.test(model) || info.isBFMIDI3 === true) { w = 480; h = 320; }
                }
            } catch (_) {}
            return { w, h, model };
        }

        async function fetchBackList() {
            try {
                const r = await fetch('/api/back/list', { cache: 'no-store' });
                if (!r.ok) return [];
                const j = await r.json();
                return Array.isArray(j.slots) ? j.slots : [];
            } catch (_) { return []; }
        }

        function setBackStatus(msg, isErr) {
            const el = document.getElementById('backImagesStatus');
            if (!el) return;
            el.textContent = msg || '';
            el.style.color = isErr ? '#ff7777' : '#888';
        }

        function renderBackSlots(slots, dims) {
            const grid = document.getElementById('backImagesGrid');
            if (!grid) return;
            grid.innerHTML = '';
            for (let i = 1; i <= NUM_BACK_SLOTS_UI; i++) {
                const slotInfo = slots.find(s => s.slot === i) || { slot: i, exists: false };
                const wrapper = document.createElement('div');
                wrapper.className = 'back-img-slot' + (slotInfo.exists ? ' has-image' : '');
                wrapper.dataset.slot = String(i);
                wrapper.innerHTML = renderSlotInner(i, slotInfo.exists, dims);
                grid.appendChild(wrapper);
                wireSlotEvents(wrapper, dims);
            }
        }

        // Render do interior do slot — sem <img> para nao baixar o JPG do
        // ESP32 toda vez que a tela carrega (era isso que travava o WiFi).
        function renderSlotInner(slot, exists, dims) {
            return `
                <div class="slot-label">BACK ${slot}</div>
                ${exists
                    ? `<div class="slot-loaded" style="display:flex;align-items:center;justify-content:center;flex:1;color:#7fc97f;font-weight:700;font-size:13px;letter-spacing:0.5px;">IMG${slot}<br><span style="font-size:9px;color:#888;font-weight:400;margin-top:2px;">carregada</span></div>`
                    : `<div class="slot-empty">arraste<br>ou clique<br>${dims.w}x${dims.h}</div>`}
                <button type="button" class="slot-del" aria-label="Remover">X</button>
            `;
        }

        function wireSlotEvents(slotEl, dims) {
            const slot = parseInt(slotEl.dataset.slot, 10);
            slotEl.addEventListener('click', (e) => {
                if (e.target.classList.contains('slot-del')) return;
                pickFileForSlot(slot, dims);
            });
            slotEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                slotEl.classList.add('drag-over');
            });
            slotEl.addEventListener('dragleave', () => {
                slotEl.classList.remove('drag-over');
            });
            slotEl.addEventListener('drop', async (e) => {
                e.preventDefault();
                slotEl.classList.remove('drag-over');
                const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                if (!file) return;
                await uploadFileToSlot(file, slot, dims);
            });
            attachDelButton(slotEl, slot, dims);
        }

        function attachDelButton(slotEl, slot, dims) {
            const delBtn = slotEl.querySelector('.slot-del');
            if (!delBtn) return;
            delBtn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                if (!confirm(`Remover BACK ${slot}?`)) return;
                setBackStatus(`removendo BACK ${slot}...`);
                let success = false;
                try {
                    const r = await fetch(`/api/back/delete?slot=${slot}`, { method: 'POST' });
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    setBackStatus(`BACK ${slot} removido`);
                    success = true;
                } catch (err) {
                    setBackStatus(`erro: ${err.message || err}`, true);
                }
                if (success) patchSlotUI(slot, false, dims);
            });
        }

        // Atualiza apenas UM slot, sem re-fetchar os outros 4 (evita exaurir
        // os sockets do AsyncTCP no ESP32, que era o que congelava o servidor).
        function patchSlotUI(slot, exists, dims) {
            const wrapper = document.querySelector(`.back-img-slot[data-slot="${slot}"]`);
            if (!wrapper) return;
            wrapper.classList.toggle('has-image', !!exists);
            wrapper.innerHTML = renderSlotInner(slot, exists, dims);
            // Os listeners no wrapper (click/drag/drop) continuam ativos — so o
            // botao de delete foi destruido pelo innerHTML e precisa ser religado.
            attachDelButton(wrapper, slot, dims);
        }

        function pickFileForSlot(slot, dims) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.addEventListener('change', async () => {
                const file = input.files && input.files[0];
                if (file) await uploadFileToSlot(file, slot, dims);
            });
            input.click();
        }

        async function uploadFileToSlot(file, slot, dims) {
            const slotEl = document.querySelector(`.back-img-slot[data-slot="${slot}"]`);
            if (slotEl) slotEl.classList.add('uploading');
            setBackStatus(`processando BACK ${slot}...`);
            let success = false;
            try {
                const blob = await resizeImageToJpeg(file, dims.w, dims.h, 0.85);
                if (!blob) throw new Error('falha ao processar imagem');
                const fd = new FormData();
                fd.append('file', blob, `back${slot}.jpg`);
                const r = await fetch(`/api/back/upload?slot=${slot}`, { method: 'POST', body: fd });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const j = await r.json().catch(() => ({}));
                if (!j.ok) throw new Error(j.msg || 'erro no servidor');
                setBackStatus(`BACK ${slot} enviado (${(j.bytes/1024).toFixed(1)} KB)`);
                success = true;
            } catch (err) {
                setBackStatus(`erro: ${err.message || err}`, true);
            } finally {
                if (slotEl) slotEl.classList.remove('uploading');
                if (success) patchSlotUI(slot, true, dims);
            }
        }

        function resizeImageToJpeg(file, targetW, targetH, quality) {
            return new Promise((resolve) => {
                const img = new Image();
                const url = URL.createObjectURL(file);
                img.onload = () => {
                    URL.revokeObjectURL(url);
                    const canvas = document.createElement('canvas');
                    canvas.width = targetW;
                    canvas.height = targetH;
                    const ctx = canvas.getContext('2d');
                    // Fundo preto + cover (corta laterais para preencher)
                    ctx.fillStyle = '#000';
                    ctx.fillRect(0, 0, targetW, targetH);
                    const srcRatio = img.width / img.height;
                    const dstRatio = targetW / targetH;
                    let sw, sh, sx, sy;
                    if (srcRatio > dstRatio) {
                        // imagem mais larga -> corta laterais
                        sh = img.height;
                        sw = sh * dstRatio;
                        sx = (img.width - sw) / 2;
                        sy = 0;
                    } else {
                        sw = img.width;
                        sh = sw / dstRatio;
                        sx = 0;
                        sy = (img.height - sh) / 2;
                    }
                    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
                    canvas.toBlob(b => resolve(b), 'image/jpeg', quality);
                };
                img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
                img.src = url;
            });
        }

        async function refreshBackImagesUI(dimsArg) {
            const grid = document.getElementById('backImagesGrid');
            if (!grid) return;
            const dims = dimsArg || (window.__backDims) || (window.__backDims = await detectBackImageDims());
            window.__backDims = dims;
            const lbl = document.getElementById('backImagesDimsLabel');
            if (lbl) lbl.textContent = `(arraste ate ${NUM_BACK_SLOTS_UI} imagens — ${dims.w}x${dims.h})`;
            const slots = await fetchBackList();
            renderBackSlots(slots, dims);
        }

        async function wireBackImagesUI() {
            if (!document.getElementById('backImagesGrid')) return;
            await refreshBackImagesUI();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', wireBackImagesUI);
        } else {
            wireBackImagesUI();
        }

    </script>
</body>