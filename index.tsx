Skip to content
meownyaaa
Equicord-FermiEndpoint
Repository navigation
Code
Pull requests
Actions
Projects
Wiki
Security and quality
Insights
Settings
Equicord-FermiEndpoint/src/equicordplugins/ChangeEndpoint
/
index.tsx
in
main

Edit

Preview
Indent mode

Spaces
Indent size

4
Line wrap mode

No wrap
Editing index.tsx file contents
  1
  2
  3
  4
  5
  6
  7
  8
  9
 10
 11
 12
 13
 14
 15
 16
 17
 18
 19
 20
 21
 22
 23
 24
 25
 26
 27
 28
 29
 30
 31
 32
 33
 34
 35
 36
 37
 38
 39
 40
 41
 42
 43
 44
 45
 46
 47
 48
 49
 50
 51
 52
 53
 54
 55
 56
 57
 58
 59
 60
 61
 62
import definePlugin from "@utils/types";
import { findByPropsLazy, findStore, findStoreLazy } from "@webpack";
import { FluxDispatcher, RestAPI } from "@webpack/common";

import { settings } from "./settings";
import { getApiEndpoint, getCdnHost, getGatewayEndpoint, getMediaProxyEndpoint } from "./utils";

// polls backend's guild_folders, applies them locally, pushes local
// reordering back. Guards against writing not-yet-loaded guild IDs

const GuildActionCreators = findByPropsLazy("moveById", "createGuildFolderLocal");
const GuildStore = findByPropsLazy("getGuild", "getGuilds");

interface HarmonyGuildFolder {
    id: string | null;
    name: string | null;
    guild_ids: string[];
    color: number | null;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastSignature: string | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let pollingStarted = false;

const POLL_INTERVAL = 45 * 1000;

function toHarmonyFolders(): HarmonyGuildFolder[] {
    const SortedGuildStore = findStore("SortedGuildStore");
    const folders = SortedGuildStore.getGuildFolders();

    return folders.map((f: any) => ({
        id: f.folderId ?? null,
        name: f.folderName ?? null,
        guild_ids: f.guildIds,
        color: f.folderColor ?? null
    }));
}

async function pushGuildOrder() {
    try {
        const guild_folders = toHarmonyFolders();
        await RestAPI.patch({
            url: "/users/@me/settings",
            body: { guild_folders }
        });
        lastSignature = JSON.stringify(guild_folders);
    } catch (e) {
        console.error("[ChangeEndpoint] Failed to push guild order", e);
    }
}

function schedulePush() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(pushGuildOrder, 1500);
}

async function applyGuildOrder(folders: HarmonyGuildFolder[]) {
    const totalIds = folders.reduce((n, f) => n + f.guild_ids.filter(Boolean).length, 0);
    const loadedIds = folders.reduce(
        (n, f) => n + f.guild_ids.filter(id => id && GuildStore.getGuild(id)).length,
        0
Use Control + Shift + m to toggle the tab key moving focus. Alternatively, use esc then tab to move to the next interactive element on the page.
 
