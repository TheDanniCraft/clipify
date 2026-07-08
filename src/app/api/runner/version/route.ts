import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
	try {
		const versionPath = path.join(process.cwd(), "public", "downloads", "runner", "version.json");
		if (!fs.existsSync(versionPath)) {
			return NextResponse.json({ error: "Version file not found" }, { status: 404 });
		}

		const versionData = JSON.parse(fs.readFileSync(versionPath, "utf-8"));
		return NextResponse.json(versionData);
	} catch (error) {
		console.error("Error reading version file:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
