import { reloadAfterConsentSave } from "@/app/lib/consent/reload";

describe("reloadAfterConsentSave", () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
		document.cookie = "cw_conversation=conversation; Path=/";
	});

	it("reloads after newly granted consent", () => {
		const reload = jest.fn();

		reloadAfterConsentSave({ functionality: true, measurement: true }, reload);

		expect(reload).toHaveBeenCalledTimes(1);
	});

	it("clears Chatwoot state before reloading after revocation", () => {
		const reload = jest.fn();
		localStorage.setItem("chatwoot_session", "local");
		sessionStorage.setItem("cw_session", "session");

		reloadAfterConsentSave({ functionality: false, measurement: false }, reload);

		expect(document.cookie).not.toContain("cw_conversation=");
		expect(localStorage.getItem("chatwoot_session")).toBeNull();
		expect(sessionStorage.getItem("cw_session")).toBeNull();
		expect(reload).toHaveBeenCalledTimes(1);
	});
});
