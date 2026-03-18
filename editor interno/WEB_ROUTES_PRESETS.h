#ifndef WEB_ROUTES_PRESETS_H
#define WEB_ROUTES_PRESETS_H

#include "COMMON_DEFS.h"
#include "WEB_JSON.h" // For PsramAllocator
#include "WIFI.h"     // Access to server, etc.
#include <Arduino.h>
#include <ArduinoJson.h>
#include <ESPAsyncWebServer.h>

// HTML Pages
#include "LABELS_HTML.h"
#include "PRESET_CONFIG_HTML.h"

#include "PRESET_CONFIG_CSS.h"
#include "PRESET_CONFIG_JS_CORE.h"
#include "PRESET_CONFIG_JS_EVENTS.h"
#include "PRESET_CONFIG_JS_UI.h"
#include "ICONS_WEB_DATA.h"


extern PresetData (*presets)[PRESET_LEVELS];
extern int currentButton;
extern int currentLetter;
extern int activeLiveLayer;
extern bool isLiveMode;
extern bool liveModeInitialized;

extern uint16_t restoreWriteDelayMs;

static inline void nvsCommitPause(uint16_t ms) {
#ifdef ESP32
  if (ms == 0) {
    return;
  }
  TickType_t ticks = ms / portTICK_PERIOD_MS;
  if (ticks < 1) {
    ticks = 1;
  }
  vTaskDelay(ticks);
#else
  delay(ms);
#endif
}

// Helper functions (defined in MAIN or WIFI or WEB_API)
extern bool LOAD_PRESET_LAYER_BLOB(int layer, int btn, int lvl,
                                   PresetData &data);
extern bool SAVE_PRESET_LAYER_BLOB(int layer, int btn, int lvl,
                                   const PresetData &data);
extern void SAVE_MEMORY_BLOB(int btn, int lvl);
extern void LOAD_ACTIVE_RAMP_CONFIG(int btn, int lvl);
extern void MAIN_SCREEN(int btn, int lvl);
extern void LED_PRESET(int btn);
extern void ACTIVE_PRESET(int btn, int lvl);

extern AsyncWebServer server;

