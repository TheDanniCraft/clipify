import React from "react";
import { render } from "@testing-library/react";
import ErrorToast from "@/app/components/errorToast";

const addToast = jest.fn();

jest.mock("@heroui/react", () => ({
	addToast: (...args: unknown[]) => addToast(...args),
	Code: ({ children }: { children: React.ReactNode }) => <code>{children}</code>,
}));

describe("components/ErrorToast", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("shows mapped state error with code", () => {
		render(<ErrorToast error='stateError' errorCode='ERR123' />);
		expect(addToast).toHaveBeenCalledTimes(1);
		const payload = addToast.mock.calls[0][0];
		expect(payload.title).toContain("State error");
		expect(payload.color).toBe("danger");
	});

	it("falls back to unknown error label", () => {
		render(<ErrorToast error='unexpected' errorCode='' />);
		const payload = addToast.mock.calls[0][0];
		expect(payload.title).toContain("Unknown error");
	});

	it("does nothing when error is empty", () => {
		render(<ErrorToast error='' errorCode='' />);
		expect(addToast).not.toHaveBeenCalled();
	});
});
