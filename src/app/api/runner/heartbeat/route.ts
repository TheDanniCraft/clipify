import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { runnersTable, streamSessionsTable, overlaysTable } from "@/db/schema";
import { eq, InferSelectModel } from "drizzle-orm";
import { RunnerStatus } from "@types";
import { decryptString } from "@/app/lib/encryption";

type StreamSession = InferSelectModel<typeof streamSessionsTable>;

export async function POST(req: Request) {
	try {
		// 1. Authenticate the Runner
		const authHeader = req.headers.get("authorization");
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		const token = authHeader.split(" ")[1];

		const runner = await db.query.runnersTable.findFirst({
			where: eq(runnersTable.token, token),
		});

		if (!runner) {
			return NextResponse.json({ error: "Invalid runner token" }, { status: 401 });
		}

		// 2. Parse payload
		const body = await req.json();
		const { os, version, actualStates } = body;

		// 3. Update Runner Status
		await db.update(runnersTable)
			.set({
				lastHeartbeatAt: new Date(),
				status: RunnerStatus.Online,
				osInfo: os,
				version: version,
			})
			.where(eq(runnersTable.id, runner.id));

		// 4. Find all sessions assigned to this runner
		const sessions = await db.query.streamSessionsTable.findMany({
			where: eq(streamSessionsTable.runnerId, runner.id),
		});

		// 5. Update actual states in DB (if the runner reported them)
		// For a rough prototype, we might skip full state reconciliation and just send desired state
		if (actualStates && typeof actualStates === "object") {
			for (const sessionId of Object.keys(actualStates)) {
				const state = actualStates[sessionId];
				await db.update(streamSessionsTable)
					.set({ actualState: state })
					.where(eq(streamSessionsTable.id, sessionId));
			}
		}

		// 6. Build jobs for the runner based on desiredState
		const jobs = await Promise.all(sessions.map(async (session: StreamSession) => {
			const overlay = await db.query.overlaysTable.findFirst({
				where: eq(overlaysTable.id, session.overlayId),
			});
			return {
				id: session.id,
				overlayId: session.overlayId,
				overlaySecret: overlay?.secret || "",
				mode: session.mode,
				desiredState: session.desiredState,
				resolution: session.resolution,
				fps: session.fps,
				rtmpUrl: session.rtmpUrl,
				// Decrypt stream key if it's supposed to be running
				streamKey: session.desiredState === "running" && session.encryptedStreamKey ? decryptString(session.encryptedStreamKey) : null, 
			};
		}));

		// 7. Check if an update is available (Hardcoded for prototype)
		const LATEST_VERSION = "1.0.0";
		const updateAvailable = version !== LATEST_VERSION;

		return NextResponse.json({
			success: true,
			updateAvailable,
			latestVersion: LATEST_VERSION,
			downloadUrl: "https://clipify.io/downloads/ClipifyRunner.exe", // Mock for now
			jobs,
		});
	} catch (error) {
		console.error("Heartbeat Error:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
