/** Validate app navigation separately from Better Auth's provider callback checks. */
export function safeReturnPath(value: unknown): string | null {
	if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
	try {
		const base = "https://clipify.invalid";
		return new URL(value, base).origin === base ? value : null;
	} catch {
		return null;
	}
}
