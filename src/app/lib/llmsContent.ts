import { pricingFeatures } from "@components/Pricing/pricing-catalog";
import { publicToolNames } from "@/server/mcp/schemas";
import { MCP_EXAMPLE_PROMPTS } from "@lib/mcpPrompts";
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

export function renderLlmsText(template: string) {
	const rendered = template
		.replaceAll("{{MCP_TOOL_COUNT}}", String(publicToolNames.length))
		.replaceAll("{{MCP_PROMPT_COUNT}}", String(MCP_EXAMPLE_PROMPTS.length))
		.replaceAll("{{MCP_TOOL_LIST}}", publicToolNames.map((name) => `- \`${name}\``).join("\n"))
		.replaceAll("{{MCP_PROMPTS}}", MCP_EXAMPLE_PROMPTS.map((prompt) => `- \`${prompt.name}\`: ${prompt.title}`).join("\n"));
	if (/{{[A-Z_]+}}/.test(rendered)) throw new Error("Unresolved llms-full.txt template placeholder");
	return rendered;
}

export function renderLlmsFullText(template: string) {
	const rendered = renderLlmsText(template.replace("{{BADGE_CATALOG}}", renderBadgeCatalog()).replace("{{PLAN_COMPARISON}}", renderPlanComparison()));
	return `${rendered.trim()}\n`;
}
