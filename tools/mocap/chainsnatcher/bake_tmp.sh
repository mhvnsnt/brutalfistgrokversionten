#!/bin/bash
# bake ONLY the two Chainsnatcher clips through the repo's real bake (temp copy with a source filter) into $1
set -e
cd /workspace/vten-stages && export PATH=/workspace/tools/node-v22.23.3-linux-x64/bin:$PATH
C=/workspace/mocap-src/chainsnatcher_capture; OUT=${1:-/tmp/bake-cs}; mkdir -p $OUT
BAKE_EXTRA=CHAINSNATCHER=$C/CHAINSNATCHER.json,CHAINSNATCHER__RECV=$C/CHAINSNATCHER__RECV.json BAKE_ONLY=CHAINSNATCHER,CHAINSNATCHER__RECV \
  node --experimental-strip-types --import ./scripts/register-ts-resolve.mjs scripts/_bake_only.tmp.mjs --out $OUT 2>&1 | grep "__DUMP" | cut -c1-700 || true
ls $OUT
