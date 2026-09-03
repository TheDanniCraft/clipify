import fs from "fs/promises";
import path from "path";
import { renderLlmsFullText } from "@lib/llmsContent";

export async function GET() {
	const filePath = path.join(process.cwd(), "src", "app", "llms-full.txt", "llms-full.txt");
	const template = await fs.readFile(filePath, "utf-8");
	return new Response(renderLlmsFullText(template), {
		headers: {
			"Content-Type": "text/plain",
		},
	});
}
