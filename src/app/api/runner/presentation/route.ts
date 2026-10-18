import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { runnersTable } from "@/db/schema";
import { RUNNER_PRESENTATION_COOKIE, RUNNER_PRESENTATION_TTL_SECONDS, signRunnerPresentationIdentity, resolveRunnerPresentationExecution } from "@/server/runner/presentation";

export type RunnerPresentationRequest = { sessionId: string; executionGeneration: string };
const inputSchema = z.object({ sessionId: z.uuid(), executionGeneration: z.uuid() }).strict();
function presentationResponse(body: unknown, status = 200) {
	return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
const unavailable = () => presentationResponse({ error: "PRESENTATION_UNAVAILABLE" }, 403);

async function readPresentationInput(request: Request): Promise<{ value: unknown } | { status: 400 | 413 }> {
	const reader = request.body?.getReader();
	if (!reader) return { status: 400 };
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > 4096) {
				await reader.cancel();
				return { status: 413 };
			}
			chunks.push(value);
		}
		return { value: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
	} catch {
		return { status: 400 };
	} finally {
		reader.releaseLock();
	}
}

export async function POST(request: Request) {
	const authorization = request.headers.get("authorization") ?? "";
	if (!authorization.startsWith("Bearer ")) return presentationResponse({ error: "UNAUTHORIZED" }, 401);
	const token = authorization.slice(7).trim();
	if (!token || token.length > 4096) return presentationResponse({ error: "UNAUTHORIZED" }, 401);
	const input = await readPresentationInput(request);
	if ("status" in input) return presentationResponse({ error: "INVALID_INPUT" }, input.status);
	const parsed = inputSchema.safeParse(input.value);
	if (!parsed.success) return presentationResponse({ error: "INVALID_INPUT" }, 400);
	const runner = await db.query.runnersTable.findFirst({ where: eq(runnersTable.token, token) });
	if (!runner || runner.token !== token) return presentationResponse({ error: "UNAUTHORIZED" }, 401);
	const execution = await resolveRunnerPresentationExecution({ ownerId: runner.ownerId, runnerId: runner.id, sessionId: parsed.data.sessionId, executionGeneration: parsed.data.executionGeneration, credentialBinding: createHash("sha256").update(token).digest("hex") });
	if (!execution) return unavailable();
	const { session, admission } = execution;
	const signed = signRunnerPresentationIdentity({ ownerId: runner.ownerId, runnerId: runner.id, sessionId: session.id, executionGeneration: admission.executionGeneration, admissionId: admission.id, credentialBinding: createHash("sha256").update(token).digest("hex") }, Date.now());
	if (!signed) return presentationResponse({ error: "PRESENTATION_UNAVAILABLE" }, 503);
	const path = `/runner/presentation/${session.id}`;
	const response = presentationResponse({ url: path, expiresAt: signed.expiresAt });
	response.cookies.set(RUNNER_PRESENTATION_COOKIE, signed.token, { path, httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "strict", maxAge: RUNNER_PRESENTATION_TTL_SECONDS });
	return response;
}
