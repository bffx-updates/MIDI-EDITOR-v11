#ifndef WEB_ROUTES_GLOBAL_H
#define WEB_ROUTES_GLOBAL_H

#include "COMMON_DEFS.h"
#include "WEB_JSON.h" // For PsramAllocator
#include "WIFI.h"     // Access to server, etc.
#include <Arduino.h>
#include <ArduinoJson.h>
#include <ESPAsyncWebServer.h>

// HTML Pages
#include "GLOBAL_CONFIG_CSS.h"
#include "GLOBAL_CONFIG_HTML.h"
#include "GLOBAL_CONFIG_JS.h"


// Externs needed
extern int ledBrilho;
extern bool ledPreview;
extern bool backgroundEnabled;
extern uint32_t backgroundColorConfig;
extern String modoMidi;
extern const char *modoMidiOpcoes[NUM_MODO_MIDI_OPCOES];
extern bool mostrarTelaFX;
extern uint8_t mostrarFxModo;
extern uint8_t mostrarFxQuando;
extern uint32_t coresPresetConfig[NUM_LED_COLORS];
extern uint32_t corLiveModeConfig;
extern uint32_t corLiveMode2Config;
extern bool liveLayer2Enabled;
extern GlobalSwitchConfig swGlobalConfig;
extern int rampaValor;
extern bool presetLevels[PRESET_LEVELS];
extern bool lockSetup;
extern bool lockGlobal;
extern bool ledModeNumeros;
extern bool autoStartEnabled;
extern uint8_t autoStartRow;
extern uint8_t autoStartCol;
extern bool autoStartLiveMode;
extern String selectMode;
extern const char *selectModeOpcoes[NUM_SELECT_MODE_OPCOES];

extern void SAVE_GLOBAL();
extern void aplicarBrilhoLEDs();
extern void aplicarConfiguracoesDeCorLEDs();

extern AsyncWebServer server;

