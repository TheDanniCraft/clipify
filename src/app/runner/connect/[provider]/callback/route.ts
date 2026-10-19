import { randomBytes } from "node:crypto";
import { getVerifiedSessionPrincipal } from "@/auth/session-principal";
import { completeStreamingConnection } from "@/server/runner/provider-connections";
import { streamingProviderSchema } from "@/server/runner/provider-contract";
import { resolveBaseUrl } from "@/app/lib/baseUrl";

/** OAuth redirect is an external-provider callback; UI mutations use server actions. */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
	const provider = streamingProviderSchema.safeParse((await params).provider);
	const url = new URL(request.url);
	const nonce = randomBytes(18).toString("base64");
	let success = false;
	let connectionId: string | undefined;
	try {
		const principal = await getVerifiedSessionPrincipal(request.headers);
		if (principal && provider.success && !url.searchParams.has("error")) {
			const result = await completeStreamingConnection(principal, provider.data, url.searchParams.get("state") ?? "", url.searchParams.get("code") ?? "");
			if (result.success) {
				success = true;
				connectionId = result.connection.id;
			}
		}
	} catch {
		/* Provider denial and expired sessions are recoverable in the initiating editor. */
	}
	const origin = resolveBaseUrl().origin;
	const data = JSON.stringify({ type: "runner-provider-connection", success, connectionId }).replaceAll("<", "\\u003c");
	const text = success ? "Channel connected. You can close this window." : "Could not connect the channel. Return to Clipify and try again.";
	return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Clipify channel connection</title><body><p>${text}</p><script nonce="${nonce}">if(window.opener){window.opener.postMessage(${data},${JSON.stringify(origin)});window.close()}</script></body></html>`, {
		headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'` },
	});
}
