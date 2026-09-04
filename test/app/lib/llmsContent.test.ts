import { pricingFeatures } from "@components/Pricing/pricing-catalog";
import { badgeCatalog } from "@lib/badgeCatalog";
import { renderBadgeCatalog, renderLlmsFullText, renderPlanComparison } from "@lib/llmsContent";

describe("LLM product reference rendering", () => {
	it("includes every registered member badge", () => {
		const output = renderBadgeCatalog();
		for (const [slug, badge] of Object.entries(badgeCatalog)) {
			expect(output).toContain(`**${badge.name}**`);
			expect(output).toContain(`\`${slug}\``);
			expect(output).toContain(badge.description);
		}
	});

	it("includes every pricing comparison feature", () => {
		const output = renderPlanComparison();
		for (const section of pricingFeatures) {
			expect(output).toContain(`### ${section.title}`);
			for (const item of section.items) {
				expect(output).toContain(`**${item.title}**`);
				expect(output).toContain(item.helpText);
			}
		}
	});

	it("rejects unresolved template placeholders", () => {
		expect(() => renderLlmsFullText("{{UNKNOWN_SECTION}}\n{{BADGE_CATALOG}}\n{{PLAN_COMPARISON}}")).toThrow("Unresolved llms-full.txt template placeholder");
	});
});
