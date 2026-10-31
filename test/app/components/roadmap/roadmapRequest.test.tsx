/** @jest-environment node */
const connected = jest.fn();
const getItems = jest.fn(async () => []);
jest.mock("next/server", () => ({ connection: () => connected() }));
jest.mock("@lib/roadmap", () => ({ getRoadmapItems: () => getItems() }));
jest.mock("@components/footer", () => () => null);
jest.mock("@components/LandingPage/basicNavbar", () => () => null);
jest.mock("@components/LandingPage/publicPageHeader", () => () => null);
jest.mock("@components/roadmap/roadmapSections", () => () => null);
jest.mock("@components/roadmap/roadmapIcon", () => () => null);
import RoadmapPage from "@/app/roadmap/page";

it("waits for an incoming request before reading CMS milestones", async () => {
	let release!: () => void;
	connected.mockReturnValue(
		new Promise<void>((resolve) => {
			release = resolve;
		}),
	);
	const rendering = RoadmapPage();
	await Promise.resolve();
	expect(getItems).not.toHaveBeenCalled();
	release();
	await rendering;
	expect(getItems).toHaveBeenCalledTimes(1);
});
