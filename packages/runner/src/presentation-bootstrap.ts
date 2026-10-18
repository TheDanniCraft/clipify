/** Native transport for the authenticated generated presentation. */
export type RunnerPresentationBootstrap = {
	url: string;
	cookie: { name: string; value: string; domain: string; path: string; httpOnly: true; secure: boolean; sameSite: "Strict" };
};

export async function requestRunnerPresentation(options: { apiBase: string; runnerToken: string; sessionId: string; executionGeneration: string; signal?: AbortSignal; fetcher?: typeof fetch }): Promise<RunnerPresentationBootstrap | null> {
	try {
		const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		if (!uuid.test(options.sessionId) || !uuid.test(options.executionGeneration) || !options.runnerToken || options.runnerToken.length > 4096) return null;
		const base = new URL(options.apiBase);
		if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== "/") return null;
		const path = `/runner/presentation/${options.sessionId}`;
		const response = await (options.fetcher ?? fetch)(new URL("/api/runner/presentation", base).href, {
			method: "POST",
			headers: { authorization: `Bearer ${options.runnerToken}`, "content-type": "application/json" },
			body: JSON.stringify({ sessionId: options.sessionId, executionGeneration: options.executionGeneration }),
			redirect: "error",
			signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
		});
		if (!response.ok) return null;
		const body: unknown = await response.json();
		if (!body || typeof body !== "object" || !("url" in body) || body.url !== path) return null;
		const cookie = response.headers.get("set-cookie");
		if (!cookie) return null;
		const pieces = cookie.split(";").map((piece) => piece.trim());
		const credential = pieces[0].match(/^clipify_runner_presentation=([A-Za-z0-9._-]{1,4096})$/)?.[1];
		if (!credential || !pieces.includes(`Path=${path}`) || !pieces.some((piece) => piece.toLowerCase() === "httponly") || !pieces.some((piece) => piece.toLowerCase() === "samesite=strict")) return null;
		const secure = base.protocol === "https:";
		if (secure && !pieces.some((piece) => piece.toLowerCase() === "secure")) return null;
		// Keep a browser-session cookie. JWT expiry is enforced by the server; using
		// server wall time as a client cookie expiry fails on a skewed gaming PC.
		return { url: new URL(path, base).href, cookie: { name: "clipify_runner_presentation", value: credential, domain: base.hostname, path, httpOnly: true, secure, sameSite: "Strict" } };
	} catch {
		return null;
	}
}
