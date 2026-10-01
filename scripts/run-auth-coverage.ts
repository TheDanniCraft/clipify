import { spawnSync } from "node:child_process";

if (!process.env.AUTH_CUTOVER_TEST_DATABASE_URL) {
	throw new Error("AUTH_CUTOVER_TEST_DATABASE_URL_REQUIRED: run this gate through Infisical against the disposable development database");
}

const productionFiles = ["src/auth/session.ts", "src/auth/memberships.ts", "src/auth/invitations.ts", "src/auth/rate-limit.ts", "src/auth/transactional-mail.ts", "src/server/notifications/outbox.ts", "src/server/agencies/database.ts", "src/server/account-lifecycle/database.ts", "scripts/auth-cutover/postgres.ts"];

const result = spawnSync(process.platform === "win32" ? "bunx.exe" : "bunx", ["jest", "test/auth-engine-rewrite", "--runInBand", "--coverage", "--coverageDirectory=coverage/auth-engine-rewrite", `--coverageThreshold=${JSON.stringify({ global: { branches: 90, functions: 95, lines: 95, statements: 95 } })}`, ...productionFiles.map((file) => `--collectCoverageFrom=${file}`)], { env: process.env, stdio: "inherit" });

if (result.error) throw result.error;
process.exit(result.status ?? 1);
