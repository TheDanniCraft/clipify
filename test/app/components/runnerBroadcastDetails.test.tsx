import { render, screen, fireEvent } from "@testing-library/react";
import BroadcastDetails from "@/app/components/runner/BroadcastDetails";
jest.mock("@/app/actions/runner", () => ({ searchRunnerTwitchCategories: jest.fn(), uploadRunnerScheduleThumbnail: jest.fn() }));
jest.mock("@/app/components/runner/ImageDropZone", () => ({ __esModule: true, default: () => null }));
test("PC-6 a selected manual destination offers account management without discarding the event draft", () => {
	const manage = jest.fn();
	render(<BroadcastDetails ownerId='owner' runnerId='runner' targets={[{ id: "target", name: "Twitch", provider: "twitch" }]} eventTitle='Vacation' enabled={false} details={[]} disabled={false} onEnabledChange={jest.fn()} onChange={jest.fn()} onBusyChange={jest.fn()} onManage={manage} />);
	fireEvent.click(screen.getByRole("button", { name: "Manage destinations" }));
	expect(manage).toHaveBeenCalledTimes(1);
});
test("PC-4 keeping the current category clears its saved label as well as its identifier", () => {
	const change = jest.fn();
	render(<BroadcastDetails ownerId='owner' runnerId='runner' targets={[{ id: "target", name: "Twitch", provider: "twitch", connectionId: "connection" }]} eventTitle='Vacation' enabled details={[{ destinationId: "target", categoryId: "509658", categoryName: "Just Chatting" }]} disabled={false} onEnabledChange={jest.fn()} onChange={change} onBusyChange={jest.fn()} onManage={jest.fn()} />);
	fireEvent.click(screen.getByRole("button", { name: "Keep current category" }));
	expect(change.mock.calls[0][0][0].categoryId).toBeUndefined();
	expect(change.mock.calls[0][0][0].categoryName).toBeUndefined();
});
