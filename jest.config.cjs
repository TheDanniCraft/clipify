/* eslint-disable @typescript-eslint/no-require-imports */
const nextJest = require("next/jest");

const createJestConfig = nextJest({
	dir: "./",
});

const customJestConfig = {
	testEnvironment: "jsdom",
	setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
	testMatch: ["<rootDir>/test/**/*.test.ts", "<rootDir>/test/**/*.test.tsx"],
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/src/$1",
		"^@components/(.*)$": "<rootDir>/src/app/components/$1",
		"^@css/(.*)$": "<rootDir>/src/app/css/$1",
		"^@actions/(.*)$": "<rootDir>/src/app/actions/$1",
		"^@hooks/(.*)$": "<rootDir>/src/app/hooks/$1",
		"^@store/(.*)$": "<rootDir>/src/app/store/$1",
		"^@lib/(.*)$": "<rootDir>/src/app/lib/$1",
		"^@types$": "<rootDir>/src/app/lib/types.ts",
	},
	testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
	modulePathIgnorePatterns: ["<rootDir>/.next/"],
	collectCoverageFrom: [
		"src/app/actions/**/*.{ts,tsx}",
		"src/app/lib/**/*.{ts,tsx}",
		"src/app/utils/**/*.{ts,tsx}",
		"src/app/auth/**/*.{ts,tsx}",
		"src/app/components/**/*.{ts,tsx}",
		"src/app/eventsub/**/*.{ts,tsx}",
		"src/app/llms.txt/**/*.{ts,tsx}",
		"src/app/payment/**/*.{ts,tsx}",
		"src/app/store/**/*.{ts,tsx}",
		"!src/app/components/DemoPlayer/**",
		"!src/app/components/AffiliatePage/**",
		"!src/app/components/LandingPage/**",
		"!src/app/components/chatWidget.tsx",
		"!src/app/components/construction.tsx",
		"!src/app/components/errorPage.tsx",
		"!src/app/components/footer.tsx",
		"!src/app/components/nextErrorPage.tsx",
		"!src/app/components/playerOverlay.tsx",
		"!src/app/components/tagsInput.tsx",
		"!src/app/components/upgradeModal.tsx",
		"!src/app/components/OverlayTable/index.tsx",
		"!src/app/components/Pricing/index.tsx",
		"!src/app/components/feedbackWidget/**",
		"!src/app/lib/entitlementsScheduler.ts",
	],
	coverageThreshold: {
		global: {
			branches: 50,
			functions: 65,
			lines: 60,
			statements: 60,
		},
	},
};

module.exports = createJestConfig(customJestConfig);
