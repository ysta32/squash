#!/bin/sh
# Installs the Squash → Claude Code bridge.
#
#   curl -fsSL https://<squash>/bridge/install.sh | sh -s -- https://<squash>
#   curl -fsSL https://<squash>/bridge/install.sh | sh -s -- --uninstall
#
# On macOS it runs at login as a LaunchAgent, so "Send to Claude" always works.
# Elsewhere it is downloaded to ~/.squash and started in the foreground.
set -eu

DIR="$HOME/.squash"
SCRIPT="$DIR/claude-bridge.mjs"
LABEL="app.squash.claude-bridge"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
ORIGIN="${1:-https://squash-livid.vercel.app}"
ORIGIN="${ORIGIN%/}"

if [ "$ORIGIN" = "--uninstall" ]; then
  if [ "$(uname)" = "Darwin" ]; then
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
  fi
  rm -f "$SCRIPT"
  echo "Removed the Squash bridge. Your folder choices remain in $DIR/bridge.json."
  exit 0
fi

NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  echo "The Squash bridge needs Node.js 18 or newer: https://nodejs.org" >&2
  exit 1
fi
if ! "$NODE" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)'; then
  echo "The Squash bridge needs Node.js 18 or newer (found $("$NODE" --version))." >&2
  exit 1
fi
if ! command -v claude >/dev/null 2>&1; then
  echo "Note: Claude Code is not on your PATH yet. Install it: https://claude.com/claude-code"
fi

CONFIG="$(curl -fsSL "$ORIGIN/bridge/config.json")"
SUPABASE_HOST="$(printf '%s' "$CONFIG" | "$NODE" --input-type=module -e '
  import { readFileSync } from "node:fs";
  try {
    const config = JSON.parse(readFileSync(0, "utf8"));
    if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error();
    if (Object.hasOwn(config, "supabaseHost")) {
      const host = config.supabaseHost;
      if (typeof host !== "string" || host.length > 253 ||
          !host.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) {
        throw new Error();
      }
      process.stdout.write(host.toLowerCase());
    }
  } catch {
    console.error("Invalid bridge config: expected a Supabase hostname.");
    process.exit(1);
  }
')"

mkdir -p "$DIR"
curl -fsSL "$ORIGIN/bridge/claude-bridge.mjs" -o "$SCRIPT"
ORIGINS="$ORIGIN,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"

if [ "$(uname)" != "Darwin" ]; then
  echo "Starting the Squash bridge. Leave this terminal open."
  SQUASH_ORIGINS="$ORIGINS" SQUASH_SUPABASE_HOST="$SUPABASE_HOST" exec "$NODE" "$SCRIPT"
fi

mkdir -p "$HOME/Library/LaunchAgents"
cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>$SCRIPT</string></array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>SQUASH_ORIGINS</key><string>$ORIGINS</string>
    <key>SQUASH_SUPABASE_HOST</key><string>$SUPABASE_HOST</string>
    <key>PATH</key><string>$(dirname "$NODE"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$DIR/bridge.log</string>
  <key>StandardErrorPath</key><string>$DIR/bridge.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

i=0
until curl -fs -H "Origin: $ORIGIN" http://127.0.0.1:4317/health >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 20 ]; then
    echo "The bridge did not start. See $DIR/bridge.log" >&2
    exit 1
  fi
  sleep 0.5
done

echo "✓ Squash bridge installed and running. It starts automatically when you log in."
echo "  Go back to Squash and press \"Send to Claude\"."
echo "  macOS will ask once to let node control Terminal: click OK."
