export function isRecentAuthRequired(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const value = error as { code?: unknown; message?: unknown; body?: { code?: unknown; message?: unknown } };
	return [value.code, value.message, value.body?.code, value.body?.message].some((item) => typeof item === "string" && /^(RECENT_AUTH_REQUIRED|REAUTHENTICATION_REQUIRED|SESSION_NOT_FRESH|AUTHENTICATION_REQUIRED|UNAUTHORIZED|Session is not fresh)$/i.test(item));
}

export async function withSensitiveActionResult<T extends object>(operation: () => Promise<T>): Promise<(T & { success: true }) | { success: false; code: "REAUTHENTICATION_REQUIRED" | "EXPORT_RATE_LIMITED" }> {
	try {
		return { ...(await operation()), success: true };
	} catch (error) {
		if (isRecentAuthRequired(error)) return { success: false, code: "REAUTHENTICATION_REQUIRED" };
		if (error instanceof Error && error.message === "EXPORT_RATE_LIMITED") return { success: false, code: "EXPORT_RATE_LIMITED" };
		throw error;
	}
}
