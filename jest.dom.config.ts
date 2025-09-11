import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
	displayName: "dom",
	testEnvironment: "jsdom",
	clearMocks: true,
	setupFilesAfterEnv: ["<rootDir>/jest.dom.setup.ts"],
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/src/$1",
		"^@components/(.*)$": "<rootDir>/src/app/components/$1",
		"^@css/(.*)$": "<rootDir>/src/app/css/$1",
		"^@actions/(.*)$": "<rootDir>/src/app/actions/$1",
		"^@types$": "<rootDir>/src/app/lib/types.ts",
	},
	testMatch: ["<rootDir>/src/test/**/*.(spec|test).tsx", "<rootDir>/**/*.client.(spec|test).tsx", "<rootDir>/**/?(*.)+(spec|test).tsx"],
};

export default createJestConfig(config);
