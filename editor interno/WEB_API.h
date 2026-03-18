#pragma once

#include "COMMON_DEFS.h"
#include "MEMORY.h" // For PresetData
#include <Arduino.h>
#include <nvs.h>
#include <nvs_flash.h>

// Read extra ramp config from NVS for a given preset/switch
static void readRampExtrasFromNVS(int btn, int lvl, int sw, int &upMs,
                                  int &dnMs, bool &inv, bool &autoStop,
                                  int baseMs) {
  upMs = baseMs;
  dnMs = baseMs;
  inv = false;
  autoStop = true;
  nvs_handle_t h;
  if (nvs_open_from_partition("nvs2", "presets", NVS_READONLY, &h) == ESP_OK) {
    char key[32];
    int32_t i32 = 0;
    uint8_t u8 = 0;
    sprintf(key, "p%d%d_rtup_sw%d", btn, lvl, sw);
    if (nvs_get_i32(h, key, &i32) == ESP_OK && i32 > 0)
      upMs = i32;
    sprintf(key, "p%d%d_rtdn_sw%d", btn, lvl, sw);
    if (nvs_get_i32(h, key, &i32) == ESP_OK && i32 > 0)
      dnMs = i32;
    sprintf(key, "p%d%d_rinv_sw%d", btn, lvl, sw);
    if (nvs_get_u8(h, key, &u8) == ESP_OK)
      inv = (u8 != 0);
    sprintf(key, "p%d%d_rastop_sw%d", btn, lvl, sw);
    if (nvs_get_u8(h, key, &u8) == ESP_OK)
      autoStop = (u8 != 0);
    nvs_close(h);
  }
}

// Inicializa um PresetData com valores seguros
static inline void initPresetDefaults(PresetData &preset) {
  memset(&preset, 0, sizeof(PresetData));
  // Garante que todas as strings estejam null-terminated (memset ja zerou)
  preset.nomePreset[0] = '\0';
  preset.nomePreset[MAX_PRESET_NAME_LENGTH] = '\0';
  preset.nomePresetTextColor = 0xFFFFFF;
  preset.bank = 1;
  preset.canal = 1;
  for (int i = 0; i < TOTAL_BUTTONS; ++i) {
    preset.rampTimes[i] = 1000;
    SwitchData &sw = preset.switches[i];
    sw.modo = MODE_STOMP;
    sw.cc = 1 + i;
    sw.cc2 = 0;
    sw.canal_cc2 = 1;
    sw.cc_hold = 0;
    sw.start_value = false;
    sw.start_value_cc2 = false;
    sw.single_value = 127;
    sw.spin_send_pc = false;
    sw.canal = 1;
    sw.led = 2 + i;

    sw.autoRamp = false;
    sw.led2 = 0;
    sw.led_hold = 6;
    sw.favoriteAutoLive = false;
    sw.tap2_cc = 0;
    sw.tap2_ch = 0;
    sw.tap3_cc = 0;
    sw.tap3_ch = 0;
    // Garante strings null-terminated para sigla_fx
    sw.sigla_fx[0] = '\0';
    sw.sigla_fx[3] = '\0';
    sw.sigla_fx_2[0] = '\0';
    sw.sigla_fx_2[3] = '\0';
    sw.icon_fx = 21;
    sw.icon_fx_2 = 21;
    strncpy(sw.icon_name, "STOMP", 8);
    sw.icon_name[8] = '\0';
    strncpy(sw.icon_name_2, "STOMP", 8);
    sw.icon_name_2[8] = '\0';
    sw.icon_color = 6;     // BRANCO (white) - default icon color
    sw.icon_color_off = 6; // BRANCO
    sw.border_color_on = 6;
    sw.border_color_off = 6; // BRANCO
    sw.back_color_on = CORAL;    // CORAL (9)
    sw.back_color_off = CORAL;   // CORAL (9)
    sw.icon_color_2 = 6;         // BRANCO
    sw.icon_color_off_2 = 6;     // BRANCO
    sw.border_color_on_2 = 6;
    sw.border_color_off_2 = 6;   // BRANCO
    sw.back_color_on_2 = CORAL;  // CORAL (9)
    sw.back_color_off_2 = CORAL; // CORAL (9)
    for (int m = 0; m < 4; m++) {
      sw.macros[m] = {0, 0, 127, 1};
    }
  }
  preset.extras.enviar_extras = false;
  for (int i = 0; i < 6; ++i) {
    preset.extras.spin[i] = {0, 64, 127};
    preset.extras.control[i] = {0, false};
    preset.extras.custom[i] = {(uint8_t)(48 + i), 0, 127, 1};
  }
  for (int i = 0; i < 4; ++i)
    preset.extras.pc[i] = {0, 1};
  for (int i = 0; i < 2; ++i)
    preset.extras.cc[i] = {0, 0, 1};
}
