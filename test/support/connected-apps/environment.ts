export function fixtureDatabase(environment: Record<string, string | undefined> = process.env) {
	const url = new URL(environment.DATABASE_URL ?? "");
	if (environment.CLIPIFY_CONNECTED_APP_FIXTURE !== "1" || environment.APP_ENV !== "test" || environment.DISABLE_BACKGROUND_JOBS !== "true" || url.search || url.hash || url.password !== "clipify_fixture_password" || url.protocol !== "postgresql:" || url.hostname !== "clipify-db" || url.port !== "5432" || url.pathname !== "/clipify_apps_fixture" || url.username !== "clipify_fixture" || environment.NEXT_PUBLIC_BASE_URL !== "https://clipify:3108")
		throw new Error("CONNECTED_APP_DISPOSABLE_FIXTURE_REQUIRED");
	return url;
}
export const fixtureOrigin = "https://clipify:3108";
export const fixtureCreator = "274252231";
