module.exports = {
	testEnvironment: "node",
	testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts", "<rootDir>/test/**/*.test.ts"],
	transform: {
		"^.+\\.tsx?$": ["@swc/jest", { jsc: { parser: { syntax: "typescript" }, target: "es2022" }, module: { type: "commonjs" } }],
	},
};