void setupPresetRoutes() {
  // Preset Config Page
  server.on("/preset-config", HTTP_GET, [](AsyncWebServerRequest *request) {
    auto *response = request->beginResponseStream("text/html");
    response->print(FPSTR(PRESET_CONFIG_page_start));
    response->print(FPSTR(PRESET_CONFIG_css));
    response->print(FPSTR(PRESET_CONFIG_page_body));
    response->print(FPSTR(LABELS_html));
    response->print(FPSTR(ICONS_WEB_DATA_js));
    response->print(FPSTR(PRESET_CONFIG_js_core));
    response->print(FPSTR(PRESET_CONFIG_js_ui));
    response->print(FPSTR(PRESET_CONFIG_js_events));
    response->print(FPSTR(PRESET_CONFIG_page_end));
    request->send(response);
  });

  // API para ler TODOS os dados de presets
  server.on(
      "/get-all-presets-data", HTTP_GET, [](AsyncWebServerRequest *request) {
        // Rate limiting para evitar sobrecarga
        static unsigned long lastGetAllMs = 0;
        unsigned long now = millis();
        if (now - lastGetAllMs < 500) {
          request->send(429, "text/plain", "Muitas requisicoes. Aguarde.");
          return;
        }
        lastGetAllMs = now;

#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
        size_t freeHeap = ESP.getFreeHeap();
        size_t freePsram = ESP.getFreePsram();
#pragma GCC diagnostic pop
        if (freeHeap < 25000 || freePsram < 50000) {
          Serial.printf("[GET-ALL] Memoria baixa. Heap=%u PSRAM=%u\n",
                        (unsigned)freeHeap, (unsigned)freePsram);
          request->send(503, "text/plain", "Memoria insuficiente. Aguarde.");
          return;
        }
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
        ArduinoJson::BasicJsonDocument<PsramAllocator> doc(30720);
#pragma GCC diagnostic pop

        JsonArray presetsArray = doc["presets"].to<JsonArray>();

        for (int i = 0; i < TOTAL_BUTTONS; i++) {
          for (int k = 0; k < PRESET_LEVELS; k++) {
            JsonObject presetObj = presetsArray.add<JsonObject>();
            serializePresetDataToJson(presets[i][k], presetObj, i, k);
          }
        }

        AsyncResponseStream *response =
            request->beginResponseStream("application/json");
        serializeJson(doc, *response);
        request->send(response);
      });

  // API para salvar TODOS os dados de presets
  server.on(
      "/save-all-presets-data", HTTP_POST,
      [](AsyncWebServerRequest *request) {
        // Rate limiting para evitar sobrecarga durante restore
        static unsigned long lastSaveAllMs = 0;
        unsigned long now = millis();
        if (now - lastSaveAllMs < 1000) {
          request->send(429, "text/plain", "Muitas requisicoes. Aguarde.");
          return;
        }
        lastSaveAllMs = now;

        // Verificar memoria antes de aceitar
        size_t freeHeap = ESP.getFreeHeap();
        size_t freePsram = ESP.getFreePsram();
        if (freeHeap < 30000 || freePsram < 100000) {
          Serial.printf("[SAVE-ALL] Memoria baixa. Heap=%u PSRAM=%u\n",
                        (unsigned)freeHeap, (unsigned)freePsram);
          request->send(503, "text/plain", "Memoria insuficiente. Aguarde.");
          return;
        }

        postBodyBuffer = String();
        postBodyPsramLength = 0;
        postBodyPsramCapacity = 0;
        if (postBodyPsram) {
          heap_caps_free(postBodyPsram);
          postBodyPsram = nullptr;
        }
        Serial.println(
            "[SAVE HANDLER] HTTP_POST request started. Buffer cleared.");
        request->send(202);
      },
      NULL,
      [](AsyncWebServerRequest *request, uint8_t *data, size_t len,
         size_t index, size_t total) {
        static bool usePsramUpload = true;
        if (index == 0) {
          usePsramUpload = true;
          postBodyPsramLength = 0;
          postBodyPsramCapacity = total + 1;
          if (postBodyPsram) {
            heap_caps_free(postBodyPsram);
            postBodyPsram = nullptr;
          }
          postBodyPsram = (char *)heap_caps_malloc(
              postBodyPsramCapacity, MALLOC_CAP_8BIT | MALLOC_CAP_SPIRAM);
          if (!postBodyPsram) {
            usePsramUpload = false;
            postBodyBuffer.reserve(total + 32);
            Serial.println(
                "[SAVE HANDLER] Aviso: falha ao alocar PSRAM; usando "
                "String interna.");
          }
        }
        if (usePsramUpload && postBodyPsram) {
          if (index + len <= postBodyPsramCapacity) {
            memcpy(postBodyPsram + index, data, len);
            postBodyPsramLength = index + len;
          }
        } else {
          for (size_t i = 0; i < len; i++) {
            postBodyBuffer += (char)data[i];
          }
        }

        if (index + len == total) {
          Serial.println("\n[SAVE HANDLER] Todos os chunks recebidos.");
          Serial.printf(
              "[SAVE HANDLER] Tamanho total do payload acumulado: %u bytes\n",
              usePsramUpload ? (unsigned)postBodyPsramLength
                             : (unsigned)postBodyBuffer.length());

          if (total > 600000) {
            Serial.println("[SAVE HANDLER] ERRO: Payload muito grande!");
            if (postBodyPsram) {
              heap_caps_free(postBodyPsram);
              postBodyPsram = nullptr;
            }
            postBodyBuffer = String();
            return;
          }

          size_t docSize =
              (usePsramUpload ? postBodyPsramLength : postBodyBuffer.length()) +
              8192;
          if (docSize < 16384)
            docSize = 16384;
          if (docSize > 600000)
            docSize = 600000;
          // DEBUG: upload size and PSRAM free
          size_t __restoreBodyLen =
              usePsramUpload ? postBodyPsramLength : postBodyBuffer.length();
          Serial.printf("[RESTORE] Upload completo. Tamanho: %u bytes. PSRAM "
                        "livre: %u bytes\n",
                        (unsigned)__restoreBodyLen, ESP.getFreePsram());
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
          ArduinoJson::BasicJsonDocument<PsramAllocator> doc(docSize);
#pragma GCC diagnostic pop
          Serial.printf(
              "[SAVE HANDLER] DynamicJsonDocument alocado com tamanho: %u\n",
              docSize);

          if (usePsramUpload && postBodyPsram)
            postBodyPsram[postBodyPsramLength] = '\0';
          DeserializationError error =
              usePsramUpload && postBodyPsram
                  ? deserializeJson(doc, postBodyPsram, postBodyPsramLength)
                  : deserializeJson(doc, postBodyBuffer);
          Serial.println(
              "[SAVE HANDLER] deserializeJson chamado com corpo completo.");

          if (error) {
            Serial.print(F("[SAVE HANDLER] deserializeJson() falhou: "));
            Serial.println(error.c_str());
            if (postBodyPsram) {
              heap_caps_free(postBodyPsram);
              postBodyPsram = nullptr;
            }
            postBodyBuffer = String();
            return;
          }
          Serial.println("[SAVE HANDLER] JSON desserializado com sucesso.");
          if (postBodyPsram) {
            heap_caps_free(postBodyPsram);
            postBodyPsram = nullptr;
          }
          postBodyBuffer = String();

          JsonArrayConst presetsJsonArray = doc["presets"].as<JsonArrayConst>();
          if (!presetsJsonArray) {
            Serial.println(
                "[SAVE HANDLER] ERRO: Array ' n encontrado no JSON.");
            return;
          }
          Serial.printf("[SAVE HANDLER] Array ' encontrado. Tamanho: %d\n",
                        presetsJsonArray.size());

          if (presetsJsonArray.size() != (TOTAL_BUTTONS * PRESET_LEVELS)) {
            Serial.printf("[SAVE HANDLER] AVISO: N de presets no JSON (%d) "
                          "diferente do esperado (%d).\n",
                          presetsJsonArray.size(),
                          TOTAL_BUTTONS * PRESET_LEVELS);
          }

          int presetGlobalIndex = 0;
          for (int i = 0; i < TOTAL_BUTTONS; i++) {
            for (int k = 0; k < PRESET_LEVELS; k++) {
              if (presetGlobalIndex >= presetsJsonArray.size()) {
                Serial.printf(
                    "[SAVE HANDLER] AVISO: Fim do array JSON alcan "
                    "(idx %d) antes de completar o loop de presets do "
                    "firmware (i=%d, k=%d).\n",
                    presetGlobalIndex, i, k);
                goto end_loops;
              }

              JsonObjectConst presetJsonObj =
                  presetsJsonArray[presetGlobalIndex].as<JsonObjectConst>();
              if (!presetJsonObj) {
                Serial.printf("[SAVE HANDLER] AVISO: Objeto de preset nulo no "
                              "JSON, pulando  JSON %d\n",
                              presetGlobalIndex);
                presetGlobalIndex++;
                continue;
              }

              if (!deserializeJsonToPresetData(presetJsonObj, presets[i][k])) {
                Serial.printf("[SAVE HANDLER] AVISO: Falha ao desserializar "
                              "dados para o preset no  JSON %d\n",
                              presetGlobalIndex);
              }
              // Se for o preset ativo, recarrega as configuracoes de rampa
              // ativas
              if (i == currentButton && k == currentLetter) {
                LOAD_ACTIVE_RAMP_CONFIG(currentButton, currentLetter);
              }

              SAVE_MEMORY_BLOB(i, k);
              // Persist extra RAMPA unificado em NVS
              if (presetJsonObj["switches"].is<JsonArrayConst>()) {
                nvs_handle_t h;
                if (nvs_open_from_partition("nvs2", "presets", NVS_READWRITE,
                                            &h) == ESP_OK) {
                  JsonArrayConst swArr =
                      presetJsonObj["switches"].as<JsonArrayConst>();
                  for (int sw = 0; sw < TOTAL_BUTTONS; sw++) {
                    if (sw < swArr.size()) {
                      JsonObjectConst swObj = swArr[sw].as<JsonObjectConst>();
                      if (swObj) {
                        char key[32];
                        if (swObj["rampUp"].is<int>()) {
                          sprintf(key, "p%d%d_rtup_sw%d", i, k, sw);
                          nvs_set_i32(h, key, swObj["rampUp"].as<int>());
                        }
                        if (swObj["rampDown"].is<int>()) {
                          sprintf(key, "p%d%d_rtdn_sw%d", i, k, sw);
                          nvs_set_i32(h, key, swObj["rampDown"].as<int>());
                        }
                        if (swObj["rampInvert"].is<bool>()) {
                          sprintf(key, "p%d%d_rinv_sw%d", i, k, sw);
                          nvs_set_u8(h, key,
                                     swObj["rampInvert"].as<bool>() ? 1 : 0);
                        }
                        if (swObj["rampAutoStop"].is<bool>()) {
                          sprintf(key, "p%d%d_rastop_sw%d", i, k, sw);
                          nvs_set_u8(h, key,
                                     swObj["rampAutoStop"].as<bool>() ? 1 : 0);
                        }
                      }
                    }
                  }
                  nvs_commit(h);
                  nvs_close(h);
                  nvsCommitPause(restoreWriteDelayMs);
                }
              }

              // Persist extra CCs unificado em NVS
              if (presetJsonObj["extras"].is<JsonObjectConst>()) {
                JsonObjectConst extrasObj =
                    presetJsonObj["extras"].as<JsonObjectConst>();
                if (extrasObj["cc"].is<JsonArrayConst>()) {
                  JsonArrayConst ccArr = extrasObj["cc"].as<JsonArrayConst>();
                  nvs_handle_t h;
                  if (nvs_open_from_partition("nvs2", "presets", NVS_READWRITE,
                                              &h) == ESP_OK) {
                    for (int n = 0; n < 2; n++) {
                      if (n < ccArr.size()) {
                        JsonObjectConst ccObj = ccArr[n].as<JsonObjectConst>();
                        if (!ccObj.isNull()) {
                          char key[32];
                          if (ccObj["cc"].is<int>()) {
                            sprintf(key, "p%d%d_cc%d_c", i, k, n);
                            nvs_set_u8(h, key, (uint8_t)ccObj["cc"].as<int>());
                          }
                          if (ccObj["valor"].is<int>()) {
                            sprintf(key, "p%d%d_cc%d_v", i, k, n);
                            nvs_set_u8(h, key,
                                       (uint8_t)ccObj["valor"].as<int>());
                          }
                          if (ccObj["canal"].is<int>()) {
                            sprintf(key, "p%d%d_cc%d_ch", i, k, n);
                            nvs_set_u8(h, key,
                                       (uint8_t)ccObj["canal"].as<int>());
                          }
                        }
                      }
                    }
                    nvs_commit(h);
                    nvs_close(h);
                    nvsCommitPause(restoreWriteDelayMs);
                  }
                }
              }

              delay(0); // Yield para n travar tarefas de fundo
              presetGlobalIndex++;
            }
          }
        end_loops:;

          // Process Layer 2 if passed
          JsonArrayConst presetsLayer2 =
              doc["presets_layer2"].as<JsonArrayConst>();
          if (presetsLayer2) {
            Serial.printf("[SAVE HANDLER] Salvando Layer 2 (%d itens).\n",
                          presetsLayer2.size());
            int idx = 0;
            for (int i = 0; i < TOTAL_BUTTONS; i++) {
              for (int k = 0; k < PRESET_LEVELS; k++) {
                if (idx >= presetsLayer2.size())
                  goto end_layer2;
                JsonObjectConst presetJsonObj =
                    presetsLayer2[idx].as<JsonObjectConst>();
                PresetData *tmp = (PresetData *)heap_caps_malloc(
                    sizeof(PresetData), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
                if (!tmp) {
                  Serial.println("[SAVE HANDLER] Falha ao alocar PSRAM para Layer 2");
                  idx++;
                  continue;
                }
                initPresetDefaults(*tmp);
                if (presetJsonObj) {
                  deserializeJsonToPresetData(presetJsonObj, *tmp);
                  // Save to BLOB layer 2
                  SAVE_PRESET_LAYER_BLOB(2, i, k, *tmp);
                }
                heap_caps_free(tmp);
                idx++;
                delay(0);
              }
            }
          end_layer2:;
          }

          Serial.println("[SAVE HANDLER] Processamento concluido.");
        }
      });

  server.on("/api/restore/config", HTTP_GET,
            [](AsyncWebServerRequest *request) {
              if (request->hasParam("delay_ms")) {
                int v = request->getParam("delay_ms")->value().toInt();
                if (v < 0)
                  v = 0;
                if (v > 1000)
                  v = 1000; // limita entre 0 e 1000ms
                restoreWriteDelayMs = (uint16_t)v;
              }
              JsonDocument doc;
              doc["restoreWriteDelayMs"] = restoreWriteDelayMs;
              String payload;
              serializeJson(doc, payload);
              request->send(200, "application/json", payload);
            });

  server.on("/api/presets/diagnostics", HTTP_GET,
            [](AsyncWebServerRequest *request) {
              // Usa PSRAM para documento de diagnóstico que pode crescer
              ArduinoJson::BasicJsonDocument<PsramAllocator> out(4096);
              JsonArray arr = out["entries"].to<JsonArray>();
              int present = 0;
              nvs_handle_t h;
              if (nvs_open_from_partition("nvs2", "presets_bin", NVS_READONLY,
                                          &h) == ESP_OK) {
                for (int btn = 0; btn < TOTAL_BUTTONS; ++btn) {
                  for (int lvl = 0; lvl < PRESET_LEVELS; ++lvl) {
                    char key[8];
                    sprintf(key, "p%d%d", btn, lvl);
                    size_t len = 0;
                    esp_err_t ge = nvs_get_blob(h, key, NULL, &len);
                    JsonObject e = arr.add<JsonObject>();
                    e["key"] = key;
                    e["exists"] = (ge == ESP_OK);
                    e["size"] = (ge == ESP_OK) ? (int)len : 0;
                    if (ge == ESP_OK)
                      present++;
                  }
                }
                nvs_close(h);
              }
              out["total"] = TOTAL_BUTTONS * PRESET_LEVELS;
              out["present"] = present;
              String payload;
              serializeJson(out, payload);
              request->send(200, "application/json", payload);
            });

  server.on(
      "/get-single-preset-data", HTTP_GET, [](AsyncWebServerRequest *request) {
        // Verificar memória disponível antes de processar
        size_t freeHeap = ESP.getFreeHeap();
        size_t freePsram = ESP.getFreePsram();
        if (freeHeap < 20000 || freePsram < 30000) {
          Serial.printf("[GET-SINGLE] AVISO: Memoria baixa! Heap=%u PSRAM=%u\n",
                        (unsigned)freeHeap, (unsigned)freePsram);
          request->send(503, "text/plain", "Memoria insuficiente. Aguarde.");
          return;
        }

        // Rate limit reduzido para melhor responsividade
        static unsigned long lastGetSingleMs = 0;
        unsigned long now = millis();
        unsigned long delta = now - lastGetSingleMs;
        if (delta < 30) {
#ifdef ESP32
          vTaskDelay((30 - delta) / portTICK_PERIOD_MS + 1);
#else
          delay(30 - delta);
#endif
        }
        lastGetSingleMs = millis();

        if (request->hasParam("btn") && request->hasParam("lvl")) {
          int btn = request->getParam("btn")->value().toInt();
          int lvl = request->getParam("lvl")->value().toInt();
          int layerIndex = 1;
          if (request->hasParam("layer")) {
            int l = request->getParam("layer")->value().toInt();
            if (l >= 1 && l <= LIVE_LAYERS)
              layerIndex = l;
          }

          if (btn >= 0 && btn < TOTAL_BUTTONS && lvl >= 0 &&
              lvl < PRESET_LEVELS) {
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
            ArduinoJson::BasicJsonDocument<PsramAllocator> doc(16384);
#pragma GCC diagnostic pop
            JsonObject presetObj = doc.to<JsonObject>();

            // Aloca PresetData em PSRAM para evitar stack overflow
            PresetData *tempPreset = (PresetData *)heap_caps_malloc(
                sizeof(PresetData), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
            if (!tempPreset) {
              Serial.println("[GET-SINGLE] Falha ao alocar PSRAM para tempPreset");
              request->send(503, "text/plain", "Falha ao alocar memoria PSRAM.");
              return;
            }
            // Inicializa com defaults ANTES de tentar carregar
            initPresetDefaults(*tempPreset);
            PresetData *srcPreset = nullptr;

            // Usa helper unificado que lê sempre a layer solicitada a
            // partir da NVS (quando possível) garantindo que alternar entre
            // layer 1 e 2 não dependa do conteúdo atual em RAM.
            if (LOAD_PRESET_LAYER_BLOB(layerIndex, btn, lvl, *tempPreset)) {
              srcPreset = tempPreset;
            } else {
              // Fallback: usa preset default inicializado
              // Copia nome do preset padrão se a RAM não tiver dados válidos
              if (presets[btn][lvl].nomePreset[0] == '\0' ||
                  presets[btn][lvl].nomePreset[0] < 32 ||
                  presets[btn][lvl].nomePreset[0] > 126) {
                strncpy(tempPreset->nomePreset, presetNames[btn][lvl], 10);
                tempPreset->nomePreset[10] = '\0';
                srcPreset = tempPreset;
              } else {
                srcPreset = &presets[btn][lvl];
              }
            }

            // Garante que strings estejam null-terminated antes de serializar
            srcPreset->nomePreset[MAX_PRESET_NAME_LENGTH] = '\0';
            for (int sw = 0; sw < TOTAL_BUTTONS; ++sw) {
              srcPreset->switches[sw].sigla_fx[3] = '\0';
              srcPreset->switches[sw].sigla_fx_2[3] = '\0';
            }

            // Debug log removido para melhor performance

            serializePresetDataToJson(*srcPreset, presetObj, btn, lvl);
            heap_caps_free(tempPreset); // Libera PSRAM após serialização
            AsyncResponseStream *response =
                request->beginResponseStream("application/json");
            serializeJson(doc, *response);
            request->send(response);
          } else {
            request->send(400, "text/plain",
                          " de preset (btn/lvl) inv ou fora dos limites.");
            Serial.println("[GET-SINGLE] Erro:  de preset inv.");
          }
        } else {
          request->send(400, "text/plain", "Par ' e ' s obrigat.");
          Serial.println("[GET-SINGLE] Erro: Par ' e ' ausentes.");
        }
      });

  server.on(
      "/save-single-preset-data", HTTP_POST,
      [](AsyncWebServerRequest *request) {
        // Rate limiting para evitar sobrecarga
        static unsigned long lastSaveSingleMs = 0;
        unsigned long now = millis();
        if (now - lastSaveSingleMs < 50) {
          request->send(429, "text/plain", "Muitas requisicoes. Aguarde.");
          return;
        }
        lastSaveSingleMs = now;

        // Verificar memoria antes de aceitar
        size_t freeHeap = ESP.getFreeHeap();
        size_t freePsram = ESP.getFreePsram();
        if (freeHeap < 20000 || freePsram < 40000) {
          Serial.printf("[SAVE-SINGLE] Memoria baixa. Heap=%u PSRAM=%u\n",
                        (unsigned)freeHeap, (unsigned)freePsram);
          request->send(503, "text/plain", "Memoria insuficiente. Aguarde.");
          return;
        }

        postBodyBuffer = String();
        postBodyPsramLength = 0;
        postBodyPsramCapacity = 0;
        if (postBodyPsram) {
          heap_caps_free(postBodyPsram);
          postBodyPsram = nullptr;
        }

        bool paramsOk = false;
        if (request->hasParam("btn") && request->hasParam("lvl")) {
          int btn = request->getParam("btn")->value().toInt();
          int lvl = request->getParam("lvl")->value().toInt();
          if (btn >= 0 && btn < TOTAL_BUTTONS && lvl >= 0 &&
              lvl < PRESET_LEVELS) {
            paramsOk = true;
            Serial.printf("[SAVE-SINGLE] HTTP_POST request started for btn=%d, "
                          "lvl=%d. Buffer cleared.\n",
                          btn, lvl);
            request->send(202);
          } else {
            Serial.printf("[SAVE-SINGLE] Erro inicial:  btn=%d, lvl=%d inv.\n",
                          btn, lvl);
            request->send(400, "text/plain",
                          " de preset (btn/lvl) inv na URL.");
          }
        } else {
          Serial.println(
              "[SAVE-SINGLE] Erro inicial: Par ' e ' ausentes na URL.");
          request->send(400, "text/plain", "Par ' e ' da URL s obrigat.");
        }
      },
      NULL,
      [](AsyncWebServerRequest *request, uint8_t *data, size_t len,
         size_t index, size_t total) {
        int btn_param = -1, lvl_param = -1;
        int layer_param = 1;
        bool params_valid_for_body = false;
        if (request->hasParam("btn") && request->hasParam("lvl")) {
          btn_param = request->getParam("btn")->value().toInt();
          lvl_param = request->getParam("lvl")->value().toInt();
          if (btn_param >= 0 && btn_param < TOTAL_BUTTONS && lvl_param >= 0 &&
              lvl_param < PRESET_LEVELS) {
            params_valid_for_body = true;
          }
        }
        if (request->hasParam("layer")) {
          int l = request->getParam("layer")->value().toInt();
          if (l >= 1 && l <= LIVE_LAYERS)
            layer_param = l;
        }
        // Parametro migrate=1 indica que e um backup antigo que precisa migrar indices de cores
        bool migrate_colors = false;
        if (request->hasParam("migrate")) {
          migrate_colors = (request->getParam("migrate")->value().toInt() == 1);
        }

        if (!params_valid_for_body) {
          if (index + len == total) {
            postBodyBuffer = String();
            Serial.printf(
                "[SAVE-SINGLE BODY] Par inv (btn=%d, lvl=%d) no corpo. "
                "Corpo ignorado.\n",
                btn_param, lvl_param);
          }
          return;
        }

        static bool usePsramUpload = true;
        if (index == 0) {
          usePsramUpload = true;
          postBodyPsramLength = 0;
          postBodyPsramCapacity = total + 1;
          if (postBodyPsram) {
            heap_caps_free(postBodyPsram);
            postBodyPsram = nullptr;
          }
          postBodyPsram = (char *)heap_caps_malloc(
              postBodyPsramCapacity, MALLOC_CAP_8BIT | MALLOC_CAP_SPIRAM);
          if (!postBodyPsram) {
            usePsramUpload = false;
            postBodyBuffer.reserve(total + 32);
            Serial.println("[RESTORE] Aviso: falha ao alocar PSRAM; usando "
                           "String interna.");
          }
        }
        if (usePsramUpload && postBodyPsram) {
          if (index + len <= postBodyPsramCapacity) {
            memcpy(postBodyPsram + index, data, len);
            postBodyPsramLength = index + len;
          }
        } else {
          for (size_t i = 0; i < len; i++) {
            postBodyBuffer += (char)data[i];
          }
        }

        if (index + len == total) {
          Serial.println("\n[SAVE-SINGLE] Todos os chunks recebidos.");
          Serial.printf(
              "[SAVE-SINGLE] Tamanho total do payload acumulado: %u bytes\n",
              usePsramUpload ? (unsigned)postBodyPsramLength
                             : (unsigned)postBodyBuffer.length());

#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
          size_t docSize =
              (usePsramUpload ? postBodyPsramLength : postBodyBuffer.length()) +
              1024;
          if (docSize < 4096)
            docSize = 4096;
          if (docSize > 65536)
            docSize = 65536;
          ArduinoJson::BasicJsonDocument<PsramAllocator> doc(docSize);
#pragma GCC diagnostic pop
          // Per-chunk/body verbose logging removed to avoid blocking and
          // excessive serial output.
          if (usePsramUpload && postBodyPsram)
            postBodyPsram[postBodyPsramLength] = '\0';
          DeserializationError error =
              usePsramUpload && postBodyPsram
                  ? deserializeJson(doc, postBodyPsram, postBodyPsramLength)
                  : deserializeJson(doc, postBodyBuffer);

          if (error) {
            Serial.print(F("[SAVE-SINGLE] deserializeJson() falhou para "
                           "btn=%d, lvl=%d: "));
            Serial.println(error.c_str());
          } else {
            // Removed heavy debug serialization/prints to keep the UI
            // responsive.
            JsonObjectConst presetJsonObj = doc.as<JsonObjectConst>();
            if (!presetJsonObj) {
              Serial.printf(
                  "[SAVE-SINGLE] JSON invalido para btn=%d, lvl=%d.\n",
                  btn_param, lvl_param);
            } else if (layer_param == 1) {
              // Layer 1: comportamento atual, atualiza presets[] em RAM e NVS
              if (deserializeJsonToPresetData(presetJsonObj,
                                              presets[btn_param][lvl_param])) {
                // Se migrate_colors=true, migra indices de cores (PRETO 9->14)
                if (migrate_colors) {
                  migratePresetColorIndices(presets[btn_param][lvl_param]);
                }
                // Persist extra RAMPA unificado por switch em NVS
                nvs_handle_t h;
                if (nvs_open_from_partition("nvs2", "presets", NVS_READWRITE,
                                            &h) == ESP_OK) {
                  for (int sw = 0; sw < TOTAL_BUTTONS; sw++) {
                    if (sw <
                        presetJsonObj["switches"].as<JsonArrayConst>().size()) {
                      JsonObjectConst swObj =
                          presetJsonObj["switches"][sw].as<JsonObjectConst>();
                      if (swObj) {
                        char key[32];
                        if (swObj["rampUp"].is<int>()) {
                          sprintf(key, "p%d%d_rtup_sw%d", btn_param, lvl_param,
                                  sw);
                          nvs_set_i32(h, key, swObj["rampUp"].as<int>());
                        }
                        if (swObj["rampDown"].is<int>()) {
                          sprintf(key, "p%d%d_rtdn_sw%d", btn_param, lvl_param,
                                  sw);
                          nvs_set_i32(h, key, swObj["rampDown"].as<int>());
                        }
                        if (swObj["rampInvert"].is<bool>()) {
                          sprintf(key, "p%d%d_rinv_sw%d", btn_param, lvl_param,
                                  sw);
                          nvs_set_u8(h, key,
                                     swObj["rampInvert"].as<bool>() ? 1 : 0);
                        }
                        if (swObj["rampAutoStop"].is<bool>()) {
                          sprintf(key, "p%d%d_rastop_sw%d", btn_param,
                                  lvl_param, sw);
                          nvs_set_u8(h, key,
                                     swObj["rampAutoStop"].as<bool>() ? 1 : 0);
                        }
                      }
                    }
                  }
                  nvs_commit(h);
                  nvs_close(h);
                  nvsCommitPause(restoreWriteDelayMs);
                }
                // Debug log removido para melhor performance
                SAVE_MEMORY_BLOB(btn_param, lvl_param);
              } else {
                Serial.printf("[SAVE-SINGLE] Falha ao desserializar/processar "
                              "dados para preset btn=%d, lvl=%d (layer 1).\n",
                              btn_param, lvl_param);
              }
            } else {
              // Layer 2: usa BLOB separado, sem alterar presets[] em RAM,
              // alocando em PSRAM
              PresetData *layerPreset = (PresetData *)heap_caps_malloc(
                  sizeof(PresetData), MALLOC_CAP_SPIRAM);
              if (!layerPreset) {
                Serial.printf(
                    "[SAVE-SINGLE] Falha CRITICA ao alocar PSRAM para "
                    "layer %d, btn=%d, lvl=%d.\n",
                    layer_param, btn_param, lvl_param);
              } else {
                memset(layerPreset, 0, sizeof(PresetData)); // Inicia zerado
                if (deserializeJsonToPresetData(presetJsonObj, *layerPreset)) {
                  // Se migrate_colors=true, migra indices de cores (PRETO 9->14)
                  if (migrate_colors) {
                    migratePresetColorIndices(*layerPreset);
                  }
                  SAVE_PRESET_LAYER_BLOB(layer_param, btn_param, lvl_param,
                                         *layerPreset);
                } else {
                  Serial.printf(
                      "[SAVE-SINGLE] Falha ao desserializar dados para "
                      "layer %d, btn=%d, lvl=%d.\n",
                      layer_param, btn_param, lvl_param);
                }
                heap_caps_free(layerPreset); // Libera a memória PSRAM
              }
            }
          }
// Pequeno yield apÃ³s gravar na NVS para evitar WDT/brownout durante trÃ¡fego
// Wiâ€‘Fi
#ifdef ESP32
          vTaskDelay(1);
#else
          delay(1);
#endif
          if (postBodyPsram) {
            heap_caps_free(postBodyPsram);
            postBodyPsram = nullptr;
          }
          postBodyBuffer = String();
        }
      });

  // API para migrar presets atuais para BLOBs e limpar o formato antigo '
  server.on("/api/presets/migrate-clean", HTTP_POST,
            [](AsyncWebServerRequest *request) {
              size_t psram_before = ESP.getFreePsram();
              size_t heap_before = ESP.getFreeHeap();

              int migrated = 0;
              for (int i = 0; i < TOTAL_BUTTONS; i++) {
                for (int k = 0; k < PRESET_LEVELS; k++) {
                  SAVE_MEMORY_BLOB(i, k);
                  migrated++;
                }
              }

              bool erased = false;
              {
                nvs_handle_t h;
                esp_err_t err = nvs_open_from_partition("nvs2", "presets",
                                                        NVS_READWRITE, &h);
                if (err == ESP_OK) {
                  esp_err_t e2 = nvs_erase_all(h);
                  esp_err_t ec = nvs_commit(h);
                  erased = (e2 == ESP_OK && ec == ESP_OK);
                  nvs_close(h);
                }
              }

              size_t psram_after = ESP.getFreePsram();
              size_t heap_after = ESP.getFreeHeap();

              AsyncResponseStream *response =
                  request->beginResponseStream("application/json");
              response->print("{");
              response->print("\"success\":true,");
              response->print("\"migrated\":");
              response->print(migrated);
              response->print(",");
              response->print("\"erased_old_namespace\":");
              response->print(erased ? "true" : "false");
              response->print(",");
              response->print("\"free_psram_before\":");
              response->print(psram_before);
              response->print(",");
              response->print("\"free_heap_before\":");
              response->print(heap_before);
              response->print(",");
              response->print("\"free_psram_after\":");
              response->print(psram_after);
              response->print(",");
              response->print("\"free_heap_after\":");
              response->print(heap_after);
              response->print("}");
              request->send(response);
            });

  // API para migrar indices de cores em todos os presets na RAM e NVS
  // Converte PRETO de indice 9 (versoes antigas) para indice 14 (V10 r6+)
  // Usar apos restaurar backup de versao antiga se as cores estiverem erradas
  server.on("/api/presets/migrate-colors", HTTP_POST,
            [](AsyncWebServerRequest *request) {
              int migrated_l1 = 0;
              int migrated_l2 = 0;

              // Migra Layer 1 (presets[][] em RAM)
              for (int btn = 0; btn < TOTAL_BUTTONS; btn++) {
                for (int lvl = 0; lvl < PRESET_LEVELS; lvl++) {
                  migratePresetColorIndices(presets[btn][lvl]);
                  SAVE_MEMORY_BLOB(btn, lvl);
                  migrated_l1++;
                }
              }

              // Migra Layer 2 (presets salvos em NVS como blobs)
              for (int layer = 2; layer <= LIVE_LAYERS; layer++) {
                for (int btn = 0; btn < TOTAL_BUTTONS; btn++) {
                  for (int lvl = 0; lvl < PRESET_LEVELS; lvl++) {
                    PresetData *layerPreset = (PresetData *)heap_caps_malloc(
                        sizeof(PresetData), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
                    if (layerPreset) {
                      if (LOAD_PRESET_LAYER_BLOB(layer, btn, lvl, *layerPreset)) {
                        migratePresetColorIndices(*layerPreset);
                        SAVE_PRESET_LAYER_BLOB(layer, btn, lvl, *layerPreset);
                        migrated_l2++;
                      }
                      heap_caps_free(layerPreset);
                    }
                  }
                }
              }

              AsyncResponseStream *response =
                  request->beginResponseStream("application/json");
              response->print("{\"success\":true,");
              response->print("\"migrated_layer1\":");
              response->print(migrated_l1);
              response->print(",\"migrated_layer2\":");
              response->print(migrated_l2);
              response->print("}");
              request->send(response);

              Serial.printf("[MIGRATE-COLORS] Migrados %d presets L1, %d presets L2\n",
                            migrated_l1, migrated_l2);
            });

  // API para instruir o ESP32 a ATUALIZAR SEU DISPLAY/LEDs
  // Opcionalmente aceita ?layer=1|2 para que o modo LIVE use o layer correto.
  server.on("/set-active-config-preset", HTTP_GET,
            [](AsyncWebServerRequest *request) {
              if (request->hasParam("btn") && request->hasParam("lvl")) {
                int btn_param = request->getParam("btn")->value().toInt();
                int lvl_param = request->getParam("lvl")->value().toInt();
                int layer_param = 1;
                if (request->hasParam("layer")) {
                  int l = request->getParam("layer")->value().toInt();
                  if (l >= 1 && l <= LIVE_LAYERS)
                    layer_param = l;
                }

                if (btn_param >= 0 && btn_param < TOTAL_BUTTONS &&
                    lvl_param >= 0 && lvl_param < PRESET_LEVELS) {
                  currentButton = btn_param;
                  currentLetter = lvl_param;
                  // Atualiza layer LIVE ativo (afeta cor e preset usado pelo
                  // SW_LIVE)
                  activeLiveLayer = layer_param;

                  // Quando já estamos em modo LIVE, garantimos que o preset em
                  // RAM reflita o layer ativo. Fora do modo LIVE, mantemos
                  // presets[][] como base (layer1) para evitar interferir no
                  // modo PRESET.
                  if (isLiveMode) {
                    PresetData *tempPreset = (PresetData *)heap_caps_malloc(
                        sizeof(PresetData), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
                    if (tempPreset) {
                      if (LOAD_PRESET_LAYER_BLOB(activeLiveLayer, currentButton,
                                                 currentLetter, *tempPreset)) {
                        presets[currentButton][currentLetter] = *tempPreset;
                      }
                      heap_caps_free(tempPreset);
                    }
                  }

                  // Recarrega RAMPA ativa para refletir alteracoes feitas via
                  // editor
                  LOAD_ACTIVE_RAMP_CONFIG(currentButton, currentLetter);

                  MAIN_SCREEN(currentButton, currentLetter);
                  LED_PRESET(currentButton);
                  ACTIVE_PRESET(currentButton, currentLetter);
                  if (isLiveMode) {
                    liveModeInitialized = false;
                    Serial.printf(
                        "[WEB-CONFIG] Modo Live reinicializado para preset: "
                        "btn=%d, lvl=%d, layer=%d\n",
                        currentButton, currentLetter, activeLiveLayer);
                  }
                  Serial.println(
                      "[WEB-CONFIG] Display/LEDs atualizados e MIDI enviado "
                      "para preset: " +
                      String(currentButton) + ", " + String(currentLetter) +
                      " (layer LIVE " + String(activeLiveLayer) + ")");
                  request->send(
                      200, "text/plain",
                      "Display/LEDs atualizados e MIDI enviado no ESP32.");
                } else {
                  request->send(400, "text/plain", " de preset (btn/lvl) inv.");
                  Serial.println("[WEB-CONFIG] Erro:  de preset inv para "
                                 "set-active-config-preset.");
                }
              } else {
                request->send(400, "text/plain", "Par ' e ' s obrigat.");
                Serial.println("[WEB-CONFIG] Erro: Par ' e ' ausentes para "
                               "set-active-config-preset.");
              }
            });

  // API para atualizar apenas o DISPLAY/LEDs sem enviar MIDI
  // Opcionalmente aceita ?layer=1|2 para que o preset em RAM corresponda ao
  // layer LIVE editado.
  server.on(
      "/refresh-display-only", HTTP_GET, [](AsyncWebServerRequest *request) {
        if (request->hasParam("btn") && request->hasParam("lvl")) {
          int btn_param = request->getParam("btn")->value().toInt();
          int lvl_param = request->getParam("lvl")->value().toInt();
          int layer_param = 1;
          if (request->hasParam("layer")) {
            int l = request->getParam("layer")->value().toInt();
            if (l >= 1 && l <= LIVE_LAYERS)
              layer_param = l;
          }

          if (btn_param >= 0 && btn_param < TOTAL_BUTTONS && lvl_param >= 0 &&
              lvl_param < PRESET_LEVELS) {
            currentButton = btn_param;
            currentLetter = lvl_param;
            activeLiveLayer = layer_param;

            // Carrega em RAM o preset correspondente ao layer ativo apenas se
            // já estivermos em modo LIVE. Em modo PRESET, mantemos presets[][]
            // sempre como a base do preset (layer1).
            if (isLiveMode) {
              PresetData *tempPreset = (PresetData *)heap_caps_malloc(
                  sizeof(PresetData), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
              if (tempPreset) {
                if (LOAD_PRESET_LAYER_BLOB(activeLiveLayer, currentButton,
                                           currentLetter, *tempPreset)) {
                  presets[currentButton][currentLetter] = *tempPreset;
                }
                heap_caps_free(tempPreset);
              }
            }

            // Recarrega configuracoes de rampa ativas para refletir dados
            // persistidos
            LOAD_ACTIVE_RAMP_CONFIG(currentButton, currentLetter);

            MAIN_SCREEN(currentButton, currentLetter);
            if (isLiveMode) {
              // Em modo LIVE, reinitialize o loop LIVE para redesenhar todos os
              // pixels conforme SW_LIVE
              liveModeInitialized = false;
              Serial.println(
                  "[WEB-CONFIG] LIVE ativo: pixels serao atualizados "
                  "pelo SW_LIVE.");
            } else {
              // Em modo PRESET, atualiza os pixels conforme configuracao do
              // preset (layer1 permanece comportamento padrao)
              LED_PRESET(currentButton);
            }

            Serial.println(
                "[WEB-CONFIG] Display atualizado; LEDs conforme modo atual (" +
                String(isLiveMode ? "LIVE" : "PRESET") + ") para preset: " +
                String(currentButton) + ", " + String(currentLetter) +
                " (layer LIVE " + String(activeLiveLayer) + ")");
            request->send(200, "text/plain",
                          "Display atualizado e LEDs conforme modo atual.");
          } else {
            request->send(400, "text/plain", " de preset (btn/lvl) inv.");
            Serial.println(
                "[WEB-CONFIG] Erro:  de preset inv para refresh-display-only.");
          }
        } else {
          request->send(400, "text/plain", "Par ' e ' s obrigat.");
          Serial.println("[WEB-CONFIG] Erro: Par ' e ' ausentes para "
                         "refresh-display-only.");
        }
      });
}

#endif
