import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
	displayName: "node",
	testEnvironment: "node",
	clearMocks: true,
	setupFilesAfterEnv: ["<rootDir>/jest.node.setup.ts"],
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/src/$1",
		"^@actions/(.*)$": "<rootDir>/src/app/actions/$1",
	},
	testMatch: ["<rootDir>/src/test/actions/**/*.(spec|test).ts", "<rootDir>/**/?(*.)+(server|api).(spec|test).ts"],
};

export default createJestConfig(config);
