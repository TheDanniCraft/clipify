import { clearRevokedConsentStorage } from "@lib/consent/cleanup";

describe("consent revocation cleanup", () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
		document.cookie = "cw_conversation=; Max-Age=0; Path=/";
	});

	it("preserves support state while functionality remains allowed", () => {
		localStorage.setItem("chatwoot_available_agents", "cached");
		clearRevokedConsentStorage({ functionality: true });
		expect(localStorage.getItem("chatwoot_available_agents")).toBe("cached");
	});

	it("removes Chatwoot first-party state after functionality is revoked", () => {
		localStorage.setItem("chatwoot_available_agents", "cached");
		localStorage.setItem("unrelated", "keep");
		sessionStorage.setItem("cw_session", "cached");
		document.cookie = "cw_conversation=test; Path=/";
		clearRevokedConsentStorage({ functionality: false });
		expect(localStorage.getItem("chatwoot_available_agents")).toBeNull();
		expect(localStorage.getItem("unrelated")).toBe("keep");
		expect(sessionStorage.getItem("cw_session")).toBeNull();
		expect(document.cookie).not.toContain("cw_conversation");
	});
});
