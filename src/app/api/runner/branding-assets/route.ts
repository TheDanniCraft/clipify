import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getVerifiedSessionPrincipal } from "@/auth/session-principal";
import { MAX_RUNNER_ASSET_BYTES, storeRunnerBrandingAssetForPrincipal } from "@/server/runner/branding-assets";
const reply = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function POST(request: Request) {
	const principal = await getVerifiedSessionPrincipal(request.headers);
	if (!principal) return reply({ success: false, code: "ACCESS_DENIED", error: "Sign in to upload a standby image." }, 401);
	const query = new URL(request.url).searchParams;
	const reader = request.body?.getReader();
	if (!reader) return reply({ success: false, code: "INVALID_INPUT", error: "Choose an image to upload." }, 400);
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > MAX_RUNNER_ASSET_BYTES) {
				await reader.cancel();
				return reply({ success: false, code: "INVALID_INPUT", error: "Images must be no larger than 2 MiB." }, 413);
			}
			chunks.push(value);
		}
	} catch {
		return reply({ success: false, code: "INVALID_INPUT", error: "The upload was interrupted. Please try again." }, 400);
	} finally {
		reader.releaseLock();
	}
	try {
		const result = await storeRunnerBrandingAssetForPrincipal(principal, { ownerId: query.get("ownerId"), runnerId: query.get("runnerId"), kind: query.get("kind"), bytes: Buffer.concat(chunks) });
		return reply(result, result.success ? 201 : result.code === "ACCESS_DENIED" || result.code === "FEATURE_RESTRICTED" ? 403 : 400);
	} catch {
		Sentry.captureException(new Error("Runner standby image storage failed"));
		return reply({ success: false, code: "SERVICE_UNAVAILABLE", error: "Could not upload the image. Your saved appearance is unchanged. Please try again." }, 503);
	}
}
