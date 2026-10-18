const critical = ["execution-runtime", "execution-journal", "execution-keys", "terminal-credentials", "terminal-delivery", "storage", "schedule-cache", "presentation-bootstrap"];
const ordinary = ["engine", "index", "output", "presentation", "schedule"];

module.exports = {
	testEnvironment: "node",
	testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts", "<rootDir>/test/**/*.test.ts"],
	collectCoverageFrom: [...critical, ...ordinary].map((name) => `src/${name}.ts`),
	coverageReporters: ["json", "text-summary", "lcov"],
	coverageThreshold: {
		global: { statements: 90, functions: 90, lines: 90, branches: 85 },
		...Object.fromEntries(critical.map((name) => [`./src/${name}.ts`, { statements: 95, functions: 95, lines: 95, branches: 90 }])),
	},
	transform: {
		"^.+\\.tsx?$": ["@swc/jest", { jsc: { parser: { syntax: "typescript" }, target: "es2022" }, module: { type: "commonjs" } }],
	},
};
