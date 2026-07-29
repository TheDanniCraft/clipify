import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import RunnerEnrollForm from "@/app/runner/enroll/runner-enroll-form";

const mockSubmitRunnerEnrollCode = jest.fn();

jest.mock("@/app/runner/enroll/actions", () => ({
	submitRunnerEnrollCode: (...args: unknown[]) => mockSubmitRunnerEnrollCode(...args),
}));

jest.mock("@actions/runner", () => ({
	createOwnRunner: jest.fn(),
}));

jest.mock("next/navigation", () => ({
	useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

describe("RunnerEnrollForm", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockSubmitRunnerEnrollCode.mockResolvedValue({ status: "idle" });
	});

	it("prefills a verification URL code but waits for Continue before submitting", async () => {
		render(<RunnerEnrollForm initialCode='ABCD-2345' />);

		const continueButton = screen.getByRole("button", { name: "Continue" });
		expect(continueButton).toBeEnabled();
		expect(mockSubmitRunnerEnrollCode).not.toHaveBeenCalled();

		fireEvent.click(continueButton);

		await waitFor(() => expect(mockSubmitRunnerEnrollCode).toHaveBeenCalledTimes(1));
		const formData = mockSubmitRunnerEnrollCode.mock.calls[0][1] as FormData;
		expect(formData.get("code")).toBe("ABCD-2345");
	});
});
