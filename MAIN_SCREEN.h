#ifndef MAIN_SCREEN_H
#define MAIN_SCREEN_H

#include "BACKS.h"
#include "COMMON_DEFS.h"
#include "GLOBAL_CONFIG.h"
#include "ICONS_8BIT.h"
#include "LABELS.h"
#include <Adafruit_NeoPixel.h>
#include <Arduino.h>
#include <TFT_eSPI.h>

// =================================================================================
// GLOBALS NEEDED BY MAIN_SCREEN
// =================================================================================
extern TFT_eSPI tft;
extern TFT_eSprite spr;
extern Adafruit_NeoPixel strip;

// Configurações e Estados Globais
extern GlobalSwitchConfig swGlobalConfig; // Se usada
extern PinoutConfig activePins;
extern PresetData (*presets)[PRESET_LEVELS];

extern int currentButton;
extern int currentLetter;
extern bool isLiveMode;
extern bool liveModeInitialized;
extern String modoMidi;

extern int ledBrilho;
extern bool ledPreview;
extern bool backgroundEnabled;
extern uint32_t backgroundColorConfig;
extern uint8_t mostrarFxModo;   // 0=OFF, 1=SIGLAS, 2=ICONES
extern uint8_t mostrarFxQuando; // 0=SEMPRE, 1=LIVE MODE

extern uint32_t corLiveModeConfig;
extern uint32_t corLiveMode2Config;

// Arrays de estado de Stomps (tamanhos definidos em COMMON_DEFS ou hardcoded)
extern bool stompState[];
extern bool dualShortState[];
extern bool dualLongState[];

// Arrays para animação de split block
extern unsigned long lastStateChangeTime[];
extern int lastChangedSubSwitch[];

// Arrays para exibição de porcentagem SPIN
extern unsigned long lastSpinPressTime[];
extern int lastSpinValue[];
extern int spinState[];

// Background image extern (if not directly included via header var)
extern const unsigned short back[];

// Nomes de presets padrão e cores

extern uint32_t coresPresetConfig[NUM_LED_COLORS];
extern bool ledModeNumeros;

// Fontes
// Certifique-se que estas fontes estão definidas ou inclusas. Normalmente,
// FreeFonts são inclusas via TFT_eSPI ou header auxiliar. Se estiverem em um
// header como "Free_Fonts.h", ele deve ser incluído aqui ou no COMMON_DEFS.

// =================================================================================
// FUNÇÕES AUXILIARES
// =================================================================================

// alpha blend: 0..255 (0 = bg, 255 = fg)
static inline uint16_t blend565(uint16_t bg, uint16_t fg, uint8_t alpha) {
  if (alpha == 0) return bg;
  if (alpha == 255) return fg;
  uint8_t inv = 255 - alpha;
  uint16_t r = (((fg >> 11) & 0x1F) * alpha + ((bg >> 11) & 0x1F) * inv) / 255;
  uint16_t g = (((fg >> 5) & 0x3F) * alpha + ((bg >> 5) & 0x3F) * inv) / 255;
  uint16_t b = ((fg & 0x1F) * alpha + (bg & 0x1F) * inv) / 255;
  return (r << 11) | (g << 5) | b;
}

// Desenha um ícone FX centralizado dentro de um bloco (formato 8-bit alpha)
// iconIdx: 0=nenhum(texto), 1..ICONS_COUNT
// iconColorIdx: color index for icon pixels (PERFIS_CORES)
// fillColor: background color for alpha blending
void drawFxIcon(int x, int y, int w, int h, uint8_t iconIdx,
                uint8_t iconColorIdx, uint16_t fillColor,
                bool hasLabel = true) {
  if (iconIdx == 0 || iconIdx > ICONS_COUNT)
    return;

  const IconBitmap &ico = ICONS[iconIdx - 1];
  const uint8_t *iconData = ico.data;
  if (!iconData)
    return;

  const int iconW = ico.width;
  const int iconH = ico.height;

  // Calcula a cor do ícone a partir do índice de cor
  if (iconColorIdx >= N_CORES)
    iconColorIdx = 6; // BRANCO default
  const uint8_t *iconRgb = PERFIS_CORES[iconColorIdx];
  uint16_t iconColor16 = tft.color565(iconRgb[0], iconRgb[1], iconRgb[2]);

  const int rowStride = iconW; // 8-bit alpha: 1 byte por pixel

  if (hasLabel) {
    // Com label: tamanho original, sobe 10px pra dar espaço ao texto
    int iconX = x + (w - iconW) / 2;
    int iconY = y + (h - iconH) / 2 - 10;
    if (iconX < x) iconX = x;
    if (iconY < y) iconY = y;

    for (int py = 0; py < iconH; ++py) {
      for (int px = 0; px < iconW; ++px) {
        uint8_t srcAlpha = pgm_read_byte(&iconData[py * rowStride + px]);
        if (srcAlpha == 0) continue;
        if (srcAlpha >= 255) {
          spr.drawPixel(iconX + px, iconY + py, iconColor16);
        } else {
          uint16_t bg = spr.readPixel(iconX + px, iconY + py);
          spr.drawPixel(iconX + px, iconY + py, blend565(bg, iconColor16, srcAlpha));
        }
      }
    }
  } else {
    // Sem label: upscale bilinear pra preencher o bloco
    const int margin = 8;
    int availW = w - margin * 2;
    int availH = h - margin * 2;
    float scaleX = (float)availW / iconW;
    float scaleY = (float)availH / iconH;
    float scale = (scaleX < scaleY) ? scaleX : scaleY;
    if (scale < 1.0f) scale = 1.0f;
    int drawW = (int)(iconW * scale);
    int drawH = (int)(iconH * scale);
    int iconX = x + (w - drawW) / 2;
    int iconY = y + (h - drawH) / 2;

    for (int oy = 0; oy < drawH; ++oy) {
      float srcYf = ((oy + 0.5f) * iconH) / drawH - 0.5f;
      int y0 = (int)srcYf;
      int y1 = y0 + 1;
      float fy = srcYf - y0;
      if (y0 < 0) { y0 = 0; fy = 0; }
      if (y1 >= iconH) y1 = iconH - 1;

      for (int ox = 0; ox < drawW; ++ox) {
        float srcXf = ((ox + 0.5f) * iconW) / drawW - 0.5f;
        int x0 = (int)srcXf;
        int x1 = x0 + 1;
        float fx = srcXf - x0;
        if (x0 < 0) { x0 = 0; fx = 0; }
        if (x1 >= iconW) x1 = iconW - 1;

        // Bilinear interpolation dos 4 vizinhos
        uint8_t a00 = pgm_read_byte(&iconData[y0 * rowStride + x0]);
        uint8_t a10 = pgm_read_byte(&iconData[y0 * rowStride + x1]);
        uint8_t a01 = pgm_read_byte(&iconData[y1 * rowStride + x0]);
        uint8_t a11 = pgm_read_byte(&iconData[y1 * rowStride + x1]);
        float inv_fx = 1.0f - fx, inv_fy = 1.0f - fy;
        uint8_t srcAlpha = (uint8_t)(a00 * inv_fx * inv_fy + a10 * fx * inv_fy +
                                     a01 * inv_fx * fy + a11 * fx * fy + 0.5f);
        if (srcAlpha == 0) continue;

        int dx = iconX + ox;
        int dy = iconY + oy;
        if (dx >= x && dx < x + w && dy >= y && dy < y + h) {
          if (srcAlpha >= 255) {
            spr.drawPixel(dx, dy, iconColor16);
          } else {
            uint16_t bg = spr.readPixel(dx, dy);
            spr.drawPixel(dx, dy, blend565(bg, iconColor16, srcAlpha));
          }
        }
      }
    }
  }
}

