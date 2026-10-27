/** @jest-environment node */

import { NextRequest } from "next/server";

const verifyAccountDataExportToken = jest.fn();
const downloadDatabaseAccountDataExport = jest.fn();
const createAccountDataArchive = jest.fn();
jest.mock("@/server/account-lifecycle/account-data-archive", () => ({ createAccountDataArchive: (...args: unknown[]) => createAccountDataArchive(...args) }));

jest.mock("@/auth/account-data-export-token", () => ({
	verifyAccountDataExportToken: (...args: unknown[]) => verifyAccountDataExportToken(...args),
}));

jest.mock("@/server/account-lifecycle/database", () => ({
	downloadDatabaseAccountDataExport: (...args: unknown[]) => downloadDatabaseAccountDataExport(...args),
}));

describe("account data export route", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		createAccountDataArchive.mockResolvedValue(new Uint8Array([80, 75, 3, 4]));
		verifyAccountDataExportToken.mockReturnValue({ authUserId: "auth-1", creatorId: "creator-1", organizationId: "org-1", expiresAt: Date.now() + 60_000 });
		downloadDatabaseAccountDataExport.mockResolvedValue({ exportFormat: "clipify-account-data-v2", profile: { id: "creator-1" } });
	});

	it("downloads a private, non-cacheable package for the bound identity", async () => {
		const { GET } = await import("@/app/api/account/export/route");
		const response = await GET(new NextRequest("https://clipify.us/api/account/export?token=signed-token"));

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(response.headers.get("content-disposition")).toContain("clipify-account-creator-1.zip");
		expect(downloadDatabaseAccountDataExport).toHaveBeenCalledWith(expect.objectContaining({ authUserId: "auth-1", creatorId: "creator-1", organizationId: "org-1" }));
	});

	it("rejects expired links and account mismatches", async () => {
		const { GET } = await import("@/app/api/account/export/route");
		verifyAccountDataExportToken.mockReturnValueOnce(null);
		await expect(GET(new NextRequest("https://clipify.us/api/account/export?token=expired"))).resolves.toMatchObject({ status: 410 });

		downloadDatabaseAccountDataExport.mockRejectedValueOnce(new Error("EXPORT_IDENTITY_MISMATCH"));
		await expect(GET(new NextRequest("https://clipify.us/api/account/export?token=valid"))).resolves.toMatchObject({ status: 403 });
	});

	it("requires a signed-in account and contains unexpected failures", async () => {
		const { GET } = await import("@/app/api/account/export/route");
		downloadDatabaseAccountDataExport.mockRejectedValueOnce(new Error("AUTHENTICATION_REQUIRED"));
		await expect(GET(new NextRequest("https://clipify.us/api/account/export?token=valid"))).resolves.toMatchObject({ status: 307 });

		downloadDatabaseAccountDataExport.mockRejectedValueOnce(new Error("database unavailable"));
		await expect(GET(new NextRequest("https://clipify.us/api/account/export?token=valid"))).resolves.toMatchObject({ status: 500 });
	});

	it("redirects a stale authenticated owner to verification without logging an incident", async () => {
		const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
		try {
			const { GET } = await import("@/app/api/account/export/route");
			downloadDatabaseAccountDataExport.mockRejectedValueOnce(new Error("RECENT_AUTH_REQUIRED"));
			const response = await GET(new NextRequest("https://clipify.us/api/account/export?token=valid"));
			expect(response.status).toBe(307);
			expect(response.headers.get("location")).toBe("https://clipify.us/dashboard/settings#downloadExport=valid");
			expect(log).not.toHaveBeenCalled();
		} finally {
			log.mockRestore();
		}
	});
});
