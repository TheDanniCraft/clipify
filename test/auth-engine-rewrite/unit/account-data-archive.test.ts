/** @jest-environment node */
import * as fflate from "fflate";
import { createAccountDataArchive } from "@/server/account-lifecycle/account-data-archive";
import { accountExportCoverage, createAccountExportManifest } from "@/server/account-lifecycle/account-export-manifest";

jest.mock("fflate", () => {
	const actual = jest.requireActual("fflate");
	return { ...actual, zip: jest.fn(actual.zip) };
});

function emptyPackage(): Record<string, any> {
	const data: Record<string, any> = {};
	for (const entry of Object.values(accountExportCoverage)) {
		if (!("paths" in entry)) continue;
		for (const path of entry.paths) {
			const keys = path.split(".");
			let section = data;
			for (const key of keys.slice(0, -1)) section = section[key] ??= {};
			section[keys.at(-1)!] = [];
		}
	}
	return data;
}

test("the archive preserves binary assets and ordinary text while rejecting unsafe asset filenames", async () => {
	const data = emptyPackage();
	data.identity.profile = null;
	data.exportedAt = "2026-10-27T00:00:00.000Z";
	data.identity.profile = { username: "my username is password" };
	data.runner.brandingAssets = [
		{ id: "55a14977-cf49-4338-adbd-9d9d50178b85", normalizedMime: "image/png", bytes: { encoding: "base64", value: "iVBORw==" } },
		{ id: "../../outside", normalizedMime: "image/png", bytes: { encoding: "base64", value: "iVBORw==" } },
		{ id: "55a14977-cf49-4338-adbd-9d9d50178b86", normalizedMime: "unknown", bytes: { encoding: "base64", value: "AQ==" } },
		{ id: "55a14977-cf49-4338-adbd-9d9d50178b87", normalizedMime: "image/png", bytes: null },
	];
	const files = fflate.unzipSync(await createAccountDataArchive(data));
	const runner = JSON.parse(fflate.strFromU8(files["runner/runner.json"]));
	expect([...files[runner.brandingAssets[0].archiveFile]]).toEqual([137, 80, 78, 71]);
	expect(runner.brandingAssets[0]).not.toHaveProperty("bytes");
	expect(runner.brandingAssets[1].archiveFile).toBe(runner.brandingAssets[0].archiveFile);
	expect([...files[runner.brandingAssets[2].archiveFile]]).toEqual([1]);
	expect(Object.keys(files).some((name) => name.includes(".."))).toBe(false);
	expect(fflate.strFromU8(files["account/account.json"])).toContain("my username is password");
	expect(JSON.parse(fflate.strFromU8(files["manifest.json"])).files).toEqual(expect.arrayContaining(["manifest.json", "READ-ME-FIRST.txt", "account/account.json"]));
});

test("an incomplete dataset cannot silently become a complete-looking archive", async () => {
	await expect(createAccountDataArchive({})).rejects.toThrow("ACCOUNT_EXPORT_DATASET_MISSING");
	const data = emptyPackage();
	delete data.runner;
	await expect(createAccountDataArchive(data)).rejects.toThrow("ACCOUNT_EXPORT_DATASET_MISSING");
});

test("missing optional assets still produce a readable package", async () => {
	const data = emptyPackage();
	data.runner.brandingAssets = null;
	const files = fflate.unzipSync(await createAccountDataArchive(data));
	expect(files["READ-ME-FIRST.txt"]).toBeDefined();
});

test("compression failures are returned instead of producing a corrupt download", async () => {
	jest.mocked(fflate.zip).mockImplementationOnce((...args: unknown[]) => {
		(args.at(-1) as (error: Error) => void)(new Error("compression unavailable"));
		return () => {};
	});
	await expect(createAccountDataArchive(emptyPackage())).rejects.toThrow("compression unavailable");
});

test("a database table missing from the registry fails the completeness check", () => {
	const coverage = accountExportCoverage["public.users"];
	try {
		delete accountExportCoverage["public.users"];
		expect(() => createAccountExportManifest(emptyPackage())).toThrow("ACCOUNT_EXPORT_TABLE_NOT_CLASSIFIED: public.users");
	} finally {
		accountExportCoverage["public.users"] = coverage;
	}
});

