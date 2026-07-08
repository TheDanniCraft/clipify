import { NextRequest, NextResponse } from "next/server";
import { validateAuth } from "@/app/actions/auth";
import { db } from "@/db/client";
import { runnersTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";

export async function GET(req: NextRequest) {
	const user = await validateAuth();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const searchParams = req.nextUrl.searchParams;
	const osParam = searchParams.get("os");
	const runnerId = searchParams.get("runnerId");

	if (!osParam || !["windows", "linux", "macos"].includes(osParam)) {
		return NextResponse.json({ error: "Invalid OS parameter" }, { status: 400 });
	}
	if (!runnerId) {
		return NextResponse.json({ error: "Missing runnerId parameter" }, { status: 400 });
	}

	// Verify runner ownership
	const runner = await db.query.runnersTable.findFirst({
		where: and(eq(runnersTable.id, runnerId), eq(runnersTable.ownerId, user.id)),
	});

	if (!runner) {
		return NextResponse.json({ error: "Runner not found or unauthorized" }, { status: 404 });
	}

	// Read binary
	const ext = osParam === "windows" ? ".exe" : "";
	const binaryName = `clipify-runner-${osParam}${ext}`;
	const binaryPath = path.join(process.cwd(), "public", "downloads", "runner", binaryName);

	try {
		const binaryBuffer = await fs.readFile(binaryPath);

		// Generate bootstrap token
		const bootstrapToken = crypto.randomUUID();

		// Save to DB
		await db.update(runnersTable).set({ bootstrapToken }).where(eq(runnersTable.id, runnerId));

		// Inject Config Block
		const apiBase = req.nextUrl.origin;
		const configBlock = `\n\n\n___CLIPIFY_CONFIG_START____${JSON.stringify({
			apiBase,
			bootstrapToken,
			runnerId,
		})}___CLIPIFY_CONFIG_END____\n\n\n`;

		const configBuffer = Buffer.from(configBlock, "utf-8");
		const finalBuffer = Buffer.concat([binaryBuffer, configBuffer]);

		return new NextResponse(finalBuffer, {
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
