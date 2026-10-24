import { act, render, screen } from "@testing-library/react";
import AppearancePreview from "@/app/components/runner/AppearancePreview";
jest.mock("@/app/components/overlayPlayer", () => ({ __esModule: true, default: () => <div data-testid='player' /> }));
jest.mock("@/app/components/runnerGeneratedPresentation", () => ({
	__esModule: true,
	default: ({ children, ...props }: Record<string, unknown>) => (
		<div data-testid='presentation' data-settings={JSON.stringify(props)}>
			{children as React.ReactNode}
		</div>
	),
}));
const runnerId = "11111111-1111-4111-8111-111111111111";
const draft = { watermarkCorner: "bottom_right" as const, proShowAttribution: false, standbyBackgroundColor: "#16324f", backgroundAssetId: null, logoAssetId: null, message: "Saved", showNextBroadcastTime: true, previewMode: "standby" as const };
function setup(paid = true) {
	return render(<AppearancePreview runnerId={runnerId} overlay={{ id: "overlay" } as never} overlaySecret='owned-secret' runnerPro={paid} validUntil={null} initial={draft} nextBroadcast={null} />);
}
function send(changes: Record<string, unknown>, override: Record<string, unknown> = {}) {
	const next = { ...draft, ...changes };
	act(() => window.dispatchEvent(new MessageEvent("message", { origin: location.origin, source: window.parent, data: { type: "clipify:runner-preview", runnerId, draft: next, revision: JSON.stringify(next) }, ...override })));
}
function settings() {
	return JSON.parse(screen.getByTestId("presentation").getAttribute("data-settings")!);
}
afterEach(() => jest.restoreAllMocks());
test("UX-C3: message edits update presentation without remounting the player", () => {
	setup();
	const player = screen.getByTestId("player");
	send({ message: "Back soon", standbyBackgroundColor: "#abcdef", watermarkCorner: "top_left" });
	expect(settings()).toMatchObject({ standbyMessage: "Back soon", standbyBackgroundColor: "#abcdef", watermarkCorner: "top_left" });
	expect(screen.getByTestId("player")).toBe(player);
});
test.each(["foreign origin", "foreign source", "wrong runner", "invalid color", "oversized text", "mismatched revision"])("UX-C3: rejects %s preview messages", (boundary) => {
	setup();
	const next = { ...draft, message: "Untrusted" };
	const data = { type: "clipify:runner-preview", runnerId, draft: next, revision: JSON.stringify(next) };
	if (boundary === "wrong runner") data.runnerId = "another";
	if (boundary === "invalid color") next.standbyBackgroundColor = "red";
	if (boundary === "oversized text") next.message = "x".repeat(161);
	if (boundary === "mismatched revision") data.revision = "wrong";
	act(() => window.dispatchEvent(new MessageEvent("message", { origin: boundary === "foreign origin" ? "https://foreign.invalid" : location.origin, source: boundary === "foreign source" ? null : window.parent, data })));
	expect(settings().standbyMessage).toBe("Saved");
});
test("UX-C3: Free cannot apply paid fields or hide attribution through a message", () => {
	setup(false);
	send({ message: "Paid draft", standbyBackgroundColor: "#abcdef", proShowAttribution: false, backgroundAssetId: "33333333-3333-4333-8333-333333333333" });
	expect(settings()).toMatchObject({ attributionRequired: true, runnerPro: false });
	expect(settings().standbyMessage).toBeUndefined();
	expect(settings().standbyBackgroundImageUrl).toBeUndefined();
});
test("UX-C3: empty image drafts clear paid images and playback mode explicitly remounts player", () => {
	setup();
	const player = screen.getByTestId("player");
	send({ backgroundAssetId: "33333333-3333-4333-8333-333333333333" });
	expect(settings().standbyBackgroundImageUrl).toContain("/assets/33333333");
	send({ backgroundAssetId: null, logoAssetId: null, previewMode: "playback" });
	expect(settings().standbyBackgroundImageUrl).toBeUndefined();
	expect(screen.getByTestId("player")).not.toBe(player);
});
