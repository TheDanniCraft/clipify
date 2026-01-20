import { RE2JS } from "re2js";

function compileEntry(entry: string): RE2JS | null {
	const s = entry.trim();
	if (!s) return null;

	try {
		// "i" equivalent; there is no "g" in RE2JS
		return RE2JS.compile(s, RE2JS.CASE_INSENSITIVE);
	} catch {
		return null;
	}
}

export function isTitleBlocked(title: string, blacklist: string[]): boolean {
	return blacklist.some((entry) => {
		const rx = compileEntry(entry);
		if (!rx) return false;

		// Equivalent to /.../g.test(title) but without lastIndex state:
		return rx.matcher(title).find();
	});
}
