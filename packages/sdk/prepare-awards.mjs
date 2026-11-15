import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sdk = fileURLToPath(new URL(".", import.meta.url));
const vendor = fileURLToPath(new URL("../../examples/babbler-awards/vendor/", import.meta.url));
mkdirSync(vendor, { recursive: true });
execFileSync("bun", ["run", "build"], { cwd: sdk, stdio: "inherit" });
execFileSync("python3", [fileURLToPath(new URL("pack.py", import.meta.url)), sdk, `${vendor}clipify-sdk-0.1.0.tgz`], { stdio: "inherit" });
