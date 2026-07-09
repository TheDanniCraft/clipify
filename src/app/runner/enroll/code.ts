export function normalizeUserCode(code: string) {
	const compact = code
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");
	return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : code.trim().toUpperCase();
}
