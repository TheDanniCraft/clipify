import fs from "fs/promises";
import path from "path";
import { renderLlmsText } from "@lib/llmsContent";

export async function GET() {
	const filePath = path.join(process.cwd(), "src", "app", "llms.txt", "llms.txt");
	const content = await fs.readFile(filePath, "utf-8");
	return new Response(renderLlmsText(content), {
		headers: {
			"Content-Type": "text/plain",
		},
	});
}
