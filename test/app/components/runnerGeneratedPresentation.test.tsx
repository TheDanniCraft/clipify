/** @jest-environment node */
import { renderToStaticMarkup } from "react-dom/server";
import RunnerGeneratedPresentation from "@/app/components/runnerGeneratedPresentation";

test("the generated surface renders two attribution lines and the existing Clipify logo while retaining its execution marker", () => {
	const html = renderToStaticMarkup(
		<RunnerGeneratedPresentation attributionRequired executionGeneration='assigned-generation'>
			<span>Generated clip content</span>
		</RunnerGeneratedPresentation>,
	);
	expect(html).toContain('data-runner-presentation-generation="assigned-generation"');
	expect(html).toContain('aria-label="Livestream powered by Clipify.us"');
	expect(html).toContain('data-runner-attribution="true"');
	expect(html).toContain('id="ClipifyLogo"');
	expect(html).toContain(">Livestream powered</span>");
	expect(html).toContain(">by Clipify.us</span>");
	expect(html).toContain("Generated clip content");
});

test("an admitted clean presentation retains its content and execution marker without attribution", () => {
	const html = renderToStaticMarkup(
		<RunnerGeneratedPresentation attributionRequired={false} executionGeneration='paid-generation'>
			<span>Generated clip content</span>
		</RunnerGeneratedPresentation>,
	);
	expect(html).toContain('data-runner-presentation-generation="paid-generation"');
	expect(html).toContain("Generated clip content");
	expect(html).not.toMatch(/data-runner-attribution|Livestream powered|ClipifyLogo/);
});
