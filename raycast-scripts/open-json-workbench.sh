#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.title Open JSON Workbench
# @raycast.mode silent
# @raycast.packageName JSON Workbench
# @raycast.icon icon.png
# @raycast.argument1 {"type":"text","placeholder":"JSON or absolute file path (optional)","optional":true}
# @raycast.description Open the local JSON editor with clipboard text or an optional input.
# @raycast.author tang_xiangrun
# @raycast.authorURL https://github.com/Stxr/raycast-json-preview

set -euo pipefail

app="/Applications/JSON Workbench.app"
if [[ ! -d "$app" ]]; then
  app="$HOME/Applications/JSON Workbench.app"
fi
if [[ ! -d "$app" ]]; then
  echo "Install JSON Workbench.app in Applications first. See the GitHub release installation guide." >&2
  exit 1
fi

if [[ -n "${1:-}" ]]; then
  /usr/bin/open -n "$app" --args --input "$1"
else
  /usr/bin/open -n "$app" --args --clipboard
fi
