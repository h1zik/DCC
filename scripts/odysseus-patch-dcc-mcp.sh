#!/bin/bash
set -euo pipefail
cd /root/odysseus/integrations/dcc-mcp

# Add import if missing
if ! grep -q 'register-research-tools' src/create-server.ts; then
  sed -i 's|from "./register-strategic-tools.js";|from "./register-strategic-tools.js";\nimport { registerResearchTools } from "./register-research-tools.js";|' src/create-server.ts
  sed -i 's|version: "3.1.0"|version: "3.2.0"|' src/create-server.ts
  sed -i '/registerStrategicTools(server, {/,/});/a\
\
  registerResearchTools(server, {\
    dccFetch,\
    buildQuery,\
    asText,\
    limitSchema,\
  });' src/create-server.ts
fi

npm run build
echo "Build OK"
