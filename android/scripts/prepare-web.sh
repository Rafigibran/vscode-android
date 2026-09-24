#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "\${BASH_SOURCE[0]}")/../.." && pwd)"
ANDROID_ASSETS="$ROOT/android/app/src/main/assets/www"
WEB_PACKAGE="$ROOT/../vscode-web"

cd "$ROOT"

echo "Building the Code - OSS web bundle..."
export NODE_OPTIONS="\${NODE_OPTIONS:---max-old-space-size=8192}"
npm run gulp vscode-web-min

if [[ ! -d "$WEB_PACKAGE/out" ]]; then
  echo "ERROR: expected web package at $WEB_PACKAGE" >&2
  exit 1
fi

rm -rf "$ANDROID_ASSETS"
mkdir -p "$ANDROID_ASSETS"
cp -a "$WEB_PACKAGE/." "$ANDROID_ASSETS/"

python3 - "$ROOT/android/web-config.json" "$ANDROID_ASSETS/index.html" <<'PY'
import html
import json
import pathlib
import sys

config_path = pathlib.Path(sys.argv[1])
index_path = pathlib.Path(sys.argv[2])

config = json.loads(config_path.read_text())
config_attr = html.escape(json.dumps(config, separators=(",", ":")), quote=True)

index = f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#181818">
  <title>Code - OSS Android</title>
  <meta id="vscode-workbench-web-configuration" data-settings="{config_attr}">
  <meta id="vscode-workbench-web-base-url" data-settings=".">
  <meta id="vscode-workbench-auth-session" data-settings="">
  <link rel="icon" href="./favicon.ico">
  <link rel="manifest" href="./manifest.json">
  <link rel="stylesheet" href="./out/vs/code/browser/workbench/workbench.css">
</head>
<body aria-label=""></body>
<script>
  const baseUrl = new URL(
    document.getElementById('vscode-workbench-web-base-url').getAttribute('data-settings'),
    window.location.origin
  ).toString();
  globalThis._VSCODE_FILE_ROOT = baseUrl + '/out/';
  performance.mark('code/willLoadWorkbenchMain');
</script>
<script type="module" src="./out/vs/code/browser/workbench/workbench.js"></script>
</html>
"""
index_path.write_text(index)
PY
