/** @jest-environment node */
import { uploadInputSchema, guardUploadBody } from "@/server/events/upload-policy";
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0]);
function stream(parts: Uint8Array[]) {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			for (const part of parts) controller.enqueue(part);
			controller.close();
		},
	});
}
it("accepts bounded supported media metadata and rejects scripts/SVG or oversized uploads", () => {
	expect(uploadInputSchema.safeParse({ mime: "image/png", size: png.length, title: "Thumbnail" }).success).toBe(true);
	for (const mime of ["text/html", "image/svg+xml", "application/javascript"]) expect(uploadInputSchema.safeParse({ mime, size: 100, title: "File" }).success).toBe(false);
	expect(uploadInputSchema.safeParse({ mime: "video/mp4", size: 104857601, title: "Video" }).success).toBe(false);
});
it("checks the actual signature across stream chunk boundaries", async () => {
	const result = await new Response(guardUploadBody(stream([png.slice(0, 3), png.slice(3)]), png.length, "image/png")).arrayBuffer();
	expect(new Uint8Array(result)).toEqual(png);
	await expect(new Response(guardUploadBody(stream([new TextEncoder().encode("<html>not an image</html>")]), 25, "image/png")).arrayBuffer()).rejects.toThrow("INVALID_INPUT");
});
it("rejects both truncated and oversized bodies rather than trusting declared size", async () => {
	await expect(new Response(guardUploadBody(stream([png]), png.length + 1, "image/png")).arrayBuffer()).rejects.toThrow("INVALID_INPUT");
	await expect(new Response(guardUploadBody(stream([png]), png.length - 1, "image/png")).arrayBuffer()).rejects.toThrow("INVALID_INPUT");
});
