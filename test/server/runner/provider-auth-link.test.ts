/** @jest-environment node */
import { providerLinkRequest } from "@/server/runner/provider-contract";
import { TWITCH_REQUIRED_SCOPES } from "@/auth/providers/twitch";

test("streaming consent uses Better Auth linking with combined permissions and a local completion URL", () => {
	const result = providerLinkRequest("twitch", "https://preview.clipify.cloud.thedannicraft.de", "intent");
	expect(result).toMatchObject({ provider: "twitch", disableRedirect: true, scopes: ["channel:read:stream_key", "channel:manage:broadcast"], additionalData: { runnerConnectionIntent: "intent" } });
	expect(result.callbackURL).toBe("https://preview.clipify.cloud.thedannicraft.de/runner/connect/twitch/complete?intent=intent");
	expect(result.errorCallbackURL).toBe(result.callbackURL);
	expect(TWITCH_REQUIRED_SCOPES).not.toContain("channel:read:stream_key");
});
test("YouTube uses Google's existing Better Auth callback and requests durable consent", () => {
	expect(providerLinkRequest("youtube", "https://clipify.us", "intent")).toMatchObject({ provider: "google", scopes: ["https://www.googleapis.com/auth/youtube.force-ssl"], additionalParams: { access_type: "offline", prompt: "consent" } });
});

import { runMcpProbe } from "../../support/mcp/probe";
test.each([
	["production", "twitch"],
	["preview", "twitch"],
	["production", "google"],
	["preview", "google"],
])(
	"real Better Auth %s/%s links the selected account through the stable callback and keeps the session",
	(deployment, provider) => {
		expect(runMcpProbe("runner-auth-link-probe", [deployment, provider], 60000)).toEqual({ preview: deployment === "preview", provider, callback: `https://clipify.us/api/auth/callback/${provider}`, linked: true, sameSession: true });
	},
	65000,
);
