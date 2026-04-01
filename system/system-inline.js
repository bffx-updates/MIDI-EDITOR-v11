// Extracted from system/index.html to reduce inline template parsing on ESP

let midiSocket;
let _systemPageReady = false;
let _systemUserInteracted = false;
function markSystemUserInteracted() {
  _systemUserInteracted = true;
}
window.addEventListener('pointerdown', markSystemUserInteracted, { capture: true, once: true });
window.addEventListener('keydown', markSystemUserInteracted, { capture: true, once: true });
window.addEventListener('touchstart', markSystemUserInteracted, { capture: true, once: true });

    function toggleMidiMonitor(event) {
      const monitor = document.getElementById('midiMonitor');
      const button = event.currentTarget;
      if (monitor.style.display === 'none') {
        monitor.style.display = 'block';
        button.textContent = 'Close Monitor';
        startMidiSocket();
      } else {
        monitor.style.display = 'none';
        button.textContent = 'Open Monitor';
        stopMidiSocket();
      }
    }

    function startMidiSocket() {
      const log = document.getElementById('midiLog');
      log.value = 'Connecting to MIDI monitor...\n';
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = wsProtocol + '//' + window.location.host + '/ws';

      midiSocket = new WebSocket(wsUrl);

      midiSocket.onopen = function() {
        log.value += 'Connected! Waiting for MIDI data...\n============================================\n';
        if (midiSocket.readyState === WebSocket.OPEN) {
          midiSocket.send('start_midi_monitor');
        }
      };

      midiSocket.onmessage = function(event) {
        log.value += event.data;
        log.scrollTop = log.scrollHeight;
      };

      midiSocket.onclose = function() {
        log.value += '============================================\nDisconnected from MIDI monitor.\n';
      };

      midiSocket.onerror = function(error) {
        log.value += 'WebSocket connection error.\n';
        console.error('WebSocket Error: ', error);
      };
    }

    function stopMidiSocket() {
      if (midiSocket) {
        if (midiSocket.readyState === WebSocket.OPEN) {
          midiSocket.send('stop_midi_monitor');
        }
        midiSocket.close();
        midiSocket = null;
      }
    }

    function copyMidiLog(button) {
      const logTextarea = document.getElementById('midiLog');
      const textToCopy = logTextarea.value;
      if (!textToCopy) return;

      const originalText = button.textContent;

      function setCopied() {
        button.textContent = 'Copied!';
        button.disabled = true;
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 2000);
      }

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy)
          .then(setCopied)
          .catch(err => {
            console.error('Copy error: ', err);
          });
      } else {
        logTextarea.select();
        logTextarea.setSelectionRange(0, 99999);
        try {
          document.execCommand('copy');
          setCopied();
        } catch (err) {
          console.error('Fallback copy error', err);
        }
      }
    }

    function clearMidiLog() {
      document.getElementById('midiLog').value = '';
    }

    function applyNvsInfo(info) {
      try {
        const usedPercent = (info && info.nvs && typeof info.nvs.usedPercent === 'number')
          ? info.nvs.usedPercent
          : 0;
        const used = (info && info.nvs && typeof info.nvs.usedBytes === 'number')
          ? info.nvs.usedBytes
          : parseInt('0') || 0;
        const total = (info && info.nvs && typeof info.nvs.totalBytes === 'number')
          ? info.nvs.totalBytes
          : parseInt('0') || 0;

        document.getElementById('fwVal').innerText =
          (info && info.firmwareVersion) ? info.firmwareVersion : '--';
        const fwMainEl = document.getElementById('fwMain');
        if (fwMainEl) {
          fwMainEl.innerText = (info && info.firmwareVersion) ? info.firmwareVersion : '--';
        }
        document.getElementById('nvsPercent').innerText = usedPercent + '%';
        document.getElementById('memFill').style.width = usedPercent + '%';
        document.getElementById('nvsUsed').innerText = 'Used: ' + used + ' bytes';
        document.getElementById('nvsTotal').innerText = 'Total: ' + total + ' bytes';
        const lastReset =
          (info && (info.lastReset || info.lastResetTime || info.last_reset || info.last_reset_time))
            ? String(info.lastReset || info.lastResetTime || info.last_reset || info.last_reset_time)
            : '--';
        const lastResetEl = document.getElementById('lastResetValue');
        if (lastResetEl) lastResetEl.innerText = lastReset;

        const rrText = (info && info.resetReason) ? info.resetReason : '-';
        const rrCode = (info && typeof info.resetReasonCode === 'number')
          ? String(info.resetReasonCode)
          : '-';
        const rrTextEl = document.getElementById('resetReasonText');
        const rrCodeEl = document.getElementById('resetReasonCode');
        if (rrTextEl) rrTextEl.innerText = rrText;
        if (rrCodeEl) rrCodeEl.innerText = rrCode;
        const rrTextLogEl = document.getElementById('logsResetReasonText');
        const rrCodeLogEl = document.getElementById('logsResetReasonCode');
        if (rrTextLogEl) rrTextLogEl.innerText = rrText;
        if (rrCodeLogEl) rrCodeLogEl.innerText = rrCode;

        if (info && Array.isArray(info.boards) && info.boards.length) {
          const sel = document.getElementById('board-select');
          if (sel) {
            const currentOptions = Array.from(sel.options).map(option => option.value);
            const incomingOptions = info.boards.map(String);
            const needsRefresh =
              currentOptions.length !== incomingOptions.length ||
              incomingOptions.some((value, index) => currentOptions[index] !== value);

            if (needsRefresh) {
              sel.innerHTML = '';
              incomingOptions.forEach(boardName => {
                const option = document.createElement('option');
                option.value = boardName;
                option.textContent = boardName;
                sel.appendChild(option);
              });
            }

            if (info.boardName) {
              sel.value = String(info.boardName);
            }
          }
        } else if (info && info.boardName) {
          const sel = document.getElementById('board-select');
          if (sel) {
            sel.value = String(info.boardName);
          }
        }

        if (info && typeof info.invertTela === 'boolean') {
          const invEl = document.getElementById('invertTela');
          if (invEl) {
            invEl.value = info.invertTela ? '1' : '0';
            updateTelaOrientacaoButton();
          }
        }

        const buildDateEl = document.getElementById('buildDateVal');
        if (buildDateEl) {
          buildDateEl.innerText = (info && info.buildDate) ? String(info.buildDate) : '--';
        }
      } catch (e) {
        console.error('applyNvsInfo error', e);
      }
    }

    function tryFetchSystemInfo() {
      fetch('/api/system/info')
        .then(r => {
          if (!r.ok) throw new Error('no api');
          return r.json();
        })
        .then(j => applyNvsInfo(j))
        .catch(() => applyNvsInfo(null));
    }

    // Screen orientation toggle via checkbox
    function onScreenRotateChange() {
      const cb = document.getElementById('screenRotate');
      const inv = document.getElementById('invertTela');
      if (cb && inv) {
        inv.value = cb.checked ? '1' : '0';
        scheduleSystemAutoSave();
      }
    }

    function updateTelaOrientacaoButton() {
      const invEl = document.getElementById('invertTela');
      const cb = document.getElementById('screenRotate');
      if (!invEl) return;
      const invertida = (invEl.value === '1');
      if (cb) cb.checked = invertida;
    }

    function toggleTelaOrientacao() {
      const invEl = document.getElementById('invertTela');
      if (!invEl) return;
      invEl.value = (invEl.value === '1') ? '0' : '1';
      updateTelaOrientacaoButton();
      scheduleSystemAutoSave();
    }

    function setupResetButton() {
      const resetNvsButton = document.getElementById('resetNvsButton');
      const resetStatusMessage = document.getElementById('resetStatusMessage');
      if (resetNvsButton && resetStatusMessage) {
        resetNvsButton.addEventListener('click', () => {
          if (confirm('Are you sure you want to reset ALL settings to factory defaults? This action is irreversible and the device will be restarted.')) {
            resetStatusMessage.textContent = 'Processing reset...';
            resetStatusMessage.style.color = 'orange';

            fetch('/api/system/nvs-erase', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            })
            .then(response => {
              if (response.ok) return response.json();
              throw new Error('Server response failed.');
            })
            .then(result => {
              if (result.success) {
                resetStatusMessage.textContent = 'Settings reset! Device will restart.';
                resetStatusMessage.style.color = '#22c55e';
              } else {
                resetStatusMessage.textContent = 'Reset error: ' + (result.message || 'Unknown error.');
                resetStatusMessage.style.color = '#ef4444';
              }
            })
            .catch(error => {
              console.error('NVS reset error:', error);
              resetStatusMessage.textContent = 'Communication error during reset.';
              resetStatusMessage.style.color = '#ef4444';
            });
          }
        });
      }
      updateTelaOrientacaoButton();
    }

    // --- WiFi Functions ---
    function setupWifiEvents() {
      const evtSource = new EventSource('/events');

      evtSource.onopen = function() {
        console.log("Event connection established.");
      };

      evtSource.addEventListener("wifiscan", function(event) {
        console.log("wifiscan event received.");
        const scanBtn = document.getElementById('scanWifiBtn');
        const ssidSelect = document.getElementById('wifi-ssid');

        try {
          const networks = JSON.parse(event.data);
          ssidSelect.innerHTML = '<option value="">Select a network</option>';
          networks.sort((a, b) => b.rssi - a.rssi);
          networks.forEach(net => {
            const signalStrength = net.rssi > -50 ? 'Excellent' : net.rssi > -70 ? 'Good' : 'Weak';
            const label = net.ssid + ' (' + signalStrength + ')';
            const option = new Option(label, net.ssid);
            ssidSelect.add(option);
          });
        } catch (e) {
          console.error("wifiscan parse error:", e);
          ssidSelect.innerHTML = '<option value="">Failed to process networks</option>';
        } finally {
          scanBtn.disabled = false;
          scanBtn.textContent = 'Scan Networks';
        }
      });

      evtSource.onerror = function(err) {
        console.error("EventSource error:", err);
      };
    }

    function updateWifiStatus() {
      fetch('/api/wifi/status')
        .then(response => response.json())
        .then(data => {
          const statusText = data.status || 'Unknown';
          const statusIcon = document.getElementById('wifiStatusIcon');
          const statusDiv = document.getElementById('wifiStatus');
          const currentNetworkDiv = document.getElementById('wifiCurrentNetwork');
          const currentSSIDDiv = document.getElementById('wifiCurrentSSID');

          statusDiv.textContent = statusText;

          if (statusText.includes('Conectado') || statusText.includes('Connected')) {
            statusIcon.style.background = '#4CAF50';
            statusIcon.style.boxShadow = '0 0 12px rgba(76, 175, 80, 0.8)';
            currentNetworkDiv.style.display = 'block';
            currentSSIDDiv.textContent = data.sta_ssid || '-';
          } else if (statusText.includes('Conectando') || statusText.includes('Connecting')) {
            statusIcon.style.background = '#ffa500';
            statusIcon.style.boxShadow = '0 0 12px rgba(255, 165, 0, 0.8)';
            currentNetworkDiv.style.display = 'none';
          } else {
            statusIcon.style.background = '#666';
            statusIcon.style.boxShadow = '0 0 8px rgba(102, 102, 102, 0.6)';
            currentNetworkDiv.style.display = 'none';
          }

          const staEnabledCheckbox = document.getElementById('staEnabled');
          staEnabledCheckbox.checked = data.sta_enabled || false;

          const ssidSelect = document.getElementById('wifi-ssid');
          if (data.sta_ssid && !Array.from(ssidSelect.options).some(opt => opt.value === data.sta_ssid)) {
            const option = new Option(data.sta_ssid, data.sta_ssid);
            ssidSelect.add(option);
          }
          ssidSelect.value = data.sta_ssid || '';

          updateWifiForm();
        })
        .catch(err => {
          document.getElementById('wifiStatus').textContent = 'Error loading status';
          document.getElementById('wifiStatusIcon').style.background = '#ff5c5c';
          document.getElementById('wifiStatusIcon').style.boxShadow = '0 0 12px rgba(255, 92, 92, 0.8)';
          console.error('WiFi status error:', err);
        });
    }

    function updateWifiForm() {
      const staEnabled = document.getElementById('staEnabled').checked;
      document.getElementById('wifi-sta-form').style.display = staEnabled ? 'block' : 'none';
    }

    function scanWifi() {
      const scanBtn = document.getElementById('scanWifiBtn');
      const scanBtnIcon = document.getElementById('scanBtnIcon');
      const scanBtnText = document.getElementById('scanBtnText');
      const ssidSelect = document.getElementById('wifi-ssid');

      scanBtn.disabled = true;
      scanBtnText.textContent = 'Scanning...';
      ssidSelect.innerHTML = '<option value="">Please wait...</option>';

      fetch('/api/wifi/scan')
        .then(response => {
          if (!response.ok) throw new Error('Scan failed.');
          return response.json();
        })
        .then(networks => {
          ssidSelect.innerHTML = '<option value="">Select a network</option>';
          networks.sort((a, b) => b.rssi - a.rssi);

          if (networks.length === 0) {
            ssidSelect.innerHTML = '<option value="">No networks found</option>';
          } else {
            networks.forEach(net => {
              const signalStrength = net.rssi > -50 ? 'Excellent' : net.rssi > -70 ? 'Good' : 'Weak';
              const label = net.ssid + ' (' + signalStrength + ')';
              const option = new Option(label, net.ssid);
              ssidSelect.add(option);
            });
          }

          scanBtn.disabled = false;
          scanBtnText.textContent = networks.length + ' networks found';

          setTimeout(() => {
            scanBtnText.textContent = 'Scan WiFi Networks';
          }, 3000);
        })
        .catch(err => {
          console.error('WiFi scan error:', err);
          ssidSelect.innerHTML = '<option value="">Scan failed</option>';
          scanBtn.disabled = false;
          scanBtnText.textContent = 'Scan error';

          setTimeout(() => {
            scanBtnText.textContent = 'Scan WiFi Networks';
          }, 3000);
        });
    }

    function connectToWifi() {
      const statusDiv = document.getElementById('wifi-connect-status');
      const payload = {
        enabled: document.getElementById('staEnabled').checked,
        ssid: document.getElementById('wifi-ssid').value,
        password: document.getElementById('wifi-password').value
      };

      if (payload.enabled && !payload.ssid) {
        statusDiv.style.display = 'block';
        statusDiv.style.background = 'rgba(255, 92, 92, 0.1)';
        statusDiv.style.border = '1px solid rgba(255, 92, 92, 0.3)';
        statusDiv.style.color = '#ff5c5c';
        statusDiv.textContent = 'Please select a network.';
        return;
      }

      statusDiv.style.display = 'block';
      statusDiv.style.background = 'rgba(255, 179, 0, 0.1)';
      statusDiv.style.border = '1px solid rgba(255, 179, 0, 0.3)';
      statusDiv.style.color = 'var(--accent-primary)';
      statusDiv.textContent = 'Saving settings and restarting... Please wait.';

      fetch('/api/wifi/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          statusDiv.style.background = 'rgba(76, 175, 80, 0.1)';
          statusDiv.style.border = '1px solid rgba(76, 175, 80, 0.3)';
          statusDiv.style.color = '#22c55e';
          statusDiv.textContent = data.message;
        } else {
          statusDiv.style.background = 'rgba(255, 92, 92, 0.1)';
          statusDiv.style.border = '1px solid rgba(255, 92, 92, 0.3)';
          statusDiv.style.color = '#ef4444';
          statusDiv.textContent = 'Error: ' + data.message;
        }
      })
      .catch(err => {
        statusDiv.style.background = 'rgba(255, 92, 92, 0.1)';
        statusDiv.style.border = '1px solid rgba(255, 92, 92, 0.3)';
        statusDiv.style.color = '#ef4444';
        statusDiv.textContent = 'Communication error.';
        console.error('WiFi connect error:', err);
      });
    }

    function forgetWifiNetwork() {
      if (!confirm('Are you sure you want to forget the configured WiFi network? The device will restart in AP mode.')) {
        return;
      }

      const statusDiv = document.getElementById('wifi-connect-status');
      statusDiv.style.display = 'block';
      statusDiv.style.background = 'rgba(255, 165, 0, 0.1)';
      statusDiv.style.border = '1px solid rgba(255, 165, 0, 0.3)';
      statusDiv.style.color = '#ffa500';
      statusDiv.textContent = 'Removing WiFi settings...';

      fetch('/api/wifi/forget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          statusDiv.style.background = 'rgba(76, 175, 80, 0.1)';
          statusDiv.style.border = '1px solid rgba(76, 175, 80, 0.3)';
          statusDiv.style.color = '#22c55e';
          statusDiv.textContent = 'Network forgotten! Restarting...';
          document.getElementById('wifi-ssid').value = '';
          document.getElementById('wifi-password').value = '';
          document.getElementById('staEnabled').checked = false;
          updateWifiForm();
        } else {
          statusDiv.style.background = 'rgba(255, 92, 92, 0.1)';
          statusDiv.style.border = '1px solid rgba(255, 92, 92, 0.3)';
          statusDiv.style.color = '#ef4444';
          statusDiv.textContent = 'Error: ' + data.message;
        }
      })
      .catch(err => {
        statusDiv.style.background = 'rgba(255, 92, 92, 0.1)';
        statusDiv.style.border = '1px solid rgba(255, 92, 92, 0.3)';
        statusDiv.style.color = '#ef4444';
        statusDiv.textContent = 'Communication error.';
        console.error('WiFi forget error:', err);
      });
    }


    window.addEventListener('load', () => {
      tryFetchSystemInfo();
      updateTelaOrientacaoButton();
      setupResetButton();
      _systemPageReady = true;
    });

    function showSavedBanner() {
      const bannerId = 'saveBanner';
      let banner = document.getElementById(bannerId);
      if (!banner) {
        banner = document.createElement('div');
        banner.id = bannerId;
        banner.className = 'save-banner';
        banner.setAttribute('aria-hidden', 'true');
        banner.textContent = 'SALVO! REINICIANDO...';
        Object.assign(banner.style, {
          position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)',
          background: '#27ae60', color: 'white', padding: '12px 24px', borderRadius: '4px',
          zIndex: '10000', opacity: '0', transition: 'opacity 0.15s', pointerEvents: 'none',
          display: 'none', fontSize: '1.5em', fontWeight: 'bold'
        });
        document.body.appendChild(banner);
      }
      banner.style.display = 'block';
      banner.style.opacity = '1';
      banner.setAttribute('aria-hidden', 'false');
      setTimeout(() => {
        banner.style.opacity = '0';
        banner.setAttribute('aria-hidden', 'true');
        setTimeout(() => { banner.style.display = 'none'; }, 150);
      }, 500);
    }

    async function saveSystemConfig() {
      const sel = document.getElementById('board-select');
      const board = sel ? sel.value : '';
      const invEl = document.getElementById('invertTela');
      const invert = (invEl && invEl.value === '1') ? '1' : '0';
      const url = '/savesystem?board=' + encodeURIComponent(board) + '&invert=' + invert;

      try {
        const response = await fetch(url, { method: 'GET', cache: 'no-store' });
        const raw = await response.text();
        let payload = null;
        try { payload = raw ? JSON.parse(raw) : null; } catch (_) {}

        if (!response.ok) {
          throw new Error((payload && payload.message) ? payload.message : ('HTTP ' + response.status));
        }
        if (payload && payload.success === false) {
          throw new Error(payload.message || 'Failed to save board settings.');
        }

        showSavedBanner();

        setTimeout(() => {
          try { tryFetchSystemInfo(); } catch (_) {}
          try { updateTelaOrientacaoButton(); } catch (_) {}
        }, 900);
      } catch (err) {
        console.error('saveSystemConfig error:', err);
        const statusEl = document.getElementById('resetStatusMessage');
        if (statusEl) {
          statusEl.textContent = 'Save error: ' + ((err && err.message) ? err.message : 'Unknown error');
          statusEl.style.color = '#ef4444';
          setTimeout(() => { statusEl.textContent = ''; }, 5000);
        }
      }
    }

    async function saveAndRestart() { return saveSystemConfig(); }

    // --- AUTO-SAVE debounced ---
    let _systemAutoSaveTimer = null;
    function scheduleSystemAutoSave() {
      if (!_systemPageReady || !_systemUserInteracted) return;
      if (_systemAutoSaveTimer) clearTimeout(_systemAutoSaveTimer);
      _systemAutoSaveTimer = setTimeout(() => { _systemAutoSaveTimer = null; saveSystemConfig(); }, 1000);
    }

    async function uploadBackup() {
      const fileInput = document.getElementById('backupFile');
      const restoreMessage = document.getElementById('restoreMessage');
      const progress = document.getElementById('restoreProgress');
      const progressBar = document.getElementById('progressBar');
      const progressText = document.getElementById('progressText');
      const banner = document.getElementById('restoreBanner');
      const file = fileInput.files[0];

      if (!file) {
        restoreMessage.style.color = '#ef4444';
        restoreMessage.innerText = 'Please select a backup file.';
        return;
      }

      const isJsonExt = file.name && file.name.toLowerCase().endsWith('.json');
      if (!isJsonExt) {
        restoreMessage.style.color = '#ef4444';
        restoreMessage.innerText = 'Invalid format. Please select .json';
        return;
      }

      progress.style.display = 'block';
      progressBar.style.width = '0%';
      progressText.innerText = 'Reading file...';
      restoreMessage.innerText = '';
      banner.style.display = 'none';

      try {
        const text = await file.text();
        progressBar.style.width = '20%';
        progressText.innerText = 'Backup file loaded (20%)';
        const backup = JSON.parse(sanitizeJsonString(text));
        const normalizedBackup = {
          ...backup,
          global_config: backup.global_config
            ? normalizeGlobalConfigPayload(backup.global_config)
            : backup.global_config
        };

        progressBar.style.width = '55%';
        progressText.innerText = 'Sending backup package... (55%)';
        let directRestorePulse = null;
        try {
          directRestorePulse = startProgressPulse(progressBar, progressText, 55, 94, 'Sending backup package...');
          const directRestoreResponse = await fetch('/api/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(normalizedBackup)
          });

          if (directRestoreResponse.ok || directRestoreResponse.status === 202) {
            if (directRestorePulse) {
              directRestorePulse.stop(
                100,
                directRestoreResponse.status === 202 ? 'Restore package accepted' : 'Restore complete'
              );
            }
            progressBar.style.width = '100%';
            progressText.innerText = directRestoreResponse.status === 202
              ? 'Restore package accepted (100%)'
              : 'Restore complete (100%)';
            banner.innerText = directRestoreResponse.status === 202
              ? 'Restore accepted! Aguarde alguns segundos para o dispositivo aplicar os dados.'
              : 'Backup restored successfully!';
            banner.style.display = 'block';
            return;
          }
          if (directRestorePulse) directRestorePulse.stop(55, 'Sending backup package...');
        } catch (directRestoreError) {
          if (directRestorePulse) directRestorePulse.stop();
          console.warn('Direct restore endpoint unavailable, falling back to step-by-step restore:', directRestoreError);
        }

        let needsColorMigration = false;
        const backupVersion = backup.firmware_version || '';
        const verLower = backupVersion.toLowerCase();
        if (verLower.includes('v9') || verLower.includes('-v9')) {
          needsColorMigration = true;
        } else if (verLower.includes('v10')) {
          const rMatch = verLower.match(/ r(\d+)/);
          if (!rMatch) {
            needsColorMigration = true;
          } else {
            const revNum = parseInt(rMatch[1], 10);
            if (revNum < 6) needsColorMigration = true;
          }
        } else if (!backupVersion) {
          needsColorMigration = true;
        }
        if (needsColorMigration) {
          console.log('[RESTORE] Old backup detected, color migration will be applied');
        }

        let totalSteps = 1;
        if (backup.board_config) totalSteps++;
        if (backup.wifi_config && backup.wifi_config.sta_enabled) totalSteps++;
        totalSteps += (backup.presets ? backup.presets.length : 0);
        totalSteps += (backup.presets_layer2 ? backup.presets_layer2.length : 0);
        let currentStep = 0;

        function updateProgress(msg) {
          currentStep++;
          const pct = Math.round((currentStep / totalSteps) * 100);
          progressBar.style.width = pct + '%';
          progressText.innerText = msg + ' (' + pct + '%)';
        }

        // 1. Restore global config
        if (backup.global_config) {
          progressText.innerText = 'Restoring global config...';
          const globalConfigPayload = normalizedBackup.global_config;
          const res = await fetch('/api/global-config/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(globalConfigPayload)
          });
          if (!res.ok) throw new Error('Failed to restore global config: ' + res.status);
          updateProgress('Global config restored');
          await new Promise(r => setTimeout(r, 50));
        }

        // 2. Restore board config
        if (backup.board_config) {
          progressText.innerText = 'Restoring board config...';
          const boardName = backup.board_config.board_name || 'default';
          const invertTela = backup.board_config.invert_tela ? '1' : '0';
          const url = '/savesystem?board=' + encodeURIComponent(boardName) + '&invert=' + invertTela + '&norestart=1';
          try {
            await fetch(url);
          } catch (e) {
            console.warn('Board config may not have been saved:', e);
          }
          // Update UI to reflect restored values
          const boardSel = document.getElementById('board-select');
          if (boardSel) boardSel.value = boardName;
          const invEl = document.getElementById('invertTela');
          if (invEl) invEl.value = invertTela;
          updateTelaOrientacaoButton();
          updateProgress('Board config restored');
          await new Promise(r => setTimeout(r, 50));
        }

        // 3. Restore presets layer 1
        if (backup.presets && backup.presets.length > 0) {
          const NUM_PRESET_COLUMNS = 6;
          const NUM_PRESET_ROWS = 5;
          for (let i = 0; i < backup.presets.length; i++) {
            const preset = backup.presets[i];
            const col = Math.floor(i / NUM_PRESET_ROWS);
            const row = i % NUM_PRESET_ROWS;
            if (col >= NUM_PRESET_COLUMNS) continue;

            const url = '/save-single-preset-data?btn=' + col + '&lvl=' + row + '&layer=1' + (needsColorMigration ? '&migrate=1' : '');
            let success = false;
            let retries = 0;
            while (!success && retries < 3) {
              try {
                const res = await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(preset)
                });
                if (res.ok || res.status === 202) {
                  success = true;
                } else if (res.status === 503 || res.status === 500) {
                  retries++;
                  await new Promise(r => setTimeout(r, 500));
                } else {
                  throw new Error('HTTP ' + res.status);
                }
              } catch (e) {
                retries++;
                if (retries >= 3) throw new Error('Failed preset L1 [' + col + ',' + row + ']: ' + e.message);
                await new Promise(r => setTimeout(r, 300));
              }
            }
            updateProgress('Preset L1 ' + (i + 1) + '/' + backup.presets.length);
            await new Promise(r => setTimeout(r, 30));
          }
        }

        // 4. Restore presets layer 2
        if (backup.presets_layer2 && backup.presets_layer2.length > 0) {
          const NUM_PRESET_COLUMNS = 6;
          const NUM_PRESET_ROWS = 5;
          for (let i = 0; i < backup.presets_layer2.length; i++) {
            const preset = backup.presets_layer2[i];
            const col = Math.floor(i / NUM_PRESET_ROWS);
            const row = i % NUM_PRESET_ROWS;
            if (col >= NUM_PRESET_COLUMNS) continue;

            const url = '/save-single-preset-data?btn=' + col + '&lvl=' + row + '&layer=2' + (needsColorMigration ? '&migrate=1' : '');
            let success = false;
            let retries = 0;
            while (!success && retries < 3) {
              try {
                const res = await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(preset)
                });
                if (res.ok || res.status === 202) {
                  success = true;
                } else if (res.status === 503 || res.status === 500) {
                  retries++;
                  await new Promise(r => setTimeout(r, 500));
                } else {
                  throw new Error('HTTP ' + res.status);
                }
              } catch (e) {
                retries++;
                if (retries >= 3) throw new Error('Failed preset L2 [' + col + ',' + row + ']: ' + e.message);
                await new Promise(r => setTimeout(r, 300));
              }
            }
            updateProgress('Preset L2 ' + (i + 1) + '/' + backup.presets_layer2.length);
            await new Promise(r => setTimeout(r, 30));
          }
        }

        // 5. Restore WiFi config last (causes ESP32 restart)
        if (backup.wifi_config && backup.wifi_config.sta_enabled && backup.wifi_config.sta_ssid) {
          progressText.innerText = 'Restoring WiFi config (device will restart)...';
          try {
            const wifiPayload = {
              enabled: backup.wifi_config.sta_enabled,
              ssid: backup.wifi_config.sta_ssid,
              password: backup.wifi_config.sta_password || ''
            };
            await fetch('/api/wifi/connect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(wifiPayload)
            });
            updateProgress('WiFi config restored - Restarting...');
            progress.style.display = 'none';
            banner.innerText = 'Backup restored successfully! Device restarting...';
            banner.style.display = 'block';
            return;
          } catch (e) {
            console.warn('WiFi config may have caused restart:', e);
            progress.style.display = 'none';
            banner.innerText = 'Backup restored! Device may be restarting...';
            banner.style.display = 'block';
            return;
          }
        }

        if (needsColorMigration) {
          updateProgress('Migrating colors...');
          try {
            await fetch('/api/presets/migrate-colors', { method: 'POST' });
            console.log('[RESTORE] Color migration executed automatically');
          } catch (e) {
            console.warn('[RESTORE] Color migration may have failed:', e);
          }
        }

        progress.style.display = 'none';
        banner.innerText = 'Backup restored successfully! Restart the device to apply all settings.';
        banner.style.display = 'block';

      } catch (err) {
        progress.style.display = 'none';
        restoreMessage.style.color = '#ef4444';
        restoreMessage.innerText = 'Error: ' + err.message;
        console.error('Restore error:', err);
      }
    }

    function onBoardChange(v) {
      console.log('Board selected:', v);
      scheduleSystemAutoSave();
    }

    function downloadLogs() {
      window.location.href = '../api/logs/';
    }

    function sanitizeJsonString(jsonStr) {
      return jsonStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }

    function normalizeGlobalConfigPayload(raw) {
      const data = raw && typeof raw === 'object' ? raw : {};
      const asInt = function(value, fallback) {
        const parsed = parseInt(value, 10);
        return Number.isNaN(parsed) ? fallback : parsed;
      };

      let mostrarFxQuando = asInt(data.mostrarFxQuando, null);
      if (mostrarFxQuando === null) {
        const legacy = asInt(data.mostrarSiglaFX, 1);
        if (legacy === 0) mostrarFxQuando = 2;
        else if (legacy === 2) mostrarFxQuando = 1;
        else mostrarFxQuando = 0;
      }

      return {
        ledBrilho: asInt(data.ledBrilho, 100),
        ledPreview: !!data.ledPreview,
        modoMidiIndex: asInt(data.modoMidiIndex, 0),
        mostrarTelaFX: !!data.mostrarTelaFX,
        mostrarCadeia: !!data.mostrarCadeia,
        mostrarFxModo: asInt(data.mostrarFxModo, 1),
        mostrarFxQuando: mostrarFxQuando,
        coresPresetConfig: Array.isArray(data.coresPresetConfig) ? data.coresPresetConfig : [],
        corLiveModeConfig: asInt(data.corLiveModeConfig, 0xFFFFFF),
        corLiveMode2Config: asInt(data.corLiveMode2Config, asInt(data.corLiveModeConfig, 0xFFFFFF)),
        liveLayer2Enabled: (typeof data.liveLayer2Enabled === 'boolean') ? data.liveLayer2Enabled : true,
        backgroundEnabled: !!data.backgroundEnabled,
        backgroundColorConfig: asInt(data.backgroundColorConfig, 0x000000),
        selectModeIndex: asInt(data.selectModeIndex, 0),
        swGlobal: Array.isArray(data.swGlobal) ? data.swGlobal : [],
        presetLevels: Array.isArray(data.presetLevels) ? data.presetLevels : [],
        lockSetup: !!data.lockSetup,
        lockGlobal: !!data.lockGlobal,
        ledModeNumeros: !!data.ledModeNumeros,
        autoStartEnabled: !!data.autoStartEnabled,
        autoStartRow: asInt(data.autoStartRow, 0),
        autoStartCol: asInt(data.autoStartCol, 0),
        autoStartLiveMode: !!data.autoStartLiveMode
      };
    }

    function triggerBackupDownload(backup) {
      const text = JSON.stringify(backup);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bfmidi_backup.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function() {
        URL.revokeObjectURL(url);
        a.remove();
      }, 500);
    }

    function startProgressPulse(progressBar, progressTextOrStartPct, startPctOrMaxPct, maxPctOrLabel, maybeLabel) {
      let progressText = null;
      let startPct = 0;
      let maxPct = 100;
      let label = '';

      if (typeof progressTextOrStartPct === 'object' && progressTextOrStartPct !== null) {
        progressText = progressTextOrStartPct;
        startPct = startPctOrMaxPct || 0;
        maxPct = maxPctOrLabel || 100;
        label = maybeLabel || '';
      } else {
        startPct = progressTextOrStartPct || 0;
        maxPct = startPctOrMaxPct || 100;
        label = maxPctOrLabel || '';
      }

      let current = Math.max(0, Math.min(maxPct, startPct || 0));
      let timer = null;
      const baseLabel = label || 'Working';

      if (progressBar) {
        progressBar.style.width = current + '%';
      }
      if (progressText) {
        progressText.innerText = baseLabel + ' (' + Math.round(current) + '%)';
      }

      timer = setInterval(function() {
        current = Math.min(maxPct, current + Math.max(1, (maxPct - current) * 0.08));
        if (progressBar) {
          progressBar.style.width = Math.round(current) + '%';
        }
        if (progressText) {
          progressText.innerText = baseLabel + ' (' + Math.round(current) + '%)';
        }
        if (current >= maxPct && timer) {
          clearInterval(timer);
          timer = null;
        }
      }, 220);

      return {
        stop: function(finalPct, finalLabel) {
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
          if (progressBar && typeof finalPct === 'number') {
            progressBar.style.width = finalPct + '%';
          }
          if (progressText && typeof finalPct === 'number') {
            progressText.innerText = (finalLabel || baseLabel) + ' (' + Math.round(finalPct) + '%)';
          }
        }
      };
    }

    async function fetchJsonSanitized(url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      const text = await response.text();
      const sanitized = sanitizeJsonString(text);
      return JSON.parse(sanitized);
    }

    async function downloadBackupClientSide() {
      const btn = document.getElementById('btnBackupClient');
      const progressContainer = document.getElementById('backupProgressContainer');
      const progressBar = document.getElementById('backupProgressBar');
      const progressText = document.getElementById('backupProgressText');
      const backupMessage = document.getElementById('backupMessage');
      const backupBanner = document.getElementById('backupBanner');

      if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
      if (progressContainer) { progressContainer.style.display = 'block'; }
      if (progressBar) { progressBar.style.width = '0%'; }
      if (backupMessage) { backupMessage.innerText = ''; }
      if (backupBanner) { backupBanner.style.display = 'none'; }

      const NUM_PRESET_COLUMNS = 6;
      const NUM_PRESET_ROWS = 5;
      const totalPresets = NUM_PRESET_COLUMNS * NUM_PRESET_ROWS * 2;
      const totalSteps = 4 + totalPresets;
      let currentStep = 0;

      function updateProgress(msg) {
        currentStep++;
        const pct = Math.round((currentStep / totalSteps) * 100);
        if (progressBar) { progressBar.style.width = pct + '%'; }
        if (progressText) { progressText.innerText = msg + ' (' + pct + '%)'; }
      }

      try {
        if (progressText) { progressText.innerText = 'Trying direct backup... (12%)'; }
        if (progressBar) { progressBar.style.width = '12%'; }
        let fastBackupPulse = null;
        try {
          fastBackupPulse = startProgressPulse(progressBar, progressText, 12, 88, 'Generating backup...');
          const fastBackup = await fetchJsonSanitized('/api/backup');
          if (fastBackup && Array.isArray(fastBackup.presets)) {
            if (fastBackupPulse) fastBackupPulse.stop(88, 'Generating backup...');
            fastBackup.global_config = normalizeGlobalConfigPayload(fastBackup.global_config);
            if (progressBar) { progressBar.style.width = '92%'; }
            if (progressText) { progressText.innerText = 'Packaging backup... (92%)'; }
            triggerBackupDownload(fastBackup);
            if (progressBar) { progressBar.style.width = '100%'; }
            if (progressText) { progressText.innerText = 'Backup complete (100%)'; }
            if (progressContainer) { progressContainer.style.display = 'none'; }
            if (backupBanner) {
              backupBanner.innerText = 'Backup generated successfully!';
              backupBanner.style.display = 'block';
              setTimeout(function() { backupBanner.style.display = 'none'; }, 3000);
            }
            return;
          }
          if (fastBackupPulse) fastBackupPulse.stop(12, 'Trying direct backup...');
        } catch (fastErr) {
          if (fastBackupPulse) fastBackupPulse.stop();
          console.warn('Direct backup endpoint unavailable, falling back to client-side dump:', fastErr);
        }

        if (progressText) { progressText.innerText = 'Collecting system info...'; }
        const sysInfo = await fetchJsonSanitized('/api/system/info');
        const firmwareVersion = (sysInfo && sysInfo.firmwareVersion) ? sysInfo.firmwareVersion : 'UNKNOWN';
        updateProgress('System info collected');

        const globalConfig = await fetchJsonSanitized('/api/global-config/read');
        updateProgress('Global config collected');

        const boardSelect = document.getElementById('board-select');
        const invertTelaEl = document.getElementById('invertTela');
        const boardConfig = {
          board_name: boardSelect ? boardSelect.value : (globalConfig.boardName || 'default'),
          invert_tela: invertTelaEl ? (invertTelaEl.value === '1') : false
        };
        updateProgress('Board config collected');

        let wifiConfig = null;
        try {
          const wifiStatus = await fetchJsonSanitized('/api/wifi/status');
          wifiConfig = {
            sta_enabled: wifiStatus.sta_enabled || false,
            sta_ssid: wifiStatus.sta_ssid || '',
            sta_password: wifiStatus.sta_password || ''
          };
        } catch (e) {
          console.warn('Could not get WiFi config:', e);
        }
        updateProgress('WiFi config collected');

        const totalPresetSlots = NUM_PRESET_COLUMNS * NUM_PRESET_ROWS;
        const presets = new Array(totalPresetSlots);
        const presetsLayer2 = new Array(totalPresetSlots);
        const maxRetries = 3;
        const jobs = [];
        for (let col = 0; col < NUM_PRESET_COLUMNS; col++) {
          for (let row = 0; row < NUM_PRESET_ROWS; row++) {
            const presetIndex = col * NUM_PRESET_ROWS + row;
            jobs.push({ layer: 1, col: col, row: row, presetIndex: presetIndex });
            jobs.push({ layer: 2, col: col, row: row, presetIndex: presetIndex });
          }
        }

        const fetchPresetWithRetries = async function(job) {
          const url = '/get-single-preset-data?btn=' + job.col + '&lvl=' + job.row + '&layer=' + job.layer;
          let retryCount = 0;

          while (retryCount < maxRetries) {
            try {
              return await fetchJsonSanitized(url);
            } catch (e) {
              if (e.message.includes('503') || e.message.includes('500')) {
                retryCount++;
                if (progressText) { progressText.innerText = 'Low memory, waiting... (' + retryCount + '/' + maxRetries + ')'; }
                await new Promise(function(res) { setTimeout(res, 500); });
              } else {
                throw e;
              }
            }
          }

          throw new Error('Failed after ' + maxRetries + ' attempts for L' + job.layer + ' btn=' + job.col + ' lvl=' + job.row);
        };

        let nextJobIndex = 0;
        const concurrency = Math.min(4, jobs.length || 1);
        const runWorker = async function() {
          while (true) {
            const jobIndex = nextJobIndex++;
            if (jobIndex >= jobs.length) break;

            const job = jobs[jobIndex];
            const result = await fetchPresetWithRetries(job);

            if (job.layer === 1) {
              presets[job.presetIndex] = result;
            } else {
              presetsLayer2[job.presetIndex] = result;
            }

            updateProgress('Preset L' + job.layer + ' [' + (job.col + 1) + ',' + String.fromCharCode(65 + job.row) + ']');
          }
        };

        await Promise.all(Array.from({ length: concurrency }, function() { return runWorker(); }));

        if (progressText) { progressText.innerText = 'Generating file...'; }
        if (progressBar) { progressBar.style.width = '100%'; }

        const backup = {
          firmware_version: firmwareVersion,
          backup_date: new Date().toISOString(),
          global_config: normalizeGlobalConfigPayload(globalConfig),
          board_config: boardConfig,
          wifi_config: wifiConfig,
          presets: presets,
          presets_layer2: presetsLayer2
        };

        triggerBackupDownload(backup);

        if (progressContainer) { progressContainer.style.display = 'none'; }
        if (backupBanner) {
          backupBanner.innerText = 'Backup generated successfully!';
          backupBanner.style.display = 'block';
          setTimeout(function() { backupBanner.style.display = 'none'; }, 3000);
        }

      } catch (err) {
        if (progressContainer) { progressContainer.style.display = 'none'; }
        if (backupMessage) {
          backupMessage.style.color = '#ef4444';
          backupMessage.innerText = 'Error: ' + (err && err.message ? err.message : err);
        }
        console.error('Backup error:', err);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Export Data';
        }
      }
    }

    // ========================================
    // HARDWARE TEST FUNCTIONS
    // ========================================
    let hardwareTestRunning = false;
    let hardwareTestInterval = null;

    function startHardwareTest(testType) {
      if (hardwareTestRunning) return;

      const progressContainer = document.getElementById('testProgressContainer');
      const progressBar = document.getElementById('testProgressBar');
      const progressText = document.getElementById('testProgressText');
      const resultMessage = document.getElementById('testResultMessage');
      const btnLeds = document.getElementById('btnTestLeds');
      const btnDisplay = document.getElementById('btnTestDisplay');
      const btnMidi = document.getElementById('btnTestMidi');

      btnLeds.disabled = true;
      btnDisplay.disabled = true;
      btnMidi.disabled = true;
      hardwareTestRunning = true;

      progressContainer.style.display = 'block';
      progressBar.style.width = '0%';
      resultMessage.innerText = '';

      if (testType === 'leds') {
        runLedTest(progressBar, progressText, resultMessage, () => {
          finishTest(btnLeds, btnDisplay, btnMidi, progressContainer);
        });
      } else if (testType === 'display') {
        runDisplayTest(progressBar, progressText, resultMessage, () => {
          finishTest(btnLeds, btnDisplay, btnMidi, progressContainer);
        });
      } else if (testType === 'midi') {
        runMidiTest(progressBar, progressText, resultMessage, () => {
          finishTest(btnLeds, btnDisplay, btnMidi, progressContainer);
        });
      }
    }

    function finishTest(btnLeds, btnDisplay, btnMidi, progressContainer) {
      hardwareTestRunning = false;
      btnLeds.disabled = false;
      btnDisplay.disabled = false;
      btnMidi.disabled = false;
      setTimeout(() => {
        progressContainer.style.display = 'none';
      }, 2000);
    }

    function runLedTest(progressBar, progressText, resultMessage, onComplete) {
      const totalDuration = 20000;
      const updateInterval = 500;
      let elapsed = 0;
      let step = 0;

      progressText.innerText = 'Testing LEDs...';
      resultMessage.style.color = '#ffa500';
      resultMessage.innerText = 'Starting LED test (20 seconds)';

      fetch('/api/hardware-test/leds/start', { method: 'POST' })
        .catch(err => console.warn('LED test start:', err));

      hardwareTestInterval = setInterval(() => {
        elapsed += updateInterval;
        step++;
        const progress = Math.min((elapsed / totalDuration) * 100, 100);
        progressBar.style.width = progress + '%';

        const phase = step % 8;
        const phases = ['Red', 'Green', 'Blue', 'Yellow', 'Purple', 'Cyan', 'White', 'Rainbow'];
        progressText.innerText = 'Testing LEDs: ' + phases[phase] + ' (' + Math.round(progress) + '%)';

        if (elapsed >= totalDuration) {
          clearInterval(hardwareTestInterval);
          hardwareTestInterval = null;

          fetch('/api/hardware-test/leds/stop', { method: 'POST' })
            .catch(err => console.warn('LED test stop:', err));

          progressBar.style.width = '100%';
          progressText.innerText = 'LED test complete!';
          resultMessage.style.color = '#22c55e';
          resultMessage.innerText = 'LED test finished successfully';
          onComplete();
        }
      }, updateInterval);
    }

    function runDisplayTest(progressBar, progressText, resultMessage, onComplete) {
      const totalDuration = 20000;
      const updateInterval = 500;
      let elapsed = 0;
      let step = 0;

      progressText.innerText = 'Testing Display...';
      resultMessage.style.color = '#4ecdc4';
      resultMessage.innerText = 'Starting display test (20 seconds)';

      fetch('/api/hardware-test/display/start', { method: 'POST' })
        .catch(err => console.warn('Display test start:', err));

      hardwareTestInterval = setInterval(() => {
        elapsed += updateInterval;
        step++;
        const progress = Math.min((elapsed / totalDuration) * 100, 100);
        progressBar.style.width = progress + '%';
        progressBar.style.background = 'linear-gradient(90deg, #4ecdc4, #45b7aa)';

        const phase = step % 10;
        const phases = ['Red', 'Green', 'Blue', 'White', 'Black', 'Color Bars', 'Gradient', 'Checkerboard', 'Lines', 'Info'];
        progressText.innerText = 'Testing Display: ' + phases[phase] + ' (' + Math.round(progress) + '%)';

        if (elapsed >= totalDuration) {
          clearInterval(hardwareTestInterval);
          hardwareTestInterval = null;

          fetch('/api/hardware-test/display/stop', { method: 'POST' })
            .catch(err => console.warn('Display test stop:', err));

          progressBar.style.width = '100%';
          progressText.innerText = 'Display test complete!';
          resultMessage.style.color = '#22c55e';
          resultMessage.innerText = 'Display test finished successfully';
          onComplete();
        }
      }, updateInterval);
    }

    function runMidiTest(progressBar, progressText, resultMessage, onComplete) {
      const totalPCs = 20;
      let currentPC = 1;

      progressText.innerText = 'Testing MIDI...';
      resultMessage.style.color = '#a855f7';
      resultMessage.innerText = 'Sending Program Changes (PC 1-20)';
      progressBar.style.background = 'linear-gradient(90deg, #a855f7, #9333ea)';

      function sendNextPC() {
        if (currentPC > totalPCs) {
          clearInterval(hardwareTestInterval);
          hardwareTestInterval = null;

          progressBar.style.width = '100%';
          progressText.innerText = 'MIDI test complete!';
          resultMessage.style.color = '#22c55e';
          resultMessage.innerText = 'Sent PC 1 to PC 20 successfully';
          onComplete();
          return;
        }

        const progress = (currentPC / totalPCs) * 100;
        progressBar.style.width = progress + '%';
        progressText.innerText = 'Sending PC ' + currentPC + ' of ' + totalPCs + ' (' + Math.round(progress) + '%)';

        fetch('/api/hardware-test/midi/pc?pc=' + currentPC, { method: 'POST' })
          .then(response => {
            if (response.ok) {
              resultMessage.innerText = 'PC ' + currentPC + ' sent';
            }
          })
          .catch(err => {
            console.warn('MIDI PC ' + currentPC + ' error:', err);
            resultMessage.innerText = 'Error sending PC ' + currentPC;
          });

        currentPC++;
      }

      sendNextPC();
      hardwareTestInterval = setInterval(sendNextPC, 1000);
    }
