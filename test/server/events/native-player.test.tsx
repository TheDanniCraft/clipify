import { fireEvent, render, screen } from "@testing-library/react";
const attach = jest.fn();
jest.mock("@/app/lib/eventAudio", () => ({ attachEventAudio: (...args: unknown[]) => attach(...args) }));
import EventNativePlayer from "@/app/components/events/EventNativePlayer";
beforeEach(() => {
	localStorage.clear();
	attach.mockReset();
});
it("remembers volume and mute when a different nominee is opened", () => {
	const view = render(<EventNativePlayer src='/api/events/one/clips/first' title='First' onError={() => {}} />);
	const first = screen.getByLabelText("First") as HTMLVideoElement;
	first.volume = 0.3;
	fireEvent.volumeChange(first);
	fireEvent.click(screen.getByRole("button", { name: "Mute event audio" }));
	view.unmount();
	render(<EventNativePlayer src='/api/events/one/clips/second' title='Second' onError={() => {}} />);
	const second = screen.getByLabelText("Second") as HTMLVideoElement;
	expect(second.volume).toBeCloseTo(0.3);
	expect(second.muted).toBe(true);
});
it("reuses the audio graph when leveling is toggled and releases it on close", () => {
	const graph = { setEnabled: jest.fn(), dispose: jest.fn() };
	attach.mockReturnValue(graph);
	const view = render(<EventNativePlayer src='/api/events/one/clips/first' title='First' onError={() => {}} />);
	const toggle = screen.getByRole("switch", { name: "Level audio" });
	fireEvent.click(toggle);
	fireEvent.click(toggle);
	fireEvent.click(toggle);
	expect(attach).toHaveBeenCalledTimes(1);
	expect(graph.setEnabled).toHaveBeenLastCalledWith(true);
	view.unmount();
	expect(graph.dispose).toHaveBeenCalledTimes(1);
});
it("does not route unapproved cross-origin media into Web Audio", () => {
	render(<EventNativePlayer src='https://external.invalid/video.mp4' title='Remote' onError={() => {}} />);
	expect(screen.getByRole("switch", { name: "Level audio" })).toBeDisabled();
	expect(attach).not.toHaveBeenCalled();
});
