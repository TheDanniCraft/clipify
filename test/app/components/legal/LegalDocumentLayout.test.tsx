import { render, screen } from "@testing-library/react";
import LegalDocumentLayout from "@components/legal/LegalDocumentLayout";
import { legalDocuments } from "@lib/legal/documents";

describe("LegalDocumentLayout", () => {
	it("renders document metadata", () => {
		const document = legalDocuments.find(({ id }) => id === "privacy");
		expect(document).toBeDefined();

		render(
			<LegalDocumentLayout document={document!}>
				<p>Policy content</p>
			</LegalDocumentLayout>,
		);

		expect(screen.getByRole("main")).toBeInTheDocument();
		expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeInTheDocument();
		expect(screen.getByText("Version 1.0.0")).toBeInTheDocument();
		expect(screen.getByText("Effective September 25, 2026")).toBeInTheDocument();
		expect(screen.getByText(document!.description)).toBeInTheDocument();
		expect(screen.queryByText(document!.scope)).not.toBeInTheDocument();
		expect(screen.getByRole("article")).toHaveTextContent("Policy content");
	});

	it("renders complete legal navigation", () => {
		const document = legalDocuments.find(({ id }) => id === "privacy");
		render(<LegalDocumentLayout document={document!}>Policy content</LegalDocumentLayout>);

		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(5);
		expect(links.map((link) => link.getAttribute("href"))).toEqual(legalDocuments.map(({ route }) => route));
		expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("aria-current", "page");
		expect(screen.getByRole("link", { name: "Cookie Policy" })).not.toHaveAttribute("aria-current");
	});
});
