/** @jest-environment node */
jest.mock("@/server/events/connections", () => ({ eventGoogleToken: jest.fn(async () => ({ accessToken: "fixture-token", connection: { id: "drive", identityId: "folder" } })), eventS3Credentials: jest.fn(() => ({ bucket: "awards" })) }));
jest.mock("@/server/events/storage-http", () => ({ s3Request: jest.fn(async () => new Response(null, { status: 200 })) }));
import { writeAwardUpload } from "@/server/events/upload-provider";
import { eventConnectionsTable } from "@/db/schema";
const connection = { id: "drive", ownerId: "host", provider: "drive", connected: true, identityId: "folder" } as typeof eventConnectionsTable.$inferSelect;
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0]);
const stream = () =>
	new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(png);
			controller.close();
		},
	});
it("keeps the Drive upload session server-side and validates the completed size", async () => {
	const fetcher = jest
		.fn()
		.mockResolvedValueOnce(new Response(null, { status: 200, headers: { Location: "https://www.googleapis.com/upload/drive/v3/files/file-id?uploadType=resumable&upload_id=secret-session" } }))
		.mockImplementationOnce(async (_url: string, options: RequestInit) => {
			await new Response(options.body).arrayBuffer();
			return Response.json({ id: "file-id", size: "16", mimeType: "image/png" });
		});
	global.fetch = fetcher;
	await expect(writeAwardUpload(connection, "file-id", { mime: "image/png", size: 16 }, stream(), new AbortController().signal)).resolves.toBeUndefined();
	expect(fetcher).toHaveBeenCalledTimes(2);
	expect(fetcher.mock.calls[1][0]).toContain("upload_id=secret-session");
});
it("rejects a Drive redirect to a foreign upload endpoint before sending bytes", async () => {
	const fetcher = jest.fn().mockResolvedValue(new Response(null, { status: 200, headers: { Location: "https://attacker.example/upload" } }));
	global.fetch = fetcher;
	await expect(writeAwardUpload(connection, "file-id", { mime: "image/png", size: 16 }, stream(), new AbortController().signal)).rejects.toThrow("PROVIDER_UNAVAILABLE");
	expect(fetcher).toHaveBeenCalledTimes(1);
});
it("never accepts an incomplete provider upload as a valid submission", async () => {
	global.fetch = jest
		.fn()
		.mockResolvedValueOnce(new Response(null, { status: 200, headers: { Location: "https://www.googleapis.com/upload/drive/v3/files/file-id?upload_id=secret-session" } }))
		.mockImplementationOnce(async (_url: string, options: RequestInit) => {
			await new Response(options.body).arrayBuffer();
			return Response.json({ id: "file-id", size: "15", mimeType: "image/png" });
		});
	await expect(writeAwardUpload(connection, "file-id", { mime: "image/png", size: 16 }, stream(), new AbortController().signal)).rejects.toThrow("PROVIDER_UNAVAILABLE");
});
