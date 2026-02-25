const fs = require('fs');
const path = require('path');
const statusManager = require('./statusManager');

const DATA_DIR = path.join(__dirname, '..', 'data');
const RPC_FILE = path.join(DATA_DIR, 'rpc.json');

const defaultData = {
    enabled: false,
    type: 'STREAMING',
    name: '.gg/stackss',
    applicationId: '',
    details: '',
    state: '',
    largeImage: '',
    largeText: '',
    smallImage: '',
    smallText: '',
    button1Text: '',
    button1Url: '',
    button2Text: '',
    button2Url: '',
    startTimestamp: 0
};

function loadData() {
    if (!fs.existsSync(RPC_FILE)) return defaultData;
    try {
        const loaded = JSON.parse(fs.readFileSync(RPC_FILE, 'utf8'));
        return { ...defaultData, ...loaded };
    } catch (e) { return defaultData; }
}

function saveData(data) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    // Calculate Absolute Epoch for Timer Persistence
    // This anchors the "Elapsed" timer so it doesn't reset on bot restarts
    const offset = parseInt(data.startTimestamp);
    if (!isNaN(offset) && offset > 0) {
        // Current Time - User's Offset (e.g. 21 hours) = The Timestamp when it "Started"
        data.epochTimestamp = Date.now() - offset;
    } else {
        delete data.epochTimestamp; // Remove if invalid/zero
    }

    fs.writeFileSync(RPC_FILE, JSON.stringify(data, null, 2));
}

async function setPresence(client, data) {
    if (!client.user) return;

    try {
        const activities = [];

        // 1. RPC Activity
        if (data.enabled) {
            const rpcActivity = {
                type: data.type.toUpperCase(),
                application_id: data.applicationId || client.user.id,
                name: data.name || 'stackss',
                details: data.details || undefined,
                state: data.state || undefined,
                assets: {},
                buttons: [],
                metadata: { button_urls: [] }
            };

            if (data.type.toUpperCase() === 'STREAMING') {
                rpcActivity.url = 'https://twitch.tv/renstackss';
            }

            // Timestamp Logic (Fixed Persistence)
            // Use the saved Epoch timestamp if available, otherwise fallback (legacy behavior)
            if (data.epochTimestamp && data.epochTimestamp > 0) {
                rpcActivity.timestamps = { start: data.epochTimestamp };
            } else if (data.startTimestamp > 0) {
                // Fallback for old configs: Calculate temporary epoch
                rpcActivity.timestamps = { start: Date.now() - parseInt(data.startTimestamp) };
            }

            if (data.largeImage) {
                rpcActivity.assets.large_image = data.largeImage;
                if (data.largeText) rpcActivity.assets.large_text = data.largeText;
            }
            if (data.smallImage) {
                rpcActivity.assets.small_image = data.smallImage;
                if (data.smallText) rpcActivity.assets.small_text = data.smallText;
            }
            if (Object.keys(rpcActivity.assets).length === 0) delete rpcActivity.assets;

            const isValidUrl = (url) => url && (url.startsWith('http://') || url.startsWith('https://'));
            if (data.button1Text && isValidUrl(data.button1Url)) {
                rpcActivity.buttons.push(data.button1Text);
                rpcActivity.metadata.button_urls.push(data.button1Url);
            }
            if (data.button2Text && isValidUrl(data.button2Url)) {
                rpcActivity.buttons.push(data.button2Text);
                rpcActivity.metadata.button_urls.push(data.button2Url);
            }
            if (rpcActivity.buttons.length === 0) {
                delete rpcActivity.buttons;
                delete rpcActivity.metadata;
            }
            activities.push(rpcActivity);
        }

        // 2. Custom Status Activity
        const statusData = statusManager.loadData();
        const statusActivity = statusManager.getStatusActivity(statusData);
        if (statusActivity) {
            activities.push(statusActivity);
        }

        // 3. Set Presence
        await client.user.setPresence({
            status: statusData.status || 'online',
            activities: activities
        });

    } catch (e) {
        console.error("[RPC] Error setting presence:", e);
    }
}

module.exports = {
    loadData,
    saveData,
    setPresence,
    initialize: async (client) => {
        const data = loadData();
        await setPresence(client, data);
    }
};
