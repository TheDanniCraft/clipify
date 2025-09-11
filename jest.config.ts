import type { Config } from "jest";

const config: Config = {
	coverageDirectory: "coverage",
	passWithNoTests: true,
	coverageProvider: "v8",
	projects: ["<rootDir>/jest.dom.config.ts", "<rootDir>/jest.node.config.ts"],
};

export default config;
