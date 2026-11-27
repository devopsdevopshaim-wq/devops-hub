#!/bin/bash
# Optimus screen: opens the hall screen full screen on this Mac. Close with Cmd+Q.
URL="https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/tv.html?app=1"
caffeinate -d -w $$ &   # the screen does not sleep while this window is open
if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --kiosk --no-first-run --user-data-dir="$HOME/.optimus-screen" "$URL"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -na "Microsoft Edge" --args --kiosk --no-first-run --user-data-dir="$HOME/.optimus-screen" "$URL"
else
  open "$URL"   # Safari: press Ctrl+Cmd+F for full screen
fi
sleep 2
