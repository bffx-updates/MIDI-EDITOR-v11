#pragma once

#include "COMMON_DEFS.h"
#include "WEB_API.h" // For readRampExtrasFromNVS, initPresetDefaults
#include "WIFI.h"    // For wifiStatus? migrateBackupDocument sets globals.
#include <Arduino.h>
#include <ArduinoJson.h>
#include <esp_heap_caps.h>

// Globals like wifi_sta_enabled are in WIFI.h (extern).
// But migrateBackupDocument sets them.
// WIFI.h declares them.

// Functions extracted from WIFI_SERVER.h

void serializePresetDataToJson(const PresetData &preset, JsonObject &presetObj,
                               int btnIndex = -1, int lvlIndex = -1) {
  presetObj["nomePreset"] = preset.nomePreset;
  presetObj["nomePresetTextColor"] = preset.nomePresetTextColor;
  presetObj["bank"] = preset.bank;
  presetObj["canal"] = preset.canal;
  // Per-switch ramp times (ms)
  {
    JsonObject rt = presetObj["rampTimes"].to<JsonObject>();
    rt["sw1"] = preset.rampTimes[0];
    rt["sw2"] = preset.rampTimes[1];
    rt["sw3"] = preset.rampTimes[2];
    rt["sw4"] = preset.rampTimes[3];
    rt["sw5"] = preset.rampTimes[4];
    rt["sw6"] = preset.rampTimes[5];
  }

  JsonArray switchesArray = presetObj["switches"].to<JsonArray>();
  for (int j = 0; j < TOTAL_BUTTONS;
       j++) { // TOTAL_BUTTONS  6, para os 6 switches
    JsonObject swObj = switchesArray.add<JsonObject>();
    swObj["modo"] = preset.switches[j].modo;
    swObj["cc"] = preset.switches[j].cc;
    swObj["cc2"] = preset.switches[j].cc2;
    swObj["cc2_ch"] = preset.switches[j].canal_cc2;
    swObj["canal_cc2"] = preset.switches[j].canal_cc2;
    swObj["cc_hold"] =
        preset.switches[j]
            .cc_hold; // CC dedicado para SPINx HOLD long-press on/off

    swObj["start_value"] = preset.switches[j].start_value;
    swObj["start_value_cc2"] =
        preset.switches[j]
            .start_value_cc2; // NEW: persist CC2 initial state in JSON
    swObj["single_value"] = preset.switches[j].single_value;
    swObj["spin_send_pc"] = preset.switches[j].spin_send_pc;
    swObj["canal"] = preset.switches[j].canal;
    swObj["led"] = preset.switches[j].led;
    swObj["autoRamp"] = preset.switches[j].autoRamp;
    swObj["led2"] = preset.switches[j].led2;
    // NEW: include HOLD color index for SPIN HOLD
    swObj["led_hold"] = preset.switches[j].led_hold;
    // NEW: include 3-char FX label (SIGLA FX)
    swObj["sigla_fx"] = preset.switches[j].sigla_fx;
    // NEW: include 3-char FX label 2 (SIGLA FX 2)
    swObj["sigla_fx_2"] = preset.switches[j].sigla_fx_2;
    // NEW: include icon FX indices (0=text mode, 1=DRIVE, 2=REVERB, etc.)
    swObj["icon_fx"] = preset.switches[j].icon_fx;
    swObj["icon_fx_2"] = preset.switches[j].icon_fx_2;
    // NEW: include icon name for display
    swObj["icon_name"] = preset.switches[j].icon_name;
    swObj["icon_name_2"] = preset.switches[j].icon_name_2;
    // icon_name_color removed - now follows icon ON/OFF color
    // NEW: icon color and fill for display
    swObj["icon_color"] = preset.switches[j].icon_color;
    swObj["icon_color_off"] = preset.switches[j].icon_color_off;
    // border_on_mode removed - always use border_color_on
    swObj["border_color_on"] = preset.switches[j].border_color_on;
    swObj["border_color_off"] = preset.switches[j].border_color_off;
    swObj["back_color_on"] = preset.switches[j].back_color_on;
    swObj["back_color_off"] = preset.switches[j].back_color_off;
    swObj["icon_color_2"] = preset.switches[j].icon_color_2;
    swObj["icon_color_off_2"] = preset.switches[j].icon_color_off_2;
    swObj["border_color_on_2"] = preset.switches[j].border_color_on_2;
    swObj["border_color_off_2"] = preset.switches[j].border_color_off_2;
    swObj["back_color_on_2"] = preset.switches[j].back_color_on_2;
    swObj["back_color_off_2"] = preset.switches[j].back_color_off_2;

    // MACROS array
    JsonArray macrosArr = swObj["macros"].to<JsonArray>();
    for (int m = 0; m < 4; m++) {
      JsonObject mObj = macrosArr.add<JsonObject>();
      const int macroCc = preset.switches[j].macros[m].cc;
      const int macroOff = preset.switches[j].macros[m].valueOff;
      const int macroOn = preset.switches[j].macros[m].valueOn;
      const int macroCh = preset.switches[j].macros[m].channel;
      mObj["cc"] = macroCc;
      mObj["valueOff"] = macroOff;
      mObj["valueOn"] = macroOn;
      mObj["channel"] = macroCh;
      // Legacy field names for compatibility with older UIs
      mObj["off"] = macroOff;
      mObj["on"] = macroOn;
      mObj["ch"] = macroCh;
    }

    swObj["favoriteAutoLive"] = preset.switches[j].favoriteAutoLive;
    // TAP TEMPO extras
    swObj["tap2_cc"] = preset.switches[j].tap2_cc;
    swObj["tap2_ch"] = preset.switches[j].tap2_ch;
    swObj["tap3_cc"] = preset.switches[j].tap3_cc;
    swObj["tap3_ch"] = preset.switches[j].tap3_ch;
    // DUAL STOMP custom values
    swObj["ds_custom_enabled"] = preset.switches[j].ds_custom_enabled;
    swObj["ds_cc1_off"] = preset.switches[j].ds_cc1_off;
    swObj["ds_cc1_on"] = preset.switches[j].ds_cc1_on;
    swObj["ds_cc2_off"] = preset.switches[j].ds_cc2_off;
    swObj["ds_cc2_on"] = preset.switches[j].ds_cc2_on;
    // Extra RAMPA unificado: injeta valores do NVS para o preset se indices
    // fornecidos
    if (btnIndex >= 0 && lvlIndex >= 0) {
      int baseMs = (j >= 0 && j < TOTAL_BUTTONS)
                       ? (preset.rampTimes[j] > 0 ? preset.rampTimes[j] : 1000)
                       : 1000;
      int upMs = baseMs, dnMs = baseMs;
      bool inv = false, autoStop = true;
      readRampExtrasFromNVS(btnIndex, lvlIndex, j, upMs, dnMs, inv, autoStop,
                            baseMs);
      swObj["rampUp"] = upMs;
      swObj["rampDown"] = dnMs;
      swObj["rampInvert"] = inv;
      swObj["rampAutoStop"] = autoStop;
    }
  }

  JsonObject extrasObj = presetObj["extras"].to<JsonObject>();
  JsonArray spinArray = extrasObj["spin"].to<JsonArray>();
  for (int e = 0; e < 6; e++) {
    JsonObject spinItem = spinArray.add<JsonObject>();
    spinItem["v1"] = preset.extras.spin[e].v1;
    spinItem["v2"] = preset.extras.spin[e].v2;
    spinItem["v3"] = preset.extras.spin[e].v3;
  }
  JsonArray controlArray = extrasObj["control"].to<JsonArray>();
  for (int e = 0; e < 6; e++) {
    JsonObject controlItem = controlArray.add<JsonObject>();
    controlItem["cc"] = preset.extras.control[e].cc;
    controlItem["modo_invertido"] = preset.extras.control[e].modo_invertido;
  }
  JsonArray customArray = extrasObj["custom"].to<JsonArray>();
  for (int e = 0; e < 6; e++) {
    JsonObject customItem = customArray.add<JsonObject>();
    customItem["cc"] = preset.extras.custom[e].cc;
    customItem["canal"] = preset.extras.custom[e].canal;
    customItem["valor_off"] = preset.extras.custom[e].valor_off;
    customItem["valor_on"] = preset.extras.custom[e].valor_on;
  }
  extrasObj["enviar_extras"] = preset.extras.enviar_extras;

  // PCs extras
  JsonArray pcArray = extrasObj["pc"].to<JsonArray>();
  for (int e = 0; e < 4; e++) { // Modificado para 4 PCs
    JsonObject pcItem = pcArray.add<JsonObject>();
    pcItem["valor"] = preset.extras.pc[e].valor;
    pcItem["canal"] = preset.extras.pc[e].canal;
  }

  // CC extras (CC1 e CC2)
  JsonArray ccArray = extrasObj["cc"].to<JsonArray>();
  for (int e = 0; e < 2; e++) {
    JsonObject ccItem = ccArray.add<JsonObject>();
    ccItem["cc"] = preset.extras.cc[e].cc;
    ccItem["valor"] = preset.extras.cc[e].valor;
    ccItem["canal"] = preset.extras.cc[e].canal;
  }
}

