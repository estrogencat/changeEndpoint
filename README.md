# FermiEndpoint (Vencord/Equicord userplugin)

Redirects Discord's REST API, CDN, and Gateway traffic to **fermi.chat's**
Spacebar backend (`harmony.melodychat.org`), plus a set of fixes for
things that broke or misbehaved specifically because of that redirect.

## Install

```bash
mkdir -p src/userplugins/FermiEndpoint
# copy index.tsx into that folder
pnpm install
pnpm build
pnpm inject
```

Fully quit Discord (tray icon, not just closing the window) and relaunch.
Enable **FermiEndpoint** under Vencord/Equicord Settings → Plugins.

## What's in here, and why

### 1\. Host redirection (API / CDN / Gateway / media proxy)

Discord reads its backend hosts once from `window.GLOBAL\_ENV`, set inline
in the page HTML before any app code runs. Most modules read this via
dot-access (`window.GLOBAL\_ENV.CDN\_HOST`), which four patches rewrite
directly in the compiled module source before that code ever executes -
this is more reliable than a runtime `fetch`/`WebSocket` hook, which is
too late: by the time it attaches, many modules have already cached the
real Discord hosts into local variables.

### 2\. Destructured `GLOBAL\_ENV` reads (stickers, avatars, and others)

Some modules instead read `GLOBAL\_ENV` via object destructuring in one
shot, e.g.:

```js
let{API\_ENDPOINT:h,MEDIA\_PROXY\_ENDPOINT:I,CDN\_HOST:T}=window.GLOBAL\_ENV
```

This never contains the literal substring `window.GLOBAL\_ENV.CDN\_HOST`,
so the dot-access patches silently missed it. This was confirmed as the
cause of stickers loading Discord's "Oops!" placeholder (they were
requesting `media.discordapp.net` directly), and a HAR capture showed the
same pattern hitting `cdn.discordapp.com/avatars/...` during normal use -
so this also fixes regular avatar/banner *display*.

**Version note:** the first attempt at this patch appended new
`;localVar="...";` statements after the match. That broke as soon as the
destructuring was just one declarator inside a larger comma-separated
`let` statement (e.g. `let a=1,{CDN\_HOST:i}=window.GLOBAL\_ENV,b=2`) -
inserting a semicolon there split the statement and left a dangling
`,b=2`, a syntax error that broke every module it touched (CDN failing
everywhere, not just stickers). Fixed by keeping it a pure expression
substitution instead: only the `window.GLOBAL\_ENV` RHS gets rewritten to
`Object.assign({},window.GLOBAL\_ENV,{...overrides})`, which is safe in
any surrounding syntax since it never introduces a new statement.

### 3\. Gateway plaintext mode

The gateway connected but closed instantly (WS code 4000, no data
received) because the client was requesting `encoding=etf\&compress=zstd-stream`,
which most Spacebar backends don't implement. Discord's own client has a
built-in escape hatch for this - `isDiscordGatewayPlaintextSet()`,
hardcoded to `false` - patched to always return `true`, forcing plain
JSON with no compression.

### 4\. GIF provider

The GIF picker's provider (tenor/giphy/klipy) is chosen by an A/B
experiment (`2025-10-gif-providers-multi-treatment`) that can't resolve
on Spacebar (experiments endpoints 404), so it falls back to a hardcoded
`"tenor"`. Since Tenor's API is being retired and Fermi's backend has
already moved to Klipy, this caused 500s. Patched the resolver to always
return `"klipy"` regardless of experiment state.

**Known issue:** even with this patch, and even with the experiment
manually enabled in Discord's dev tools, GIFs still didn't load in
testing - and it reportedly doesn't work in fermi.chat's own web client
either right now. That points to this being a **Fermi/Spacebar backend
issue** (its Klipy integration itself), not something further client
patching can fix. Worth checking directly against fermi's backend/support
rather than the client.

### 6\. Avatar/banner upload schema mismatch

