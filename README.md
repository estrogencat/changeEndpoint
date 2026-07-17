# ChangeEndpoint (Vencord/Equicord userplugin)

Redirects Discord's REST API, CDN, and Gateway traffic to **fermi.chat's**
Harmony backend (`harmony.melodychat.org`) by default, which is changeable in plugin settings, plus a set of janky fixes for
things that broke or misbehaved.<br>
This plugin is compatible with Spacebar and Harmony.

## Install

Install a secondary client if you have a main client, as this plugin is set as required and cannot be disabled.<br>
<sub><sup>This plugin was built and tested on canary ONLY, results may vary on stable and PTB</sub></sup>

```bash
mkdir -p src/userplugins/ChangeEndpoint
# copy files into that folder
pnpm install
pnpm build
# MAKE SURE YOU SELECT THE RIGHT CLIENT!!!!!
pnpm inject
```

Fully quit Discord (tray icon, not just closing the window) and relaunch.

## What's confirmed working

VC on website client<br>
Messaging<br>
Emojis/stickers<br>
Registering<br>
Login<br>
Instance switching<br>
Server creation<br>
Server joining<br>
Channel creation<br>
Uploading media<br>
CDN<br>
Updating username/discriminator/bio/pronouns/PFP/banner<br>
DMs<br>
Friendship endpoint<br>

### Partial

VC joining on Desktop client (can join, thinks no permissions are granted. Cannot screenshare, viewing other screenshares and listening to voice isnt tested)<br>
Video playback (replaced discord's video player with the one your browser/client uses)<br>
<img width="602" height="392" alt="image" src="https://github.com/user-attachments/assets/9fdfe122-237b-421d-9802-06eb1ce56051" />


### Broken

Server rearranging<br>
Status (text and online/idle/whatever)<br>
Message latency (spacebar issue)<br>


## Verifying it worked

DevTools (Ctrl+Shift+I) → Network tab, confirm `api/v9`, CDN, and gateway
requests go to your specified hosts.

