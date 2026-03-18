import { ConnectionManager } from "./connection.js";
import { ParityBridgeHost } from "./parity-bridge-host.js";

if (window.parent && window.parent !== window) {
  window.location.replace("./preset-config/");
}


const connection = new ConnectionManager();
let protocol = null;

const bridgeHost = new ParityBridgeHost(() => protocol);

const editorFrameEl = document.getElementById("editorFrame");
const usbStatusIndicatorEl = document.getElementById("usbStatusIndicator");
const usbStatusTextEl = document.getElementById("usbStatusText");
const btnToolbarConnectEl = document.getElementById("btnToolbarConnect");
const btnToolbarDisconnectEl = document.getElementById("btnToolbarDisconnect");
const serialLogsEl = document.getElementById("serialLogs");
const deviceDotEl = document.getElementById("deviceDot");
const deviceNameEl = document.getElementById("deviceName");
const brandTitleEl = document.getElementById("brandTitle");
const editorCacheBust = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let currentPage = "preset-config";

const logLines = [];
const MAX_LOG_LINES = 80;

window.BFMIDIExternalBridge = {
  request: (rawUrl, init) => bridgeHost.request(rawUrl, init),
  isConnected: () => bridgeHost.isConnected(),
};

function appendLog(message, level = "info") {
  if (!serialLogsEl) {
    return;
  }

  const ts = new Date().toLocaleTimeString("pt-BR", { hour12: false });
  const prefix = level.toUpperCase();
  const line = `[${ts}] [${prefix}] ${message}`;

  logLines.push(line);
  if (logLines.length > MAX_LOG_LINES) {
    logLines.shift();
  }

  bridgeHost.pushMonitorEntry(line, level);

  serialLogsEl.textContent = logLines.join("\n");
  serialLogsEl.scrollTop = serialLogsEl.scrollHeight;
}

function setStatus(state, message) {
  if (usbStatusIndicatorEl) {
    usbStatusIndicatorEl.dataset.state = state;
  }

  const statusLabels = {
    connected: "READY",
    connecting: "LINKING",
    error: "ERROR",
    disconnected: "OFFLINE",
  };

  if (usbStatusTextEl) {
    usbStatusTextEl.textContent = statusLabels[state] || "OFFLINE";
  }

  // Update device footer dot
  if (deviceDotEl) {
    deviceDotEl.classList.toggle("connected", state === "connected");
  }

  const connected = state === "connected";
  const connecting = state === "connecting";
  btnToolbarConnectEl.disabled = connected || connecting;
  btnToolbarDisconnectEl.disabled = !connected;

  if (message) {
    appendLog(message, state === "error" ? "error" : "info");
  }
}

function reloadEditorFrameAfterConnect() {
  if (!editorFrameEl) {
    return;
  }

  editorFrameEl.src = `./${currentPage}/?v=${editorCacheBust}`;
}

async function connect() {
  setStatus("connecting", "Conectando via WebMIDI -> WebSerial...");

  try {
    const result = await connection.connect();
    protocol = result.protocol;

    if (result.midiWarn) {
      appendLog(`Aviso MIDI: ${result.midiWarn.message}`, "warn");
    }

    if (result.portInfo) {
      const vid = Number.isInteger(result.portInfo.usbVendorId)
        ? `0x${result.portInfo.usbVendorId.toString(16).padStart(4, "0")}`
        : "n/a";
      const pid = Number.isInteger(result.portInfo.usbProductId)
        ? `0x${result.portInfo.usbProductId.toString(16).padStart(4, "0")}`
        : "n/a";
      appendLog(`Porta ativa ${vid}:${pid}`, "info");
    }

    // Update device name in footer
    if (deviceNameEl) {
      deviceNameEl.textContent = "BFMIDI";
    }

    setStatus("connected", "Conexao estabelecida. Editor ativo.");
    reloadEditorFrameAfterConnect();
  } catch (error) {
    protocol = null;
    setStatus("error", `Falha na conexao: ${error.message}`);
  }
}

async function disconnect() {
  try {
    await connection.desconectar();
  } catch {
    // noop
  } finally {
    protocol = null;
    if (deviceNameEl) {
      deviceNameEl.textContent = "---";
    }
    setStatus("disconnected", "Conexao encerrada.");
  }
}

btnToolbarConnectEl.addEventListener("click", connect);
btnToolbarDisconnectEl.addEventListener("click", disconnect);

// --- SIDEBAR NAVIGATION ---
const navItems = document.querySelectorAll(".nav-item[data-page]");

function setActiveNav(page) {
  navItems.forEach((n) => {
    n.classList.toggle("active", n.dataset.page === page);
  });
}

function navigateToPage(page) {
  const valid = ["preset-config", "global-config", "system"];
  const target = valid.includes(page) ? page : "preset-config";
  currentPage = target;
  setActiveNav(target);
  if (brandTitleEl) {
    brandTitleEl.innerHTML = target === "preset-config" ? "BFMIDI<span>EDITOR</span>" : "BFMIDI";
  }
  if (editorFrameEl) {
    editorFrameEl.src = `./${target}/?v=${editorCacheBust}`;
  }
}

navItems.forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const page = item.dataset.page;
    if (!page) return;
    location.hash = page;
  });
});

window.addEventListener("hashchange", () => {
  const page = (location.hash || "#preset-config").replace("#", "");
  navigateToPage(page);
});

navigateToPage((location.hash || "#preset-config").replace("#", ""));

// --- CONNECTION LOG EVENTS ---
connection.addEventListener("log", (event) => {
  const detail = event.detail;

  if (typeof detail === "string") {
    appendLog(detail, "info");
    return;
  }

  if (!detail || typeof detail !== "object") {
    return;
  }

  const type = detail.type || "info";
  const msg = detail.message || JSON.stringify(detail);

  if (type === "error") {
    setStatus("error", msg);
    return;
  }

  if (type === "warn") {
    appendLog(msg, "warn");
    return;
  }

  if (type === "serial") {
    appendLog(msg, "serial");
    return;
  }

  appendLog(msg, "info");
});

appendLog("Editor carregado. Clique em Connect para iniciar o link USB.", "info");
setStatus("disconnected", "Aguardando conexao.");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    const isLocalHost = location.hostname === "127.0.0.1" || location.hostname === "localhost";
    if (isLocalHost) {
      // Em ambiente local de desenvolvimento, evita SW cacheando assets antigos.
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      } catch {
        // noop
      }
      return;
    }
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // noop
    });
  });
}
