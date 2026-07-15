import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
for (const key of ["--platform", "--target", "--binary", "--fingerprint", "--commit"]) if (!args.get(key)) throw new Error(`Missing ${key}`);
const binary = args.get("--binary");
const content = readFileSync(binary);
const metadata = {
  platform: args.get("--platform"), target: args.get("--target"),
  filename: binary.split(/[\\/]/).pop(), sourceFingerprint: args.get("--fingerprint"),
  sourceCommit: args.get("--commit"), sha256: createHash("sha256").update(content).digest("hex"),
  size: statSync(binary).size,
};
mkdirSync(process.env.RUNNER_ARTIFACT_DIR, { recursive: true });
copyFileSync(binary, `${process.env.RUNNER_ARTIFACT_DIR}/${metadata.filename}`);
writeFileSync(`${process.env.RUNNER_ARTIFACT_DIR}/metadata.json`, `${JSON.stringify(metadata, null, 2)}\n`);
