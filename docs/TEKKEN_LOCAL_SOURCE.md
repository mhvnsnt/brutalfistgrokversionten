# Tekken 3 local source / ROM handoff

Authorized Tekken source repository: `mhvnsnt/BrutalfistbaseofTekken3Recompiled`.

Owner-provided local source/ROM handoff:
https://drive.google.com/drive/folders/1tGHKalMKV1Xb7b2lL3R9Plk7cWJzfRd1

## Boundary

The ROM/disc files are **not committed to GitHub, bundled into Brutal Fist, or fetched by the browser runtime**. They remain local source material. Brutal Fist's current PWA uses committed/generated fighting-motion data and the authorized Tekken source repository; a retail ROM is not required just to boot Rocket.

When the Tekken recompiler/import pipeline needs the game data, set:

`TEKKEN3_SOURCE_DIR=/path/to/local/Tekken3Source`

and sync the owner-provided files there. See `config/tekken3-local-source.json` for the expected inputs.
