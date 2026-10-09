/** @jest-environment node */
import { buildSync } from "esbuild";
import { mcpToolCatalogue } from "@/server/mcp/catalogue";
import { publicToolNames, toolInputSchemas } from "@/server/mcp/schemas";
import { toolAnnotations } from "@/server/mcp/risk";
import { toolPermissions } from "@/server/mcp/permissions";
import { mcpOperationLabels } from "@/app/lib/mcpOperationLabels";

test("catalog entries cover every schema, including internal compatibility operations", () => {
	expect(Object.keys(mcpToolCatalogue).sort()).toEqual(Object.keys(toolInputSchemas).sort());
	expect(publicToolNames).toHaveLength(66);
	for (const name of ["update_overlay", "update_gallery", "get_overlay_embed"] as const) {
		expect(mcpToolCatalogue[name].public).toBe(false);
		expect(publicToolNames).not.toContain(name);
	}
});

test("permission, activity and risk consumers derive their metadata from the same catalog", () => {
	for (const name of Object.keys(toolInputSchemas) as (keyof typeof toolInputSchemas)[]) {
		const definition = mcpToolCatalogue[name];
		expect(toolPermissions[name]).toBe(definition.permission);
		expect(mcpOperationLabels[name]).toBe(definition.title);
		expect(toolAnnotations(name)).toEqual(definition.annotations);
		expect(definition.description).not.toMatch(/[\u2018\u2019]/);
	}
});

test("annotation callers cannot mutate the shared catalog's permissions hints", () => {
	const hints = toolAnnotations("delete_overlay");
	hints.readOnlyHint = true;
	expect(toolAnnotations("delete_overlay").readOnlyHint).toBe(false);
});

test("browser activity labels bundle without schemas, handlers or database dependencies", () => {
	const result = buildSync({ entryPoints: ["src/app/lib/mcpOperationLabels.ts"], bundle: true, platform: "browser", write: false, metafile: true, logLevel: "silent" });
	expect(Object.keys(result.metafile!.inputs).sort()).toEqual(["src/app/lib/mcpOperationLabels.ts", "src/server/mcp/catalogue.ts"]);
});
