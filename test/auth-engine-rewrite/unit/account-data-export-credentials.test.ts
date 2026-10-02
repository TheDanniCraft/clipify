/** @jest-environment node */

import { encryptString } from "@lib/encryption";
import { collectReusableCredentialExport } from "@/server/account-lifecycle/account-data-export-credentials";

describe("account data export reusable credentials", () => {
	it("includes Clipify-issued overlay, runner, and decrypted stream credentials", () => {
		const result = collectReusableCredentialExport({
			overlays: [
				{ id: "overlay-1", secret: "overlay-secret" },
				{ id: "overlay-without-secret", secret: null },
			],
			runners: [{ id: "runner-1", token: "runner-token" }],
			streamSessions: [{ id: "stream-1", runnerId: "runner-1", overlayId: "overlay-1", rtmpUrl: "rtmp://live.twitch.tv/app", encryptedStreamKey: encryptString("live-stream-key") }],
		});

		expect(result).toEqual({
			overlays: [{ overlayId: "overlay-1", value: "overlay-secret" }],
			runners: [{ runnerId: "runner-1", value: "runner-token" }],
			streamDestinations: [{ streamSessionId: "stream-1", runnerId: "runner-1", overlayId: "overlay-1", rtmpUrl: "rtmp://live.twitch.tv/app", value: "live-stream-key" }],
		});
	});
});
