#!/bin/zsh
# Double-click this file in Finder to run PACU on this Mac.
set -e
cd -- "$(dirname -- "$0")"

if command -v node >/dev/null 2>&1; then
  pacu_node="$(command -v node)"
elif [[ -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]]; then
  pacu_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
else
  print 'PACU needs Node.js 24 LTS. Ask Codex to finish the local setup.'
  read '?Press Return to close.'
  exit 1
fi
export PATH="$(dirname -- "$pacu_node"):$PATH"

if [[ ! -f node_modules/next/dist/bin/next ]]; then
  print 'PACU dependencies need to be installed. Ask Codex to finish setup in this folder.'
  read '?Press Return to close.'
  exit 1
fi

if curl --silent --fail --max-time 2 http://127.0.0.1:3000/login | "$pacu_node" --input-type=module -e '
  let page = "";
  for await (const chunk of process.stdin) page += chunk;
  process.exit(page.includes("PACU Baseball Performance") ? 0 : 1);
'; then
  print 'PACU is already running. Opening your dashboard…'
  open 'http://127.0.0.1:3000'
  exit 0
fi

print 'Starting PACU Baseball Performance…'
print 'Keep this window open while using the app. Press Control+C here to stop it.'
print 'Your dashboard: http://127.0.0.1:3000'
(
  for pacu_attempt in {1..30}; do
    if curl --silent --fail --max-time 1 http://127.0.0.1:3000/login >/dev/null; then
      open 'http://127.0.0.1:3000'
      break
    fi
    sleep 1
  done
) &
exec "$pacu_node" node_modules/next/dist/bin/next dev --hostname 127.0.0.1
