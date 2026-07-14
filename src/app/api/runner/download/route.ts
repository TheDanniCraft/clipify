import { NextRequest, NextResponse } from "next/server";
import { validateAuth } from "@actions/auth";
import { db } from "@/db/client";
import { editorsTable, runnersTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { hasActiveEntitlement } from "@lib/entitlements";
import { Entitlement } from "@types";

const binaryNames: Record<string, string> = {
	windows: "clipify-runner-windows.exe",
	linux: "clipify-runner-linux",
	"linux-arm64": "clipify-runner-linux-arm64",
	macos: "clipify-runner-macos",
	"macos-arm64": "clipify-runner-macos-arm64",
};

async function canAccessRunner(ownerId: string, userId: string) {
	if (ownerId === userId) return true;
	const editor = await db.query.editorsTable.findFirst({
		where: and(eq(editorsTable.userId, ownerId), eq(editorsTable.editorId, userId)),
	});
	return Boolean(editor);
}

export async function GET(req: NextRequest) {
	const user = await validateAuth();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const searchParams = req.nextUrl.searchParams;
	const osParam = searchParams.get("os") || "";
	const runnerId = searchParams.get("runnerId");
	const binaryName = binaryNames[osParam];

	if (!binaryName) {
		return NextResponse.json({ error: "Invalid OS parameter" }, { status: 400 });
	}
	if (!runnerId) {
		return NextResponse.json({ error: "Missing runnerId parameter" }, { status: 400 });
	}

	const runner = await db.query.runnersTable.findFirst({
		where: eq(runnersTable.id, runnerId),
	});

	if (!runner || !(await canAccessRunner(runner.ownerId, user.id))) {
		return NextResponse.json({ error: "Runner not found or unauthorized" }, { status: 404 });
	}
	if (!(await hasActiveEntitlement(runner.ownerId, Entitlement.RunnerAccess))) {
		return NextResponse.json({ error: "Runner add-on required", code: "entitlement_required" }, { status: 403 });
	}

	const binaryPath = path.join(process.cwd(), "public", "downloads", "runner", binaryName);

	try {
		const binaryBuffer = await fs.readFile(binaryPath);

		return new NextResponse(binaryBuffer, {
			status: 200,
			headers: {
				"Content-Type": "application/octet-stream",
				"Content-Disposition": `attachment; filename="${binaryName}"`,
			},
		});
	} catch (error) {
		console.error("Error serving runner binary:", error);
		return NextResponse.json({ error: "Binary not found or build missing" }, { status: 500 });
	}
}
