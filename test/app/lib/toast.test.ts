jest.mock("@heroui/react", () => {
	const toast = Object.assign(jest.fn(), {
		success: jest.fn(),
		warning: jest.fn(),
		danger: jest.fn(),
		info: jest.fn(),
	});
	return { toast };
});

import { notify } from "@lib/toast";

const mockedToast = jest.requireMock("@heroui/react").toast;

describe("toast adapter", () => {
	beforeEach(() => jest.clearAllMocks());

	it("dispatches success notifications through the v3 helper", () => {
		notify({ title: "Saved", description: "Done", color: "success" });
		expect(mockedToast.success).toHaveBeenCalledWith("Saved", { description: "Done", timeout: undefined });
	});

	it("uses the base toast for default notifications", () => {
		notify({ title: "Working", timeout: 8000 });
		expect(mockedToast).toHaveBeenCalledWith("Working", { description: undefined, timeout: 8000 });
	});
});
