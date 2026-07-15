/**
 * changeEndpoint - Vencord/Equicord userplugin
 */

import definePlugin from "@utils/types";
import { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";

const FERMI_API_ENDPOINT = "//api.harmony.melodychat.org/api";
const FERMI_CDN_HOST = "cdn.harmony.melodychat.org";
const FERMI_GATEWAY_ENDPOINT = "wss://gateway.harmony.melodychat.org";
const FERMI_MEDIA_PROXY_ENDPOINT = "//cdn.harmony.melodychat.org";

export const settings = definePluginSettings({
    disableQuests: {
        type: OptionType.BOOLEAN,
        description: "Block Quests requests (/quests/*) and hide the Quests button",
        default: false,
        onChange: () => rebuildHiddenButtonsCSS()
    },
    disableShop: {
        type: OptionType.BOOLEAN,
        description: "Block Shop/SKU requests (/store/published-listings/skus) and hide the Shop button",
        default: false,
        onChange: () => rebuildHiddenButtonsCSS()
    },
    disablePowerups: {
        type: OptionType.BOOLEAN,
        description: "Block server boost Powerups requests (/guilds/:id/powerups)",
        default: false
    },
    disableGameDetection: {
        type: OptionType.BOOLEAN,
        description: "Block game-activity detection requests (detectables/games.json, non-games.json, /games/detectable/exclusions)",
        default: false
    },
    disablePromotions: {
        type: OptionType.BOOLEAN,
        description: "Block promotions requests (/promotions)",
        default: false
    },
    disableExternalAssets: {
        type: OptionType.BOOLEAN,
        description: "Block application external-assets requests (/applications/:id/external-assets)",
        default: false
    }
});

// These don't work right now btw
const BLOCKED_ENDPOINTS: Array<[keyof typeof settings.store, RegExp]> = [
    ["disableQuests", /\/api\/v9\d+\/quests\//],
    ["disableShop", /\/api\/v9\d+\/store\/published-listings\/skus/],
    ["disablePowerups", /\/api\/v9\d+\/guilds\/\d+\/powerups/],
    ["disableGameDetection", /\/detectables\/(games|non-games)\.json|\/api\/v\d+\/games\/detectable\/exclusions/],
    ["disablePromotions", /\/api\/v9\d+\/promotions/],
    ["disableExternalAssets", /\/api\/v9\d+\/applications\/\d+\/external-assets/]
];

const HIDEABLE_BUTTON_CSS: Partial<Record<keyof typeof settings.store, string>> = {
    disableQuests: '[data-list-item-id*="___quests"]',
    disableShop: '[data-list-item-id*="___shop"]'
};

let origFetch: typeof window.fetch | null = null;
let styleEl: HTMLStyleElement | null = null;

function rebuildHiddenButtonsCSS() {
    if (!styleEl) return;
    const selectors = Object.entries(HIDEABLE_BUTTON_CSS)
        .filter(([key]) => settings.store[key as keyof typeof settings.store])
        .map(([, selector]) => selector);
    styleEl.textContent = selectors.length
        ? `${selectors.join(",")} { display: none !important; }`
        : "";
}

export default definePlugin({
    name: "changeEndpoint",
    description: "Redirects Discord API/CDN/Gateway traffic to fermi.chat's Harmony backend by default",
    authors: [],
    required: true,
    settings,

    start() {
        origFetch = window.fetch.bind(window);
        window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === "string"
                ? input
                : input instanceof URL
                    ? input.toString()
                    : input.url;

            for (const [key, pattern] of BLOCKED_ENDPOINTS) {
                if (settings.store[key] && pattern.test(url)) {
                    return Promise.resolve(new Response(null, { status: 404, statusText: "Not Found" }));
                }
            }

            return origFetch!(input as any, init);
        };

        styleEl = document.createElement("style");
        styleEl.id = "vc-fermiendpoint-hidden-buttons";
        document.head.appendChild(styleEl);
        rebuildHiddenButtonsCSS();
    },

    stop() {
        if (origFetch) window.fetch = origFetch;
        styleEl?.remove();
        styleEl = null;
    },

    patches: [
        {
            find: "window.GLOBAL_ENV.API_ENDPOINT",
            all: true,
            replacement: {
                match: /window\.GLOBAL_ENV\.API_ENDPOINT/g,
                replace: () => JSON.stringify(FERMI_API_ENDPOINT)
            }
        },
        {
            find: "window.GLOBAL_ENV.CDN_HOST",
            all: true,
            replacement: {
                match: /window\.GLOBAL_ENV\.CDN_HOST/g,
                replace: () => JSON.stringify(FERMI_CDN_HOST)
            }
        },
        {
            find: "window.GLOBAL_ENV.GATEWAY_ENDPOINT",
            all: true,
            replacement: {
                match: /window\.GLOBAL_ENV\.GATEWAY_ENDPOINT/g,
                replace: () => JSON.stringify(FERMI_GATEWAY_ENDPOINT)
            }
        },
        {
            find: "window.GLOBAL_ENV.MEDIA_PROXY_ENDPOINT",
            all: true,
            replacement: {
                match: /window\.GLOBAL_ENV\.MEDIA_PROXY_ENDPOINT/g,
                replace: () => JSON.stringify(FERMI_MEDIA_PROXY_ENDPOINT)
            }
        },
        {
            find: "isDiscordGatewayPlaintextSet(){return!1}",
            replacement: {
                match: /isDiscordGatewayPlaintextSet\(\)\{return!1\}/,
                replace: "isDiscordGatewayPlaintextSet(){return!0}"
            }
        },
        {
            find: "Error getting provider for API request:",
            replacement: {
                match: /function (\w+)\(\)\{try\{return \w+\.getConfig\(\{location:"gif_picker"\}\)\.provider\}catch\(\w+\)\{return \w+\.warn\("Error getting provider for API request:",\w+\),"tenor"\}\}/,
                replace: 'function $1(){return"klipy"}'
            }
        },
        {
            find: "}=window.GLOBAL_ENV",
            all: true,
            replacement: {
                match: /\{([\w:,]+)\}=window\.GLOBAL_ENV/g,
                replace: (fullMatch: string, pairsStr: string) => {
                    const overrides: Record<string, string> = {
                        API_ENDPOINT: FERMI_API_ENDPOINT,
                        CDN_HOST: FERMI_CDN_HOST,
                        GATEWAY_ENDPOINT: FERMI_GATEWAY_ENDPOINT,
                        MEDIA_PROXY_ENDPOINT: FERMI_MEDIA_PROXY_ENDPOINT
                    };
                    const keysPresent = pairsStr.split(",")
                        .map(pair => pair.split(":")[0])
                        .filter(key => overrides[key]);

                    if (keysPresent.length === 0) return fullMatch;

                    const overrideObjLiteral = "{" +
                        keysPresent.map(key => `${key}:${JSON.stringify(overrides[key])}`).join(",") +
                        "}";

                    return fullMatch.replace(
                        "window.GLOBAL_ENV",
                        `Object.assign({},window.GLOBAL_ENV,${overrideObjLiteral})`
                    );
                }
            }
        }
    ]
});
