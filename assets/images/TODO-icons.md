# TODO: replace placeholder app artwork

The files below are generated placeholders (teal ring + orange core on #10151b).
Replace them with the final ThermoTrack artwork, keeping the same file names and sizes,
so `app.json` does not need to change.

| File | Size | Used for |
|---|---|---|
| `thermotrack-icon.png` | 1024×1024, opaque | App icon (iOS and default) |
| `thermotrack-adaptive-foreground.png` | 1024×1024, transparent, mark inside the central 66 % | Android adaptive icon foreground (background colour `#10151b` in app.json) |
| `thermotrack-adaptive-monochrome.png` | 1024×1024, transparent, single colour | Android themed (monochrome) icon |
| `thermotrack-splash.png` | 512×512, transparent | Native splash image and the in-app splash overlay |
| `thermotrack-favicon.png` | 48×48 | Web favicon |

Splash background colour is `#10151b` (the app background). Icon and splash changes only
take effect in a development or store build, not in Expo Go.
