import { writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
/** Keep the source server responsive while the genuinely cold native child captures it. */
export async function observeColdRestart(directory, input) {
	const inputPath = join(directory, "cold-restart-input.json");
	writeFileSync(inputPath, JSON.stringify(input), { mode: 0o600 });
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [join(input.packageRoot, "test/support/schedule-restart-probe.mjs"), inputPath], { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "",
			stderr = "";
		const timeout = setTimeout(() => {
			child.kill("SIGKILL");
			reject(new Error("Cold restart child exceeded its observation deadline"));
		}, 35000);
		child.stdout.on("data", (chunk) => (stdout += chunk));
		child.stderr.on("data", (chunk) => (stderr += chunk));
		child.on("error", (error) => {
			clearTimeout(timeout);
			reject(error);
		});
		child.on("close", (code) => {
			clearTimeout(timeout);
			if (code !== 0) reject(new Error("Cold restart child failed: " + stderr));
			else
				resolve(
					JSON.parse(
						stdout
							.trim()
							.split("\n")
							.findLast((line) => line.startsWith("{")),
					),
				);
		});
	});
}
