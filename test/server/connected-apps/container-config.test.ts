/** @jest-environment node */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const compose = () => {
	const core = JSON.parse(readFileSync(resolve("test/support/connected-apps/clipify.compose.json"), "utf8"));
	const awards = JSON.parse(readFileSync(resolve("test/support/connected-apps/awards.compose.json"), "utf8"));
	return { services: { ...core.services, ...awards.services }, networks: { ...core.networks, ...awards.networks } };
};

test("both fixture databases remain unpublished on distinct private networks", () => {
	const config = compose();
	for (const name of ["clipify-db", "awards-db"]) {
		const service = config.services[name];
		expect(service.ports).toBeUndefined();
		expect(service.networks).toHaveLength(1);
		expect(config.networks[service.networks[0]].internal).toBe(true);
	}
	expect(config.services["clipify-db"].networks).not.toEqual(config.services["awards-db"].networks);
	expect(config.services.awards.networks).not.toContain(config.services["clipify-db"].networks[0]);
	expect(config.services.clipify.networks).not.toContain(config.services["awards-db"].networks[0]);
});
test("the fixture runs the real Awards image and explicitly guarded Clipify bootstrap", () => {
	const config = compose();
	expect(config.services.awards.build.context).toBe("${CLIPIFY_APPS_SOURCE}/examples/babbler-awards");
	expect(config.services.awards.environment.CLIPIFY_BASE_URL).toBe("https://clipify:3108");
	expect(config.services.awards.environment.DATABASE_URL).toBeUndefined();
	expect(config.services.clipify.environment.CLIPIFY_CONNECTED_APP_FIXTURE).toBe("1");
	expect(config.services.clipify.environment.DATABASE_URL).toBe("postgresql://clipify_fixture:clipify_fixture_password@clipify-db:5432/clipify_apps_fixture");
	expect(config.services.clipify.ports).toBeUndefined();
});

import { fixtureDatabase } from "../../support/connected-apps/environment";
const fixtureEnv = { CLIPIFY_CONNECTED_APP_FIXTURE: "1", APP_ENV: "test", DISABLE_BACKGROUND_JOBS: "true", DATABASE_URL: "postgresql://clipify_fixture:clipify_fixture_password@clipify-db:5432/clipify_apps_fixture", NEXT_PUBLIC_BASE_URL: "https://clipify:3108" };
test("the fixture rejects connection-string overrides before schema creation", () => {
	expect(() => fixtureDatabase({ ...fixtureEnv, DATABASE_URL: `${fixtureEnv.DATABASE_URL}?host=production.invalid` })).toThrow("CONNECTED_APP_DISPOSABLE_FIXTURE_REQUIRED");
});
test("the explicitly isolated fixture identity is accepted", () => {
	expect(fixtureDatabase(fixtureEnv).hostname).toBe("clipify-db");
});
test.each([{ CLIPIFY_CONNECTED_APP_FIXTURE: "0" }, { APP_ENV: "production" }, { DISABLE_BACKGROUND_JOBS: "false" }, { DATABASE_URL: fixtureEnv.DATABASE_URL.replace("clipify-db", "127.0.0.1") }, { DATABASE_URL: fixtureEnv.DATABASE_URL.replace("clipify_apps_fixture", "clipify") }, { DATABASE_URL: `${fixtureEnv.DATABASE_URL}#fragment` }, { NEXT_PUBLIC_BASE_URL: "https://clipify.us" }])("fixture admission rejects unsafe input %p", (patch) => {
	expect(() => fixtureDatabase({ ...fixtureEnv, ...patch })).toThrow("CONNECTED_APP_DISPOSABLE_FIXTURE_REQUIRED");
});

test("Clipify and Awards have independent Compose deployment definitions", () => {
	const core = JSON.parse(readFileSync(resolve("test/support/connected-apps/clipify.compose.json"), "utf8"));
	const awards = JSON.parse(readFileSync(resolve("test/support/connected-apps/awards.compose.json"), "utf8"));
	expect(Object.keys(core.services).sort()).toEqual(["clipify", "clipify-db"]);
	expect(Object.keys(awards.services).sort()).toEqual(["awards", "awards-db"]);
	for (const stack of [core, awards]) expect(stack.networks["app-http"]).toEqual({ external: true, name: "${CLIPIFY_APPS_HTTP_NETWORK}" });
	expect(awards.services.awards.depends_on.clipify).toBeUndefined();
});