void setupGlobalRoutes() {
  // Global Config Page
  server.on("/global-config", HTTP_GET, [](AsyncWebServerRequest *request) {
    AsyncResponseStream *response = request->beginResponseStream("text/html");
    response->print(FPSTR(GLOBAL_CONFIG_page_start));
    response->print(FPSTR(GLOBAL_CONFIG_css));
    response->print(FPSTR(GLOBAL_CONFIG_page_body));
    response->print(FPSTR(GLOBAL_CONFIG_js));
    response->print(FPSTR(GLOBAL_CONFIG_page_end));
    request->send(response);
  });

  // Global Config Read API
  server.on(
      "/api/global-config/read", HTTP_GET, [](AsyncWebServerRequest *request) {
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
        size_t freeHeap = ESP.getFreeHeap();
        size_t freePsram = ESP.getFreePsram();
#pragma GCC diagnostic pop
        if (freeHeap < 20000 || freePsram < 30000) {
          Serial.printf("[GLOBAL READ] Memoria baixa. Heap=%u PSRAM=%u\n",
                        (unsigned)freeHeap, (unsigned)freePsram);
          request->send(503, "text/plain", "Memoria insuficiente. Aguarde.");
          return;
        }
        // Usa PSRAM para o documento JSON
        ArduinoJson::BasicJsonDocument<PsramAllocator> configData(8192);

        String boardName = "default"; // Valor padr
        nvs_handle_t sys_handle;
        if (nvs_open_from_partition("nvs2", "system", NVS_READONLY,
                                    &sys_handle) == ESP_OK) {
          size_t required_size = 0;
          if (nvs_get_str(sys_handle, "board_name", NULL, &required_size) ==
              ESP_OK) {
            char *value = new char[required_size];
            if (nvs_get_str(sys_handle, "board_name", value, &required_size) ==
                ESP_OK) {
              boardName = String(value);
            }
            delete[] value;
          }
          nvs_close(sys_handle);
        }
        configData["boardName"] = boardName;

        configData["ledBrilho"] = ledBrilho;
        configData["ledPreview"] = ledPreview;
        configData["backgroundEnabled"] = backgroundEnabled;
        configData["backgroundColorConfig"] = backgroundColorConfig;
        int currentModoMidiIndex = 0;
        for (int i = 0; i < NUM_MODO_MIDI_OPCOES; i++) {
          if (modoMidi == modoMidiOpcoes[i]) {
            currentModoMidiIndex = i;
            break;
          }
        }
        configData["modoMidiIndex"] = currentModoMidiIndex;
        configData["mostrarTelaFX"] = mostrarTelaFX;
        configData["mostrarFxModo"] = mostrarFxModo;
        configData["mostrarFxQuando"] = mostrarFxQuando;

        // legado (compatibilidade com UI antiga): 0=OFF, 1=PREVIEW(SEMPRE), 2=LIVE MODE
        uint8_t legacySiglaFX = 0;
        if (mostrarFxModo != 0) legacySiglaFX = (mostrarFxQuando == 1) ? 2 : 1;
        configData["mostrarSiglaFX"] = legacySiglaFX;
        configData["rampaValor"] = rampaValor;

        JsonArray coresArray = configData["coresPresetConfig"].to<JsonArray>();
        for (int i = 0; i < NUM_LED_COLORS; i++) {
          coresArray.add(coresPresetConfig[i]);
        }

        configData["corLiveModeConfig"] = corLiveModeConfig;
        configData["corLiveMode2Config"] = corLiveMode2Config;
        configData["liveLayer2Enabled"] = liveLayer2Enabled;

        JsonObject swGlobalObj = configData["swGlobal"].to<JsonObject>();
        swGlobalObj["modo"] = swGlobalConfig.modo;
        swGlobalObj["cc"] = swGlobalConfig.cc;
        swGlobalObj["cc2"] = swGlobalConfig.cc2;
        swGlobalObj["start_value"] = swGlobalConfig.start_value;
        swGlobalObj["start_value_cc2"] = swGlobalConfig.start_value_cc2;
        swGlobalObj["spin_send_pc"] = swGlobalConfig.spin_send_pc;
        swGlobalObj["favoriteAutoLive"] = swGlobalConfig.favoriteAutoLive;
        // RAMPA (Global)
        swGlobalObj["rampUp"] = swGlobalConfig.rampUp;
        swGlobalObj["rampDown"] = swGlobalConfig.rampDown;
        swGlobalObj["rampInvert"] = swGlobalConfig.rampInvert;
        swGlobalObj["rampAutoStop"] = swGlobalConfig.rampAutoStop;
        swGlobalObj["canal"] = swGlobalConfig.canal;
        swGlobalObj["cc2_ch"] = swGlobalConfig.canal_cc2;
        swGlobalObj["canal_cc2"] = swGlobalConfig.canal_cc2;
        swGlobalObj["led"] = swGlobalConfig.led;
        swGlobalObj["led2"] = swGlobalConfig.led2;
        // TAP TEMPO adicionais para SW Global
        swGlobalObj["tap2_cc"] = swGlobalConfig.tap2_cc;
        swGlobalObj["tap2_ch"] = swGlobalConfig.tap2_ch;
        swGlobalObj["tap3_cc"] = swGlobalConfig.tap3_cc;
        swGlobalObj["tap3_ch"] = swGlobalConfig.tap3_ch;

        JsonObject extrasObj = swGlobalObj["extras"].to<JsonObject>();
        JsonArray spinArray = extrasObj["spin"].to<JsonArray>();
        JsonObject spinItem = spinArray.add<JsonObject>();
        spinItem["v1"] = swGlobalConfig.extras.spin[0].v1;
        spinItem["v2"] = swGlobalConfig.extras.spin[0].v2;
        spinItem["v3"] = swGlobalConfig.extras.spin[0].v3;

        JsonArray customArray = extrasObj["custom"].to<JsonArray>();
        JsonObject customItem = customArray.add<JsonObject>();
        customItem["valor_off"] = swGlobalConfig.extras.custom[0].valor_off;
        customItem["valor_on"] = swGlobalConfig.extras.custom[0].valor_on;

        JsonArray presetLevelsArray =
            configData["presetLevels"].to<JsonArray>();
        for (int i = 0; i < PRESET_LEVELS; i++) {
          presetLevelsArray.add(presetLevels[i]);
        }

        configData["lockSetup"] = lockSetup;
        configData["lockGlobal"] = lockGlobal;
        configData["ledModeNumeros"] = ledModeNumeros;

        // INICIO AUTOMATICO
        configData["autoStartEnabled"] = autoStartEnabled;
        configData["autoStartRow"] = autoStartRow;
        configData["autoStartCol"] = autoStartCol;
        configData["autoStartLiveMode"] = autoStartLiveMode;

        int currentSelectModeIndex = 0;
        for (int i = 0; i < NUM_SELECT_MODE_OPCOES; i++) {
          if (selectMode == selectModeOpcoes[i]) {
            currentSelectModeIndex = i;
            break;
          }
        }
        configData["selectModeIndex"] = currentSelectModeIndex;

        String jsonString;
        serializeJson(configData, jsonString);
        request->send(200, "application/json", jsonString);
      });

  // Global Config Save API
  server.on(
      "/api/global-config/save", HTTP_POST,
      [](AsyncWebServerRequest *request) {
        // Handler vazio para o início da requisição.
        // A resposta será enviada no final do upload.
      },
      NULL, // Sem handler de upload de arquivo
      [](AsyncWebServerRequest *request, uint8_t *data, size_t len,
         size_t index, size_t total) {
        // Acumula os dados do corpo da requisição
        if (index == 0) {
          postBodyBuffer = "";
          if (total > 0) {
            postBodyBuffer.reserve(total);
          }
        }
        for (size_t i = 0; i < len; i++) {
          postBodyBuffer += (char)data[i];
        }

        // Se todos os dados foram recebidos, processa o JSON
        if (index + len == total) {
          Serial.printf("[GLOBAL SAVE] Payload recebido: %d bytes\n", total);

#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
          ArduinoJson::BasicJsonDocument<PsramAllocator> doc(8192);
#pragma GCC diagnostic pop
          DeserializationError error = deserializeJson(doc, postBodyBuffer);

          bool success = true;
          String message = "Configura salvas.";

          if (error) {
            Serial.print(F("deserializeJson() falhou: "));
            Serial.println(error.c_str());
            success = false;
            // Mensagem de erro mais detalhada para o front-end
            message = "Falha ao processar os dados (JSON). Causa: ";
            message += error.c_str();
            message += ". Verifique a conexão Wi-Fi e tente novamente.";

          } else {
            JsonObject jsonObj = doc.as<JsonObject>();

            if (jsonObj["ledBrilho"].is<int>())
              ledBrilho = jsonObj["ledBrilho"].as<int>();
            if (jsonObj["ledPreview"].is<bool>())
              ledPreview = jsonObj["ledPreview"].as<bool>();
            if (jsonObj["backgroundEnabled"].is<bool>())
              backgroundEnabled = jsonObj["backgroundEnabled"].as<bool>();
            if (jsonObj["backgroundColorConfig"].is<int>())
              backgroundColorConfig =
                  (uint32_t)jsonObj["backgroundColorConfig"].as<int>();
            // Persistir imediatamente BG no NVS (para compatibilidade enquanto
            // SAVE_GLOBAL não conhece esses campos)
            {
              nvs_handle_t h;
              if (nvs_open_from_partition("nvs2", "bfmidi", NVS_READWRITE,
                                          &h) == ESP_OK) {
                nvs_set_u8(h, "bgEn", (uint8_t)backgroundEnabled);
                nvs_set_u32(h, "bgColor", backgroundColorConfig);
                nvs_commit(h);
                nvs_close(h);
              }
            }
            if (jsonObj["modoMidiIndex"].is<int>()) {
              int modoIndex = jsonObj["modoMidiIndex"].as<int>();
              if (modoIndex >= 0 && modoIndex < NUM_MODO_MIDI_OPCOES) {
                modoMidi = modoMidiOpcoes[modoIndex];
              }
            }
            if (jsonObj["mostrarTelaFX"].is<bool>())
              mostrarTelaFX = jsonObj["mostrarTelaFX"].as<bool>();

            // FX DISPLAY (novo): 0=SEMPRE, 1=LIVE MODE, 2=NUNCA
            bool hasNewFxFields = jsonObj["mostrarFxModo"].is<int>() || jsonObj["mostrarFxQuando"].is<int>();
            if (jsonObj["mostrarFxModo"].is<int>())
              mostrarFxModo = (uint8_t)jsonObj["mostrarFxModo"].as<int>();
            if (jsonObj["mostrarFxQuando"].is<int>())
              mostrarFxQuando = (uint8_t)jsonObj["mostrarFxQuando"].as<int>();

            // Legado: mostrarSiglaFX (0=NUNCA, 1=SEMPRE, 2=LIVE MODE)
            // So aplica conversao legado se NAO tiver os campos novos
            if (!hasNewFxFields && !jsonObj["mostrarSiglaFX"].isNull()) {
              uint8_t legacySiglaFX = 1;
              if (jsonObj["mostrarSiglaFX"].is<int>()) {
                legacySiglaFX = (uint8_t)jsonObj["mostrarSiglaFX"].as<int>();
              } else if (jsonObj["mostrarSiglaFX"].is<bool>()) {
                legacySiglaFX = jsonObj["mostrarSiglaFX"].as<bool>() ? 1 : 0;
              }
              // Converte: 0=NUNCA->quando=2, 1=SEMPRE->quando=0, 2=LIVE->quando=1
              mostrarFxModo = 1; // SIGLAS (sempre ativo)
              if (legacySiglaFX == 0) {
                mostrarFxQuando = 2; // NUNCA
              } else if (legacySiglaFX == 2) {
                mostrarFxQuando = 1; // LIVE MODE
              } else {
                mostrarFxQuando = 0; // SEMPRE
              }
            }
            if (jsonObj["rampaValor"].is<int>())
              rampaValor = jsonObj["rampaValor"].as<int>();

            if (jsonObj["coresPresetConfig"].is<JsonArrayConst>()) {
              JsonArrayConst coresArray =
                  jsonObj["coresPresetConfig"].as<JsonArrayConst>();
              // Aceita arrays de qualquer tamanho, usa ate NUM_LED_COLORS elementos
              int count = min((int)coresArray.size(), NUM_LED_COLORS);
              for (int i = 0; i < count; i++) {
                coresPresetConfig[i] = coresArray[i].as<uint32_t>();
              }
              // Preenche cores faltantes com valores padrao (PERFIS_CORES)
              // Cores padrao: VERMELHO, VERDE, AZUL, AMARELO, ROXO, CYAN
              const Cores coresPadrao[NUM_LED_COLORS] = {VERMELHO, VERDE, AZUL, AMARELO, ROXO, CYAN};
              for (int i = count; i < NUM_LED_COLORS; i++) {
                Cores c = coresPadrao[i];
                coresPresetConfig[i] = ((uint32_t)PERFIS_CORES[c][0] << 16) |
                                       ((uint32_t)PERFIS_CORES[c][1] << 8) |
                                       (uint32_t)PERFIS_CORES[c][2];
              }
            }

            if (!jsonObj["corLiveModeConfig"].isNull())
              corLiveModeConfig = jsonObj["corLiveModeConfig"].as<uint32_t>();
            if (!jsonObj["corLiveMode2Config"].isNull())
              corLiveMode2Config = jsonObj["corLiveMode2Config"].as<uint32_t>();
            if (!jsonObj["liveLayer2Enabled"].isNull())
              liveLayer2Enabled = jsonObj["liveLayer2Enabled"].as<bool>();

            if (jsonObj["swGlobal"].is<JsonObjectConst>()) {
              JsonObjectConst swGlobalJson = jsonObj["swGlobal"];
              if (swGlobalJson) {
                swGlobalConfig.modo = swGlobalJson["modo"].as<uint8_t>();
                swGlobalConfig.cc = swGlobalJson["cc"].as<uint8_t>();
                swGlobalConfig.cc2 = swGlobalJson["cc2"].as<uint8_t>();
                swGlobalConfig.start_value =
                    swGlobalJson["start_value"].as<bool>();
                swGlobalConfig.start_value_cc2 =
                    swGlobalJson["start_value_cc2"].as<bool>();
                swGlobalConfig.spin_send_pc =
                    swGlobalJson["spin_send_pc"].is<bool>()
                        ? swGlobalJson["spin_send_pc"].as<bool>()
                        : swGlobalConfig.spin_send_pc;
                if ((swGlobalConfig.modo >= 19 && swGlobalConfig.modo <= 21) ||
                    (swGlobalConfig.modo >= 41 && swGlobalConfig.modo <= 43)) {
                  swGlobalConfig.modo = 1;
                  swGlobalConfig.spin_send_pc = true;
                }
                swGlobalConfig.canal = swGlobalJson["canal"].as<uint8_t>();
                if (!swGlobalJson["cc2_ch"].isNull()) {
                  swGlobalConfig.canal_cc2 =
                      swGlobalJson["cc2_ch"].as<uint8_t>();
                } else if (!swGlobalJson["canal_cc2"].isNull()) {
                  swGlobalConfig.canal_cc2 =
                      swGlobalJson["canal_cc2"].as<uint8_t>();
                }
                swGlobalConfig.led = swGlobalJson["led"].as<uint8_t>();
                if (swGlobalJson["led2"].is<int>())
                  swGlobalConfig.led2 = swGlobalJson["led2"].as<uint8_t>();
                if (swGlobalJson["favoriteAutoLive"].is<bool>()) {
                  swGlobalConfig.favoriteAutoLive =
                      swGlobalJson["favoriteAutoLive"].as<bool>();
                }
                if (swGlobalJson["rampUp"].is<int>())
                  swGlobalConfig.rampUp = swGlobalJson["rampUp"].as<int>();
                if (swGlobalJson["rampDown"].is<int>())
                  swGlobalConfig.rampDown = swGlobalJson["rampDown"].as<int>();
                if (swGlobalJson["rampInvert"].is<bool>())
                  swGlobalConfig.rampInvert =
                      swGlobalJson["rampInvert"].as<bool>();
                if (swGlobalJson["rampAutoStop"].is<bool>())
                  swGlobalConfig.rampAutoStop =
                      swGlobalJson["rampAutoStop"].as<bool>();

                // TAP TEMPO adicionais (TAP2/TAP3)
                swGlobalConfig.tap2_cc = swGlobalJson["tap2_cc"].is<int>()
                                             ? swGlobalJson["tap2_cc"].as<int>()
                                             : 0;
                swGlobalConfig.tap2_ch = swGlobalJson["tap2_ch"].is<int>()
                                             ? swGlobalJson["tap2_ch"].as<int>()
                                             : 0;
                swGlobalConfig.tap3_cc = swGlobalJson["tap3_cc"].is<int>()
                                             ? swGlobalJson["tap3_cc"].as<int>()
                                             : 0;
                swGlobalConfig.tap3_ch = swGlobalJson["tap3_ch"].is<int>()
                                             ? swGlobalJson["tap3_ch"].as<int>()
                                             : 0;
                JsonObjectConst extrasJson = swGlobalJson["extras"];
                if (extrasJson) {
                  JsonArrayConst spinArray = extrasJson["spin"];
                  if (spinArray && spinArray[0]) {
                    swGlobalConfig.extras.spin[0].v1 = spinArray[0]["v1"];
                    swGlobalConfig.extras.spin[0].v2 = spinArray[0]["v2"];
                    swGlobalConfig.extras.spin[0].v3 = spinArray[0]["v3"];
                  }
                  JsonArrayConst customArray = extrasJson["custom"];
                  if (customArray && customArray[0]) {
                    swGlobalConfig.extras.custom[0].valor_off =
                        customArray[0]["valor_off"];
                    swGlobalConfig.extras.custom[0].valor_on =
                        customArray[0]["valor_on"];
                  }
                }
              }
            }

            if (jsonObj["selectModeIndex"].is<int>()) {
              int modeIndex = jsonObj["selectModeIndex"].as<int>();
              if (modeIndex >= 0 && modeIndex < NUM_SELECT_MODE_OPCOES) {
                selectMode = selectModeOpcoes[modeIndex];
              } else {
                success = false;
                message = " de Select Mode inv.";
              }
            }

            if (jsonObj["presetLevels"].is<JsonArrayConst>()) {
              JsonArrayConst levelsArray =
                  jsonObj["presetLevels"].as<JsonArrayConst>();
              if (levelsArray.size() == PRESET_LEVELS) {
                for (int i = 0; i < PRESET_LEVELS; i++) {
                  presetLevels[i] = levelsArray[i].as<bool>();
                }
              }
            }

            if (jsonObj["lockSetup"].is<bool>())
              lockSetup = jsonObj["lockSetup"].as<bool>();
            if (jsonObj["lockGlobal"].is<bool>())
              lockGlobal = jsonObj["lockGlobal"].as<bool>();
            if (jsonObj["ledModeNumeros"].is<bool>())
              ledModeNumeros = jsonObj["ledModeNumeros"].as<bool>();

            // INICIO AUTOMATICO
            if (jsonObj["autoStartEnabled"].is<bool>())
              autoStartEnabled = jsonObj["autoStartEnabled"].as<bool>();
            if (jsonObj["autoStartRow"].is<int>())
              autoStartRow = (uint8_t)jsonObj["autoStartRow"].as<int>();
            if (jsonObj["autoStartCol"].is<int>())
              autoStartCol = (uint8_t)jsonObj["autoStartCol"].as<int>();
            if (jsonObj["autoStartLiveMode"].is<bool>())
              autoStartLiveMode = jsonObj["autoStartLiveMode"].as<bool>();

            if (success) {
              SAVE_GLOBAL();
              aplicarBrilhoLEDs();
              aplicarConfiguracoesDeCorLEDs();
            }
          }

          JsonDocument responseDoc;
          responseDoc["success"] = success;
          responseDoc["message"] = message;
          {
            AsyncResponseStream *response =
                request->beginResponseStream("application/json");
            serializeJson(responseDoc, *response);
            request->send(response);
          }
        } // Fim do if (index + len == total)
      });
}

#endif
