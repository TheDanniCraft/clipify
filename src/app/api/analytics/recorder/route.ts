export async function GET() {
	try {
		const upstream = await fetch(`${process.env.UMAMI_BASE_URL || "https://umami.cloud.thedannicraft.de"}/recorder.js`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000) });
		if (!upstream.ok) return new Response(null, { status: 502 });
		const script = await upstream.text();
		// Give only this script a local fetch binding; leave Umami internals and application fetch untouched.
		return new Response(`if (typeof window.clipifyRecorderFetch === "function") {\n(function(fetch) {\n${script}\n})((...args) => window.clipifyRecorderFetch(...args));\n}\n`, {
			headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" },
		});
	} catch {
		return new Response(null, { status: 502 });
	}
}
