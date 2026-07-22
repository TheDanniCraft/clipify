export function normalizeUserCode(code: string) {
	const compact = code
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");
	return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : code.trim().toUpperCase();
}

export function isValidUserCode(code: string) {
	return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code.trim().toUpperCase());
}
