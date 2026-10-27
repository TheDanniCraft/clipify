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
	data.note = "my username is password";
	data.runner.brandingAssets = [
		{ id: "55a14977-cf49-4338-adbd-9d9d50178b85", normalizedMime: "image/png", bytes: { encoding: "base64", value: "iVBORw==" } },
		{ id: "../../outside", normalizedMime: "image/png", bytes: { encoding: "base64", value: "iVBORw==" } },
		{ id: "55a14977-cf49-4338-adbd-9d9d50178b86", normalizedMime: "unknown", bytes: { encoding: "base64", value: "AQ==" } },
		{ id: "55a14977-cf49-4338-adbd-9d9d50178b87", normalizedMime: "image/png", bytes: null },
	];
	const files = fflate.unzipSync(await createAccountDataArchive(data));
	expect([...files["assets/55a14977-cf49-4338-adbd-9d9d50178b85.png"]]).toEqual([137, 80, 78, 71]);
	expect([...files["assets/55a14977-cf49-4338-adbd-9d9d50178b86.bin"]]).toEqual([1]);
	expect(Object.keys(files).some((name) => name.includes(".."))).toBe(false);
	expect(fflate.strFromU8(files["note.json"])).toContain("my username is password");
	expect(JSON.parse(fflate.strFromU8(files["manifest.json"])).files).toEqual(expect.arrayContaining(["manifest.json", "READ-ME-FIRST.txt", "identity/profile.json"]));
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
