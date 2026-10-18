import { readNativeTestRuntime } from "./native-test-shims.mjs";

export async function ensureDependencies() {
	const { chromePath, ffmpegPath } = readNativeTestRuntime();
	return { chromePath, ffmpegPath };
}
