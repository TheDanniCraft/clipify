/** @jest-environment node */
const fetchRequest = jest.fn();
jest.mock("usesend-js", () => ({ UseSend: jest.fn().mockImplementation(() => ({ fetchRequest })) }));
import { collectExternalAccountData } from "@/server/account-lifecycle/account-export-external";
const saved = { ...process.env };
beforeEach(() => {
	delete process.env.CHATWOOT_BASE_URL;
	delete process.env.CHATWOOT_ACCOUNT_ID;
	delete process.env.CHATWOOT_API_TOKEN;
	delete process.env.CHATWOOT_INBOX_IDS;
});
afterEach(() => {
	process.env = { ...saved };
	jest.clearAllMocks();
	jest.restoreAllMocks();
});

test("reports unavailable external data explicitly without a provider call when no key is configured", async () => {
	delete process.env.USESEND_API_KEY;
	const result = await collectExternalAccountData(["owner@example.com"], "creator");
	expect(result.newsletter.status).toBe("not_configured");
	expect(result.support).toBeUndefined();
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
	const result = await collectExternalAccountData(["owner@example.com", "OWNER@example.com"], "creator");
	expect(result.newsletter.status).toBe("included");
	expect(result.newsletter.contacts).toEqual([{ id: "own", email: "Owner@Example.com", subscribed: false }]);
	expect(fetchRequest).toHaveBeenCalledTimes(1);
	expect(fetchRequest).toHaveBeenCalledWith(expect.stringContaining("emails=owner%40example.com"), expect.objectContaining({ method: "GET", redirect: "error", signal: expect.any(AbortSignal) }));
});
test("keeps the local package available and labels provider failure without leaking diagnostic secrets", async () => {
	Object.assign(process.env, { USESEND_BASE_URL: "https://mail.example.invalid", USESEND_API_KEY: "fixture-key", USESEND_CONTACT_BOOK_ID: "book" });
	fetchRequest.mockRejectedValue(new Error("private-provider-debug-info"));
	const result = await collectExternalAccountData(["owner@example.com"], "creator");
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
	const result = await collectExternalAccountData(["owner@example.com"], "creator");
	expect(result.newsletter.contacts).toEqual([{ id: "own", email: "owner@example.com" }]);
	fetchRequest.mockResolvedValueOnce({ error: { message: "provider unavailable" } });
	expect((await collectExternalAccountData(["owner@example.com"], "creator")).newsletter.status).toBe("unavailable");
});

function configureSupport() {
	Object.assign(process.env, { CHATWOOT_BASE_URL: "https://support.example.invalid", CHATWOOT_ACCOUNT_ID: "1", CHATWOOT_API_TOKEN: "private-chatwoot-key", CHATWOOT_INBOX_IDS: "1,2" });
	delete process.env.USESEND_API_KEY;
	return jest.spyOn(globalThis, "fetch");
}
const supportContact = { contact_inboxes: [{ inbox: { id: 1 } }], id: 7, identifier: "creator", email: "owner@example.com", name: "Owner" };
const supportConversation = { inbox_id: 1, id: 19, status: "resolved", created_at: 1700000000, meta: { sender: { id: 7 } }, messages: [{ content: "PRIVATE EMBEDDED MESSAGE" }] };
const supportMessage = { id: 30, conversation_id: 19, private: false, message_type: 0, content: "My support question", created_at: 1700000000 };
function supportReplies(url: string) {
	const u = new URL(url);
	const page = u.searchParams.get("page");
	if (u.pathname.endsWith("/contacts/filter")) return { meta: { count: 1 }, payload: page === "1" ? [{ ...supportContact }] : [] };
	if (u.pathname.endsWith("/conversations/filter")) return { meta: { all_count: 1 }, payload: page === "1" ? [{ ...supportConversation, meta: { sender: { id: 7 } } }] : [] };
	if (u.pathname.endsWith("/messages")) return { meta: { contact: { id: 7 } }, payload: u.searchParams.has("before") ? [] : [{ ...supportMessage }] };
	throw new Error("Unexpected support API call");
}
function mockSupport(fetch: jest.SpyInstance, transform: (data: any, url: string) => any = (data) => data) {
	fetch.mockImplementation(async (input) => {
		const url = String(input);
		return new Response(JSON.stringify(transform(supportReplies(url), url)), { status: 200 });
	});
}

test("exports actual support conversations and message history instead of a placeholder", async () => {
	const fetch = configureSupport();
	mockSupport(fetch, (data, url) => {
		if (url.includes("/messages") && !url.includes("before="))
			data.payload = [
				supportMessage,
				{ ...supportMessage, id: 31, private: true, content: "PRIVATE AGENT NOTE" },
				{ ...supportMessage, id: 32, message_type: 2, content: "INTERNAL ACTIVITY" },
				{ ...supportMessage, id: 33, message_type: 1, content: "Our reply", sender: { id: 3, name: "Support", email: "PRIVATE AGENT EMAIL", access_token: "PRIVATE AGENT TOKEN" }, attachments: [{ id: 2, file_type: "image", data_url: "https://support.example.invalid/attachment.png", file_size: 5, private_field: "PRIVATE ATTACHMENT FIELD" }] },
			];
		if (url.includes("before=30")) data.payload = [{ ...supportMessage, id: 29, content: "Earlier question" }];
		return data;
	});
	const result = await collectExternalAccountData(["owner@example.com"], "creator");
	expect(result.support).toMatchObject({
		status: "included",
		contacts: [{ id: 7, identifier: "creator" }],
		conversations: [
			{
				id: 19,
				messages: [
					{ id: 29, content: "Earlier question" },
					{ id: 30, content: "My support question" },
					{ id: 33, content: "Our reply" },
				],
			},
		],
	});
	const text = JSON.stringify(result);
	for (const secret of ["PRIVATE", "private-chatwoot-key", "held in Chatwoot", "external_request_required"]) expect(text).not.toContain(secret);
	const conversationRequest = fetch.mock.calls.find(([url]) => String(url).includes("/conversations/filter"));
	expect(JSON.parse(String(conversationRequest?.[1]?.body))).toEqual({
		payload: [
			{ attribute_key: "contact_id", filter_operator: "equal_to", values: [7], query_operator: "AND" },
			{ attribute_key: "inbox_id", filter_operator: "equal_to", values: [1, 2], query_operator: null },
		],
	});
	const olderPage = fetch.mock.calls.find(([url]) => String(url).includes("before=30"));
	expect(olderPage?.[1]).toEqual(expect.objectContaining({ redirect: "error", cache: "no-store", signal: expect.any(AbortSignal) }));
});

