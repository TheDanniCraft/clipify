import "server-only";
/** Parse known Twitch clip URL formats locally; never fetch a caller-supplied URL. */
export function parseClipReference(reference: string): string {
	const value = reference.trim();
	if (/^[A-Za-z0-9_-]{1,200}$/.test(value)) return value;
	try {
		const url = new URL(value);
		if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error();
		const parts = url.pathname.split("/").filter(Boolean);
		let id: string | undefined;
		if (url.hostname === "clips.twitch.tv" && parts.length === 1 && parts[0] !== "embed") id = parts[0];
		if (["twitch.tv", "www.twitch.tv"].includes(url.hostname) && parts.length === 3 && parts[1] === "clip") id = parts[2];
		if (!id || !/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw new Error();
		return id;
	} catch {
		throw new Error("INVALID_INPUT");
	}
}
