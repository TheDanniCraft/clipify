import { pricingFeatures } from "@components/Pricing/pricing-catalog";
import { badgeCatalog } from "@lib/badgeCatalog";

const describeAvailability = (value: boolean | string) => (typeof value === "boolean" ? (value ? "Included" : "Not included") : value);

export function renderBadgeCatalog() {
	return Object.entries(badgeCatalog)
		.map(([slug, badge]) => {
			const awardMode = "condition" in badge ? "Automatically shown while its qualifying account status is active." : "Granted as a lasting community recognition.";
			return `- **${badge.name}** (\`${slug}\`): ${badge.description} ${awardMode}`;
		})
		.join("\n");
}

export function renderPlanComparison() {
	return pricingFeatures
		.map((section) => {
			const items = section.items.map((item) => `- **${item.title}**: Free: ${describeAvailability(item.tiers.free)}; Pro: ${describeAvailability(item.tiers.pro)}. ${item.helpText}`).join("\n");
			return `### ${section.title}\n\n${items}`;
		})
		.join("\n\n");
}

export function renderLlmsFullText(template: string) {
	const rendered = template.replace("{{BADGE_CATALOG}}", renderBadgeCatalog()).replace("{{PLAN_COMPARISON}}", renderPlanComparison());
	if (/{{[A-Z_]+}}/.test(rendered)) throw new Error("Unresolved llms-full.txt template placeholder");
	return `${rendered.trim()}\n`;
}
