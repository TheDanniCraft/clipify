import { act, render, screen, waitFor } from "@testing-library/react";
import { useNavigationGuard } from "nextjs-nav-guard";
import UmamiClient from "@/app/UmamiClient";

import { getAnalyticsIdentity } from "@/app/actions/analytics";
import { setBrowserMeasurementConsent } from "@/app/lib/consent/browserMeasurement";
const scriptReady: Record<string, () => void> = {};
const identifyConsent = jest.fn().mockResolvedValue(undefined);
let measurement = false;
let policyPending = false;
let pathname = "/";
jest.mock("c15t/next", () => ({ useConsent: () => measurement, useSnapshot: () => ({ policyPending }), useIdentify: () => identifyConsent }));
jest.mock("next/navigation", () => ({ usePathname: () => pathname }));
jest.mock("nextjs-nav-guard", () => ({ useNavigationGuard: jest.fn() }));
jest.mock("@/app/actions/analytics", () => ({ getAnalyticsIdentity: jest.fn().mockResolvedValue(null) }));
jest.mock("next/script", () => ({
	__esModule: true,
	default: (props: Record<string, unknown>) => {
		scriptReady[String(props.id)] = props.onReady as () => void;
		return <div data-testid={props.id} data-website={props["data-website-id"]} data-performance={props["data-performance"]} />;
	},
}));

afterEach(() => {
	measurement = false;
	setBrowserMeasurementConsent(false);
	jest.mocked(getAnalyticsIdentity).mockResolvedValue(null);
	delete window.umami;
	policyPending = false;
	pathname = "/";
	delete process.env.E2E_TEST_MODE;
	window.history.replaceState({}, "", "/");
});

it("loads baseline without statistics consent and keeps recorder absent", () => {
	render(<UmamiClient />);
	expect(screen.getByTestId("clipify-analytics")).toHaveAttribute("data-website", "cc971acc-716d-4056-a79c-3cfda9fb8e1d");
	expect(screen.getByTestId("clipify-analytics")).toHaveAttribute("data-performance", "false");
	expect(screen.queryByTestId("clipify-heatmaps")).not.toBeInTheDocument();
});

it("preserves baseline collection on editors", () => {
	pathname = "/dashboard/overlay/example";
	render(<UmamiClient />);
	expect(screen.getByTestId("clipify-analytics")).toBeInTheDocument();
	expect(screen.queryByTestId("clipify-heatmaps")).not.toBeInTheDocument();
});

it("does not race consent hydration or leak analytics from isolated E2E runs", () => {
	policyPending = true;
	const view = render(<UmamiClient />);
	expect(screen.queryByTestId("clipify-analytics")).not.toBeInTheDocument();
	policyPending = false;
	process.env.E2E_TEST_MODE = "true";
	view.rerender(<UmamiClient />);
	expect(screen.queryByTestId("clipify-analytics")).not.toBeInTheDocument();
});

it("never loads a heatmap recorder on a private page even after consent", () => {
	measurement = true;
	pathname = "/dashboard/settings";
	render(<UmamiClient />);
	expect(screen.getByTestId("clipify-analytics")).toHaveAttribute("data-performance", "true");
	expect(screen.queryByTestId("clipify-heatmaps")).not.toBeInTheDocument();
});

it("starts native heatmaps only after the consented tracker is ready", async () => {
	measurement = true;
	setBrowserMeasurementConsent(true);
	const view = render(<UmamiClient />);
	expect(screen.queryByTestId("clipify-heatmaps")).not.toBeInTheDocument();
	await act(async () => scriptReady["clipify-analytics"]());
	expect(screen.getByTestId("clipify-heatmaps")).toBeInTheDocument();
	expect(jest.mocked(useNavigationGuard)).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
	measurement = false;
	setBrowserMeasurementConsent(false);
	view.rerender(<UmamiClient />);
	expect(screen.queryByTestId("clipify-heatmaps")).not.toBeInTheDocument();
});

it("verifies c15t identity but never identifies the Umami account before statistics consent", async () => {
	const identity = { id: "verified-auth-id", identityToken: "signed-proof", plan: "free", access_source: "billing", is_paying: false } as Awaited<ReturnType<typeof getAnalyticsIdentity>>;
	jest.mocked(getAnalyticsIdentity).mockResolvedValue(identity);
	const identify = jest.fn();
	window.umami = { identify, track: jest.fn() };
	const view = render(<UmamiClient />);
	await act(async () => scriptReady["clipify-analytics"]());
	await waitFor(() => expect(identifyConsent).toHaveBeenCalledWith({ externalId: "verified-auth-id", identityToken: "signed-proof" }));
	expect(identify).not.toHaveBeenCalled();
	measurement = true;
	setBrowserMeasurementConsent(true);
	view.rerender(<UmamiClient />);
	await waitFor(() => expect(identify).toHaveBeenCalledWith("verified-auth-id", { plan: "free", access_source: "billing", is_paying: false }));
});

it("keeps native heatmaps off URLs containing checkout or authentication parameters", async () => {
	measurement = true;
	setBrowserMeasurementConsent(true);
	window.history.replaceState({}, "", "/?code=private");
	render(<UmamiClient />);
	await act(async () => scriptReady["clipify-analytics"]());
	expect(screen.queryByTestId("clipify-heatmaps")).not.toBeInTheDocument();
});

it("refreshes native plan properties after the same account upgrades", async () => {
	measurement = true;
	setBrowserMeasurementConsent(true);
	const identify = jest.fn();
	window.umami = { identify, track: jest.fn() };
	jest.mocked(getAnalyticsIdentity).mockResolvedValue({ id: "account", identityToken: "proof", plan: "free", access_source: "reverse_trial", is_paying: false });
	const view = render(<UmamiClient />);
	await act(async () => scriptReady["clipify-analytics"]());
	await waitFor(() => expect(identify).toHaveBeenCalledWith("account", { plan: "free", access_source: "reverse_trial", is_paying: false }));
	jest.mocked(getAnalyticsIdentity).mockResolvedValue({ id: "account", identityToken: "proof", plan: "pro", access_source: "billing", is_paying: true });
	pathname = "/dashboard";
	view.rerender(<UmamiClient />);
	await waitFor(() => expect(identify).toHaveBeenLastCalledWith("account", { plan: "pro", access_source: "billing", is_paying: true }));
});

it.each(["/embed/example", "/overlay/example", "/runner/presentation/example", "/runner/preview/example", "/demoPlayer"])("preserves runtime traffic without account identification at %s", async (path) => {
	pathname = path;
	measurement = true;
	setBrowserMeasurementConsent(true);
	jest.mocked(getAnalyticsIdentity).mockClear();
	render(<UmamiClient />);
	await act(async () => scriptReady["clipify-analytics"]());
	expect(getAnalyticsIdentity).not.toHaveBeenCalled();
	expect(screen.queryByTestId("clipify-heatmaps")).not.toBeInTheDocument();
});

it("includes authenticated Runner enrollment in the consented product journey", async () => {
	pathname = "/runner/enroll";
	measurement = true;
	setBrowserMeasurementConsent(true);
	jest.mocked(getAnalyticsIdentity).mockClear();
	render(<UmamiClient />);
	await waitFor(() => expect(getAnalyticsIdentity).toHaveBeenCalled());
});