// ============================================================================
// MIGRACAO DE INDICES DE CORES EM PRESETS
// ============================================================================
// Migra indices de cores de versoes antigas (V9.x, V10 r1-r5) para V10 r6+
// No enum antigo, PRETO era indice 9. No novo enum, PRETO e indice 14.
// Indices 9-13 agora sao novas cores (CORAL, AZUL_CELESTE, VIOLETA, ROSA, MENTA)
// Esta funcao deve ser chamada apos deserializar presets de backups antigos.
static inline int migrateColorIndexFromOldBackup(int colorIndex) {
  // Se o indice e 9 (antigo PRETO), mapeia para 14 (novo PRETO)
  if (colorIndex == 9) return 14;
  // Outros indices permanecem iguais (0-8 sao as mesmas cores)
  return colorIndex;
}

// Aplica migracao de indices de cores em um PresetData
// Chamar apos deserializar de um backup antigo (V9.x ou V10 r1-r5)
static void migratePresetColorIndices(PresetData &preset) {
  for (int j = 0; j < TOTAL_BUTTONS; j++) {
    preset.switches[j].led = migrateColorIndexFromOldBackup(preset.switches[j].led);
    preset.switches[j].led2 = migrateColorIndexFromOldBackup(preset.switches[j].led2);
    preset.switches[j].led_hold = migrateColorIndexFromOldBackup(preset.switches[j].led_hold);
    preset.switches[j].icon_color = migrateColorIndexFromOldBackup(preset.switches[j].icon_color);
    preset.switches[j].icon_color_off = migrateColorIndexFromOldBackup(preset.switches[j].icon_color_off);
    preset.switches[j].border_color_on = migrateColorIndexFromOldBackup(preset.switches[j].border_color_on);
    preset.switches[j].border_color_off = migrateColorIndexFromOldBackup(preset.switches[j].border_color_off);
    preset.switches[j].back_color_on = migrateColorIndexFromOldBackup(preset.switches[j].back_color_on);
    preset.switches[j].back_color_off = migrateColorIndexFromOldBackup(preset.switches[j].back_color_off);
  }
}

