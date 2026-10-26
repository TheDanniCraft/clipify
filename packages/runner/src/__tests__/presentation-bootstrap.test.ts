import * as transport from "../presentation-bootstrap";

const sessionId = "8b01b0e0-a941-4a3d-804b-823d2c5a54d5";
const executionGeneration = "261e5175-a2d2-4c98-88fa-3e39df3f6323";
test("TDD-US4-CON012: native bootstrap keeps the credential in a scoped session cookie, outside the navigation URL", async () => {
	const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ url: `/runner/presentation/${sessionId}`, expiresAt: 1600000 }), { status: 200, headers: { "set-cookie": `clipify_runner_presentation=signed-credential; Path=/runner/presentation/${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=600` } }));
	const bootstrap = Reflect.get(transport, "requestRunnerPresentation");
	expect(bootstrap).toEqual(expect.any(Function));
	if (typeof bootstrap !== "function") return;
	const result = await bootstrap({ apiBase: "https://clipify.example", runnerToken: "private-runner-token", sessionId, executionGeneration, fetcher });
	expect(fetcher).toHaveBeenCalledWith("https://clipify.example/api/runner/presentation", expect.objectContaining({ method: "POST", headers: { authorization: "Bearer private-runner-token", "content-type": "application/json" }, body: JSON.stringify({ sessionId, executionGeneration }), redirect: "error", signal: expect.any(AbortSignal) }));
	expect(result).toEqual({ url: `https://clipify.example/runner/presentation/${sessionId}`, cookie: { name: "clipify_runner_presentation", value: "signed-credential", domain: "clipify.example", path: `/runner/presentation/${sessionId}`, httpOnly: true, secure: true, sameSite: "Strict" } });
	expect(result?.cookie).not.toHaveProperty("expires");
});

test("TDD-US4-CON012: malformed assignment identifiers never send a credential-bearing bootstrap request", async () => {
	const fetcher = jest.fn().mockResolvedValue(new Response(null, { status: 403 }));
	const bootstrap = Reflect.get(transport, "requestRunnerPresentation");
	expect(await bootstrap({ apiBase: "https://clipify.example", runnerToken: "private-runner-token", sessionId: "../../overlay/foreign", executionGeneration, fetcher })).toBeNull();
	expect(fetcher).not.toHaveBeenCalled();
});

const validCookie = `clipify_runner_presentation=signed-credential; Path=/runner/presentation/${sessionId}; HttpOnly; Secure; SameSite=Strict`;
test.each([
	{ label: "foreign origin", url: `https://foreign.example/runner/presentation/${sessionId}`, cookie: validCookie },
	{ label: "different session", url: "/runner/presentation/17507e1a-6336-4e5a-8f4c-013fab416b58", cookie: validCookie },
	{ label: "missing credential", url: `/runner/presentation/${sessionId}`, cookie: undefined },
	{ label: "wrong cookie path", url: `/runner/presentation/${sessionId}`, cookie: validCookie.replace(`/runner/presentation/${sessionId}`, "/") },
	{ label: "script-readable credential", url: `/runner/presentation/${sessionId}`, cookie: validCookie.replace("; HttpOnly", "") },
	{ label: "cross-site credential", url: `/runner/presentation/${sessionId}`, cookie: validCookie.replace("SameSite=Strict", "SameSite=None") },
	{ label: "insecure HTTPS credential", url: `/runner/presentation/${sessionId}`, cookie: validCookie.replace("; Secure", "") },
	{ label: "wrong credential name", url: `/runner/presentation/${sessionId}`, cookie: validCookie.replace("clipify_runner_presentation=", "unrelated=") },
])("TDD-US4-CON012: native transport rejects $label without exposing a navigation", async ({ url, cookie }) => {
	const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ url }), { status: 200, headers: cookie ? { "set-cookie": cookie } : {} }));
	expect(await transport.requestRunnerPresentation({ apiBase: "https://clipify.example", runnerToken: "private-runner-token", sessionId, executionGeneration, fetcher })).toBeNull();
});

test.each(["not-a-url", "ftp://clipify.example", "https://user:password@clipify.example", "https://clipify.example/prefix", "https://clipify.example?foreign=true", "https://clipify.example#foreign"])("TDD-US4-CON012: invalid API base %s never receives the Runner credential", async (apiBase) => {
	const fetcher = jest.fn();
	expect(await transport.requestRunnerPresentation({ apiBase, runnerToken: "private-runner-token", sessionId, executionGeneration, fetcher })).toBeNull();
	expect(fetcher).not.toHaveBeenCalled();
});

test("TDD-US4-CON012: loopback HTTP keeps a scoped session cookie without claiming transport security", async () => {
	const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ url: `/runner/presentation/${sessionId}` }), { status: 200, headers: { "set-cookie": validCookie.replace("; Secure", "") } }));
	const result = await transport.requestRunnerPresentation({ apiBase: "http://127.0.0.1:3107", runnerToken: "private-runner-token", sessionId, executionGeneration, fetcher });
	expect(result?.url).toBe(`http://127.0.0.1:3107/runner/presentation/${sessionId}`);
	expect(result?.cookie).toMatchObject({ domain: "127.0.0.1", secure: false, httpOnly: true, path: `/runner/presentation/${sessionId}` });
	expect(result?.cookie).not.toHaveProperty("expires");
});

test("TDD-US4-CON012: unavailable, malformed and interrupted bootstrap responses return a normal refusal", async () => {
	const fetcher = jest
		.fn()
		.mockResolvedValueOnce(new Response(null, { status: 503 }))
		.mockResolvedValueOnce(new Response("not-json", { status: 200 }))
		.mockResolvedValueOnce(new Response("null", { status: 200 }))
		.mockResolvedValueOnce(new Response("7", { status: 200 }))
		.mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));
	for (let index = 0; index < 5; index++) expect(await transport.requestRunnerPresentation({ apiBase: "https://clipify.example", runnerToken: "private-runner-token", sessionId, executionGeneration, fetcher })).toBeNull();
	expect(fetcher).toHaveBeenCalledTimes(5);
});

test("TDD-US4-CON012: malformed generations and empty or oversized credentials never reach HTTP", async () => {
	const fetcher = jest.fn();
	const valid = { apiBase: "https://clipify.example", runnerToken: "private-runner-token", sessionId, executionGeneration, fetcher };
	for (const patch of [{ executionGeneration: "not-a-generation" }, { runnerToken: "" }, { runnerToken: "x".repeat(4097) }]) expect(await transport.requestRunnerPresentation({ ...valid, ...patch })).toBeNull();
	expect(fetcher).not.toHaveBeenCalled();
});
