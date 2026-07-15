import { spawn } from "node:child_process";

const binary = process.argv[2];
if (!binary) throw new Error("Usage: node scripts/run-runner-self-test.mjs <binary>");

const timeoutMs = 20_000;
const child = spawn(binary, ["--self-test"], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
let stdout = "";
let stderr = "";
let timedOut = false;
child.stdout.on("data", (chunk) => { stdout += chunk; });
child.stderr.on("data", (chunk) => { stderr += chunk; });

const timer = setTimeout(() => {
	timedOut = true;
	child.kill();
}, timeoutMs);

const exitCode = await new Promise((resolve, reject) => {
	child.once("error", reject);
	child.once("exit", (code, signal) => resolve({ code, signal }));
});
clearTimeout(timer);

if (timedOut) throw new Error(`Runner self-test timed out after ${timeoutMs}ms`);
if (exitCode.code !== 0) throw new Error(`Runner self-test exited with ${exitCode.code ?? `signal ${exitCode.signal}`}\n${stdout}${stderr}`);
if (!stdout.includes("Clipify Runner self-test passed")) throw new Error(`Runner self-test did not report success\n${stdout}${stderr}`);
console.log(stdout.trim());
