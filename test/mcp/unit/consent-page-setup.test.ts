/** @jest-environment node */
import type { Page } from "@playwright/test";
import { openConsentPage } from "../../support/consent-page";

test("consent setup waits for policy initialization, not only visible page hydration", async () => {
	let resolve!: (response: unknown) => void;
	const response = { ok: () => true, finished: jest.fn().mockResolvedValue(null) };
	const page = {
		waitForResponse: jest.fn().mockImplementation(
			() =>
				new Promise((ready) => {
					resolve = ready;
				}),
		),
		goto: jest.fn().mockResolvedValue(null),
	};
	let ready = false;
	const opening = openConsentPage(page as unknown as Page).then(() => {
		ready = true;
	});
	await Promise.resolve();
	expect(ready).toBe(false);
	expect(response.finished).not.toHaveBeenCalled();
	resolve(response);
	await opening;
	expect(ready).toBe(true);
	expect(response.finished).toHaveBeenCalled();
	const predicate = page.waitForResponse.mock.calls[0][0] as unknown as (response: unknown) => boolean;
	const candidate = (url: string, method = "GET") => ({ url: () => url, request: () => ({ method: () => method }) });
	expect(predicate(candidate("http://127.0.0.1:3107/api/c15t/init"))).toBe(true);
	expect(predicate(candidate("http://127.0.0.1:3107/api/c15t/init", "POST"))).toBe(false);
	expect(predicate(candidate("https://other.example/api/c15t/init"))).toBe(false);
});

test.each(["http", "body"])("consent initialization failures remain real failures (%s)", async (failure) => {
	const response = { ok: () => failure !== "http", status: () => 503, finished: async () => new Error("body failed") };
	const page = { waitForResponse: async () => response, goto: async () => null };
	await expect(openConsentPage(page as unknown as Page)).rejects.toThrow(failure === "http" ? "Consent initialization failed (503)" : "body failed");
});
