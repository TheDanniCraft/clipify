import { act, renderHook } from "@testing-library/react";
import { useMemoizedCallback } from "@/app/components/OverlayTable/use-memoized-callback";

describe("components/OverlayTable/useMemoizedCallback", () => {
	it("calls latest callback implementation after rerender", () => {
		const first = jest.fn((v: number) => v + 1);
		const second = jest.fn((v: number) => v + 2);

		const { result, rerender } = renderHook(({ cb }: { cb: (v: number) => number }) => useMemoizedCallback(cb), {
			initialProps: { cb: first },
		});

		expect(result.current(2)).toBe(3);
		expect(first).toHaveBeenCalledWith(2);

		rerender({ cb: second });

		let value = 0;
		act(() => {
			value = result.current(2);
		});

		expect(value).toBe(4);
		expect(second).toHaveBeenCalledWith(2);
	});
});