test("groups populated datasets and tokens without creating files for empty tables", async () => {
	const data = emptyPackage();
	data.identity.profile = { username: "owner" };
	data.identity.settings = [{ language: "de" }];
	data.aiApps.accessTokens = [{ id: "access", token: "private-access" }];
	data.aiApps.refreshTokens = [{ id: "refresh", token: "private-refresh" }];
	data.external = { newsletter: { status: "included", contacts: [{ email: "owner@example.com" }] } };
	const files = fflate.unzipSync(await createAccountDataArchive(data));
	expect(Object.keys(files).sort()).toEqual(["READ-ME-FIRST.txt", "account/account.json", "manifest.json", "security/security.json"]);
	expect(JSON.parse(fflate.strFromU8(files["account/account.json"]))).toMatchObject({ profile: { username: "owner" }, newsletter: { contacts: [{ email: "owner@example.com" }] } });
	expect(JSON.parse(fflate.strFromU8(files["security/security.json"]))).toMatchObject({ tokens: { access: [{ token: "private-access" }], refresh: [{ token: "private-refresh" }] } });
	const manifest = JSON.parse(fflate.strFromU8(files["manifest.json"]));
	const emptyTable = manifest.tables.find((entry: { table: string }) => entry.table === "public.galleries");
	expect(emptyTable.datasets).toEqual([{ records: 0 }]);
	for (const entry of manifest.tables.flatMap((table: { datasets?: unknown[] }) => table.datasets ?? []).filter((entry: { file?: string }) => entry.file)) expect(files[entry.file]).toBeDefined();
	expect(manifest.externalSources.newsletter.file).toBe("account/account.json");
	expect(manifest.externalSources.newsletter.pointer).toBe("/newsletter");
});

test("includes downloaded avatars and maps support data and sensitive records to their actual category", async () => {
	const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array([9]), { headers: { "content-type": "image/png" } }));
	try {
		const data = emptyPackage();
		data.exportFormat = "clipify-account-data-v3";
		data.exportedAt = "2026-10-28T00:00:00.000Z";
		data.securityNotice = "private";
		data.identity.profile = { avatar: "https://static-cdn.jtvnw.net/avatar.png" };
		data.identity.settings = {};
		data.verificationRecords = [{ value: "verification-secret" }];
		data.reusableCredentials = { overlays: [{ value: "overlay-secret" }], runners: [{ value: "runner-secret" }] };
		data.external = { newsletter: { status: "included", contacts: [] }, support: { status: "included", contacts: [], conversations: [{ id: 1, messages: [{ content: "hello" }] }] } };
		const files = fflate.unzipSync(await createAccountDataArchive(data));
		const manifest = JSON.parse(fflate.strFromU8(files["manifest.json"]));
		const profile = JSON.parse(fflate.strFromU8(files["account/account.json"])).profile;
		expect([...files[profile.avatarFile]]).toEqual([9]);
		expect(data.identity.profile).not.toHaveProperty("avatarFile");
		expect(JSON.parse(fflate.strFromU8(files["support/conversations.json"]))).toMatchObject({ conversations: [{ messages: [{ content: "hello" }] }] });
		expect(manifest.externalSources.newsletter).not.toHaveProperty("file");
		expect(manifest.externalSources.support).toMatchObject({ file: "support/conversations.json", pointer: "" });
		expect(manifest.sensitiveFields).toContain("security/security.json#/verificationRecords: value");
		expect(manifest.sensitiveFields).toContain("manifest.json#/assets: sourceUrl");
		expect(manifest.assets[0]).toMatchObject({ sourceUrl: data.identity.profile.avatar, file: profile.avatarFile, status: "included" });
	} finally {
		fetch.mockRestore();
	}
});

test("unclassified package sections cannot silently disappear", async () => {
	await expect(createAccountDataArchive({ ...emptyPackage(), unexpected: [{ value: "must not disappear" }] })).rejects.toThrow("ACCOUNT_EXPORT_LAYOUT_MISSING: unexpected");
});

test("an undefined required dataset cannot be omitted as an empty dataset", async () => {
	const data = emptyPackage();
	data.identity.profile = undefined;
	await expect(createAccountDataArchive(data)).rejects.toThrow("ACCOUNT_EXPORT_DATASET_MISSING: identity.profile");
});
