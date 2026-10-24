import sharp from "sharp";

/** Real raster input; padding belongs to the file, not a multipart envelope. */
export async function standbyImageBoundary(input: { width?: number; height?: number; format?: "png" | "jpeg" | "webp"; bytes?: number }) {
	const width = input.width ?? 16;
	const height = input.height ?? 16;
	const format = input.format ?? "png";
	const raster = sharp({ create: { width, height, channels: 3, background: { r: 32, g: 91, b: 143 } } });
	const encoded = await raster[format]().toBuffer();
	if (input.bytes !== undefined && input.bytes < encoded.length) throw new Error("Boundary fixture is smaller than its raster encoding");
	const buffer = input.bytes === undefined ? encoded : Buffer.concat([encoded, Buffer.alloc(input.bytes - encoded.length)]);
	return { name: `standby-${width}x${height}.${format}`, mimeType: `image/${format}`, buffer };
}
