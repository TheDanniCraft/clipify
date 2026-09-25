import { render, screen, within } from "@testing-library/react";

jest.mock("@components/legal/CookiePreferencesLink", () => ({
	__esModule: true,
	default: () => <button type='button'>Cookie preferences</button>,
}));
import PrivacyPage, { metadata as privacyMetadata } from "../../../src/app/legal/privacy/page";
import CookiesPage, { metadata as cookiesMetadata } from "../../../src/app/legal/cookies/page";
import TermsPage, { metadata as termsMetadata } from "../../../src/app/legal/terms/page";
import PrivacyRequestsPage, { metadata as privacyRequestsMetadata } from "../../../src/app/legal/privacy-requests/page";
import { privacyPolicySections } from "@lib/legal/documents";
import { privacyRequestGuidance } from "@lib/legal/rights";
import { termsSections } from "@lib/legal/terms";

describe("local legal routes", () => {
	it("renders privacy route", () => {
		render(<PrivacyPage />);

		expect(privacyMetadata.title).toBe("Privacy Policy | Clipify");
		expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeInTheDocument();
		const article = screen.getByRole("article");
		const sectionHeadings = within(article)
			.getAllByRole("heading", { level: 2 })
			.map((heading) => heading.textContent);
		expect(sectionHeadings).toEqual(privacyPolicySections.map(({ title }) => title));
		for (const { summary } of privacyPolicySections) expect(article).toHaveTextContent(summary);
	});

	it("renders cookie route", () => {
		render(<CookiesPage />);

		expect(cookiesMetadata.title).toBe("Cookie Policy | Clipify");
		expect(screen.getByRole("heading", { level: 1, name: "Cookie Policy" })).toBeInTheDocument();
		const declarations = screen.getByRole("region", { name: "Service and storage declarations" });
		expect(declarations).toBeInTheDocument();
		expect(within(declarations).getByText(/complete declared inventory/i)).toBeInTheDocument();
		expect(screen.queryByRole("region", { name: "Activity visible on this device" })).not.toBeInTheDocument();
	});

	it("renders terms route", () => {
		render(<TermsPage />);

		expect(termsMetadata.title).toBe("Terms of Service | Clipify");
		expect(screen.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeInTheDocument();
		const article = screen.getByRole("article");
		expect(
			within(article)
				.getAllByRole("heading", { level: 2 })
				.map((heading) => heading.textContent),
		).toEqual(termsSections.map(({ title }) => title));
		for (const { summary } of termsSections) expect(article).toHaveTextContent(summary);
	});

	it("renders privacy-request route", () => {
		render(<PrivacyRequestsPage />);

		expect(privacyRequestsMetadata.title).toBe("Privacy Requests | Clipify");
		expect(screen.getByRole("heading", { level: 1, name: "Privacy Requests" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: privacyRequestGuidance.contact.email })).toHaveAttribute("href", `mailto:${privacyRequestGuidance.contact.email}`);
		expect(screen.getByText(/no Clipify account is required/i)).toBeInTheDocument();
		for (const qualification of privacyRequestGuidance.qualifications) expect(screen.getByRole("article")).toHaveTextContent(qualification);
		for (const stage of privacyRequestGuidance.processStages) expect(screen.getByRole("article")).toHaveTextContent(stage);
	});
});
