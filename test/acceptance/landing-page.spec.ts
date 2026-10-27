import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { source as axeSource } from "axe-core";

async function dismissPrivacy(page: import("@playwright/test").Page) {
	const reject = page.getByRole("button", { name: "Reject optional", exact: true });
	await expect(reject).toBeVisible();
	if (await reject.isVisible()) {
		await Promise.all([page.waitForEvent("load"), reject.click()]);
		await expect(reject).not.toBeVisible();
	}
}

async function assertAccessibleMain(page: import("@playwright/test").Page) {
	await page.addScriptTag({ content: axeSource });
	const violations = await page.evaluate(async () => {
		const engine = (window as typeof window & { axe: typeof import("axe-core") }).axe;
		const result = await engine.run(document.querySelector("main")!, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
		return result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }));
	});
	expect(violations).toEqual([]);
}

for (const theme of ["light", "dark"]) {
	for (const width of [320, 390, 1440]) {
		test(`landing page is usable at ${width}px in ${theme} mode`, async ({ page }, testInfo) => {
			await page.setViewportSize({ width, height: 900 });
			await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
			await page.emulateMedia({ reducedMotion: "reduce" });
			const demoRequests: string[] = [];
			page.on("request", (request) => {
				if (new URL(request.url()).pathname === "/demoPlayer") demoRequests.push(request.url());
			});
			await page.goto("/");
			await dismissPrivacy(page);
			await expect(page).toHaveTitle("Twitch Clip Player for OBS Break Screens | Clipify");
			await expect(page.getByRole("heading", { level: 1 })).toHaveText("Take a break.Let your Twitch clips play.");
			await expect(page.getByRole("link", { name: "Start free with Twitch" }).first()).toBeVisible();
			await expect(page.getByRole("button", { name: "Watch the demo", exact: true })).toBeVisible();
			expect(demoRequests).toHaveLength(0);
			await assertAccessibleMain(page);
			await expect(page.locator("#features")).not.toContainText("Pro:");
			await expect(page.getByRole("link", { name: "Explore Clipify", exact: true })).toHaveAttribute("href", "/features");
			await page.getByRole("img", { name: "A Twitch gaming highlight playing through Clipify" }).evaluate((image: HTMLImageElement) => image.decode());
			await page.screenshot({ timeout: 15000, path: testInfo.outputPath(`landing-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
			const monthly = page.getByRole("radio", { name: "Pay Monthly", exact: true });
			await monthly.click();
			await expect(monthly).toBeChecked();
			const yearly = page.getByRole("radio", { name: "Pay Yearly", exact: true });
			await yearly.click();
			await expect(yearly).toBeChecked();
			const free = page.getByRole("button", { name: "What can I do for free?", exact: true });
			await free.scrollIntoViewIfNeeded();
			await free.focus();
			await free.press("Enter");
			await expect(free).toHaveAttribute("aria-expanded", "true");
			await expect(page.getByText("Free is an ongoing plan.", { exact: false })).toBeVisible();
			if (width < 768) {
				await page.evaluate(() => window.scrollTo(0, 0));
				const menu = page.getByRole("button", { name: "Toggle navigation menu" });
				await menu.click();
				await expect(menu).toHaveAttribute("aria-expanded", "true");
				await page.keyboard.press("Escape");
				await expect(menu).toBeFocused();
				await expect(menu).toHaveAttribute("aria-expanded", "false");
				await menu.press("Enter");
				await page.getByRole("link", { name: "Demo", exact: true }).click();
				await expect(menu).toHaveAttribute("aria-expanded", "false");
				await expect(page).toHaveURL(/#demo$/);
			}
			await page.getByRole("link", { name: "Start free with Twitch" }).last().click();
			await expect(page.getByRole("heading", { name: "Welcome to Clipify" })).toBeVisible();
			await expect(page.getByRole("button", { name: "Login with Twitch", exact: true })).toBeVisible();
			await expect(page.getByRole("link", { name: "Clipify home" })).toHaveAttribute("href", "/");
		});
	}
}

test("missing demo configuration gives actionable recovery without blocking signup", async ({ page }) => {
	await page.goto("/");
	await dismissPrivacy(page);
	await page.getByRole("button", { name: "Watch the demo", exact: true }).click();
	await expect(page.getByRole("button", { name: "Try demo again" })).toBeVisible({ timeout: 25000 });
	await expect(page.getByText("Please try again. You can still explore Clipify and start free.")).toBeVisible();
	await expect(page.locator("iframe[title='Clipify playback demo']")).toHaveCount(0);
	await page.getByRole("link", { name: "Start free with Twitch" }).first().click();
	await expect(page.getByRole("button", { name: "Login with Twitch" })).toBeVisible();
});

test("demo shell plays controlled real media on mobile, sends skip, and stops offscreen", async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 900 });
	// Control the media boundary; the installed homepage, controls, iframe and video remain real.
	await page.route("**/__landing-fixture.mp4", (route) => route.fulfill({ contentType: "video/mp4", body: readFileSync("test/fixtures/runner/presentation.mp4") }));
	await page.route("**/demoPlayer", (route) => route.fulfill({ contentType: "text/html", body: '<html><body style="margin:0"><video autoplay muted loop playsinline src="/__landing-fixture.mp4" style="width:100%"></video><script>addEventListener("message", e => { if(e.origin===location.origin && e.data.name==="skip") document.body.dataset.command="skip"; });</script></body></html>' }));
	await page.goto("/");
	await dismissPrivacy(page);
	await page.getByRole("button", { name: "Watch the demo", exact: true }).focus();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("button", { name: "Skip clip", exact: true })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	const frame = page.frameLocator("iframe[title='Clipify playback demo']");
	await expect.poll(() => frame.locator("video").evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(0);
	await page.getByRole("button", { name: "Skip clip", exact: true }).click();
	await expect(frame.locator("body")).toHaveAttribute("data-command", "skip");
	await page.locator("#faq").scrollIntoViewIfNeeded();
	await expect(page.locator("iframe[title='Clipify playback demo']")).toHaveCount(0);
	await page.locator("#demo").scrollIntoViewIfNeeded();
	await expect(page.getByRole("button", { name: "Resume demo", exact: true })).toBeVisible();
	await expect(page.locator("iframe[title='Clipify playback demo']")).toHaveCount(0);
	await page.getByRole("button", { name: "Resume demo", exact: true }).click();
	await expect(page.getByRole("button", { name: "Skip clip", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Pause demo", exact: true }).click();
	await expect(page.locator("iframe[title='Clipify playback demo']")).toHaveCount(0);
});

test("public routes identify their own canonical and social URLs", async ({ page }) => {
	for (const path of ["/", "/pricing", "/community", "/changelog", "/roadmap", "/features", "/gallery", "/guides/twitch-clips-in-obs", "/guides/twitch-clip-playlists", "/guides/control-twitch-clip-playback", "/legal/privacy", "/legal/terms", "/legal/cookies"]) {
		await page.goto(path);
		const socialTitle = await page.locator('meta[name="twitter:title"]').getAttribute("content");
		expect(socialTitle).toBeTruthy();
		expect(socialTitle).not.toContain("Even when you can't");
		expect(new URL((await page.locator('link[rel="canonical"]').getAttribute("href"))!).href).toBe(new URL(`https://clipify.us${path}`).href);
		expect(new URL((await page.locator('meta[property="og:url"]').getAttribute("content"))!).href).toBe(new URL(`https://clipify.us${path}`).href);
	}
});

for (const theme of ["light", "dark"]) {
	test(`pricing controls remain accessible in ${theme} mode`, async ({ page }) => {
		await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
		await page.goto("/pricing");
		await dismissPrivacy(page);
		await assertAccessibleMain(page);
		await expect(page.getByText("Most Popular", { exact: true })).toHaveCount(0);
		const monthly = page.getByRole("radio", { name: "Pay Monthly", exact: true });
		await monthly.click();
		await expect(monthly).toBeChecked();
		await assertAccessibleMain(page);
	});
}

for (const theme of ["light", "dark"]) {
	test(`features, setup guides, and mobile comparison work in ${theme} mode`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width: 320, height: 900 });
		await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
		await page.goto("/features");
		await dismissPrivacy(page);
		await assertAccessibleMain(page);
		await page.getByRole("link", { name: /^Set up clips in OBS/ }).click();
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Play Twitch clips in OBS during breaks");
		for (const slug of ["twitch-clips-in-obs", "twitch-clip-playlists", "control-twitch-clip-playback"]) {
			await page.goto(`/guides/${slug}`);
			await assertAccessibleMain(page);
			await expect(page.getByRole("heading", { name: "What you need", exact: true })).toBeVisible();
			await expect(page.getByRole("link", { name: "Start free with Twitch", exact: true })).toHaveAttribute("href", "/login");
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
		}
		await page.goto("/pricing");
		await assertAccessibleMain(page);
		await page.getByRole("heading", { name: "Compare what is included", exact: true }).scrollIntoViewIfNeeded();
		const comparison = page.getByRole("table", { name: "Compare Free and Pro", exact: true });
		await expect(comparison).toBeVisible();
		await expect(comparison.getByRole("columnheader", { name: "Free", exact: true })).toBeVisible();
		await expect(comparison.getByRole("columnheader", { name: "Pro", exact: true })).toBeVisible();
		await expect(page.getByText("Self-hosted Runner", { exact: true }).filter({ visible: true })).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
		await page.screenshot({ path: testInfo.outputPath(`pricing-mobile-${theme}.png`), fullPage: true, animations: "disabled" });
		await page.goto("/guides/not-a-clipify-guide");
		await expect(page.getByRole("heading", { name: "Oops, page not found", exact: true })).toBeVisible();
	});
}

test("newsletter keyboard navigation skips the inactive name step", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 900 });
	await page.goto("/");
	await dismissPrivacy(page);
	const email = page.getByRole("textbox", { name: "Newsletter email address", exact: true });
	const name = page.getByPlaceholder("First name", { exact: true });
	await expect(name).toHaveCount(1);
	await expect(name.locator("xpath=ancestor::*[@inert][1]")).toHaveCount(1);
	await email.focus();
	await page.keyboard.press("Tab");
	await expect(name).not.toBeFocused();
});

