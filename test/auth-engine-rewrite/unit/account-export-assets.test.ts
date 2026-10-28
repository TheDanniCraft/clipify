/** @jest-environment node */
import { collectAccountArchiveAssets } from "@/server/account-lifecycle/account-export-assets";

const avatarUrl = "https://static-cdn.jtvnw.net/avatar.png";
const supportUrl = "https://support.example.invalid/attachment";
const originalEnvironment = process.env;
afterEach(() => {
	process.env = originalEnvironment;
	jest.restoreAllMocks();
});
function setup() {
	process.env = { ...originalEnvironment, CHATWOOT_BASE_URL: "https://support.example.invalid" };
	return jest.spyOn(globalThis, "fetch");
}
function account(url = avatarUrl) {
	return { "account/account.json": { profile: { avatar: url } } };
}
function support(url = supportUrl) {
	return { "support/conversations.json": { conversations: [{ messages: [{ attachments: [{ data_url: url, thumb_url: "https://support.example.invalid/thumb" }] }] }] } };
}

test("includes avatar and support bytes once, preserves source URLs and never forwards API credentials", async () => {
	const fetch = setup();
	fetch.mockImplementation(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } }));
	const documents = { ...account(), ...support(), "account/account.json": { profile: { avatar: avatarUrl }, authUsers: [{ image: avatarUrl }], team: { organizations: [{ logo: avatarUrl }] } } };
	const result = await collectAccountArchiveAssets(documents);
	expect(fetch).toHaveBeenCalledTimes(2);
	expect(Object.keys(result.files)).toHaveLength(1);
	expect(result.assets).toEqual(expect.arrayContaining([expect.objectContaining({ sourceUrl: avatarUrl, status: "included", bytes: 3 }), expect.objectContaining({ sourceUrl: supportUrl, status: "included", bytes: 3 })]));
	const profile = documents["account/account.json"].profile as Record<string, unknown>;
	expect(profile.avatar).toBe(avatarUrl);
	expect(profile.avatarFile).toBe(Object.keys(result.files)[0]);
	expect(JSON.stringify(documents)).toContain('"archiveFile"');
	for (const [, options] of fetch.mock.calls) expect(options).toEqual({ redirect: "manual", cache: "no-store", signal: expect.any(AbortSignal) });
});

test.each(["http://static-cdn.jtvnw.net/avatar.png", "https://127.0.0.1/avatar", "https://static-cdn.jtvnw.net.evil.invalid/a", "https://static-cdn.jtvnw.net:8443/a", "https://user:pass@static-cdn.jtvnw.net/a", "not a URL"])("does not request an untrusted avatar URL: %s", async (url) => {
	const fetch = setup();
	const result = await collectAccountArchiveAssets(account(url));
	expect(fetch).not.toHaveBeenCalled();
	expect(result.assets[0].status).toBe("unavailable");
	expect(result.files).toEqual({});
});

test.each(["https://other-product.example.invalid/a", "http://support.example.invalid/a"])("does not request a foreign support attachment: %s", async (url) => {
	const fetch = setup();
	const result = await collectAccountArchiveAssets(support(url));
	expect(fetch).not.toHaveBeenCalled();
	expect(result.assets[0].reason).toBe("untrusted_source");
});

test("support attachments without configured provider access remain listed but are not downloaded", async () => {
	const fetch = setup();
	delete process.env.CHATWOOT_BASE_URL;
	const result = await collectAccountArchiveAssets(support());
	expect(fetch).not.toHaveBeenCalled();
	expect(result.assets[0].reason).toBe("untrusted_source");
});

test.each(["request", "status", "body", "mime", "size header", "stream size", "empty", "timeout"])("records a failed %s download without losing account records", async (failure) => {
	const fetch = setup();
	if (failure === "request") fetch.mockRejectedValue(new Error("PRIVATE PROVIDER DIAGNOSTIC"));
	else if (failure === "status") fetch.mockResolvedValue(new Response("not found", { status: 404 }));
	else if (failure === "body") fetch.mockResolvedValue(new Response(null));
	else if (failure === "stream size") fetch.mockResolvedValue(new Response(new Uint8Array(5 * 1024 * 1024 + 1), { headers: { "content-type": "image/png" } }));
	else fetch.mockResolvedValue(new Response(failure === "empty" ? new Uint8Array() : new Uint8Array([1]), { headers: { "content-type": failure === "mime" ? "text/html" : "image/png", ...(failure === "size header" ? { "content-length": "999999999" } : {}) } }));
	if (failure === "timeout") jest.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort());
	const documents = account();
	const result = await collectAccountArchiveAssets(documents);
	expect(result.assets[0].status).toBe("unavailable");
	expect(documents["account/account.json"].profile.avatar).toBe(avatarUrl);
	expect(result.files).toEqual({});
	expect(JSON.stringify(result)).not.toContain("PRIVATE PROVIDER DIAGNOSTIC");
});

test("unknown attachment types use a safe binary filename and never download thumbnails separately", async () => {
	const fetch = setup();
	fetch.mockResolvedValue(new Response(new Uint8Array([7])));
	const result = await collectAccountArchiveAssets(support());
	expect(Object.keys(result.files)[0]).toMatch(/^support\/attachments\/[a-f0-9]{64}\.bin$/);
	expect(fetch).toHaveBeenCalledTimes(1);
});

test("absent and incomplete asset fields do not create artificial files", async () => {
	const fetch = setup();
	const result = await collectAccountArchiveAssets({ "account/account.json": { profile: { avatar: "" }, authUsers: [null] }, "runner/runner.json": { brandingAssets: [{ bytes: null }, { bytes: { encoding: "text", value: "hello" } }] }, "support/conversations.json": { conversations: [{ messages: [{ attachments: [{ data_url: null }] }] }] } });
	expect(result).toEqual({ files: {}, assets: [] });
	expect(fetch).not.toHaveBeenCalled();
});

test("follows same-provider attachment redirects and rejects redirects to other origins before connecting", async () => {
	const fetch = setup();
	fetch.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/download" } })).mockResolvedValueOnce(new Response(new Uint8Array([4]), { headers: { "content-type": "application/pdf" } }));
	const included = await collectAccountArchiveAssets(support());
	expect(included.assets[0]).toMatchObject({ status: "included", file: expect.stringMatching(/\.pdf$/) });
	expect(String(fetch.mock.calls[1][0])).toBe("https://support.example.invalid/download");
	fetch.mockClear().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }));
	const excluded = await collectAccountArchiveAssets(support());
	expect(excluded.assets[0].reason).toBe("untrusted_source");
	expect(fetch).toHaveBeenCalledTimes(1);
});

test.each(["loop", "missing location"])("an attachment redirect %s is recorded as unavailable", async (failure) => {
	const fetch = setup();
	fetch.mockImplementation(async () => new Response(null, { status: 302, headers: failure === "loop" ? { location: "/loop" } : {} }));
	const result = await collectAccountArchiveAssets(support());
	expect(result.assets[0].reason).toBe("redirect_failed");
	expect(fetch).toHaveBeenCalledTimes(failure === "loop" ? 4 : 1);
});
