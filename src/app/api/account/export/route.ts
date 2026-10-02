import { NextRequest, NextResponse } from "next/server";
import { verifyAccountDataExportToken } from "@/auth/account-data-export-token";
import { downloadDatabaseAccountDataExport } from "@/server/account-lifecycle/database";

export async function GET(request: NextRequest) {
	const token = request.nextUrl.searchParams.get("token");
	const payload = token ? verifyAccountDataExportToken(token) : null;
	if (!payload) return NextResponse.json({ error: "This data export link is invalid or has expired." }, { status: 410 });

	try {
		const data = await downloadDatabaseAccountDataExport(payload);
		return new NextResponse(JSON.stringify(data, null, 2), {
			status: 200,
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Content-Disposition": `attachment; filename="clipify-account-${payload.creatorId}.json"`,
				"Cache-Control": "private, no-store, max-age=0",
				"Referrer-Policy": "no-referrer",
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch (error) {
		if (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Sign in to the account that requested this export." }, { status: 401 });
		if (error instanceof Error && error.message === "EXPORT_IDENTITY_MISMATCH") return NextResponse.json({ error: "This export belongs to a different Clipify account." }, { status: 403 });
		console.error("Account data export failed", error);
		return NextResponse.json({ error: "The data export could not be created." }, { status: 500 });
	}
}
