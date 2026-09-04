/* eslint-disable @typescript-eslint/no-require-imports */
const nextJest = require("next/jest");

const createJestConfig = nextJest({
	dir: "./",
});

const customJestConfig = {
	testEnvironment: "jsdom",
	setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
	// Keep the checkout path out of globs: Windows escapes a dot-prefixed
	// worktree directory in <rootDir>, preventing test discovery.
	roots: ["<rootDir>/test", "<rootDir>/src"],
	testMatch: ["**/test/**/*.test.ts", "**/test/**/*.test.tsx", "**/src/**/__tests__/**/*.test.ts", "**/src/**/__tests__/**/*.test.tsx"],
	moduleNameMapper: {
		"^@heroui/react$": "<rootDir>/test/__mocks__/heroui-react.cjs",
		"^@heroui/styles$": "<rootDir>/test/__mocks__/heroui-styles.cjs",
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
		"src/app/gallery/**/*.{ts,tsx}",
		"src/app/dashboard/galleries/**/*.{ts,tsx}",
		"src/app/api/gallery/**/*.{ts,tsx}",
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
		"src/app/actions/gallery.ts": {
			branches: 90,
			functions: 95,
			lines: 95,
			statements: 95,
		},
		"src/app/lib/gallery.ts": {
			branches: 90,
			functions: 95,
			lines: 95,
			statements: 95,
		},
		"src/app/components/gallery/**/*.{ts,tsx}": {
			branches: 90,
			functions: 95,
			lines: 95,
			statements: 95,
		},
	},
};

module.exports = createJestConfig(customJestConfig);
