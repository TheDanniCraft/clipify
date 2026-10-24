import { POST } from "@/app/api/runner/terminal/route";
async function main() {
	try {
		const input = JSON.parse(process.argv[2]);
		const response = await POST(new Request("http://127.0.0.1:3107/api/runner/terminal", { method: "POST", headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json" }, body: JSON.stringify(input.body) }));
		console.log(JSON.stringify({ status: response.status, noStore: response.headers.get("Cache-Control") === "no-store", body: await response.json() }));
	} finally {
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
