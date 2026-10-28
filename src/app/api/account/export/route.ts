import { NextRequest, NextResponse } from "next/server";
import { verifyAccountDataExportToken } from "@/auth/account-data-export-token";
import { downloadDatabaseAccountDataExport } from "@/server/account-lifecycle/database";
import { createAccountDataArchive } from "@/server/account-lifecycle/account-data-archive";
import { isRecentAuthRequired } from "@/auth/recent-auth";
import { resolveBaseUrl } from "@/app/lib/baseUrl";

export async function GET(request: NextRequest) {
	const token = request.nextUrl.searchParams.get("token");
	const payload = token ? verifyAccountDataExportToken(token) : null;
	if (!payload) return NextResponse.json({ error: "This data export link is invalid or has expired." }, { status: 410 });

	try {
		const data = await downloadDatabaseAccountDataExport(payload);
		const archive = await createAccountDataArchive(data as Record<string, unknown>);
		return new NextResponse(archive, {
			status: 200,
			headers: {
				"Content-Type": "application/zip",
				"Content-Disposition": `attachment; filename="clipify-account-${payload.creatorId}.zip"`,
				"Cache-Control": "private, no-store, max-age=0",
				"Referrer-Policy": "no-referrer",
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch (error) {
		if (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED") {
			const login = new URL("/login", resolveBaseUrl());
			login.searchParams.set("returnUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
			return NextResponse.redirect(login);
		}
		if (isRecentAuthRequired(error)) {
			const verification = new URL("/dashboard/settings", resolveBaseUrl());
			verification.hash = `downloadExport=${encodeURIComponent(token!)}`;
			return NextResponse.redirect(verification);
		}
		if (error instanceof Error && error.message === "EXPORT_IDENTITY_MISMATCH") return NextResponse.json({ error: "This export belongs to a different Clipify account." }, { status: 403 });
		console.error("Account data export failed", error);
		return NextResponse.json({ error: "The data export could not be created." }, { status: 500 });
	}
}