// Desenha um ícone FX com nome opcional na parte inferior
// Icon name color follows iconColorIdx (icon ON/OFF color)
void drawFxIconWithName(int x, int y, int w, int h, uint8_t iconIdx,
                        const char *iconName, uint8_t iconColorIdx,
                        uint16_t fillColor) {
  bool hasLabel = (iconName && iconName[0] != '\0');
  drawFxIcon(x, y, w, h, iconIdx, iconColorIdx, fillColor, hasLabel);

  // Desenha o nome do ícone na parte inferior do bloco (em maiúsculas)
  if (iconName && iconName[0] != '\0') {
    // Converte para maiúsculas
    char upperName[9];
    int i = 0;
    while (iconName[i] != '\0' && i < 8) {
      upperName[i] = toupper(iconName[i]);
      i++;
    }
    upperName[i] = '\0';

    spr.setFreeFont(&FF17);     // Fonte pequena
    spr.setTextDatum(BC_DATUM); // Bottom center
    // Icon name uses icon color (ON/OFF)
    uint16_t textCol16 = TFT_WHITE;
    if (iconColorIdx < N_CORES) {
      const uint8_t *c = PERFIS_CORES[iconColorIdx];
      textCol16 = ((c[0] & 0xF8) << 8) | ((c[1] & 0xFC) << 3) | (c[2] >> 3);
    }
    spr.setTextColor(textCol16);
    int nameY = y + h - 4; // 4px acima da borda inferior
    spr.drawString(upperName, x + w / 2, nameY);
  }
}

void desenharTracoTitulo() {
  const int SCREEN_W = 320;
  const int MENU_TITLE_Y = 25;
  int y = MENU_TITLE_Y + 20;
  int width = 250;
  int espessuraLinha = 3;
  for (int i = 0; i < espessuraLinha; i++) {
    spr.drawLine(SCREEN_W / 2 - width / 2, y + i, SCREEN_W / 2 + width / 2,
                 y + i, TFT_WHITE);
  }
}

String getBankLabel(int bankValue) { // bankValue e 0-indexado (0-299)
  int bankIndex = bankValue;         // Usa bankValue diretamente

  if (modoMidi == "AMPERO AS2") {
    const int numLabels = sizeof(bank_AS2_Names) / sizeof(char *);
    if (bankIndex >= 0 && bankIndex < numLabels) {
      return String(bank_AS2_Names[bankIndex]);
    }
  } else if (modoMidi == "HX STOMP") {
    const int numLabels = sizeof(bank_HX_STOMP_Names) / sizeof(char *);
    if (bankIndex >= 0 && bankIndex < numLabels) {
      return String(bank_HX_STOMP_Names[bankIndex]);
    }
  } else if (modoMidi == "AMPERO MINI") {
    const int numLabels = sizeof(bank_AMPERO_MINI_Names) / sizeof(char *);
    if (bankIndex >= 0 && bankIndex < numLabels) {
      return String(bank_AMPERO_MINI_Names[bankIndex]);
    }
  } else if (modoMidi == "A. STAGE 2") {
    const int numLabels = sizeof(bank_ASTG2_Names) / sizeof(char *);
    if (bankIndex >= 0 && bankIndex < numLabels) {
      return String(bank_ASTG2_Names[bankIndex]);
    }
  } else if (modoMidi == "GP-200LT") {
    const int numLabels = sizeof(bank_GP200LT_Names) / sizeof(char *);
    if (bankIndex >= 0 && bankIndex < numLabels) {
      return String(bank_GP200LT_Names[bankIndex]);
    }
  } else if (modoMidi == "KEMPER PLAYER") {
    const int numLabels = sizeof(bank_KEMPER_PLAYER_Names) / sizeof(char *);
    if (bankIndex >= 0 && bankIndex < numLabels) {
      return String(bank_KEMPER_PLAYER_Names[bankIndex]);
    }
  } else if (modoMidi == "POCKET MASTER") {
    const int numLabels = sizeof(bank_POCKET_MASTER_Names) / sizeof(char *);
    if (bankIndex >= 0 && bankIndex < numLabels) {
      return String(bank_POCKET_MASTER_Names[bankIndex]);
    }
  } else if (modoMidi == "VALETON GP5") {
    const int numLabels = sizeof(bank_VALETON_GP5_Names) / sizeof(char *);
    if (bankIndex >= 0 && bankIndex < numLabels) {
      return String(bank_VALETON_GP5_Names[bankIndex]);
    }
  }
  return String(bankValue);
}

String getCCLabel(int ccValue) {
  if (modoMidi == "AMPERO AS2" ||
      modoMidi == "A. STAGE 2") { // A. STAGE 2 usa os mesmos labels de CC que
                                  // AMPERO AS2
    const char *label = getCC_AMPEROST2_Name(ccValue);
    if (strcmp(label, "?") == 0) {
      return String(ccValue);
    }
    return String(label);
  } else if (modoMidi == "AMPERO MINI") {
    const char *label = getCC_AMPERO_MINI_Names(ccValue);
    if (strcmp(label, "?") == 0) {
      return String(ccValue);
    }
    return String(label);
  } else if (modoMidi == "MX5") {
    const char *label = getCC_MX5_Names(ccValue);
    if (strcmp(label, "?") == 0) {
      return String(ccValue);
    }
    return String(label);
  }
  // Para "GLOBAL" ou "HX STOMP", retorna o valor CC como string
  return String(ccValue);
}

// =================================================================================
// FUNÇÃO PRINCIPAL DA TELA
// =================================================================================

// WELCOME_SCREEN movida de BFMIDI_v9...FINAL.ino
void WELCOME_SCREEN() {
  const int SCREEN_W = 320;
  const int SCREEN_H = 240;
  const int RECT_X = 40;
  const int RECT_Y = 50;
  const int RECT_W = 240;
  const int RECT_H = 140;
  const int RECT_R = 20;

  spr.fillSprite(TFT_BLACK);
  spr.pushImage(15, 29, 289, 142, (const uint16_t *)BFMIDI);
  spr.setTextColor(TFT_WHITE);
  spr.setFreeFont(&FF23);
  spr.setTextDatum(MC_DATUM);
  spr.drawString(activePins.BOARD_VERSION, 160, 200);

  spr.pushSprite(0, 0);
}

