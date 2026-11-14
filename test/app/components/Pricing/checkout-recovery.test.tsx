import { render, screen } from "@testing-library/react";
import CheckoutRecovery from "@components/Pricing/CheckoutRecovery";
import { setBrowserMeasurementConsent } from "@lib/consent/browserMeasurement";

afterEach(() => {
	setBrowserMeasurementConsent(false);
	delete window.umami;
});
test("offers retry only when a checkout selection survives, without sending measurement before consent", () => {
	const track = jest.fn();
	window.umami = { track, identify: jest.fn() };
	const view = render(<CheckoutRecovery status='unavailable' canRetry />);
	expect(screen.getByRole("link", { name: "Retry checkout" })).toHaveAttribute("href", "/checkout/continue");
	expect(track).not.toHaveBeenCalled();
	setBrowserMeasurementConsent(true);
	view.rerender(<CheckoutRecovery status='cancelled' canRetry={false} />);
	expect(screen.queryByRole("link", { name: "Retry checkout" })).not.toBeInTheDocument();
	expect(track).toHaveBeenCalledWith("checkout_returned", { reason: "cancelled" });
});
