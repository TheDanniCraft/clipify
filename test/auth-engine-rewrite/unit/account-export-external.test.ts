/** @jest-environment node */
const fetchRequest = jest.fn();
jest.mock("usesend-js", () => ({ UseSend: jest.fn().mockImplementation(() => ({ fetchRequest })) }));
import { collectExternalAccountData } from "@/server/account-lifecycle/account-export-external";
const saved = { ...process.env };
afterEach(() => {
	process.env = { ...saved };
	jest.clearAllMocks();
});

test("reports unavailable external data explicitly without a provider call when no key is configured", async () => {
	delete process.env.USESEND_API_KEY;
	const result = await collectExternalAccountData(["owner@example.com"]);
	expect(result.newsletter.status).toBe("not_configured");
	expect(result.support.status).toBe("external_request_required");
	expect(fetchRequest).not.toHaveBeenCalled();
});
test("exports only matching newsletter records even if the provider returns unrelated contacts", async () => {
	Object.assign(process.env, { USESEND_BASE_URL: "https://mail.example.invalid/", USESEND_API_KEY: "fixture-key", USESEND_CONTACT_BOOK_ID: "book", USESEND_PRODUCT_UPDATES_CONTACT_BOOK_ID: "book" });
	fetchRequest.mockResolvedValue({
		data: [
			{ id: "own", email: "Owner@Example.com", subscribed: false },
			{ id: "foreign", email: "another@example.com" },
		],
	});
	const result = await collectExternalAccountData(["owner@example.com", "OWNER@example.com"]);
	expect(result.newsletter.status).toBe("included");
	expect(result.newsletter.contacts).toEqual([{ id: "own", email: "Owner@Example.com", subscribed: false }]);
	expect(fetchRequest).toHaveBeenCalledTimes(1);
	expect(fetchRequest).toHaveBeenCalledWith(expect.stringContaining("emails=owner%40example.com"), expect.objectContaining({ method: "GET", redirect: "error", signal: expect.any(AbortSignal) }));
});
test("keeps the local package available and labels provider failure without leaking diagnostic secrets", async () => {
	Object.assign(process.env, { USESEND_BASE_URL: "https://mail.example.invalid", USESEND_API_KEY: "fixture-key", USESEND_CONTACT_BOOK_ID: "book" });
	fetchRequest.mockRejectedValue(new Error("private-provider-debug-info"));
	const result = await collectExternalAccountData(["owner@example.com"]);
	expect(result.newsletter.status).toBe("unavailable");
	expect(JSON.stringify(result)).not.toContain("private-provider-debug-info");
});

test("deduplicates matching contacts across books and labels malformed provider responses", async () => {
	Object.assign(process.env, { USESEND_BASE_URL: "https://mail.example.invalid", USESEND_API_KEY: "fixture-key", USESEND_CONTACT_BOOK_ID: "book", USESEND_PRODUCT_UPDATES_CONTACT_BOOK_ID: "other-book" });
	fetchRequest.mockResolvedValue({
		data: [
			{ id: "own", email: "owner@example.com" },
			{ id: "invalid", email: null },
		],
	});
	const result = await collectExternalAccountData(["owner@example.com"]);
	expect(result.newsletter.contacts).toEqual([{ id: "own", email: "owner@example.com" }]);
	fetchRequest.mockResolvedValueOnce({ error: { message: "provider unavailable" } });
	expect((await collectExternalAccountData(["owner@example.com"])).newsletter.status).toBe("unavailable");
});
