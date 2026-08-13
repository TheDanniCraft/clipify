import { act, renderHook } from "@testing-library/react";
import { QUALIFIED_PLAYBACK_MS, useQualifiedPlayback } from "@/app/hooks/useQualifiedPlayback";

describe("useQualifiedPlayback", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it("qualifies a clip only after five seconds of actual playing time", () => {
		const onQualified = jest.fn();
		const { result } = renderHook(() => useQualifiedPlayback("clip-a", onQualified));

		act(() => {
			result.current.onPlaying();
			jest.advanceTimersByTime(3_000);
			result.current.onWaiting();
			jest.advanceTimersByTime(10_000);
		});
		expect(onQualified).not.toHaveBeenCalled();

		act(() => {
			result.current.onPlaying();
			jest.advanceTimersByTime(QUALIFIED_PLAYBACK_MS - 3_001);
		});
		expect(onQualified).not.toHaveBeenCalled();

		act(() => jest.advanceTimersByTime(1));
		expect(onQualified).toHaveBeenCalledTimes(1);

		act(() => {
			result.current.onPause();
			result.current.onPlaying();
			jest.advanceTimersByTime(QUALIFIED_PLAYBACK_MS);
		});
		expect(onQualified).toHaveBeenCalledTimes(1);
	});

	it("discards partial playback when the selected clip changes", () => {
		const onQualified = jest.fn();
		const { result, rerender } = renderHook(({ clipId }) => useQualifiedPlayback(clipId, onQualified), { initialProps: { clipId: "clip-a" } });

		act(() => {
			result.current.onPlaying();
			jest.advanceTimersByTime(4_000);
		});
		rerender({ clipId: "clip-b" });
		act(() => {
			result.current.onPlaying();
			jest.advanceTimersByTime(1_001);
		});
		expect(onQualified).not.toHaveBeenCalled();
	});
});
