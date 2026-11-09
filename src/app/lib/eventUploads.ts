import { z } from "zod";
export const MAX_EVENT_UPLOAD_BYTES = 100 * 1024 * 1024;
export const eventUploadMimes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "video/mp4", "video/webm", "audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav", "audio/flac"] as const;
export const uploadInputSchema = z.object({ mime: z.enum(eventUploadMimes), size: z.number().int().min(1).max(MAX_EVENT_UPLOAD_BYTES), title: z.string().trim().min(1).max(160), description: z.string().max(5000).default("") }).strict();
