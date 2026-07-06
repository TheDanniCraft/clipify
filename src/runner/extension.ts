import fs from "fs";
import path from "path";

export function writeExtension(dir: string) {
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, "manifest.json"), `{
	"name": "Video Capture",
	"version": "0.1.0",
	"key": "ackedhmjjinfocdcekpnbdocpmiffaac",
	"manifest_version": 3,
	"sockets": {
		"tcp": { "connect": ["*"] }
	},
	"permissions": ["tabs", "tabCapture", "storage", "scripting", "sockets.udp", "sockets.tcp"],
	"host_permissions": ["*://*/*", "<all_urls>", "https://*/*", "http://*/*"],
	"action": { "default_title": "Video Capture" },
	"background": { "service_worker": "background.js" },
	"options_page": "options.html",
	"commands": {
		"invoke-action": {
			"suggested_key": {
				"default": "Ctrl+Shift+Y",
				"mac": "Command+Shift+Y"
			},
			"description": "Invoke extension for current tab"
		}
	}
}
`);
	fs.writeFileSync(path.join(dir, "background.js"), `chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'invoke-action')
        return; // noop to fix (Extension has not been invoked for the current page (see activeTab permission))
});
`);
	fs.writeFileSync(path.join(dir, "options.html"), `<script type="module" src="options.js"></script>
`);
	fs.writeFileSync(path.join(dir, "options.js"), `const recorders = {};
const START_RECORDING = async ({ index, video, audio, frameSize, audioBitsPerSecond, videoBitsPerSecond, bitsPerSecond, mimeType, videoConstraints, audioConstraints, delay, tabId, }) => {
    console.log("[PUPPETEER_STREAM] START_RECORDING", JSON.stringify({
        index,
        video,
        audio,
        frameSize,
        audioBitsPerSecond,
        videoBitsPerSecond,
        bitsPerSecond,
        mimeType,
        videoConstraints,
        audioConstraints,
        tabId,
    }));
    const client = new WebSocket(\`ws://localhost:\${window.location.hash.substring(1)}/?index=\${index}\`, []);
    await new Promise((resolve) => {
        if (client.readyState === WebSocket.OPEN)
            resolve();
        client.addEventListener("open", () => resolve());
    });
    const stream = await new Promise((resolve, reject) => {
        chrome.tabCapture.capture({
            audio,
            video,
            audioConstraints,
            videoConstraints,
        }, (stream) => {
            var _a;
            if (chrome.runtime.lastError || !stream) {
                reject((_a = chrome.runtime.lastError) === null || _a === void 0 ? void 0 : _a.message);
            }
            else {
                resolve(stream);
            }
        });
    });
    // somtimes needed to sync audio and video
    if (delay)
        await new Promise((resolve) => setTimeout(resolve, delay));
    const recorder = new MediaRecorder(stream, {
        audioBitsPerSecond,
        videoBitsPerSecond,
        bitsPerSecond,
        mimeType,
    });
    let pendingOperations = 0;
    let stopCalled = false;
    recorder.ondataavailable = async (e) => {
        if (!e.data.size)
            return;
        pendingOperations++;
        try {
            const buffer = await e.data.arrayBuffer();
            client.send(buffer);
        }
        catch (err) { }
        pendingOperations--;
        if (stopCalled && pendingOperations === 0) {
            if (client.readyState === WebSocket.OPEN)
                client.close();
        }
    };
    recorders[index] = recorder;
    // TODO: recorder onerror
    recorder.onerror = () => recorder.stop();
    recorder.onstop = function () {
        try {
            const tracks = stream.getTracks();
            tracks.forEach(function (track) {
                track.stop();
            });
            stopCalled = true;
            if (pendingOperations === 0) {
                if (client.readyState === WebSocket.OPEN)
                    client.close();
            }
        }
        catch (error) { }
    };
    stream.onremovetrack = () => {
        try {
            recorder.stop();
        }
        catch (error) { }
    };
    recorder.start(frameSize);
};
const STOP_RECORDING = async (index) => {
    console.log("[PUPPETEER_STREAM] STOP_RECORDING", index);
    if (!recorders[index])
        return;
    if (recorders[index].state === "inactive")
        return;
    recorders[index].stop();
};
globalThis.START_RECORDING = START_RECORDING;
globalThis.STOP_RECORDING = STOP_RECORDING;
export {};
`);
}