test("does not export contacts with conflicting account identifiers or emails", async () => {
	const fetch = configureSupport();
	mockSupport(fetch, (data, url) => {
		if (url.includes("/contacts/filter") && url.includes("page=1")) data.payload = [supportContact, { ...supportContact, id: 8, identifier: "foreign" }, { ...supportContact, id: 9, email: "foreign@example.com" }, { id: 10 }];
		return data;
	});
	const result = await collectExternalAccountData(["OWNER@example.com"], "creator");
	expect(result.support?.contacts.map((contact) => contact.id)).toEqual([7]);
});

test("an empty support history contains empty data arrays and no explanatory placeholder", async () => {
	const fetch = configureSupport();
	fetch.mockResolvedValue(new Response(JSON.stringify({ meta: { count: 0 }, payload: [] })));
	const result = await collectExternalAccountData(["owner@example.com"], "creator");
	expect(result.support).toEqual({ status: "included", contacts: [], conversations: [] });
});

test.each(["credentials", "response", "contact", "conversation", "message", "pagination", "contact pagination", "conversation pagination", "message contact", "conversation inbox"])("fails closed for a support %s failure instead of producing a partial-looking export", async (failure) => {
	const fetch = configureSupport();
	mockSupport(fetch, (data, url) => {
		if (failure === "contact" && url.includes("contacts/filter")) return { payload: "invalid" };
		if (failure === "conversation" && url.includes("conversations/filter") && data.payload.length) data.payload[0].meta.sender.id = 8;
		if (failure === "message" && url.includes("/messages") && data.payload.length) data.payload[0].conversation_id = 20;
		if (failure === "pagination" && url.includes("/messages")) data.payload = [supportMessage];
		if (failure === "contact pagination" && url.includes("contacts/filter")) data.payload = [{ ...supportContact }];
		if (failure === "conversation pagination" && url.includes("conversations/filter")) data.payload = [{ ...supportConversation, meta: { sender: { id: 7 } } }];
		if (failure === "message contact" && url.includes("/messages")) data.meta.contact.id = 8;
		if (failure === "conversation inbox" && url.includes("conversations/filter") && data.payload.length) data.payload[0].inbox_id = 9;
		return data;
	});
	if (failure === "credentials") delete process.env.CHATWOOT_ACCOUNT_ID;
	if (failure === "response") fetch.mockResolvedValue(new Response("PRIVATE ERROR", { status: 403 }));
	await expect(collectExternalAccountData(["owner@example.com"], "creator")).rejects.toThrow("CHATWOOT_EXPORT_UNAVAILABLE");
});

test("email-only support contacts are included only for a verified account email", async () => {
	const fetch = configureSupport();
	mockSupport(fetch, (data, url) => {
		if (url.includes("contacts/filter") && data.payload.length) data.payload[0].identifier = null;
		return data;
	});
	expect((await collectExternalAccountData(["owner@example.com"], "creator")).support?.conversations).toHaveLength(1);
});

test("unverified email addresses cannot be used to locate support history", async () => {
	const fetch = configureSupport();
	mockSupport(fetch);
	expect((await collectExternalAccountData([], "creator")).support).toEqual({ status: "included", contacts: [], conversations: [] });
	const filter = JSON.parse(fetch.mock.calls[0][1]!.body as string);
	expect(filter.payload).toEqual([{ attribute_key: "identifier", filter_operator: "equal_to", values: ["creator"], query_operator: null }]);
});

test.each(["http://support.example.invalid", "invalid-url"])("does not send the support API token to invalid base URL %s", async (base) => {
	const fetch = configureSupport();
	process.env.CHATWOOT_BASE_URL = base;
	await expect(collectExternalAccountData(["owner@example.com"], "creator")).rejects.toThrow("CHATWOOT_EXPORT_UNAVAILABLE");
	expect(fetch).not.toHaveBeenCalled();
});

test("contacts belonging only to another product's inbox are not exported", async () => {
	const fetch = configureSupport();
	mockSupport(fetch, (data, url) => {
		if (url.includes("contacts/filter") && data.payload.length) data.payload[0].contact_inboxes = [{ inbox: { id: 9 } }];
		return data;
	});
	expect((await collectExternalAccountData(["owner@example.com"], "creator")).support).toEqual({ status: "included", contacts: [], conversations: [] });
	expect(fetch.mock.calls.some(([url]) => String(url).includes("conversations"))).toBe(false);
});
