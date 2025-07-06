import fs from "fs/promises";
import path from "path";

export async function GET() {
	const filePath = path.join(process.cwd(), "src", "app", "llms.txt", "llms.txt");
	const content = await fs.readFile(filePath, "utf-8");
	return new Response(content, {
		headers: {
			"Content-Type": "text/plain",
		},
	});
}
