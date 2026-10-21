import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

/** Native ESM removes CommonJS export-analysis annotations from source mappings. */
export async function buildMcpCoverageProbes({ outputDirectory, instrument = false }) {
	const directory = resolve(outputDirectory);
	mkdirSync(directory, { recursive: true });
	const pkg = JSON.parse(readFileSync("package.json", "utf8"));
	const probes = readdirSync("test/support/mcp").filter((file) => file.endsWith("-probe.ts"));
	const plugins = [];
	if (instrument) {
		const { projectConfig } = await require("jest-config").readConfig({ _: [], $0: "mcp-probe-coverage" }, process.cwd());
		const transformer = await require("@jest/transform").createScriptTransformer(projectConfig);
		const { readMcpSourceManifest } = await import("./check-mcp-coverage.mjs");
		const required = new Set(readMcpSourceManifest().feature.map((path) => resolve(path)));
		plugins.push({
			name: "same-jest-source-counters",
			setup(build) {
				build.onLoad({ filter: /\.[jt]sx?$/ }, (args) => {
					if (!required.has(resolve(args.path))) return;
					const transformed = transformer.transformSource(args.path, readFileSync(args.path, "utf8"), { instrument: true, supportsStaticESM: false, supportsDynamicImport: false, supportsExportNamespaceFrom: false, supportsTopLevelAwait: false });
					return { contents: transformed.code, loader: "js", resolveDir: dirname(args.path) };
				});
			},
		});
	}

	await build({
		entryPoints: probes.map((file) => `test/support/mcp/${file}`),
		outdir: directory,
		outExtension: { ".js": ".mjs" },
		bundle: true,
		platform: "node",
		format: "esm",
		target: "node22",
		sourcemap: "inline",
		external: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }),
		tsconfig: "tsconfig.json",
		...(instrument
			? {
					banner: {
						js: `import "next/dist/server/node-environment-baseline.js";import {createRequire as __mcpCreateRequire} from "node:module";import {mkdirSync as __mcpMkdir,writeFileSync as __mcpWrite} from "node:fs";import {join as __mcpJoin} from "node:path";const require=__mcpCreateRequire(import.meta.url);process.once("exit",()=>{const folder=process.env.MCP_ISTANBUL_COVERAGE_DIR;if(folder&&globalThis.__coverage__){__mcpMkdir(folder,{recursive:true});__mcpWrite(__mcpJoin(folder,"istanbul-"+process.pid+"-"+Date.now()+".json"),JSON.stringify(globalThis.__coverage__));}});`,
					},
				}
			: { banner: { js: `import "next/dist/server/node-environment-baseline.js";` } }),
		plugins: [
			...plugins,
			{
				name: "installed-server-compatible-export",
				setup(build) {
					// Match the actual CommonJS server utility used by direct Node+tsx entries; do not mock it.
					build.onResolve({ filter: /^nextjs-turnstile$/ }, () => ({ path: require.resolve("nextjs-turnstile"), external: true }));
					build.onResolve({ filter: /^@sentry\/nextjs$/ }, () => ({ path: resolve("test/support/mcp/sentry-native-exports.mjs") }));
				},
			},
		],
		// Next package subpaths are extensionless in webpack/tsx, but native ESM requires their real files.
		alias: { "next/headers": "next/headers.js", "next/cache": "next/cache.js", "next/navigation": "next/dist/client/components/navigation.react-server.js", "next/server": "next/server.js", "rate-limiter-flexible/lib/RateLimiterMemory": "rate-limiter-flexible/lib/RateLimiterMemory.js" },
		logLevel: "error",
	});
}
