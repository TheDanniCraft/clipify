import "server-only";
import { EventError } from "./persistence";
export { MAX_EVENT_UPLOAD_BYTES, eventUploadMimes, uploadInputSchema } from "@/app/lib/eventUploads";
import { MAX_EVENT_UPLOAD_BYTES } from "@/app/lib/eventUploads";
function hasSignature(bytes: Uint8Array, mime: string) {
	const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
	if (mime === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
	if (mime === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
	if (mime === "image/gif") return ["GIF87a", "GIF89a"].includes(ascii(0, 6));
	if (mime === "image/webp") return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
	if (mime === "image/avif") return ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12));
	if (mime === "video/mp4" || mime === "audio/mp4") return ascii(4, 8) === "ftyp";
	if (mime === "video/webm" || mime === "audio/webm") return [26, 69, 223, 163].every((byte, index) => bytes[index] === byte);
	if (mime === "audio/ogg") return ascii(0, 4) === "OggS";
	if (mime === "audio/wav") return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE";
	if (mime === "audio/flac") return ascii(0, 4) === "fLaC";
	if (mime === "audio/mpeg") return ascii(0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224);
	return false;
}
export function guardUploadBody(body: ReadableStream<Uint8Array>, expectedBytes: number, mime: string) {
	let total = 0,
		inspected = false;
	let head = new Uint8Array(0);
	return body.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				total += chunk.byteLength;
				if (total > expectedBytes || total > MAX_EVENT_UPLOAD_BYTES) throw new EventError("INVALID_INPUT");
				if (inspected) {
					controller.enqueue(chunk);
					return;
				}
				const combined = new Uint8Array(head.length + chunk.length);
				combined.set(head);
				combined.set(chunk, head.length);
				head = combined;
				if (head.length >= 16) {
					if (!hasSignature(head, mime)) throw new EventError("INVALID_INPUT");
					inspected = true;
					controller.enqueue(head);
					head = new Uint8Array(0);
				}
			},
			flush(controller) {
				if (total !== expectedBytes) throw new EventError("INVALID_INPUT");
				if (!inspected) {
					if (!hasSignature(head, mime)) throw new EventError("INVALID_INPUT");
					controller.enqueue(head);
				}
			},
		}),
	);
}