for (const theme of ["light", "dark"]) {
	for (const consentWidth of [320, 640]) {
		test(`public page chrome, consent and reflow are accessible at ${consentWidth}px in ${theme} mode`, async ({ page }, testInfo) => {
			await page.setViewportSize({ width: consentWidth, height: 900 });
			await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
			await page.goto("/");
			const reject = page.getByRole("button", { name: "Reject optional", exact: true });
			await expect(reject).toBeVisible();
			await expect(page.getByRole("button", { name: "Enable support chat" })).toHaveCount(0);
			await reject.focus();
			await page.screenshot({ path: testInfo.outputPath(`consent-${consentWidth}-${theme}.png`), fullPage: true });
			await page.addScriptTag({ content: axeSource });
			const check = () =>
				page.evaluate(async () => {
					const engine = (window as typeof window & { axe: typeof import("axe-core") }).axe;
					return (await engine.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }));
				});
			expect(await check()).toEqual([]);
			await Promise.all([page.waitForEvent("load"), reject.press("Enter")]);
			await page.addScriptTag({ content: axeSource });
			expect(await check()).toEqual([]);
			// CSS zoom exercises 200% reflow at a 640px viewport, alongside the 320px cases.
			await page.evaluate(() => {
				document.documentElement.style.zoom = window.innerWidth === 640 ? "2" : "1";
			});
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
			await expect(page.getByRole("link", { name: "Start free with Twitch" }).first()).toBeVisible();
			await page.screenshot({ path: testInfo.outputPath(`reflow-${consentWidth}-${theme}.png`), fullPage: true });
		});
	}
	test(`public gallery plays controlled media and restores keyboard focus in ${theme} mode`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width: 390, height: 900 });
		await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
		const sample = { id: "demo-clip", title: "A demo highlight", broadcaster_id: "demo-owner", creator_name: "Demo creator", duration: 8, thumbnail_url: "/landing-playback.png" };
		let loads = 0,
			mediaRequests = 0;
		// Substitute only the external clip/media results; real actions, renderer and HeroUI modal remain installed.
		await page.route("**/gallery", async (route) => {
			if (route.request().method() !== "POST") return route.continue();
			const response = await route.fetch();
			let body = await response.text();
			if (route.request().postData() === "[]") {
				loads++;
				expect(body).toContain("1:null");
				body = body.replace("1:null", `1:${JSON.stringify({ overlayId: "demo", clips: [sample] })}`);
			} else if (route.request().postData()?.includes("demo-clip")) {
				mediaRequests++;
				expect(body).toContain('1:"$undefined"');
				body = body.replace('1:"$undefined"', `1:"/__gallery-fixture.mp4"`);
			}
			await route.fulfill({ response, body });
		});
		await page.route("**/__gallery-fixture.mp4", (route) => route.fulfill({ contentType: "video/mp4", body: readFileSync("test/fixtures/runner/presentation.mp4") }));
		await page.goto("/gallery");
		await dismissPrivacy(page);
		expect(loads).toBe(0);
		expect(mediaRequests).toBe(0);
		await page.getByRole("button", { name: "Explore the demo gallery" }).click();
		const card = page.getByRole("button", { name: /A demo highlight/ });
		await expect(card).toBeVisible();
		expect(mediaRequests).toBe(0);
		await assertAccessibleMain(page);
		await card.focus();
		await card.press("Enter");
		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		const video = dialog.locator("video");
		await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.2);
		await page.screenshot({ path: testInfo.outputPath(`gallery-${theme}.png`), fullPage: true });
		await page.keyboard.press("Escape");
		await expect(dialog).toHaveCount(0);
		await expect(card).toBeFocused();
		await expect(page.locator("video")).toHaveCount(0);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	});
}

test("unavailable public gallery offers retry without requiring login", async ({ page }) => {
	await page.goto("/gallery");
	await dismissPrivacy(page);
	await page.getByRole("button", { name: "Explore the demo gallery" }).click();
	await expect(page.locator("main").getByRole("alert")).toHaveText("The gallery couldn't load. Please try again.");
	await expect(page.getByRole("button", { name: "Try gallery again" })).toBeEnabled();
	await expect(page.getByRole("link", { name: "Create your gallery" })).toBeVisible();
});

for (const theme of ["light", "dark"]) {
	test(`community introduction leaves room for the directory in ${theme} mode`, async ({ page }, testInfo) => {
		await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
		for (const width of [390, 1440]) {
			await page.setViewportSize({ width, height: 900 });
			await page.goto("/community");
			if (await page.getByRole("button", { name: "Reject optional", exact: true }).isVisible()) await dismissPrivacy(page);
			await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find your next favorite creator.");
			const context = page.getByText("This directory shows visible community profiles.", { exact: false });
			await expect(context).toBeVisible();
			expect((await context.boundingBox())!.y).toBeLessThan(900);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
			await page.screenshot({ path: testInfo.outputPath(`community-${width}-${theme}.png`), fullPage: true });
		}
	});
}
