import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { tryRateLimit } from "@actions/rateLimit";
import { captureUnexpectedError } from "@lib/sentryServer";
import { acknowledgeRevokedExecution } from "@/server/runner/terminal";

const schema = z.object({ admissionId: z.uuid(), executionGeneration: z.uuid(), allOutputsClosed: z.literal(true), playbackOutcome: z.enum(["clip_completed", "playback_timeout"]).optional() }).strict();
function reply(body: unknown, status = 200) {
	return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}
async function readReceipt(request: Request): Promise<{ receipt: z.infer<typeof schema> } | { error: 400 | 413 }> {
	const reader = request.body?.getReader();
	if (!reader) return { error: 400 as const };
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > 65536) {
				await reader.cancel();
				return { error: 413 as const };
			}
			chunks.push(value);
		}
		const parsed = schema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
		return parsed.success ? { receipt: parsed.data } : { error: 400 as const };
	} catch {
		return { error: 400 as const };
	} finally {
		reader.releaseLock();
	}
}
export async function POST(request: Request) {
	try {
		const authorization = request.headers.get("authorization");
		if (!authorization?.startsWith("Bearer ")) return reply({ error: "Unauthorized" }, 401);
		const token = authorization.slice(7);
		if (!token || token.length > 512 || /\s/.test(token)) return reply({ error: "Unauthorized" }, 401);
		const limit = await tryRateLimit({ key: "runner-terminal", points: 12, duration: 60, identifier: createHash("sha256").update(token).digest("hex") });
		if (!limit.success) return reply({ error: "Too many terminal receipts" }, 429);
		const input = await readReceipt(request);
		if ("error" in input) return reply({ error: input.error === 413 ? "Terminal receipt too large" : "Invalid terminal receipt" }, input.error);
		return reply(await acknowledgeRevokedExecution(token, input.receipt));
	} catch (error) {
		if (error instanceof Error && error.message === "INVALID_TERMINAL_CREDENTIAL") return reply({ error: "Invalid terminal credential" }, 401);
		captureUnexpectedError(error, "runner-terminal", "acknowledge");
		return reply({ error: "Terminal receipt could not be processed" }, 500);
	}
}
