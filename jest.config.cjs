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
		"^@store/(.*)$": "<rootDir>/src/app/store/$1",
		"^@lib/(.*)$": "<rootDir>/src/app/lib/$1",
		"^@types$": "<rootDir>/src/app/lib/types.ts",
	},
	testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
	modulePathIgnorePatterns: ["<rootDir>/.next/"],
	collectCoverageFrom: [
		"src/app/actions/adminView.ts",
		"src/app/actions/twitch.ts",
		"src/app/actions/utils.ts",
		"src/app/auth/route.ts",
		"src/app/components/dashboardNavbar.tsx",
		"src/app/components/featureCard.tsx",
		"src/app/components/confirmModal.tsx",
		"src/app/components/errorToast.tsx",
		"src/app/components/OverlayTable/use-memoized-callback.ts",
		"src/app/components/OverlayTable/Status.tsx",
		"src/app/components/OverlayTable/copy-text.tsx",
		"src/app/components/chatwootData.tsx",
		"src/app/components/floatingBanner.tsx",
		"src/app/components/adminHealthCharts.tsx",
		"src/app/components/adminUserExplorer.tsx",
		"src/app/components/logo.tsx",
		"src/app/components/overlayPlayer.tsx",
		"src/app/components/roadmap/roadmapItem.tsx",
		"src/app/components/scrollingBanner.tsx",
		"src/app/eventsub/route.ts",
		"src/app/lib/featureAccess.ts",
		"src/app/lib/clipCacheScheduler.ts",
		"src/app/lib/instanceHealth.ts",
		"src/app/lib/paywallTracking.ts",
		"src/app/llms.txt/route.ts",
		"src/app/payment/webhook/route.ts",
		"src/app/store/overlaySubscribers.ts",
		"src/app/utils/regexFilter.ts",
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
