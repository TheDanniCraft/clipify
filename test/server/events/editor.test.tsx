import { fireEvent, render, screen } from "@testing-library/react";
import EventEditor from "@/app/components/events/EventEditor";
import { createAwardConfiguration } from "@/app/lib/eventDefaults";
import { saveEventAction } from "@/app/actions/events";
jest.mock("@/app/actions/events", () => ({ saveEventAction: jest.fn(), saveEventPresentationAction: jest.fn(), rotateEventPresenterAction: jest.fn(), publishEventResultsAction: jest.fn() }));
jest.mock("@/app/components/events/EventDataResults", () => ({ __esModule: true, default: () => null }));
jest.mock("@/app/components/events/EventReview", () => ({ __esModule: true, default: () => null }));
jest.mock("@/app/components/events/EventConnections", () => ({ __esModule: true, default: () => null }));
jest.mock("@/app/components/events/EventRoadmap", () => ({ __esModule: true, default: () => null }));
jest.mock("@/app/components/events/EventCategories", () => ({ __esModule: true, default: () => null }));
jest.mock("@/app/components/events/EventDeckEditor", () => ({ __esModule: true, default: () => null }));
it("retains edits after a failed save and explains recovery", async () => {
	jest.mocked(saveEventAction).mockResolvedValue({ ok: false, code: "CONFLICT" });
	const initial = { id: "8c317b25-5083-4cae-b939-0487a7fa8ff6", ownerId: "host", configuration: createAwardConfiguration("Awards", "UTC"), revision: 1, publishedAt: null, resultsPublishedAt: null, reviewReleased: false, frozenAt: null, frozenResults: null, createdAt: new Date(), updatedAt: new Date() };
	render(<EventEditor creatorId='host' initial={initial} />);
	fireEvent.change(screen.getByLabelText("Event title"), { target: { value: "Babbler Awards" } });
	fireEvent.click(screen.getByRole("button", { name: "Save event" }));
	expect(await screen.findByRole("alert")).toHaveTextContent("changed");
	expect(screen.getByLabelText("Event title")).toHaveValue("Babbler Awards");
});

jest.mock("@/app/components/upgradeModal", () => ({ __esModule: true, default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div role='dialog' aria-label='Upgrade event branding' /> : null) }));
it("opens the existing Pro upgrade flow without changing an unavailable white-label value", async () => {
	const initial = { id: "8c317b25-5083-4cae-b939-0487a7fa8ff6", ownerId: "host", configuration: createAwardConfiguration("Awards", "UTC"), revision: 1, publishedAt: null, resultsPublishedAt: null, reviewReleased: false, frozenAt: null, frozenResults: null, createdAt: new Date(), updatedAt: new Date() };
	jest.mocked(saveEventAction).mockResolvedValue({ ok: false, code: "PRO_REQUIRED" });
	render(<EventEditor creatorId='host' user={{ id: "host" } as never} canWhiteLabel={false} initial={initial} />);
	fireEvent.click(screen.getByRole("switch"));
	expect(screen.getByRole("dialog", { name: "Upgrade event branding" })).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Save event" }));
	await screen.findByRole("alert");
	expect(saveEventAction).toHaveBeenLastCalledWith("host", initial.id, 1, expect.objectContaining({ whiteLabel: false }));
});

jest.mock("@/app/components/events/EventPresentationSettings", () => ({ __esModule: true, default: () => null }));
it("saves only presentation settings once an event is published", async () => {
	const { saveEventPresentationAction } = await import("@/app/actions/events");
	const initial = { id: "8c317b25-5083-4cae-b939-0487a7fa8ff6", ownerId: "host", configuration: createAwardConfiguration("Awards", "UTC"), revision: 2, publishedAt: new Date(), resultsPublishedAt: null, reviewReleased: false, frozenAt: null, frozenResults: null, createdAt: new Date(), updatedAt: new Date() };
	jest.mocked(saveEventPresentationAction).mockResolvedValue({ ok: false, code: "CONFLICT" });
	render(<EventEditor creatorId='host' initial={initial} />);
	fireEvent.click(screen.getByRole("button", { name: "Save presentation" }));
	expect(await screen.findByRole("alert")).toHaveTextContent("changed");
	expect(saveEventPresentationAction).toHaveBeenCalledWith("host", initial.id, 2, { slides: initial.configuration.slides, presentation: initial.configuration.presentation });
});

it.each([
	["New presenter link", "rotateEventPresenterAction", "The presenter link could not be created. Please retry."],
	["Publish results", "publishEventResultsAction", "Results could not be published. Please retry."],
] as const)("recovers from a failed %s request", async (label, action, feedback) => {
	const actions = await import("@/app/actions/events");
	jest.mocked(actions[action]).mockRejectedValueOnce(new Error("Network unavailable"));
	const configuration = createAwardConfiguration("Awards", "UTC");
	configuration.schedule = { ...configuration.schedule, submissionsStart: "2020-01-01T00:00:00Z", submissionsEnd: "2020-01-02T00:00:00Z", votingStart: "2020-01-03T00:00:00Z", votingEnd: "2020-01-04T00:00:00Z" };
	const initial = { id: "8c317b25-5083-4cae-b939-0487a7fa8ff6", ownerId: "host", configuration, revision: 1, publishedAt: new Date(), resultsPublishedAt: null, reviewReleased: true, frozenAt: null, frozenResults: null, createdAt: new Date(), updatedAt: new Date() };
	render(<EventEditor creatorId='host' initial={initial} />);
	fireEvent.click(screen.getByRole("button", { name: label }));
	expect(await screen.findByRole("alert")).toHaveTextContent(feedback);
	expect(screen.getByRole("button", { name: label })).toBeEnabled();
});