void MAIN_SCREEN(int btn, int lvl) {
  // Layout principal da tela
  // Layout principal da tela
  spr.setSwapBytes(true);
  const int SCREEN_W = 320;
  const int SCREEN_H = 240;

  // BACK PADRAO: tela preta (sem imagem)
  if (!backgroundEnabled) {
    spr.fillRect(0, 0, SCREEN_W, SCREEN_H, TFT_BLACK);
  } else {
    // BACK COLOR: tela cheia na cor configurada
    uint32_t c = backgroundColorConfig;
    uint16_t bgCol = tft.color565((c >> 16) & 0xFF, (c >> 8) & 0xFF, c & 0xFF);
    spr.fillRect(0, 0, SCREEN_W, SCREEN_H, bgCol);
  }

  // Calcula se deve mostrar blocos FX (SIGLAS/ICONES) baseado no modo/quando
  // mostrarFxModo: 0=OFF, 1=SIGLAS, 2=ICONES
  // mostrarFxQuando: 0=SEMPRE, 1=LIVE MODE, 2=NUNCA
  bool shouldShowFxBlocks = false;
  if (mostrarFxModo != 0) {
    if (mostrarFxQuando == 0) {
      shouldShowFxBlocks = true;
    } else if (mostrarFxQuando == 1) {
      shouldShowFxBlocks = isLiveMode;
    }
    // mostrarFxQuando == 2 (NUNCA) -> shouldShowFxBlocks permanece false
  }

  // NOTA: ledPreview controla apenas os LEDs físicos, não o display
  // O display é controlado exclusivamente por shouldShowFxBlocks (GIG VIEW)
  if (shouldShowFxBlocks) {
    // =========================================================================
    // LAYOUT MODERNO - Espaçamento otimizado para evitar sobreposição
    // =========================================================================
    const int margin = 6;        // margem superior
    const int marginBottom = 12; // margem inferior

    // Blocos das siglas FX - tamanho original mantido
    const int FX_BOX_W = 90;       // largura original
    const int FX_BOX_H = 75;       // altura ajustada para mais espaço central
    const int FX_GAP = 10;         // espaçamento original entre quadrados
    const int FX_R = 12;           // raio dos cantos
    const int FX_BORDER_THICK = 4; // borda mais fina e elegante
    const uint16_t FX_OFF_BORDER =
        tft.color565(80, 80, 80); // cor mais suave quando OFF

    const int sep = 2;
    const int topH = FX_BOX_H;
    const int botH = FX_BOX_H;
    const int centerY = margin + topH + sep;
    const int centerH =
        SCREEN_H - (margin + topH) - (marginBottom + botH) - 2 * sep;

    // Fundo preto (apenas se background não estiver habilitado)
    if (!backgroundEnabled) {
      int topAreaH = centerY - sep;
      if (topAreaH < 0)
        topAreaH = 0;
      if (topAreaH > 0)
        spr.fillRect(0, 0, SCREEN_W, topAreaH, TFT_BLACK);

      int bottomStart = centerY + centerH + sep;
      int bottomAreaH = SCREEN_H - bottomStart;
      if (bottomAreaH < 0)
        bottomAreaH = 0;
      if (bottomAreaH > 0)
        spr.fillRect(0, bottomStart, SCREEN_W, bottomAreaH, TFT_BLACK);
    }

    int totalW3 = 3 * FX_BOX_W + 2 * FX_GAP;
    int x0 = (SCREEN_W - totalW3) / 2;
    if (x0 < 0)
      x0 = 0;
    int x1 = x0 + FX_BOX_W + FX_GAP;
    int x2 = x1 + FX_BOX_W + FX_GAP;
    int w0 = FX_BOX_W;
    int w1 = FX_BOX_W;
    int w2 = FX_BOX_W;

    spr.setTextDatum(MC_DATUM);
    spr.setFreeFont(&FF23);

    // Desenha grade de siglas FX
    if (shouldShowFxBlocks) {
      // Função modernizada para desenhar blocos FX com visual mais elegante
      auto drawFxBlockBase = [&](int x, int y, int w, int h, uint16_t fillColor,
                                 uint16_t borderColor) {
        int rrBase = min(FX_R, min(w, h) / 2);

        // Sombra sutil para efeito de profundidade (2px offset)
        uint16_t shadowColor = tft.color565(20, 20, 20);
        spr.fillRoundRect(x + 2, y + 2, w, h, rrBase, shadowColor);

        // Borda externa
        spr.fillRoundRect(x, y, w, h, rrBase, borderColor);

        // Interior com borda mais fina
        int inset = FX_BORDER_THICK;
        int ix = x + inset;
        int iy = y + inset;
        int iw = w - 2 * inset;
        int ih = h - 2 * inset;
        if (iw > 0 && ih > 0) {
          int rrInner = max(1, rrBase - inset);
          spr.fillRoundRect(ix, iy, iw, ih, rrInner, fillColor);

          // Linha de destaque no topo para efeito de brilho
          uint16_t highlightColor =
              tft.color565(min(255, ((fillColor >> 11) & 0x1F) * 8 + 40),
                           min(255, ((fillColor >> 5) & 0x3F) * 4 + 30),
                           min(255, (fillColor & 0x1F) * 8 + 40));
          spr.drawFastHLine(ix + 4, iy + 2, iw - 8, highlightColor);
        }
      };

      // Detecta placas 4S e MICRO (usam layout 2x2)
      bool is4SBoard = (activePins.BOARD_VERSION == String("BFMIDI-1 4S")) ||
                       (activePins.BOARD_VERSION == String("BFMIDI2 4S")) ||
                       (activePins.BOARD_VERSION == String("BFMIDI-2 MICRO")) ||
                       (activePins.BTSW5 < 0 && activePins.BTSW6 < 0);

      if (is4SBoard) {
        // Disposicao 2x2 (blocos 80x70)
        int totalW2 = 2 * FX_BOX_W + FX_GAP;
        int xA = (SCREEN_W - totalW2) / 2;
        if (xA < 0)
          xA = 0;
        int xB = xA + FX_BOX_W + FX_GAP;
        int wA = FX_BOX_W;
        int wB = FX_BOX_W;

        for (int row = 0; row < 2; ++row) {
          int y = (row == 0) ? margin : (SCREEN_H - marginBottom - botH);
          int h = (row == 0) ? topH : botH;
          for (int col = 0; col < 2; ++col) {
            int sw = (row == 0) ? (2 + col) : col; // topo: 2 e 3; base: 0 e 1
            int w = (col == 0) ? wA : wB;
            int x = (col == 0) ? xA : xB;

            int ledIdx = presets[btn][lvl].switches[sw].led;
            String lbl = String(presets[btn][lvl].switches[sw].sigla_fx);
            String lbl2 = "";
            int ledIdx2 = -1;
            uint8_t iconFx = presets[btn][lvl].switches[sw].icon_fx;
            uint8_t iconFx2 = presets[btn][lvl].switches[sw].icon_fx_2;

            const int mode = presets[btn][lvl].switches[sw].modo;
            // Só usa sigla_fx_2 para split se o modo suportar (DUAL STOMP,
            // RAMPA, SPIN HOLD)
            bool supportsSplit =
                (mode == 28 || mode == 50) ||
                ((mode >= 35 && mode <= 37) || (mode >= 44 && mode <= 46));
            if (supportsSplit &&
                presets[btn][lvl].switches[sw].sigla_fx_2[0] != '\0') {
              lbl2 = String(presets[btn][lvl].switches[sw].sigla_fx_2);
              if (mode == 28 || mode == 50) { // DUAL STOMP / RAMPA
                ledIdx2 = presets[btn][lvl].switches[sw].led2;
              } else if ((mode >= 35 && mode <= 37) ||
                         (mode >= 44 && mode <= 46)) { // SPIN HOLD
                ledIdx2 = presets[btn][lvl].switches[sw].led_hold;
              }
            }

            if (ledIdx < 0 || ledIdx >= N_CORES)
              ledIdx = 0;
            const uint8_t *c = PERFIS_CORES[ledIdx];
            uint16_t col16 = tft.color565(c[0], c[1], c[2]);

            bool on = isLiveMode
                          ? (liveModeInitialized
                                 ? stompState[sw]
                                 : presets[btn][lvl].switches[sw].start_value)
                          : presets[btn][lvl].switches[sw].start_value;

            // SPIN/TAP TEMPO modes: moldura sempre acesa (nao tem estado
            // on/off) SPIN1-6: 1,2,3,38,39,40 | SPINP1-6: 19,20,21,41,42,43 |
            // TAP_TEMPO: 18
            bool isAlwaysOnMode = (mode >= 1 && mode <= 3) ||
                                  (mode >= 19 && mode <= 21) ||
                                  (mode >= 38 && mode <= 40) ||
                                  (mode >= 41 && mode <= 43) || (mode == 18);
            if (isAlwaysOnMode) {
              on = true;
            }

            // Desenha split apenas se o modo suportar e lbl2 não estiver vazia
            if (supportsSplit && lbl2.length() > 0) {
              auto normalizeFxLabel = [](String s) {
                s.trim();
                if (s.length() > 3)
                  s = s.substring(0, 3);
                s.toUpperCase();
                return s;
              };

              bool showFullBlock = false;
              int fullBlockIndex = 0;
              if (millis() - lastStateChangeTime[sw] < 1000) {
                showFullBlock = true;
                fullBlockIndex = lastChangedSubSwitch[sw];
              }

              bool on1 = on;
              if (isLiveMode && liveModeInitialized &&
                  (mode == 28 || mode == 50))
                on1 = dualShortState[sw];
              // SPIN HOLD: spin block is always ON (spin function is always active)
              if ((mode >= 35 && mode <= 37) || (mode >= 44 && mode <= 46))
                on1 = true;

              bool on2 = false;
              if (isLiveMode && liveModeInitialized) {
                if (mode == 28 || mode == 50)
                  on2 = dualLongState[sw];
                else if ((mode >= 35 && mode <= 37) ||
                         (mode >= 44 && mode <= 46))
                  on2 = stompState[sw];
              } else {
                if (mode == 28)
                  on2 = presets[btn][lvl].switches[sw].start_value_cc2;
                // SPIN HOLD: read saved HOLD state from start_value
                else if ((mode >= 35 && mode <= 37) ||
                         (mode >= 44 && mode <= 46))
                  on2 = presets[btn][lvl].switches[sw].start_value;
              }

              if (ledIdx2 < 0 || ledIdx2 >= N_CORES)
                ledIdx2 = 0;
              const uint8_t *c2 = PERFIS_CORES[ledIdx2];
              uint16_t col16_2 = tft.color565(c2[0], c2[1], c2[2]);

              lbl = normalizeFxLabel(lbl);
              lbl2 = normalizeFxLabel(lbl2);

              // For SPIN HOLD modes, show percentage in spin block (lbl) for 1 second after press
              bool isSpinHoldMode = (mode >= 35 && mode <= 37) || (mode >= 44 && mode <= 46);
              bool showSpinPercentSplit = isSpinHoldMode && isLiveMode &&
                                          (millis() - lastSpinPressTime[sw] < 1000);
              if (showSpinPercentSplit) {
                int percent = (lastSpinValue[sw] * 100) / 127;
                lbl = String(percent) + "%";
              }

              uint8_t iconColorOn1 = presets[btn][lvl].switches[sw].icon_color;
              uint8_t iconColorOff1 =
                  presets[btn][lvl].switches[sw].icon_color_off;
              uint8_t borderOff1 =
                  presets[btn][lvl].switches[sw].border_color_off;
              uint8_t backOn1 = presets[btn][lvl].switches[sw].back_color_on;
              uint8_t backOff1 = presets[btn][lvl].switches[sw].back_color_off;

              uint8_t iconColorOn2 =
                  presets[btn][lvl].switches[sw].icon_color_2;
              uint8_t iconColorOff2 =
                  presets[btn][lvl].switches[sw].icon_color_off_2;
              uint8_t borderOff2 =
                  presets[btn][lvl].switches[sw].border_color_off_2;
              uint8_t backOn2 = presets[btn][lvl].switches[sw].back_color_on_2;
              uint8_t backOff2 =
                  presets[btn][lvl].switches[sw].back_color_off_2;

              auto resolveColor = [&](int idx, uint16_t fallback) {
                if (idx >= 0 && idx < N_CORES) {
                  const uint8_t *cIdx = PERFIS_CORES[idx];
                  return tft.color565(cIdx[0], cIdx[1], cIdx[2]);
                }
                return fallback;
              };

              // Border ON: use custom border_color_on
              uint8_t borderOn1 =
                  presets[btn][lvl].switches[sw].border_color_on;
              uint16_t borderColor1 =
                  on1 ? resolveColor(borderOn1, col16)
                      : resolveColor(borderOff1, FX_OFF_BORDER);
              uint16_t borderColor2 =
                  on2 ? col16_2 : resolveColor(borderOff2, FX_OFF_BORDER);
              uint16_t textColor1 =
                  resolveColor(on1 ? iconColorOn1 : iconColorOff1, TFT_WHITE);
              uint16_t textColor2 =
                  resolveColor(on2 ? iconColorOn2 : iconColorOff2, TFT_WHITE);
              uint16_t backColor1 =
                  resolveColor(on1 ? backOn1 : backOff1, TFT_BLACK);
              uint16_t backColor2 =
                  resolveColor(on2 ? backOn2 : backOff2, TFT_BLACK);

              if (showFullBlock && fullBlockIndex == 1) {
                drawFxBlockBase(x, y, w, h, backColor1, borderColor1);
                spr.setFreeFont(&FF23);
                spr.setTextColor(textColor1);
                spr.setTextDatum(MC_DATUM);
                spr.drawString(lbl, x + w / 2, y + h / 2);
              } else if (showFullBlock && fullBlockIndex == 2) {
                drawFxBlockBase(x, y, w, h, backColor2, borderColor2);
                spr.setFreeFont(&FF23);
                spr.setTextColor(textColor2);
                spr.setTextDatum(MC_DATUM);
                spr.drawString(lbl2, x + w / 2, y + h / 2);
              } else {
                int h1 = h / 2;
                int h2 = h - h1;
                int y2 = y + h1;

                drawFxBlockBase(x, y, w, h1, backColor1, borderColor1);
                spr.setFreeFont(&FF21);
                spr.setTextColor(textColor1);
                // Centraliza verticalmente no bloco superior
                int fontH1 = spr.fontHeight();
                int textY1 = y + (h1 - fontH1) / 2 + fontH1;
                spr.setTextDatum(BC_DATUM);
                spr.drawString(lbl, x + w / 2, textY1);
                drawFxBlockBase(x, y2, w, h2, backColor2, borderColor2);
                spr.setFreeFont(&FF21);
                spr.setTextColor(textColor2);
                // Centraliza verticalmente no bloco inferior
                int fontH2 = spr.fontHeight();
                int textY2 = y2 + (h2 - fontH2) / 2 + fontH2;
                spr.drawString(lbl2, x + w / 2, textY2);
                spr.setTextDatum(MC_DATUM); // Restaura
              }
            } else {

              // Desenha ícone ou sigla (bloco único)
              // Extract color/fill settings for both ICON and SIGLA
              // Desenha ícone ou sigla (bloco único)
              // Extract color/fill settings for both ICON and SIGLA
              uint8_t iconColorOn = presets[btn][lvl].switches[sw].icon_color;
              uint8_t iconColorOff =
                  presets[btn][lvl].switches[sw].icon_color_off;
              uint8_t backOn = presets[btn][lvl].switches[sw].back_color_on;
              uint8_t backOff = presets[btn][lvl].switches[sw].back_color_off;

              // Border color: use border_color_on when ON, border_color_off
              // when OFF
              uint16_t borderColor;
              if (on) {
                uint8_t borderOnIdx =
                    presets[btn][lvl].switches[sw].border_color_on;
                if (borderOnIdx < N_CORES) {
                  const uint8_t *cBorder = PERFIS_CORES[borderOnIdx];
                  borderColor =
                      tft.color565(cBorder[0], cBorder[1], cBorder[2]);
                } else {
                  borderColor = col16;
                }
              } else {
                uint8_t borderColorIdx =
                    presets[btn][lvl].switches[sw].border_color_off;
                if (borderColorIdx < N_CORES) {
                  const uint8_t *cBorder = PERFIS_CORES[borderColorIdx];
                  borderColor =
                      tft.color565(cBorder[0], cBorder[1], cBorder[2]);
                } else {
                  borderColor = FX_OFF_BORDER;
                }
              }
              uint16_t backColor = TFT_BLACK;
              uint8_t backIdx = on ? backOn : backOff;
              if (backIdx < N_CORES) {
                const uint8_t *cBack = PERFIS_CORES[backIdx];
                backColor = tft.color565(cBack[0], cBack[1], cBack[2]);
              }
              drawFxBlockBase(x, y, w, h, backColor, borderColor);

              // Check if this is a SPIN mode and should show percentage
              bool isAnySpinMode = (mode >= 1 && mode <= 3) ||    // SPIN1-3
                                   (mode >= 38 && mode <= 40) ||  // SPIN4-6
                                   (mode >= 19 && mode <= 21) ||  // SPINP1-3
                                   (mode >= 41 && mode <= 43) ||  // SPINP4-6
                                   (mode >= 35 && mode <= 37) ||  // SPIN1-3 HOLD
                                   (mode >= 44 && mode <= 46);    // SPIN4-6 HOLD
              bool showSpinPercent = isAnySpinMode && isLiveMode &&
                                     (millis() - lastSpinPressTime[sw] < 1000);

              if (showSpinPercent) {
                // Show percentage for 1 second after spin press
                int percent = (lastSpinValue[sw] * 100) / 127;
                String percentStr = String(percent) + "%";
                spr.setFreeFont(&FF23);
                spr.setTextColor(TFT_WHITE);
                int fontH = spr.fontHeight();
                int textY = y + (h - fontH) / 2 + fontH;
                spr.setTextDatum(BC_DATUM);
                spr.drawString(percentStr, x + w / 2, textY);
                spr.setTextDatum(MC_DATUM);
              } else if (iconFx > 0) {
                const char *iconName = presets[btn][lvl].switches[sw].icon_name;
                // Use iconColorOn if ON, iconColorOff if OFF
                uint8_t activeIconColor = on ? iconColorOn : iconColorOff;
                // Icon name follows icon ON/OFF color
                drawFxIconWithName(x, y, w, h, iconFx, iconName,
                                   activeIconColor, backColor);
              } else {
                // SIGLA Rendering with Color/Fill support
                lbl.trim();
                if (lbl.length() > 3)
                  lbl = lbl.substring(0, 3);
                lbl.toUpperCase();

                spr.setFreeFont(&FF23);

                // Text Color Logic
                uint16_t textColor = TFT_WHITE;
                uint8_t activeTextColorIdx = on ? iconColorOn : iconColorOff;

                if (activeTextColorIdx < N_CORES) {
                  const uint8_t *cText = PERFIS_CORES[activeTextColorIdx];
                  textColor = tft.color565(cText[0], cText[1], cText[2]);
                }
                spr.setTextColor(textColor);

                // Centraliza verticalmente
                int fontH = spr.fontHeight();
                int textY = y + (h - fontH) / 2 + fontH;
                spr.setTextDatum(BC_DATUM);
                spr.drawString(lbl, x + w / 2, textY);
                spr.setTextDatum(MC_DATUM);
              }
            }
          }
        }
      } else {
        // Layout 6 botoes (3x2) padrao
        for (int row = 0; row < 2; ++row) {
          int y = (row == 0) ? margin : (SCREEN_H - marginBottom - botH);
          int h = (row == 0) ? topH : botH;
          for (int col = 0; col < 3; ++col) {
            int sw = (row == 0) ? (3 + col) : col;
            int w = (col == 0) ? w0 : (col == 1 ? w1 : w2);
            int x = (col == 0) ? x0 : (col == 1 ? x1 : x2);

            int ledIdx = presets[btn][lvl].switches[sw].led;
            String lbl = String(presets[btn][lvl].switches[sw].sigla_fx);
            String lbl2 = "";
            int ledIdx2 = -1;
            uint8_t iconFx = presets[btn][lvl].switches[sw].icon_fx;
            uint8_t iconFx2 = presets[btn][lvl].switches[sw].icon_fx_2;

            const int mode = presets[btn][lvl].switches[sw].modo;
            // Só usa sigla_fx_2 para split se o modo suportar (DUAL STOMP,
            // RAMPA, SPIN HOLD)
            bool supportsSplit =
                (mode == 28 || mode == 50) ||
                ((mode >= 35 && mode <= 37) || (mode >= 44 && mode <= 46));
            if (supportsSplit &&
                presets[btn][lvl].switches[sw].sigla_fx_2[0] != '\0') {
              lbl2 = String(presets[btn][lvl].switches[sw].sigla_fx_2);
              if (mode == 28 || mode == 50) { // DUAL STOMP / RAMPA
                ledIdx2 = presets[btn][lvl].switches[sw].led2;
              } else if ((mode >= 35 && mode <= 37) ||
                         (mode >= 44 && mode <= 46)) { // SPIN HOLD
                ledIdx2 = presets[btn][lvl].switches[sw].led_hold;
              }
            }

            if (ledIdx < 0 || ledIdx >= N_CORES)
              ledIdx = 0;
            const uint8_t *c = PERFIS_CORES[ledIdx];
            uint16_t col16 = tft.color565(c[0], c[1], c[2]);

            bool on = isLiveMode
                          ? (liveModeInitialized
                                 ? stompState[sw]
                                 : presets[btn][lvl].switches[sw].start_value)
                          : presets[btn][lvl].switches[sw].start_value;

            // SPIN/TAP TEMPO modes: moldura sempre acesa (nao tem estado
            // on/off) SPIN1-6: 1,2,3,38,39,40 | SPINP1-6: 19,20,21,41,42,43 |
            // TAP_TEMPO: 18
            bool isAlwaysOnMode = (mode >= 1 && mode <= 3) ||
                                  (mode >= 19 && mode <= 21) ||
                                  (mode >= 38 && mode <= 40) ||
                                  (mode >= 41 && mode <= 43) || (mode == 18);
            if (isAlwaysOnMode) {
              on = true;
            }

            // Desenha split apenas se o modo suportar e lbl2 não estiver vazia
            if (supportsSplit && lbl2.length() > 0) {
              auto normalizeFxLabel = [](String s) {
                s.trim();
                if (s.length() > 3)
                  s = s.substring(0, 3);
                s.toUpperCase();
                return s;
              };

              bool showFullBlock = false;
              int fullBlockIndex = 0;
              if (millis() - lastStateChangeTime[sw] < 1000) {
                showFullBlock = true;
                fullBlockIndex = lastChangedSubSwitch[sw];
              }

              bool on1 = on;
              if (isLiveMode && liveModeInitialized &&
                  (mode == 28 || mode == 50))
                on1 = dualShortState[sw];
              // SPIN HOLD: spin block is always ON (spin function is always active)
              if ((mode >= 35 && mode <= 37) || (mode >= 44 && mode <= 46))
                on1 = true;

              bool on2 = false;
              if (isLiveMode && liveModeInitialized) {
                if (mode == 28 || mode == 50)
                  on2 = dualLongState[sw];
                else if ((mode >= 35 && mode <= 37) ||
                         (mode >= 44 && mode <= 46))
                  on2 = stompState[sw];
              } else {
                if (mode == 28)
                  on2 = presets[btn][lvl].switches[sw].start_value_cc2;
                // SPIN HOLD: read saved HOLD state from start_value
                else if ((mode >= 35 && mode <= 37) ||
                         (mode >= 44 && mode <= 46))
                  on2 = presets[btn][lvl].switches[sw].start_value;
              }

              if (ledIdx2 < 0 || ledIdx2 >= N_CORES)
                ledIdx2 = 0;
              const uint8_t *c2 = PERFIS_CORES[ledIdx2];
              uint16_t col16_2 = tft.color565(c2[0], c2[1], c2[2]);

              lbl = normalizeFxLabel(lbl);
              lbl2 = normalizeFxLabel(lbl2);

              // For SPIN HOLD modes, show percentage in spin block (lbl) for 1 second after press
              bool isSpinHoldMode = (mode >= 35 && mode <= 37) || (mode >= 44 && mode <= 46);
              bool showSpinPercentSplit = isSpinHoldMode && isLiveMode &&
                                          (millis() - lastSpinPressTime[sw] < 1000);
              if (showSpinPercentSplit) {
                int percent = (lastSpinValue[sw] * 100) / 127;
                lbl = String(percent) + "%";
              }

              uint8_t iconColorOn1 = presets[btn][lvl].switches[sw].icon_color;
              uint8_t iconColorOff1 =
                  presets[btn][lvl].switches[sw].icon_color_off;
              uint8_t borderOff1 =
                  presets[btn][lvl].switches[sw].border_color_off;
              uint8_t backOn1 = presets[btn][lvl].switches[sw].back_color_on;
              uint8_t backOff1 = presets[btn][lvl].switches[sw].back_color_off;

              uint8_t iconColorOn2 =
                  presets[btn][lvl].switches[sw].icon_color_2;
              uint8_t iconColorOff2 =
                  presets[btn][lvl].switches[sw].icon_color_off_2;
              uint8_t borderOff2 =
                  presets[btn][lvl].switches[sw].border_color_off_2;
              uint8_t backOn2 = presets[btn][lvl].switches[sw].back_color_on_2;
              uint8_t backOff2 =
                  presets[btn][lvl].switches[sw].back_color_off_2;

              auto resolveColor = [&](int idx, uint16_t fallback) {
                if (idx >= 0 && idx < N_CORES) {
                  const uint8_t *cIdx = PERFIS_CORES[idx];
                  return tft.color565(cIdx[0], cIdx[1], cIdx[2]);
                }
                return fallback;
              };

              // Border ON: use custom border_color_on
              uint8_t borderOn1 =
                  presets[btn][lvl].switches[sw].border_color_on;
              uint16_t borderColor1 =
                  on1 ? resolveColor(borderOn1, col16)
                      : resolveColor(borderOff1, FX_OFF_BORDER);
              uint8_t borderOn2 =
                  presets[btn][lvl].switches[sw].border_color_on_2;
              uint16_t borderColor2 =
                  on2 ? resolveColor(borderOn2, col16_2)
                      : resolveColor(borderOff2, FX_OFF_BORDER);
              uint16_t textColor1 =
                  resolveColor(on1 ? iconColorOn1 : iconColorOff1, TFT_WHITE);
              uint16_t textColor2 =
                  resolveColor(on2 ? iconColorOn2 : iconColorOff2, TFT_WHITE);
              uint16_t backColor1 =
                  resolveColor(on1 ? backOn1 : backOff1, TFT_BLACK);
              uint16_t backColor2 =
                  resolveColor(on2 ? backOn2 : backOff2, TFT_BLACK);

              if (showFullBlock && fullBlockIndex == 1) {
                drawFxBlockBase(x, y, w, h, backColor1, borderColor1);
                spr.setFreeFont(&FF23);
                spr.setTextColor(textColor1);
                spr.setTextDatum(MC_DATUM);
                spr.drawString(lbl, x + w / 2, y + h / 2);
              } else if (showFullBlock && fullBlockIndex == 2) {
                drawFxBlockBase(x, y, w, h, backColor2, borderColor2);
                spr.setFreeFont(&FF23);
                spr.setTextColor(textColor2);
                spr.setTextDatum(MC_DATUM);
                spr.drawString(lbl2, x + w / 2, y + h / 2);
              } else {
                int h1 = h / 2;
                int h2 = h - h1;
                int y2 = y + h1;

                drawFxBlockBase(x, y, w, h1, backColor1, borderColor1);
                spr.setFreeFont(&FF21);
                spr.setTextColor(textColor1);
                // Centraliza verticalmente no bloco superior
                int fontH1 = spr.fontHeight();
                int textY1 = y + (h1 - fontH1) / 2 + fontH1;
                spr.setTextDatum(BC_DATUM);
                spr.drawString(lbl, x + w / 2, textY1);
                drawFxBlockBase(x, y2, w, h2, backColor2, borderColor2);
                spr.setFreeFont(&FF21);
                spr.setTextColor(textColor2);
                // Centraliza verticalmente no bloco inferior
                int fontH2 = spr.fontHeight();
                int textY2 = y2 + (h2 - fontH2) / 2 + fontH2;
                spr.drawString(lbl2, x + w / 2, textY2);
                spr.setTextDatum(MC_DATUM); // Restaura
              }
            } else {

              // Desenha ícone ou sigla (bloco único)
              // Extract color/fill settings for both ICON and SIGLA
              uint8_t iconColorOn = presets[btn][lvl].switches[sw].icon_color;
              uint8_t iconColorOff =
                  presets[btn][lvl].switches[sw].icon_color_off;
              uint8_t backOn = presets[btn][lvl].switches[sw].back_color_on;
              uint8_t backOff = presets[btn][lvl].switches[sw].back_color_off;

              // Border color: use border_color_on when ON, border_color_off
              // when OFF
              uint16_t borderColor;
              if (on) {
                uint8_t borderOnIdx =
                    presets[btn][lvl].switches[sw].border_color_on;
                if (borderOnIdx < N_CORES) {
                  const uint8_t *cBorder = PERFIS_CORES[borderOnIdx];
                  borderColor =
                      tft.color565(cBorder[0], cBorder[1], cBorder[2]);
                } else {
                  borderColor = col16;
                }
              } else {
                uint8_t borderColorIdx =
                    presets[btn][lvl].switches[sw].border_color_off;
                if (borderColorIdx < N_CORES) {
                  const uint8_t *cBorder = PERFIS_CORES[borderColorIdx];
                  borderColor =
                      tft.color565(cBorder[0], cBorder[1], cBorder[2]);
                } else {
                  borderColor = FX_OFF_BORDER;
                }
              }
              uint16_t backColor = TFT_BLACK;
              uint8_t backIdx = on ? backOn : backOff;
              if (backIdx < N_CORES) {
                const uint8_t *cBack = PERFIS_CORES[backIdx];
                backColor = tft.color565(cBack[0], cBack[1], cBack[2]);
              }
              drawFxBlockBase(x, y, w, h, backColor, borderColor);

              // Check if this is a SPIN mode and should show percentage
              bool isAnySpinMode = (mode >= 1 && mode <= 3) ||    // SPIN1-3
                                   (mode >= 38 && mode <= 40) ||  // SPIN4-6
                                   (mode >= 19 && mode <= 21) ||  // SPINP1-3
                                   (mode >= 41 && mode <= 43) ||  // SPINP4-6
                                   (mode >= 35 && mode <= 37) ||  // SPIN1-3 HOLD
                                   (mode >= 44 && mode <= 46);    // SPIN4-6 HOLD
              bool showSpinPercent = isAnySpinMode && isLiveMode &&
                                     (millis() - lastSpinPressTime[sw] < 1000);

              if (showSpinPercent) {
                // Show percentage for 1 second after spin press
                int percent = (lastSpinValue[sw] * 100) / 127;
                String percentStr = String(percent) + "%";
                spr.setFreeFont(&FF23);
                spr.setTextColor(TFT_WHITE);
                int fontH = spr.fontHeight();
                int textY = y + (h - fontH) / 2 + fontH;
                spr.setTextDatum(BC_DATUM);
                spr.drawString(percentStr, x + w / 2, textY);
                spr.setTextDatum(MC_DATUM);
              } else if (iconFx > 0) {
                const char *iconName = presets[btn][lvl].switches[sw].icon_name;
                // Use iconColorOn if ON, iconColorOff if OFF
                uint8_t activeIconColor = on ? iconColorOn : iconColorOff;
                // Icon name follows icon ON/OFF color
                drawFxIconWithName(x, y, w, h, iconFx, iconName,
                                   activeIconColor, backColor);
              } else {
                // SIGLA Rendering with Color/Fill support
                lbl.trim();
                if (lbl.length() > 3)
                  lbl = lbl.substring(0, 3);
                lbl.toUpperCase();

                spr.setFreeFont(&FF23);

                // Text Color Logic
                uint16_t textColor = TFT_WHITE;
                uint8_t activeTextColorIdx = on ? iconColorOn : iconColorOff;
                if (activeTextColorIdx < N_CORES) {
                  const uint8_t *cText = PERFIS_CORES[activeTextColorIdx];
                  textColor = tft.color565(cText[0], cText[1], cText[2]);
                }
                spr.setTextColor(textColor);

                // Centraliza verticalmente
                int fontH = spr.fontHeight();
                int textY = y + (h - fontH) / 2 + fontH;
                spr.setTextDatum(BC_DATUM);
                spr.drawString(lbl, x + w / 2, textY);
                spr.setTextDatum(MC_DATUM);
              }
            }
          }
        }
      }
    }

    // =========================================================================
    // NOME DO PRESET - Área central destacada
    // =========================================================================
    uint32_t nomeColor32 = presets[btn][lvl].nomePresetTextColor;
    uint16_t nomeColor16 =
        tft.color565((nomeColor32 >> 16) & 0xFF, (nomeColor32 >> 8) & 0xFF,
                     nomeColor32 & 0xFF);
    String presetName = String(presets[btn][lvl].nomePreset);
    if (presetName.length() == 0) {
      presetName = String(presetNames[btn][lvl]);
    }

    spr.setFreeFont(&FF24);
    spr.setTextDatum(MC_DATUM);
    int cx = SCREEN_W / 2;
    int cy = centerY + centerH / 2;

    // Fundo compacto para destacar o nome (apenas se tiver texto)
    if (presetName.length() > 0) {
      int textW = spr.textWidth(presetName);
      int textH = spr.fontHeight();
      int paddingX = 6; // padding horizontal mais estreito
      int paddingY = 2; // padding vertical mais estreito
      int bgW = textW + paddingX * 2;
      int bgH = textH + paddingY * 2;
      int bgX = cx - bgW / 2;
      int bgY = cy - bgH / 2;

      // Fundo escuro
      uint16_t bgColor = tft.color565(30, 30, 35);
      spr.fillRoundRect(bgX, bgY, bgW, bgH, 12, bgColor);

      // Borda cinza
      uint16_t borderGray = tft.color565(100, 100, 100);
      spr.drawRoundRect(bgX, bgY, bgW, bgH, 12, borderGray);
    }

    // Contorno do texto (sombra suave)
    uint16_t shadowColor = tft.color565(15, 15, 15);
    for (int dx = -2; dx <= 2; dx++) {
      for (int dy = -2; dy <= 2; dy++) {
        if (dx != 0 || dy != 0) {
          spr.setTextColor(shadowColor);
          spr.drawString(presetName, cx + dx, cy + dy);
        }
      }
    }

    // Texto principal
    spr.setTextColor(nomeColor16);
    spr.drawString(presetName, cx, cy);

    if (!shouldShowFxBlocks) {
      // =========================================================================
      // INDICADOR DE PRESET (quando FX blocks estão ocultos)
      // =========================================================================
      spr.setFreeFont(&FF24);
      spr.setTextDatum(MC_DATUM);

      char letra = 'A';
      int numero = 1;
      if (currentLetter >= 0 && currentLetter < PRESET_LEVELS) {
        letra = 'A' + currentLetter;
      } else if (lvl >= 0 && lvl < PRESET_LEVELS) {
        letra = 'A' + lvl;
      }
      if (currentButton >= 0 && currentButton < TOTAL_BUTTONS) {
        numero = currentButton + 1;
      } else if (btn >= 0 && btn < TOTAL_BUTTONS) {
        numero = btn + 1;
      }

      String defaultPresetIdText = "PRESET ";
      defaultPresetIdText += letra;
      defaultPresetIdText += String(numero);
      const int presetNameTextY = 40;

      // Badge do preset no topo
      int pidTextW = spr.textWidth(defaultPresetIdText);
      int pidTextH = spr.fontHeight();
      int pidBadgeW = pidTextW + 40; // mais espaço horizontal
      int pidBadgeH = pidTextH + 16; // mais espaço vertical baseado na fonte
      int pidBadgeX = (SCREEN_W - pidBadgeW) / 2;
      int pidBadgeY = presetNameTextY - pidBadgeH / 2;

      uint16_t pidBgColor = tft.color565(40, 45, 55);
      spr.fillRoundRect(pidBadgeX, pidBadgeY, pidBadgeW, pidBadgeH, 8,
                        pidBgColor);
      spr.drawRoundRect(pidBadgeX, pidBadgeY, pidBadgeW, pidBadgeH, 8,
                        TFT_WHITE);

      spr.setTextColor(TFT_WHITE);
      spr.drawString(defaultPresetIdText, SCREEN_W / 2, presetNameTextY);

      // =========================================================================
      // INDICADOR DE MODO (LIVE/PRESET) - Visual moderno
      // =========================================================================
      const int modeTextY = 195;
      spr.setFreeFont(&FF23);
      spr.setTextDatum(MC_DATUM);
      const String modeLabel = isLiveMode ? "LIVE MODE" : "PRESET MODE";
      int textW = spr.textWidth(modeLabel);
      int textH = spr.fontHeight();
      const int MODE_PAD_X = 20;
      const int MODE_PAD_Y = 6;
      int modeRectW = textW + 2 * MODE_PAD_X;
      int modeRectH = textH + 2 * MODE_PAD_Y;
      int modeRectX = (SCREEN_W - modeRectW) / 2;
      int modeRectY = modeTextY - modeRectH / 2;

      // Cores mais vibrantes para o modo
      uint16_t modeFillColor =
          isLiveMode ? tft.color565(180, 30, 30) : tft.color565(30, 80, 180);
      uint16_t modeBorderColor =
          isLiveMode ? tft.color565(255, 60, 60) : tft.color565(80, 140, 255);

      int rrBase = modeRectH / 2;

      // Sombra
      spr.fillRoundRect(modeRectX + 2, modeRectY + 2, modeRectW, modeRectH,
                        rrBase, tft.color565(15, 15, 15));

      // Fundo do badge
      spr.fillRoundRect(modeRectX, modeRectY, modeRectW, modeRectH, rrBase,
                        modeFillColor);

      // Borda brilhante
      spr.drawRoundRect(modeRectX, modeRectY, modeRectW, modeRectH, rrBase,
                        modeBorderColor);
      spr.drawRoundRect(modeRectX + 1, modeRectY + 1, modeRectW - 2,
                        modeRectH - 2, rrBase - 1, modeBorderColor);

      // Texto do modo
      spr.setTextColor(TFT_WHITE);
      spr.drawString(modeLabel, SCREEN_W / 2, modeTextY);
    }

    spr.pushSprite(0, 0);
    return;
  }

  // ===========================================================================
  // MODO SEM LED PREVIEW - Layout alternativo centralizado
  // ===========================================================================
  const int presetNameTextY = 40;
  const GFXfont *presetNameFont = &FF24;
  const int rectTopY = 80;
  const int rectH = 90;
  const int modeTextY = 205;
  const GFXfont *modeTextFont = &FF23;

  spr.setFreeFont(presetNameFont);
  spr.setTextDatum(MC_DATUM);

  // Determina texto do preset
  String defaultPresetIdText;
  bool showPresetId = !shouldShowFxBlocks;
  if (showPresetId) {
    char letra = 'A';
    int numero = 1;

    if (currentLetter >= 0 && currentLetter < PRESET_LEVELS) {
      letra = 'A' + currentLetter;
    } else if (lvl >= 0 && lvl < PRESET_LEVELS) {
      letra = 'A' + lvl;
    }

    if (currentButton >= 0 && currentButton < TOTAL_BUTTONS) {
      numero = currentButton + 1;
    } else if (btn >= 0 && btn < TOTAL_BUTTONS) {
      numero = btn + 1;
    }

    defaultPresetIdText = "PRESET ";
    defaultPresetIdText += letra;
    defaultPresetIdText += String(numero);
  } else {
    defaultPresetIdText = "PRESET ";
    defaultPresetIdText += presetNames[btn][lvl];
  }

  // Badge do preset no topo
  int pidTextW2 = spr.textWidth(defaultPresetIdText);
  int pidTextH2 = spr.fontHeight();
  int pidBadgeW2 = pidTextW2 + 40; // mais espaço horizontal
  int pidBadgeH2 = pidTextH2 + 16; // mais espaço vertical baseado na fonte
  int pidBadgeX2 = (SCREEN_W - pidBadgeW2) / 2;
  int pidBadgeY2 = presetNameTextY - pidBadgeH2 / 2;

  uint16_t pidBgColor2 = tft.color565(40, 45, 55);
  spr.fillRoundRect(pidBadgeX2, pidBadgeY2, pidBadgeW2, pidBadgeH2, 8,
                    pidBgColor2);
  spr.drawRoundRect(pidBadgeX2, pidBadgeY2, pidBadgeW2, pidBadgeH2, 8,
                    TFT_WHITE);

  spr.setTextColor(TFT_WHITE);
  spr.drawString(defaultPresetIdText, SCREEN_W / 2, presetNameTextY);

  // Nome customizado do preset
  uint32_t nomeColor32b = presets[btn][lvl].nomePresetTextColor;
  uint16_t nomeColor16b =
      tft.color565((nomeColor32b >> 16) & 0xFF, (nomeColor32b >> 8) & 0xFF,
                   nomeColor32b & 0xFF);

  String customPresetNameText = String(presets[btn][lvl].nomePreset);
  if (customPresetNameText.length() == 0) {
    customPresetNameText = String(presetNames[btn][lvl]);
  }

  if (customPresetNameText.length() > 0) {
    int cx2 = SCREEN_W / 2;
    int cy2 = rectTopY + rectH / 2;

    // Fundo compacto para o nome
    int nameTextW = spr.textWidth(customPresetNameText);
    int nameTextH = spr.fontHeight();
    int nameBgW = nameTextW + 12; // padding horizontal mais estreito
    int nameBgH = nameTextH + 4;  // padding vertical mais estreito
    int nameBgX = cx2 - nameBgW / 2;
    int nameBgY = cy2 - nameBgH / 2;

    uint16_t nameBgColor = tft.color565(30, 30, 35);
    spr.fillRoundRect(nameBgX, nameBgY, nameBgW, nameBgH, 12, nameBgColor);
    spr.drawRoundRect(nameBgX, nameBgY, nameBgW, nameBgH, 12,
                      tft.color565(100, 100, 100));

    // Sombra do texto
    uint16_t shadowColor2 = tft.color565(15, 15, 15);
    for (int dx = -2; dx <= 2; dx++) {
      for (int dy = -2; dy <= 2; dy++) {
        if (dx != 0 || dy != 0) {
          spr.setTextColor(shadowColor2);
          spr.drawString(customPresetNameText, cx2 + dx, cy2 + dy);
        }
      }
    }

    spr.setTextColor(nomeColor16b);
    spr.drawString(customPresetNameText, cx2, cy2);
  }

  // Indicador de modo (LIVE/PRESET)
  spr.setFreeFont(modeTextFont);
  spr.setTextDatum(MC_DATUM);
  const String modeLabel = isLiveMode ? "LIVE MODE" : "PRESET MODE";
  int textW = spr.textWidth(modeLabel);
  int textH = spr.fontHeight();
  const int MODE_PAD_X = 20;
  const int MODE_PAD_Y = 6;
  int modeRectW = textW + 2 * MODE_PAD_X;
  int modeRectH = textH + 2 * MODE_PAD_Y;
  int modeRectX = (SCREEN_W - modeRectW) / 2;
  int modeRectY = modeTextY - modeRectH / 2;

  // Cores vibrantes para o modo
  uint16_t modeFillColor =
      isLiveMode ? tft.color565(180, 30, 30) : tft.color565(30, 80, 180);
  uint16_t modeBorderColor =
      isLiveMode ? tft.color565(255, 60, 60) : tft.color565(80, 140, 255);

  int rrBase = modeRectH / 2;

  // Sombra
  spr.fillRoundRect(modeRectX + 2, modeRectY + 2, modeRectW, modeRectH, rrBase,
                    tft.color565(15, 15, 15));

  // Fundo do badge
  spr.fillRoundRect(modeRectX, modeRectY, modeRectW, modeRectH, rrBase,
                    modeFillColor);

  // Borda brilhante
  spr.drawRoundRect(modeRectX, modeRectY, modeRectW, modeRectH, rrBase,
                    modeBorderColor);
  spr.drawRoundRect(modeRectX + 1, modeRectY + 1, modeRectW - 2, modeRectH - 2,
                    rrBase - 1, modeBorderColor);

  spr.setTextColor(TFT_WHITE);
  spr.drawString(modeLabel, SCREEN_W / 2, modeTextY);

  spr.pushSprite(0, 0);
}

// LED_PRESET() movida para LED_MANAGER.h

#endif
