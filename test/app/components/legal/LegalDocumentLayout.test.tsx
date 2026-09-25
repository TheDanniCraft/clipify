import { render, screen } from "@testing-library/react";
import LegalDocumentLayout from "@components/legal/LegalDocumentLayout";
import { legalDocuments } from "@lib/legal/documents";

jest.mock("next/navigation", () => ({
	useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@components/legal/LegalDocumentTabs", () => ({
	__esModule: true,
	default: ({ activeDocumentId, children }: { activeDocumentId: string; children: React.ReactNode }) => {
		const { legalDocuments: documents } = jest.requireActual("@lib/legal/documents");
		return (
			<>
				<div role='tablist' aria-label='Legal documents'>
					{documents.map((item: { id: string; title: string }) => (
						<button key={item.id} role='tab' aria-selected={item.id === activeDocumentId}>
							{item.title}
						</button>
					))}
				</div>
				{children}
			</>
		);
	},
}));

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
		expect(screen.getByText("Version 1.1.0")).toBeInTheDocument();
		expect(screen.getByText("Effective September 25, 2026")).toBeInTheDocument();
		expect(screen.getByText(document!.description)).toBeInTheDocument();
		expect(screen.queryByText(document!.scope)).not.toBeInTheDocument();
		expect(screen.getByRole("article")).toHaveTextContent("Policy content");
	});

	it("renders complete legal navigation", () => {
		const document = legalDocuments.find(({ id }) => id === "privacy");
		render(<LegalDocumentLayout document={document!}>Policy content</LegalDocumentLayout>);

		const tabs = screen.getAllByRole("tab");
		expect(tabs).toHaveLength(5);
		expect(tabs.map((tab) => tab.textContent)).toEqual(legalDocuments.map(({ title }) => title));
		expect(screen.getByRole("tab", { name: "Privacy Policy" })).toHaveAttribute("aria-selected", "true");
		expect(screen.getByRole("tab", { name: "Cookie Policy" })).toHaveAttribute("aria-selected", "false");
	});
});