bool deserializeJsonToPresetData(JsonObjectConst &presetJsonObj,
                                 PresetData &presetTarget) {
  if (!presetJsonObj)
    return false;
  // Garante base zerada e com valores padrao antes de aplicar o JSON
  initPresetDefaults(presetTarget);
  int customSIndex[TOTAL_BUTTONS];
  for (int i = 0; i < TOTAL_BUTTONS; i++)
    customSIndex[i] = -1;

  if (presetJsonObj["nomePreset"].is<const char *>()) {
    const char *nome = presetJsonObj["nomePreset"].as<const char *>();
    if (nome) {
      strncpy(presetTarget.nomePreset, nome, MAX_PRESET_NAME_LENGTH);
      presetTarget.nomePreset[MAX_PRESET_NAME_LENGTH] = '\0';
    } else {
      presetTarget.nomePreset[0] = '\0'; // Default se o valor for nulo
    }
  } else {
    presetTarget.nomePreset[0] = '\0'; // Default se a chave n existir
  }

  presetTarget.nomePresetTextColor =
      presetJsonObj["nomePresetTextColor"].is<uint32_t>()
          ? presetJsonObj["nomePresetTextColor"].as<uint32_t>()
          : 0xFFFFFF;
  presetTarget.bank =
      presetJsonObj["bank"].is<int>() ? presetJsonObj["bank"].as<int>() : 0;
  presetTarget.canal = clampPresetChannel(
      presetJsonObj["canal"].is<int>() ? presetJsonObj["canal"].as<int>() : 1);

  // rampTimes (per-switch, ms)
  for (int i = 0; i < TOTAL_BUTTONS; ++i)
    presetTarget.rampTimes[i] = 1000;
  if (presetJsonObj["rampTimes"].is<JsonObjectConst>()) {
    JsonObjectConst rt = presetJsonObj["rampTimes"].as<JsonObjectConst>();
    if (rt) {
      if (rt["sw1"].is<int>())
        presetTarget.rampTimes[0] = clampRampTimeMs(rt["sw1"].as<int>());
      if (rt["sw2"].is<int>())
        presetTarget.rampTimes[1] = clampRampTimeMs(rt["sw2"].as<int>());
      if (rt["sw3"].is<int>())
        presetTarget.rampTimes[2] = clampRampTimeMs(rt["sw3"].as<int>());
      if (rt["sw4"].is<int>())
        presetTarget.rampTimes[3] = clampRampTimeMs(rt["sw4"].as<int>());
      if (rt["sw5"].is<int>())
        presetTarget.rampTimes[4] = clampRampTimeMs(rt["sw5"].as<int>());
      if (rt["sw6"].is<int>())
        presetTarget.rampTimes[5] = clampRampTimeMs(rt["sw6"].as<int>());
    }
  }

  JsonArrayConst switchesJsonArray =
      presetJsonObj["switches"].as<JsonArrayConst>();
  if (switchesJsonArray) {
    for (int j = 0; j < TOTAL_BUTTONS; j++) {
      if (j < switchesJsonArray.size()) {
        JsonObjectConst swJsonObj = switchesJsonArray[j].as<JsonObjectConst>();
        if (swJsonObj) {
          int modoRecebido =
              swJsonObj["modo"].is<int>() ? swJsonObj["modo"].as<int>() : 0;
          presetTarget.switches[j].modo = modoRecebido;
          if ((presetTarget.switches[j].modo >= 19 &&
               presetTarget.switches[j].modo <= 21) ||
              (presetTarget.switches[j].modo >= 41 &&
               presetTarget.switches[j].modo <= 43)) {
            // Converte SPIN(P) legado para SPIN com flag de PC
            if (presetTarget.switches[j].modo >= 19 &&
                presetTarget.switches[j].modo <= 21) {
              presetTarget.switches[j].modo =
                  presetTarget.switches[j].modo - 18;
            } else {
              presetTarget.switches[j].modo = presetTarget.switches[j].modo - 3;
            }
            presetTarget.switches[j].spin_send_pc = true;
          }
          if (presetTarget.switches[j].modo >= 22 &&
              presetTarget.switches[j].modo <= 27) {
            int idx = presetTarget.switches[j].modo - 22;
            customSIndex[j] = idx;
            int valorOn = 127;
            int ccCustom = presetTarget.switches[j].cc;
            if (idx >= 0 && idx < 6 &&
                presetTarget.extras.custom[idx].valor_on > 0) {
              valorOn = presetTarget.extras.custom[idx].valor_on;
              if (presetTarget.extras.custom[idx].cc > 0)
                ccCustom = presetTarget.extras.custom[idx].cc;
            }
            presetTarget.switches[j].modo = MODE_SINGLE;
            presetTarget.switches[j].start_value = true;
            presetTarget.switches[j].single_value = valorOn;
            presetTarget.switches[j].cc = ccCustom;
          }
          presetTarget.switches[j].cc =
              swJsonObj["cc"].is<int>() ? swJsonObj["cc"].as<int>() : 0;
          presetTarget.switches[j].cc2 =
              swJsonObj["cc2"].is<int>() ? swJsonObj["cc2"].as<int>() : 0;
          {
            int cc2Ch = 1;
            if (!swJsonObj["cc2_ch"].isNull()) {
              cc2Ch = swJsonObj["cc2_ch"].as<int>();
            } else if (!swJsonObj["canal_cc2"].isNull()) {
              cc2Ch = swJsonObj["canal_cc2"].as<int>();
            }
            presetTarget.switches[j].canal_cc2 = cc2Ch;
          }
          presetTarget.switches[j].cc_hold =
              swJsonObj["cc_hold"].is<int>() ? swJsonObj["cc_hold"].as<int>()
                                             : 0; // novo campo

          presetTarget.switches[j].start_value =
              swJsonObj["start_value"].is<bool>()
                  ? swJsonObj["start_value"].as<bool>()
                  : false;
          // NEW: read start_value for CC2 if present in JSON
          presetTarget.switches[j].start_value_cc2 =
              swJsonObj["start_value_cc2"].is<bool>()
                  ? swJsonObj["start_value_cc2"].as<bool>()
                  : false;
          // SINGLE custom value (default 127)
          presetTarget.switches[j].single_value =
              swJsonObj["single_value"].is<int>()
                  ? swJsonObj["single_value"].as<int>()
                  : 127;
          // NEW: SPIN envia PC em vez de CC
          presetTarget.switches[j].spin_send_pc =
              swJsonObj["spin_send_pc"].is<bool>()
                  ? swJsonObj["spin_send_pc"].as<bool>()
                  : false;
          presetTarget.switches[j].canal = clampChannel16(
              swJsonObj["canal"].is<int>() ? swJsonObj["canal"].as<int>() : 1,
              1);
          presetTarget.switches[j].led =
              swJsonObj["led"].is<int>() ? swJsonObj["led"].as<int>() : 0;
          presetTarget.switches[j].autoRamp =
              swJsonObj["autoRamp"].is<bool>()
                  ? swJsonObj["autoRamp"].as<bool>()
                  : false;
          presetTarget.switches[j].led2 =
              swJsonObj["led2"].is<int>() ? swJsonObj["led2"].as<int>() : 0;
          // NEW: read HOLD color index for SPIN HOLD if present in JSON
          presetTarget.switches[j].led_hold =
              swJsonObj["led_hold"].is<int>()
                  ? swJsonObj["led_hold"].as<int>()
                  : presetTarget.switches[j].led_hold;
          // NEW: read 3-char FX label (SIGLA FX)
          if (swJsonObj["sigla_fx"].is<const char *>()) {
            const char *sfx = swJsonObj["sigla_fx"].as<const char *>();
            if (sfx) {
              strncpy(presetTarget.switches[j].sigla_fx, sfx, 3);
              presetTarget.switches[j].sigla_fx[3] = '\0';
            } else {
              presetTarget.switches[j].sigla_fx[0] = '\0';
            }
          } else {
            presetTarget.switches[j].sigla_fx[0] = '\0';
          }
          // NEW: read 3-char FX label 2 (SIGLA FX 2)
          if (swJsonObj["sigla_fx_2"].is<const char *>()) {
            const char *sfx2 = swJsonObj["sigla_fx_2"].as<const char *>();
            if (sfx2) {
              strncpy(presetTarget.switches[j].sigla_fx_2, sfx2, 3);
              presetTarget.switches[j].sigla_fx_2[3] = '\0';
            } else {
              presetTarget.switches[j].sigla_fx_2[0] = '\0';
            }
          } else {
            presetTarget.switches[j].sigla_fx_2[0] = '\0';
          }
          // NEW: read icon FX indices (0=text mode, 1=DRIVE, 2=REVERB, etc.)
          presetTarget.switches[j].icon_fx =
              swJsonObj["icon_fx"].is<int>()
                  ? (uint8_t)swJsonObj["icon_fx"].as<int>()
                  : 21;
          presetTarget.switches[j].icon_fx_2 =
              swJsonObj["icon_fx_2"].is<int>()
                  ? (uint8_t)swJsonObj["icon_fx_2"].as<int>()
                  : 21;

          // NEW: read icon name fields
          if (swJsonObj["icon_name"].is<const char *>()) {
            const char *iname = swJsonObj["icon_name"].as<const char *>();
            if (iname) {
              strncpy(presetTarget.switches[j].icon_name, iname, 8);
              presetTarget.switches[j].icon_name[8] = '\0';
            } else {
              strncpy(presetTarget.switches[j].icon_name, "STOMP", 8);
              presetTarget.switches[j].icon_name[8] = '\0';
            }
          } else {
            strncpy(presetTarget.switches[j].icon_name, "STOMP", 8);
            presetTarget.switches[j].icon_name[8] = '\0';
          }
          if (swJsonObj["icon_name_2"].is<const char *>()) {
            const char *iname2 = swJsonObj["icon_name_2"].as<const char *>();
            if (iname2) {
              strncpy(presetTarget.switches[j].icon_name_2, iname2, 8);
              presetTarget.switches[j].icon_name_2[8] = '\0';
            } else {
              strncpy(presetTarget.switches[j].icon_name_2, "STOMP", 8);
              presetTarget.switches[j].icon_name_2[8] = '\0';
            }
          } else {
            strncpy(presetTarget.switches[j].icon_name_2, "STOMP", 8);
            presetTarget.switches[j].icon_name_2[8] = '\0';
          }
          // icon_name_color removed - now follows icon ON/OFF color
          // NEW: read icon color and fill options
          presetTarget.switches[j].icon_color =
              swJsonObj["icon_color"].is<int>()
                  ? (uint8_t)swJsonObj["icon_color"].as<int>()
                  : 6; // Default to BRANCO (white)
          presetTarget.switches[j].icon_color_off =
              swJsonObj["icon_color_off"].is<int>()
                  ? (uint8_t)swJsonObj["icon_color_off"].as<int>()
                  : 6; // Default to BRANCO (white)
          // border_on_mode removed - always use border_color_on
          presetTarget.switches[j].border_color_on =
              swJsonObj["border_color_on"].is<int>()
                  ? (uint8_t)swJsonObj["border_color_on"].as<int>()
                  : 6; // Default to BRANCO
          presetTarget.switches[j].border_color_off =
              swJsonObj["border_color_off"].is<int>()
                  ? (uint8_t)swJsonObj["border_color_off"].as<int>()
                  : 6; // Default Black/Off -> Branco per user request
          presetTarget.switches[j].back_color_on =
              swJsonObj["back_color_on"].is<int>()
                  ? (uint8_t)swJsonObj["back_color_on"].as<int>()
                  : 9; // Default PRETO
          presetTarget.switches[j].back_color_off =
              swJsonObj["back_color_off"].is<int>()
                  ? (uint8_t)swJsonObj["back_color_off"].as<int>()
                  : 9; // Default PRETO
          presetTarget.switches[j].icon_color_2 =
              swJsonObj["icon_color_2"].is<int>()
                  ? (uint8_t)swJsonObj["icon_color_2"].as<int>()
                  : 6; // Default to BRANCO (white)
          presetTarget.switches[j].icon_color_off_2 =
              swJsonObj["icon_color_off_2"].is<int>()
                  ? (uint8_t)swJsonObj["icon_color_off_2"].as<int>()
                  : 6; // Default to BRANCO (white)
          presetTarget.switches[j].border_color_on_2 =
              swJsonObj["border_color_on_2"].is<int>()
                  ? (uint8_t)swJsonObj["border_color_on_2"].as<int>()
                  : 6; // Default to BRANCO
          presetTarget.switches[j].border_color_off_2 =
              swJsonObj["border_color_off_2"].is<int>()
                  ? (uint8_t)swJsonObj["border_color_off_2"].as<int>()
                  : 6; // Default Black/Off -> Branco per user request
          presetTarget.switches[j].back_color_on_2 =
              swJsonObj["back_color_on_2"].is<int>()
                  ? (uint8_t)swJsonObj["back_color_on_2"].as<int>()
                  : 9; // Default PRETO
          presetTarget.switches[j].back_color_off_2 =
              swJsonObj["back_color_off_2"].is<int>()
                  ? (uint8_t)swJsonObj["back_color_off_2"].as<int>()
                  : 9; // Default PRETO

          // MACROS array
          JsonArrayConst macrosArr = swJsonObj["macros"].as<JsonArrayConst>();
          if (macrosArr) {
            for (int m = 0; m < 4; m++) {
              if (m < macrosArr.size()) {
                JsonObjectConst mObj = macrosArr[m].as<JsonObjectConst>();
                if (mObj) {
                  int macroCc = mObj["cc"].is<int>() ? mObj["cc"].as<int>() : 0;
                  int macroOff =
                      mObj["valueOff"].is<int>()
                          ? mObj["valueOff"].as<int>()
                          : (mObj["off"].is<int>() ? mObj["off"].as<int>() : 0);
                  int macroOn =
                      mObj["valueOn"].is<int>()
                          ? mObj["valueOn"].as<int>()
                          : (mObj["on"].is<int>() ? mObj["on"].as<int>() : 127);
                  int macroCh =
                      mObj["channel"].is<int>()
                          ? mObj["channel"].as<int>()
                          : (mObj["ch"].is<int>() ? mObj["ch"].as<int>() : 1);
                  presetTarget.switches[j].macros[m].cc = clampCc7(macroCc);
                  presetTarget.switches[j].macros[m].valueOff =
                      clampCc7(macroOff);
                  presetTarget.switches[j].macros[m].valueOn =
                      clampCc7(macroOn);
                  presetTarget.switches[j].macros[m].channel =
                      clampChannel16(macroCh, 1);
                }
              } else {
                presetTarget.switches[j].macros[m] = {0, 0, 127, 1};
              }
            }
          } else {
            for (int m = 0; m < 4; m++)
              presetTarget.switches[j].macros[m] = {0, 0, 127, 1};
          }
          presetTarget.switches[j].favoriteAutoLive =
              swJsonObj["favoriteAutoLive"].is<bool>()
                  ? swJsonObj["favoriteAutoLive"].as<bool>()
                  : false;
          // TAP TEMPO extras
          presetTarget.switches[j].tap2_cc =
              swJsonObj["tap2_cc"].is<int>() ? swJsonObj["tap2_cc"].as<int>()
                                             : 0;
          presetTarget.switches[j].tap2_ch =
              swJsonObj["tap2_ch"].is<int>() ? swJsonObj["tap2_ch"].as<int>()
                                             : 0;
          presetTarget.switches[j].tap3_cc =
              swJsonObj["tap3_cc"].is<int>() ? swJsonObj["tap3_cc"].as<int>()
                                             : 0;
          presetTarget.switches[j].tap3_ch =
              swJsonObj["tap3_ch"].is<int>() ? swJsonObj["tap3_ch"].as<int>()
                                             : 0;
          // DUAL STOMP custom values
          presetTarget.switches[j].ds_custom_enabled =
              swJsonObj["ds_custom_enabled"].is<bool>()
                  ? swJsonObj["ds_custom_enabled"].as<bool>()
                  : false;
          presetTarget.switches[j].ds_cc1_off =
              swJsonObj["ds_cc1_off"].is<int>()
                  ? (uint8_t)swJsonObj["ds_cc1_off"].as<int>()
                  : 0;
          presetTarget.switches[j].ds_cc1_on =
              swJsonObj["ds_cc1_on"].is<int>()
                  ? (uint8_t)swJsonObj["ds_cc1_on"].as<int>()
                  : 127;
          presetTarget.switches[j].ds_cc2_off =
              swJsonObj["ds_cc2_off"].is<int>()
                  ? (uint8_t)swJsonObj["ds_cc2_off"].as<int>()
                  : 0;
          presetTarget.switches[j].ds_cc2_on =
              swJsonObj["ds_cc2_on"].is<int>()
                  ? (uint8_t)swJsonObj["ds_cc2_on"].as<int>()
                  : 127;

          // Saneamento final
          presetTarget.switches[j].modo =
              sanitizeModoValue(presetTarget.switches[j].modo);
          presetTarget.switches[j].cc = clampCc7(presetTarget.switches[j].cc);
          presetTarget.switches[j].cc2 = clampCc7(presetTarget.switches[j].cc2);
          presetTarget.switches[j].canal_cc2 =
              clampChannel16(presetTarget.switches[j].canal_cc2, 1);
          presetTarget.switches[j].cc_hold =
              clampCc7(presetTarget.switches[j].cc_hold);
          presetTarget.switches[j].single_value =
              clampCc7(presetTarget.switches[j].single_value);
          presetTarget.switches[j].canal =
              clampChannel16(presetTarget.switches[j].canal, 1);
          presetTarget.switches[j].led =
              clampLedIndex(presetTarget.switches[j].led);
          presetTarget.switches[j].led2 =
              clampLedIndex(presetTarget.switches[j].led2);
          presetTarget.switches[j].led_hold =
              clampLedIndex(presetTarget.switches[j].led_hold);

          presetTarget.switches[j].tap2_cc =
              clampCc7(presetTarget.switches[j].tap2_cc);
          presetTarget.switches[j].tap3_cc =
              clampCc7(presetTarget.switches[j].tap3_cc);
          presetTarget.switches[j].tap2_ch =
              clampTapChannel(presetTarget.switches[j].tap2_ch);
          presetTarget.switches[j].tap3_ch =
              clampTapChannel(presetTarget.switches[j].tap3_ch);
          // MACROS sanitation
          for (int m = 0; m < 4; m++) {
            presetTarget.switches[j].macros[m].cc =
                clampCc7(presetTarget.switches[j].macros[m].cc);
            presetTarget.switches[j].macros[m].valueOff =
                clampCc7(presetTarget.switches[j].macros[m].valueOff);
            presetTarget.switches[j].macros[m].valueOn =
                clampCc7(presetTarget.switches[j].macros[m].valueOn);
            presetTarget.switches[j].macros[m].channel =
                clampChannel16(presetTarget.switches[j].macros[m].channel, 1);
          }
          // DUAL STOMP custom values sanitation
          presetTarget.switches[j].ds_cc1_off =
              clampCc7(presetTarget.switches[j].ds_cc1_off);
          presetTarget.switches[j].ds_cc1_on =
              clampCc7(presetTarget.switches[j].ds_cc1_on);
          presetTarget.switches[j].ds_cc2_off =
              clampCc7(presetTarget.switches[j].ds_cc2_off);
          presetTarget.switches[j].ds_cc2_on =
              clampCc7(presetTarget.switches[j].ds_cc2_on);
        }
      }
    }
  }

  JsonObjectConst extrasJsonObj = presetJsonObj["extras"].as<JsonObjectConst>();
  if (extrasJsonObj) {
    presetTarget.extras.enviar_extras =
        extrasJsonObj["enviar_extras"].is<bool>()
            ? extrasJsonObj["enviar_extras"].as<bool>()
            : false;

    JsonArrayConst spinArray = extrasJsonObj["spin"].as<JsonArrayConst>();
    if (spinArray)
      for (int e = 0; e < 6; e++) {
        if (e < spinArray.size()) {
          JsonObjectConst item = spinArray[e].as<JsonObjectConst>();
          if (item) {
            presetTarget.extras.spin[e].v1 =
                clampCc7(item["v1"].is<int>() ? item["v1"].as<int>() : 0);
            presetTarget.extras.spin[e].v2 =
                clampCc7(item["v2"].is<int>() ? item["v2"].as<int>() : 64);
            presetTarget.extras.spin[e].v3 =
                clampCc7(item["v3"].is<int>() ? item["v3"].as<int>() : 127);
          }
        } else {
          presetTarget.extras.spin[e] = {0, 64, 127};
        }
      }

    JsonArrayConst controlArray = extrasJsonObj["control"].as<JsonArrayConst>();
    if (controlArray)
      for (int e = 0; e < 6; e++) {
        if (e < controlArray.size()) {
          JsonObjectConst item = controlArray[e].as<JsonObjectConst>();
          if (item) {
            presetTarget.extras.control[e].cc =
                clampCc7(item["cc"].is<int>() ? item["cc"].as<int>() : 0);
            presetTarget.extras.control[e].modo_invertido =
                item["modo_invertido"].is<bool>()
                    ? item["modo_invertido"].as<bool>()
                    : false;
          }
        } else {
          presetTarget.extras.control[e] = {0, false};
        }
      }

    JsonArrayConst customArray = extrasJsonObj["custom"].as<JsonArrayConst>();
    if (customArray)
      for (int e = 0; e < 6; e++) {
        if (e < customArray.size()) {
          JsonObjectConst item = customArray[e].as<JsonObjectConst>();
          if (item) {
            presetTarget.extras.custom[e].cc = clampCc7(
                item["cc"].is<int>() ? item["cc"].as<int>() : (48 + e));
            presetTarget.extras.custom[e].canal = clampChannel16(
                item["canal"].is<int>() ? item["canal"].as<int>() : 1, 1);
            presetTarget.extras.custom[e].valor_off = clampCc7(
                item["valor_off"].is<int>() ? item["valor_off"].as<int>() : 0);
            presetTarget.extras.custom[e].valor_on = clampCc7(
                item["valor_on"].is<int>() ? item["valor_on"].as<int>() : 127);
          }
        } else {
          presetTarget.extras.custom[e] = {(uint8_t)(48 + e), 0, 127, 1};
        }
      }
    // Após carregar extras, aplica valor_on para modos CUSTOM(S) convertidos em
    // SINGLE
    for (int sw = 0; sw < TOTAL_BUTTONS; ++sw) {
      int idx = customSIndex[sw];
      if (idx >= 0 && idx < 6 &&
          presetTarget.switches[sw].modo == MODE_SINGLE) {
        int valOn = presetTarget.extras.custom[idx].valor_on;
        if (valOn < 0 || valOn > 127)
          valOn = 127;
        presetTarget.switches[sw].single_value = valOn;
        if (presetTarget.extras.custom[idx].cc > 0) {
          presetTarget.switches[sw].cc = presetTarget.extras.custom[idx].cc;
        }
        presetTarget.switches[sw].start_value = true;
      }
    }
    // SW COMBO removido: ignorar dados legados em extras.combo (se existirem).

    JsonArrayConst pcArray = extrasJsonObj["pc"].as<JsonArrayConst>();
    if (pcArray)
      for (int e = 0; e < 4; e++) {
        if (e < pcArray.size()) {
          JsonObjectConst item = pcArray[e].as<JsonObjectConst>();
          if (item) {
            presetTarget.extras.pc[e].valor =
                clampCc7(item["valor"].is<int>() ? item["valor"].as<int>() : 0);
            presetTarget.extras.pc[e].canal = clampChannel16(
                item["canal"].is<int>() ? item["canal"].as<int>() : 1, 1);
          }
        } else {
          presetTarget.extras.pc[e] = {0, 1};
        }
      }

    // CC extras (CC1 e CC2)
    JsonArrayConst ccArray = extrasJsonObj["cc"].as<JsonArrayConst>();
    if (ccArray) {
      for (int e = 0; e < 2; e++) {
        if (e < ccArray.size()) {
          JsonObjectConst item = ccArray[e].as<JsonObjectConst>();
          if (item) {
            presetTarget.extras.cc[e].cc =
                clampCc7(item["cc"].is<int>() ? item["cc"].as<int>() : 0);
            presetTarget.extras.cc[e].valor =
                clampCc7(item["valor"].is<int>() ? item["valor"].as<int>() : 0);
            presetTarget.extras.cc[e].canal = clampChannel16(
                item["canal"].is<int>() ? item["canal"].as<int>() : 1, 1);
          }
        } else {
          presetTarget.extras.cc[e] = {0, 0, 1};
        }
      }
    } else {
      for (int e = 0; e < 2; e++)
        presetTarget.extras.cc[e] = {0, 0, 1};
    }
  } else {
    Serial.println("  AVISO: Objeto 'extras' nao encontrado. Mantendo valores "
                   "padrao inicializados.");
  }
  return true;
}

