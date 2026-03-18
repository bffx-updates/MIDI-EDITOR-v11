#ifndef WEB_ROUTES_H
#define WEB_ROUTES_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include <AsyncEventSource.h>
#include <ESPAsyncWebServer.h>


#include "COMMON_DEFS.h"
#include "WEB_API.h"
#include "WEB_JSON.h"
#include "WIFI.h" // Includes server, ws, etc.


// Includes of the separated route files
#include "WEB_ROUTES_GLOBAL.h"
#include "WEB_ROUTES_PRESETS.h"
#include "WEB_ROUTES_SYSTEM.h"


void setupWebRoutes() {
  // Helper to init defaults if needed (moved to WEB_API or handled elsewhere,
  // but ensure any global initialization is done if required.
  // initPresetDefaults is available if needed)

  // Setup routes from the split files
  setupSystemRoutes();
  setupGlobalRoutes();
  setupPresetRoutes();

  // Attach WebSocket handler
  // onWsEvent must be visible here (defined in WEB_ROUTES_SYSTEM.h)
  ws.onEvent(onWsEvent);
  server.addHandler(&ws);

  // Start the server
  server.begin();
  Serial.println("Servidor HTTP iniciado via setupWebRoutes()");

#ifdef BOARD_HAS_PSRAM
  Serial.printf("PSRAM livre: %u bytes\n", ESP.getFreePsram());
#endif
  Serial.printf("HEAP interno livre: %u bytes\n", ESP.getFreeHeap());
}

#endif // WEB_ROUTES_H
