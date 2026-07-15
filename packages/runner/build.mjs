import { build } from "esbuild";
import { execFileSync, execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as resedit from "resedit";

const runnerRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(runnerRoot, "../..");
const buildRoot = path.join(runnerRoot, "build");
const downloadsDir = path.join(projectRoot, "public", "downloads", "runner");

function getFileHash(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function getLdidPath() {
  try {
    return execSync("command -v ldid", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    return null;
  }
}

// Prefer an explicit deployment URL. Local development targets the local app, while a non-CI fallback remains usable for released binaries.
const bakedApiUrl = process.env.CLIPIFY_RUNNER_API_URL || (process.env.CI ? undefined : process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://clipify.us");
if (!bakedApiUrl) throw new Error("CLIPIFY_RUNNER_API_URL is required for Runner packaging");
const normalizedApiUrl = new URL(bakedApiUrl).toString().replace(/\/$/, "");
console.log(`[Builder] Baking runner API URL: ${normalizedApiUrl}`);

await build({
  entryPoints: [path.join(runnerRoot, "src", "index.ts")],
  bundle: true,
  platform: "node",
  outfile: path.join(buildRoot, "runner.js"),
  external: ["@napi-rs/keyring"],
  loader: { ".node": "file" },
  nodePaths: [path.join(runnerRoot, "node_modules")],
  define: { "process.env.BAKED_API_URL": JSON.stringify(normalizedApiUrl) },
});

console.log("[Builder] Bundled successfully. Compiling executables with @yao-pkg/pkg...");
const ldidPath = getLdidPath();
const pkgEnv = { ...process.env };
if (ldidPath) {
  pkgEnv.PATH = `${path.dirname(ldidPath)}${path.delimiter}${pkgEnv.PATH || ""}`;
  console.log(`[Builder] macOS ad-hoc signing available via ldid: ${ldidPath}`);
} else {
  console.warn("[Builder] macOS ad-hoc signing skipped; build in Docker for signed macOS artifacts.");
}

const pkgScript = path.join(runnerRoot, "node_modules", "@yao-pkg", "pkg", "lib-es5", "bin.js");
const pkgBin = process.platform === "win32" ? "node" : path.join(runnerRoot, "node_modules", ".bin", "pkg");
if (!fs.existsSync(pkgScript)) throw new Error(`@yao-pkg/pkg script not found at ${pkgScript}`);
if (process.platform !== "win32" && !fs.existsSync(pkgBin)) throw new Error(`@yao-pkg/pkg executable not found at ${pkgBin}`);

const pkgTargets = process.env.RUNNER_PKG_TARGETS ?? "node24-win-x64,node24-linux-x64,node24-linux-arm64,node24-macos-x64,node24-macos-arm64";
console.log(`[Builder] Packaging targets: ${pkgTargets}`);
for (const generatedName of ["runner", "runner.exe", "runner-win.exe", "runner-win-x64.exe", "runner-linux", "runner-linux-x64", "runner-linux-arm64", "runner-macos", "runner-macos-x64", "runner-macos-arm64"]) {
  fs.rmSync(path.join(buildRoot, generatedName), { force: true });
}
const pkgArgs = process.platform === "win32" ? [pkgScript, path.join(buildRoot, "runner.js"), "-t", pkgTargets, "--out-path", buildRoot] : [path.join(buildRoot, "runner.js"), "-t", pkgTargets, "--out-path", buildRoot];
execFileSync(pkgBin, pkgArgs, { stdio: "inherit", env: pkgEnv });
console.log("[Builder] Runner executables generated successfully in build/!");

fs.mkdirSync(downloadsDir, { recursive: true });
const requestedTargets = new Set(pkgTargets.split(",").map((target) => target.trim()));
const findGeneratedBinary = (target, ...names) => requestedTargets.has(target) ? names.map((name) => path.join(buildRoot, name)).find((candidate) => fs.existsSync(candidate)) : undefined;
const binaries = [
  ["node24-win-x64", ["runner-win-x64.exe", "runner-win.exe", "runner.exe"], "clipify-runner-windows.exe"],
  ["node24-linux-x64", ["runner-linux-x64", "runner-linux", "runner"], "clipify-runner-linux"],
  ["node24-linux-arm64", ["runner-linux-arm64", "runner-linux", "runner"], "clipify-runner-linux-arm64"],
  ["node24-macos-x64", ["runner-macos-x64", "runner-macos", "runner"], "clipify-runner-macos"],
  ["node24-macos-arm64", ["runner-macos-arm64", "runner-macos", "runner"], "clipify-runner-macos-arm64"],
];

for (const [target, names, destination] of binaries) {
  const source = findGeneratedBinary(target, ...names);
  if (!source) continue;
  const destinationPath = path.join(downloadsDir, destination);
  fs.copyFileSync(source, destinationPath);
  if (target === "node24-win-x64") {
    try {
      const exe = resedit.NtExecutable.from(fs.readFileSync(destinationPath));
      const resource = resedit.NtExecutableResource.from(exe);
      const iconPath = path.join(projectRoot, "src", "app", "favicon.ico");
      if (fs.existsSync(iconPath)) {
        const iconFile = resedit.Data.IconFile.from(fs.readFileSync(iconPath));
        resedit.Resource.IconGroupEntry.replaceIconsForResource(resource.entries, 1, 1033, iconFile.icons.map((icon) => icon.data));
        resource.outputResource(exe);
        fs.writeFileSync(destinationPath, Buffer.from(exe.generate()));
      }
    } catch (error) {
      console.warn("[Builder] Failed to set executable icon:", error);
    }
  }
}

const hashes = {
  windows: fs.existsSync(path.join(downloadsDir, "clipify-runner-windows.exe")) ? getFileHash(path.join(downloadsDir, "clipify-runner-windows.exe")) : null,
  linux: fs.existsSync(path.join(downloadsDir, "clipify-runner-linux")) ? getFileHash(path.join(downloadsDir, "clipify-runner-linux")) : null,
  linuxArm: fs.existsSync(path.join(downloadsDir, "clipify-runner-linux-arm64")) ? getFileHash(path.join(downloadsDir, "clipify-runner-linux-arm64")) : null,
  macos: fs.existsSync(path.join(downloadsDir, "clipify-runner-macos")) ? getFileHash(path.join(downloadsDir, "clipify-runner-macos")) : null,
  macosArm: fs.existsSync(path.join(downloadsDir, "clipify-runner-macos-arm64")) ? getFileHash(path.join(downloadsDir, "clipify-runner-macos-arm64")) : null,
  updatedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(downloadsDir, "version.json"), JSON.stringify(hashes, null, 2));
console.log("[Builder] Copied binaries to public/downloads/runner/");
console.log("[Builder] Hashes generated:", hashes);