static void migrateBackupDocument(JsonDocument &doc,
                                  const char *backupVersion) {
  Serial.println("[MIGRATION] Iniciando migra do backup (se necess).");
  Serial.printf("[MIGRATION] Vers do backup: %s | Vers atual: %s\n",
                backupVersion ? backupVersion : "UNKNOWN", FIRMWARE_VERSION);

  // Funcao helper para obter cor padrao em RGB (VERMELHO, VERDE, AZUL, AMARELO, ROXO, CYAN)
  const Cores coresPadraoArray[NUM_LED_COLORS] = {VERMELHO, VERDE, AZUL, AMARELO, ROXO, CYAN};
  auto getCorPadraoRGBHelper = [&](int idx) -> uint32_t {
    Cores c = coresPadraoArray[idx];
    return ((uint32_t)PERFIS_CORES[c][0] << 16) |
           ((uint32_t)PERFIS_CORES[c][1] << 8) |
           (uint32_t)PERFIS_CORES[c][2];
  };

  // ====================================================================
  // MIGRACAO DE INDICES DE CORES (V9.x / V10.0 -> V10 r6+)
  // ====================================================================
  // Antes de V10 r6, o enum Cores tinha 10 valores:
  //   0=VERMELHO, 1=VERDE, 2=AZUL, 3=AMARELO, 4=ROXO, 5=CYAN,
  //   6=BRANCO, 7=LARANJA, 8=MAGENTA, 9=PRETO
  // A partir de V10 r6, foram adicionadas novas cores entre MAGENTA e PRETO:
  //   9=CORAL, 10=AZUL_CELESTE, 11=VIOLETA, 12=ROSA, 13=MENTA, 14=PRETO
  // Backups antigos com led=9 (PRETO) devem ser migrados para led=14
  // ====================================================================
  bool needsColorIndexMigration = false;
  if (backupVersion) {
    // Detecta versoes antigas que precisam de migracao
    // V9.x, V10.0, V10 r1 ate V10 r5 precisam de migracao
    String ver(backupVersion);
    ver.toLowerCase();
    if (ver.indexOf("v9") >= 0 || ver.indexOf("-v9") >= 0) {
      needsColorIndexMigration = true;
    } else if (ver.indexOf("v10") >= 0) {
      // Verifica se e V10 sem revisao ou revisao < 6
      int rPos = ver.indexOf(" r");
      if (rPos < 0) {
        // "v10" sem revisao - precisa migracao
        needsColorIndexMigration = true;
      } else {
        // Extrai numero da revisao
        int revNum = ver.substring(rPos + 2).toInt();
        if (revNum < 6) {
          needsColorIndexMigration = true;
        }
      }
    }
  } else {
    // Versao desconhecida - assume que precisa migracao por seguranca
    needsColorIndexMigration = true;
  }

  // Funcao para migrar indice de cor (9 antigo PRETO -> 14 novo PRETO)
  auto migrateColorIndex = [&](int oldIdx) -> int {
    if (!needsColorIndexMigration) return oldIdx;
    if (oldIdx == 9) return 14; // PRETO antigo -> PRETO novo
    return oldIdx; // Outros indices permanecem iguais
  };

  if (needsColorIndexMigration) {
    Serial.println("[MIGRATION] Backup requer migracao de indices de cores (PRETO: 9->14)");
  }

  if (!doc["global_config"].is<JsonObject>()) {
    Serial.println("[MIGRATION] global_config ausente  criando com valores m.");
    JsonObject globalObj = doc["global_config"].to<JsonObject>();
    globalObj["board_name"] = "PCB_A1";
    globalObj["ledBrilho"] = 5;
    globalObj["ledPreview"] = true;
    globalObj["modoMidiIndex"] = 0;
    globalObj["mostrarTelaFX"] = true;
    globalObj["mostrarFxModo"] = 1;   // SIGLAS
    globalObj["mostrarFxQuando"] = 0; // SEMPRE
    globalObj["rampaValor"] = 1000;
    JsonArray coresArr = globalObj["coresPresetConfig"].to<JsonArray>();
    for (int i = 0; i < NUM_LED_COLORS; ++i)
      coresArr.add(getCorPadraoRGBHelper(i));
    globalObj["corLiveModeConfig"] = 0xFFFFFF;
    globalObj["corLiveMode2Config"] = 0xFFFFFF;
    JsonArray levels = globalObj["presetLevels"].to<JsonArray>();
    for (int i = 0; i < PRESET_LEVELS; ++i)
      levels.add(true);
    globalObj["lockSetup"] = false;
    globalObj["lockGlobal"] = false;
    globalObj["selectModeIndex"] = 0;
  } else {
    // Preencher campos faltantes de global_config com defaults
    JsonObject globalObj = doc["global_config"].as<JsonObject>();
    if (globalObj["board_name"].isNull())
      globalObj["board_name"] = "PCB_A1";
    if (globalObj["ledBrilho"].isNull())
      globalObj["ledBrilho"] = 5;
    if (globalObj["ledPreview"].isNull())
      globalObj["ledPreview"] = true;
    if (globalObj["modoMidiIndex"].isNull())
      globalObj["modoMidiIndex"] = 0;
    if (globalObj["mostrarTelaFX"].isNull())
      globalObj["mostrarTelaFX"] = true;
    // FX DISPLAY: 0=SEMPRE, 1=LIVE MODE, 2=NUNCA
    if (globalObj["mostrarFxModo"].isNull())
      globalObj["mostrarFxModo"] = 1; // SIGLAS
    if (globalObj["mostrarFxQuando"].isNull())
      globalObj["mostrarFxQuando"] = 0; // SEMPRE
    if (globalObj["rampaValor"].isNull())
      globalObj["rampaValor"] = 1000;

    if (globalObj["coresPresetConfig"].isNull()) {
      JsonArray coresArr = globalObj["coresPresetConfig"].to<JsonArray>();
      for (int i = 0; i < NUM_LED_COLORS; ++i)
        coresArr.add(getCorPadraoRGBHelper(i));
    } else {
      JsonArray coresArr = globalObj["coresPresetConfig"].as<JsonArray>();
      while ((int)coresArr.size() < NUM_LED_COLORS)
        coresArr.add(getCorPadraoRGBHelper(coresArr.size()));
    }
    if (globalObj["corLiveModeConfig"].isNull())
      globalObj["corLiveModeConfig"] = 0xFFFFFF;
    if (globalObj["corLiveMode2Config"].isNull())
      globalObj["corLiveMode2Config"] = 0xFFFFFF;
    if (globalObj["presetLevels"].isNull()) {
      JsonArray levels = globalObj["presetLevels"].to<JsonArray>();
      for (int i = 0; i < PRESET_LEVELS; ++i)
        levels.add(true);
    } else {
      JsonArray levels = globalObj["presetLevels"].as<JsonArray>();
      while ((int)levels.size() < PRESET_LEVELS)
        levels.add(true);
    }
    if (globalObj["lockSetup"].isNull())
      globalObj["lockSetup"] = false;
    if (globalObj["lockGlobal"].isNull())
      globalObj["lockGlobal"] = false;
    if (globalObj["selectModeIndex"].isNull())
      globalObj["selectModeIndex"] = 0;
  }

  // 2) Migrar/normalizar a estrutura de cada preset no array "presets"
  if (doc["presets"].is<JsonArray>()) {
    JsonArray presetsArr = doc["presets"].as<JsonArray>();
    Serial.printf("[MIGRATION] Presets no backup: %d\n", presetsArr.size());
    for (JsonVariant presetVar : presetsArr) {
      if (!presetVar.is<JsonObject>())
        continue;
      JsonObject presetObj = presetVar.as<JsonObject>();

      // nome e cor do nome
      if (presetObj["nomePreset"].isNull())
        presetObj["nomePreset"] = "";
      if (presetObj["nomePresetTextColor"].isNull())
        presetObj["nomePresetTextColor"] = 0xFFFFFF;

      if (presetObj["switches"].isNull()) {
        JsonArray swArr = presetObj["switches"].to<JsonArray>();
        for (int s = 0; s < TOTAL_BUTTONS; ++s) {
          JsonObject sw = swArr.add<JsonObject>();
          sw["modo"] = 0;
          sw["cc"] = 0;
          sw["cc2"] = 0;
          sw["cc_hold"] = 0;
          sw["start_value"] = false;
          sw["canal"] = 1;
          sw["led"] = 0;
        }
      } else {
        JsonArray swArr = presetObj["switches"].as<JsonArray>();
        while ((int)swArr.size() < TOTAL_BUTTONS) {
          JsonObject sw = swArr.add<JsonObject>();
          sw["modo"] = 0;
          sw["cc"] = 0;
          sw["cc2"] = 0;
          sw["cc_hold"] = 0;
          sw["start_value"] = false;
          sw["canal"] = 1;
          sw["led"] = 0;
        }
        for (JsonVariant swVar : swArr) {
          if (!swVar.is<JsonObject>())
            continue;
          JsonObject swObj = swVar.as<JsonObject>();
          if (swObj["cc_hold"].isNull())
            swObj["cc_hold"] = 0;
          if (swObj["cc2"].isNull())
            swObj["cc2"] = 0;
          if (swObj["start_value"].isNull())
            swObj["start_value"] = false;
          if (swObj["canal"].isNull())
            swObj["canal"] = 1;
          if (swObj["led"].isNull())
            swObj["led"] = 0;

          // Migracao de indices de cores (PRETO: 9->14)
          if (needsColorIndexMigration) {
            if (!swObj["led"].isNull()) {
              swObj["led"] = migrateColorIndex(swObj["led"].as<int>());
            }
            if (!swObj["led2"].isNull()) {
              swObj["led2"] = migrateColorIndex(swObj["led2"].as<int>());
            }
            if (!swObj["led_hold"].isNull()) {
              swObj["led_hold"] = migrateColorIndex(swObj["led_hold"].as<int>());
            }
            if (!swObj["icon_name_color"].isNull()) {
              swObj["icon_name_color"] = migrateColorIndex(swObj["icon_name_color"].as<int>());
            }
            if (!swObj["icon_color"].isNull()) {
              swObj["icon_color"] = migrateColorIndex(swObj["icon_color"].as<int>());
            }
          }
        }
      }

      if (presetObj["extras"].isNull()) {
        JsonObject extras = presetObj["extras"].to<JsonObject>();
        JsonArray spinArr = extras["spin"].to<JsonArray>();
        for (int i = 0; i < 6; ++i) {
          JsonObject it = spinArr.add<JsonObject>();
          it["v1"] = 0;
          it["v2"] = 64;
          it["v3"] = 127;
        }
        JsonArray ctrlArr = extras["control"].to<JsonArray>();
        for (int i = 0; i < 6; ++i) {
          JsonObject it = ctrlArr.add<JsonObject>();
          it["cc"] = 0;
          it["modo_invertido"] = false;
        }
        JsonArray customArr = extras["custom"].to<JsonArray>();
        for (int i = 0; i < 6; ++i) {
          JsonObject it = customArr.add<JsonObject>();
          it["valor_off"] = 0;
          it["valor_on"] = 127;
        }
        JsonArray pcArr = extras["pc"].to<JsonArray>();
        for (int i = 0; i < 4; ++i) {
          JsonObject it = pcArr.add<JsonObject>();
          it["valor"] = 0;
          it["canal"] = 1;
        }
        JsonArray ccArr = extras["cc"].to<JsonArray>();
        for (int i = 0; i < 2; ++i) {
          JsonObject it = ccArr.add<JsonObject>();
          it["cc"] = 0;
          it["valor"] = 0;
          it["canal"] = 1;
        }
        extras["enviar_extras"] = false;
      } else {
        JsonObject extras = presetObj["extras"].as<JsonObject>();
        if (extras["spin"].isNull()) {
          JsonArray spinArr = extras["spin"].to<JsonArray>();
          for (int i = 0; i < 6; ++i) {
            JsonObject it = spinArr.add<JsonObject>();
            it["v1"] = 0;
            it["v2"] = 64;
            it["v3"] = 127;
          }
        } else {
          JsonArray spinArr = extras["spin"].as<JsonArray>();
          while ((int)spinArr.size() < 6) {
            JsonObject it = spinArr.add<JsonObject>();
            it["v1"] = 0;
            it["v2"] = 64;
            it["v3"] = 127;
          }
        }
        if (extras["control"].isNull()) {
          JsonArray ctrlArr = extras["control"].to<JsonArray>();
          for (int i = 0; i < 6; ++i) {
            JsonObject it = ctrlArr.add<JsonObject>();
            it["cc"] = 0;
            it["modo_invertido"] = false;
          }
        } else {
          JsonArray ctrlArr = extras["control"].as<JsonArray>();
          while ((int)ctrlArr.size() < 6) {
            JsonObject it = ctrlArr.add<JsonObject>();
            it["cc"] = 0;
            it["modo_invertido"] = false;
          }
        }
        if (extras["custom"].isNull()) {
          JsonArray customArr = extras["custom"].to<JsonArray>();
          for (int i = 0; i < 6; ++i) {
            JsonObject it = customArr.add<JsonObject>();
            it["valor_off"] = 0;
            it["valor_on"] = 127;
          }
        } else {
          JsonArray customArr = extras["custom"].as<JsonArray>();
          while ((int)customArr.size() < 6) {
            JsonObject it = customArr.add<JsonObject>();
            it["valor_off"] = 0;
            it["valor_on"] = 127;
          }
        }
        if (extras["pc"].isNull()) {
          JsonArray pcArr = extras["pc"].to<JsonArray>();
          for (int i = 0; i < 4; ++i) {
            JsonObject it = pcArr.add<JsonObject>();
            it["valor"] = 0;
            it["canal"] = 1;
          }
        } else {
          JsonArray pcArr = extras["pc"].as<JsonArray>();
          while ((int)pcArr.size() < 4) {
            JsonObject it = pcArr.add<JsonObject>();
            it["valor"] = 0;
            it["canal"] = 1;
          }
        }
        if (extras["cc"].isNull()) {
          JsonArray ccArr = extras["cc"].to<JsonArray>();
          for (int i = 0; i < 2; ++i) {
            JsonObject it = ccArr.add<JsonObject>();
            it["cc"] = 0;
            it["valor"] = 0;
            it["canal"] = 1;
          }
        } else {
          JsonArray ccArr = extras["cc"].as<JsonArray>();
          while ((int)ccArr.size() < 2) {
            JsonObject it = ccArr.add<JsonObject>();
            it["cc"] = 0;
            it["valor"] = 0;
            it["canal"] = 1;
          }
          for (int i = 0; i < 2; ++i) {
            JsonObject ccObj = ccArr[i].as<JsonObject>();
            if (ccObj["canal"].isNull())
              ccObj["canal"] = 1;
            if (ccObj["valor"].isNull()) {
              if (!presetObj["cc_valores"].isNull()) {
                JsonArray vals = presetObj["cc_valores"].as<JsonArray>();
                if (vals && i < (int)vals.size())
                  ccObj["valor"] = vals[i].as<int>();
              } else {
                ccObj["valor"] = 0;
              }
            }
            if (ccObj["cc"].isNull())
              ccObj["cc"] = 0;
          }
        }
        if (extras["enviar_extras"].isNull())
          extras["enviar_extras"] = false;
      }
    }
  } else {
    Serial.println("[MIGRATION] Aviso: documento de backup n cont '.");
  }
  Serial.println("[MIGRATION] Migra do backup conclu (preenchidos campos "
                 "faltantes e normalizados).");
}
