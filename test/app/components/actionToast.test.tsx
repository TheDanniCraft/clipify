import { render } from "@testing-library/react";
import ActionToast from "@components/actionToast";
import { notify } from "@lib/toast";
jest.mock("@lib/toast", () => ({ notify: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
it("announces an action return once and announces a changed outcome", () => {
	const view = render(<ActionToast title='Seat allocated' color='success' />);
	expect(notify).toHaveBeenCalledWith({ title: "Seat allocated", description: undefined, color: "success" });
	view.rerender(<ActionToast title='Seat allocated' color='success' />);
	expect(notify).toHaveBeenCalledTimes(1);
	view.rerender(<ActionToast title='Allocation failed' description='Try again' color='danger' />);
	expect(notify).toHaveBeenLastCalledWith({ title: "Allocation failed", description: "Try again", color: "danger" });
	expect(notify).toHaveBeenCalledTimes(2);
	expect(view.container).toBeEmptyDOMElement();
});
