import { readFile } from "node:fs/promises";
import { join } from "node:path";
export const runtime = "nodejs";
const files: Record<string, string> = { "DejaVu Sans": "DejaVuSans", "DejaVu Serif": "DejaVuSerif", "DejaVu Sans Mono": "DejaVuSansMono" };
export async function GET(request: Request) {
	const params = new URL(request.url).searchParams,
		family = params.get("family") ?? "",
		weight = params.get("weight") ?? "400";
	if (!Object.hasOwn(files, family) || !["400", "700"].includes(weight)) return new Response(null, { status: 404 });
	try {
		const bytes = await readFile(join(process.cwd(), "public/fonts/brand", `${files[family]}${weight === "700" ? "-Bold" : ""}.ttf`));
		return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "font/ttf", "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
	} catch {
		return new Response(null, { status: 503 });
	}
}