Confirmed via HAR: the `PATCH /users/@me` request when uploading an
avatar included an `avatar\_description` field (an auto-generated
alt-text string, e.g. `"<hash>, added 15 July 2026 at 02:44"` - a newer
Discord accessibility feature) alongside `avatar`. Spacebar's schema
validation doesn't recognize this field and rejects the *entire* request
with `400 "must NOT have additional properties"`, breaking avatar
uploads outright. A runtime `fetch` hook now strips `avatar\_description`
(and defensively `banner\_description`, since banners almost certainly
get the same treatment) from this specific request's body before it's
sent - nothing else in the body is touched. This is separate from the
destructuring/host-redirect patches above and runs safely at request
time, since it's user-triggered well after boot, not read from an
early-cached config value.

### 7\. Toggles for unimplemented-endpoint spam

Quests, Shop/SKUs, server-boost Powerups, game-activity detection,
promotions, and application external-assets aren't implemented on
Spacebar and just 404 repeatedly - harmless individually, but it's
needless request volume against Fermi's backend (rate-limit risk) and
wasted cycles on slow devices. Six independent toggles in plugin settings
each short-circuit their matching request to an instant fake 404 -
identical to what the server already returns today, just without the
network round-trip. The Quests and Shop toggles also hide their nav
buttons via a CSS selector on Discord's own `data-list-item-id` attribute
(matched on stable suffix, not the full value, since it embeds a
per-session numeric id). Powerups/game-detection/promotions/
external-assets don't have a single persistent nav button to hide (they're
background calls, not tied to one button) - only their fetches are
blocked. All toggles default to **off** (no behavior change) so you opt
in to whichever you want.

## What's confirmed working (per your testing)

Messaging, search, CDN upload/download, emoji sending, sticker/emoji
uploading, custom emoji reactions, pronouns updating.

## What I looked at but couldn't fix from the client side

* **Members list not fully loading / server-unreads delay on load /
friends list flickering then showing empty / channel-switch info
(role colors, member lists) dropping out after a while.** These all
smell like partial/inconsistent implementation of Discord's lazy
member-list subscription and READY\_SUPPLEMENTAL protocol on Spacebar's
side, but I don't have a clean enough repro isolated in the HARs to
point at a specific broken request vs. a timing/race issue. If you can
get a HAR that brackets just one flaky reproduction (e.g. start
recording right before switching channels, stop right after role
colors disappear) that would help narrow it down.
* **Guild/server reordering.** The settings HAR only captured an `OPTIONS`
preflight to `/users/@me/settings` with no follow-up `PATCH` - the
actual reorder request either didn't fire or wasn't in the capture
window. A HAR that captures the full drag-and-drop through to the
PATCH response would let me check whether it's a client bug or a
Spacebar `settings` endpoint gap.
* **Mutual guilds/friends.** You noted you don't have mutual friends to
test with, so this is unconfirmed either way - likely a Spacebar
implementation gap rather than a client-side redirect issue, since
there's no obvious host/endpoint mismatch involved.
* **Video embedding on CDN upload.** URLs looked correct in your report;
I didn't find a clear discriminating signal in the provided HARs for
why embeds don't render. Would need a HAR capturing the actual embed
fetch/oEmbed-style request Discord makes after upload completes.
* **Random client reloads / bounce to messages page.** No consistent
error pattern found tied to this in the provided captures. If it
correlates with a specific action (you mentioned emoji loading as a
possible trigger), a HAR bracketing just that action plus the
DevTools console output at the moment of reload would help.
* **`PUT /guilds/:id/members/@me?lurker=true` returning 400 "Unknown
guild"** (found in the reload-issue HAR) - this is a Spacebar backend
response, not a client-side URL issue (the same guild ID resolves fine
on other endpoints in the same session), so it's not something this
plugin can patch around.
* **Voice chat, online-status accuracy** - per your own notes, these are
Fermi/Discord-side issues respectively, not pursued further here.

## Verifying it worked

DevTools (Ctrl+Shift+I) → Network tab, confirm `api/v9`, CDN, and gateway
requests go to `harmony.melodychat.org` hosts. For the destructuring fix
specifically, check sticker images and other users' avatars actually
render instead of showing Discord's "Oops!" placeholder or a broken
image icon.

