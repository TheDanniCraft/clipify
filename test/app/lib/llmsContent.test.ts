import { readFileSync } from "node:fs";
import { publicToolNames } from "@/server/mcp/schemas";
import { MCP_EXAMPLE_PROMPTS } from "@lib/mcpPrompts";
import { pricingFeatures } from "@components/Pricing/pricing-catalog";
import { badgeCatalog } from "@lib/badgeCatalog";
import { renderBadgeCatalog, renderLlmsFullText, renderLlmsText, renderPlanComparison } from "@lib/llmsContent";

describe("LLM product reference rendering", () => {
	it("documents MCP as included on both plans without bypassing limits", () => {
		const output = renderPlanComparison();
		expect(output).toContain("**AI assistant access (MCP)**: Free: Included; Pro: Included.");
		expect(output).toMatch(/MCP[\s\S]*plan limits/i);
	});
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

it("renders the public MCP registry instead of stale counts or internal aliases", () => {
	const output = renderLlmsText("{{MCP_TOOL_COUNT}} tools; {{MCP_PROMPT_COUNT}} prompts\n{{MCP_TOOL_LIST}}\n{{MCP_PROMPTS}}");
	expect(output).toContain(`${publicToolNames.length} tools; ${MCP_EXAMPLE_PROMPTS.length} prompts`);
	for (const name of publicToolNames) expect(output).toContain(`- \`${name}\``);
	for (const prompt of MCP_EXAMPLE_PROMPTS) expect(output).toContain(prompt.title);
	expect(output).not.toContain("- `control_overlay`");
	expect(output).not.toContain("- `update_overlay`");
	expect(output).not.toMatch(/{{[A-Z_]+}}/);
});

it("keeps the actual published templates aligned with pricing and public MCP capabilities", () => {
	const full = renderLlmsFullText(readFileSync("src/app/llms-full.txt/llms-full.txt", "utf8"));
	const short = renderLlmsText(readFileSync("src/app/llms.txt/llms.txt", "utf8"));
	for (const section of pricingFeatures) for (const item of section.items) expect(full).toContain(`**${item.title}**`);
	expect(short).toContain(`${publicToolNames.length} tools and ${MCP_EXAMPLE_PROMPTS.length} optional prompt suggestions`);
	for (const name of publicToolNames) expect(full).toContain(`- \`${name}\``);
	expect(full).toContain("Settings → Account");
	expect(full).not.toMatch(/{{[A-Z_]+}}/);
	expect(short).not.toMatch(/{{[A-Z_]+}}/);
});
