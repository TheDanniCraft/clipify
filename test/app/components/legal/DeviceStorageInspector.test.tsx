import React from "react";
import { render, screen } from "@testing-library/react";
import DeviceStorageInspector from "@/app/components/legal/DeviceStorageInspector";

const originalFetch = global.fetch;

describe("components/legal/DeviceStorageInspector", () => {
	afterEach(() => {
		global.fetch = originalFetch;
		localStorage.clear();
		sessionStorage.clear();
	});

	it("renders storage names and types without values", () => {
		const fetchSpy = jest.fn();
		global.fetch = fetchSpy;

		render(<DeviceStorageInspector observations={[{ type: "localStorage", name: "c15t", value: "private-consent-payload" }]} />);

		expect(screen.getByText("c15t")).toBeInTheDocument();
		expect(screen.getByText("Local storage")).toBeInTheDocument();
		expect(screen.queryByText("private-consent-payload")).not.toBeInTheDocument();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("labels unavailable browser visibility as supplemental", () => {
		render(<DeviceStorageInspector observations={[]} unavailable />);

		expect(screen.getByText(/supplemental/i)).toBeInTheDocument();
		expect(screen.getByText(/complete declared inventory remains authoritative/i)).toBeInTheDocument();
		expect(screen.queryByText(/nothing is stored/i)).not.toBeInTheDocument();
	});

	it("discovers only approved browser storage names without exposing values", async () => {
		localStorage.setItem("chatwoot_available_agents_smoke", "private-evidence-value");

		render(<DeviceStorageInspector />);

		expect(await screen.findByText("chatwoot_available_agents_smoke")).toBeInTheDocument();
		expect(screen.getByText("Local storage")).toBeInTheDocument();
		expect(screen.queryByText("private-evidence-value")).not.toBeInTheDocument();
	});
});
