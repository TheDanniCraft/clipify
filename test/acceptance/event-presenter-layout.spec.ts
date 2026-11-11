import { randomUUID, createHmac } from "node:crypto";
import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { createAwardConfiguration } from "../../src/app/lib/eventDefaults";
import { browserProviderEnvironment } from "../support/mcp/browser-database.cjs";

for (const width of [390, 1440])
	for (const theme of ["light", "dark"]) {
		test(`Award preview layout and provider frames at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			await page.setViewportSize({ width, height: 900 });
			await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
			const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
			const id = randomUUID(),
				digest = "d".repeat(64),
				configuration = createAwardConfiguration("Babbler Awards", "UTC");
			configuration.description = "Demo nominations and votes for reviewing the award show.";
			const category = configuration.categories[0];
			category.title = "Best clip";
			const quote = { ...category, id: randomUUID(), title: "Best quote", source: "text" as const };
			configuration.categories.push(quote);
			configuration.slides = [
				{ id: randomUUID(), type: "welcome", title: "", text: "", statistics: [] },
				{
					id: randomUUID(),
					type: "statistics",
					title: "The show in numbers",
					text: "",
					statistics: [
						{ source: "categories", label: "Categories" },
						{ source: "nominees", label: "Nominees" },
						{ source: "voters", label: "Voters" },
					],
				},
				{ id: randomUUID(), type: "category", categoryId: category.id, title: "", text: "", statistics: [] },
				{ id: randomUUID(), type: "category", categoryId: quote.id, title: "", text: "", statistics: [] },
				{ id: randomUUID(), type: "closing", title: "The winners", text: "", statistics: [] },
			];
			await tourWorld.fixture.pool.query("INSERT INTO award_events(id,owner_id,configuration,presenter_digest) VALUES($1,$2,$3,$4)", [id, creatorId, JSON.stringify(configuration), digest]);
			const thumbnailUrl = "https://static-cdn.jtvnw.net/award-thumbnail.png";
			const candidateIds = Array.from({ length: 5 }, () => randomUUID()).sort();
			for (const [i, candidateId] of candidateIds.entries()) {
				await tourWorld.fixture.pool.query("INSERT INTO award_candidates(id,event_id,category_id,canonical_key,content,nominated) VALUES($1,$2,$3,$4,$5,true)", [candidateId, id, category.id, `clip:fixture${i}`, JSON.stringify({ kind: "clip", reference: `fixture${i}`, title: `Nominee ${i + 1}`, description: "", creatorId, thumbnailUrl: `${thumbnailUrl}?nominee=${i + 1}` })]);
				for (let ballot = 0; ballot < 5 - i; ballot++) {
					const viewer = `preview-voter-${randomUUID()}`;
					await tourWorld.fixture.pool.query('INSERT INTO auth."user"(id,name,email) VALUES($1,$2,$3)', [viewer, "Demo voter", `${viewer}@example.invalid`]);
					await tourWorld.fixture.pool.query("INSERT INTO award_votes(event_id,category_id,candidate_id,auth_user_id) VALUES($1,$2,$3,$4)", [id, category.id, candidateId, viewer]);
				}
			}
			const quoteTitle = "Everything is under control, I promise.";
			const quoteDescription = "A fictional demonstration quote with enough context to remain readable when the nominee is opened on a phone.";
			await tourWorld.fixture.pool.query("INSERT INTO award_candidates(id,event_id,category_id,canonical_key,content,nominated) VALUES($1,$2,$3,$4,$5,true)", [randomUUID(), id, quote.id, "text:quote", JSON.stringify({ kind: "text", reference: "", title: quoteTitle, description: quoteDescription })]);
			const expiry = String(Date.now() + 3600000),
				signature = createHmac("sha256", browserProviderEnvironment({ APP_ENV: "test", E2E_TEST_MODE: "true", MCP_BROWSER_PROVIDER_FIXTURE: "true", MCP_BROWSER_DATABASE_URL: tourWorld.fixture.url }).BETTER_AUTH_SECRET)
					.update(`clipify-event-preview:${id}:${digest}:${expiry}`)
					.digest("base64url");
			await page.route("https://clips.twitch.tv/embed?**", (route) => route.fulfill({ contentType: "text/html", body: "<body style='background:#111;color:white'>Twitch clip provider loaded</body>" }));
			let thumbnailRequests = 0;
			await page.route(`${thumbnailUrl}*`, (route) => {
				thumbnailRequests++;
				const number = Number(new URL(route.request().url()).searchParams.get("nominee") ?? "1");
				const color = ["#31445b", "#684939", "#31584a", "#59416b", "#5c552c"][number - 1] ?? "#31445b";
				return route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="${color}"/><path d="M0 300L340 0H640V360H0Z" fill="#ffffff" opacity=".08"/><circle cx="320" cy="165" r="76" fill="#ffffff" opacity=".14"/><text x="320" y="193" fill="white" font-family="sans-serif" font-size="80" text-anchor="middle">${number}</text></svg>` });
			});
			const response = await page.goto(`${tourWorld.origin}/events/${id}/preview#${expiry}.${signature}`);
			expect(response?.headers()["content-security-policy"]).toContain("https://clips.twitch.tv https://www.youtube-nocookie.com");
			await expect(page.getByRole("heading", { name: "Babbler Awards", exact: true })).toBeVisible();
			await page.waitForTimeout(700);
			const overflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
			expect(overflow).toBeLessThanOrEqual(1);
			await page.screenshot({ path: info.outputPath(`welcome-${theme}-${width}.png`), fullPage: true });
			await page.keyboard.press("ArrowRight");
			await expect(page.getByRole("heading", { name: "The show in numbers" })).toBeVisible();
			await expect(page.getByText("Categories", { exact: true })).toHaveCount(0);
			await page.keyboard.press("ArrowRight");
			await page.waitForTimeout(1300);
			if (width === 1440) {
				const stats = page.getByText("Categories", { exact: true }).locator("..").locator("..");
				const box = await stats.boundingBox();
				expect(box).not.toBeNull();
				expect(Math.abs(box!.x + box!.width / 2 - width / 2)).toBeLessThan(2);
			}
			await page.screenshot({ path: info.outputPath(`statistics-${theme}-${width}.png`), fullPage: true });
			await page.keyboard.press("ArrowRight");
			const heading = page.getByRole("heading", { name: "Best clip", exact: true });
			await expect(heading).toBeVisible();
			await expect.poll(() => thumbnailRequests).toBeGreaterThan(0);
			await expect(page.getByRole("button", { name: /^View Nominee/ })).toHaveCount(0);
			for (let position = 1; position <= 5; position++) {
				await page.keyboard.press("ArrowRight");
				await expect(page.getByLabel("Category nominees").getByRole("button", { name: `View Nominee ${position}`, exact: true })).toBeVisible();
				await expect(page.getByRole("button", { name: `View Nominee ${position}`, exact: true })).toHaveCount(1);
				if (position === 2) {
					const outgoing = page.getByRole("button", { name: "View Nominee 1", exact: true });
					const start = await outgoing.boundingBox();
					await page.waitForTimeout(180);
					const moving = await outgoing.boundingBox();
					expect(moving!.y).toBeGreaterThan(start!.y + 10);
					await page.screenshot({ path: info.outputPath(`nominee-flying-${theme}-${width}.png`) });
				}
				if (position !== 1) await expect.poll(() => page.locator("[data-award-flight]").evaluateAll((nodes) => nodes.reduce((count, node) => count + node.getAnimations().length, 0))).toBe(0);
				if (position === 1) {
					const overlap = await page.evaluate(async () => {
						let maximum = 0;
						for (let frame = 0; frame < 40; frame++) {
							await new Promise(requestAnimationFrame);
							const main = document.querySelector("[data-award-featured]")!;
							const stage = main.parentElement!;
							const heading = document.querySelector("header")!;
							const card = main.querySelector("button")!;
							if (Number(getComputedStyle(stage).opacity) > 0.05) maximum = Math.max(maximum, heading.getBoundingClientRect().bottom - card.getBoundingClientRect().top);
						}
						return maximum;
					});
					expect(overlap).toBeLessThanOrEqual(0);
					await expect
						.poll(async () => {
							const box = await page.getByLabel("Category nominees").getByRole("button").boundingBox();
							return Math.abs(box!.x + box!.width / 2 - width / 2);
						})
						.toBeLessThan(2);
					await expect
						.poll(async () => {
							const title = await heading.boundingBox();
							const card = await page.getByLabel("Category nominees").getByRole("button").boundingBox();
							return card!.y - title!.y - title!.height;
						})
						.toBeGreaterThan(16);
					await page.screenshot({ path: info.outputPath(`first-nominee-${theme}-${width}.png`), fullPage: true });
				}
			}
			const hero = page.getByLabel("Category nominees");
			await expect
				.poll(async () => {
					const box = await hero.getByRole("button").boundingBox();
					return Math.abs(box!.x + box!.width / 2 - width / 2);
				})
				.toBeLessThan(2);
			const nomineeFooterHeight = await hero.getByRole("button").evaluate((node) => node.closest("div.overflow-hidden")!.lastElementChild!.getBoundingClientRect().height);
			await page.screenshot({ path: info.outputPath(`nominees-${theme}-${width}.png`), fullPage: true });
			await page.keyboard.press("Space");
			await expect(page.frameLocator('iframe[title="Nominee 5"]').getByText("Twitch clip provider loaded")).toBeVisible();
			await expect(page.locator('iframe[title="Nominee 5"]')).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
			await page.keyboard.press("Escape");
			const restored = await page.evaluate(() => ({ header: Number(getComputedStyle(document.querySelector("header")!).opacity), stage: Number(getComputedStyle(document.querySelector("[data-award-featured]")!.parentElement!).opacity) }));
			expect(restored.header).toBe(1);
			expect(restored.stage).toBe(1);
			const beforeReveal = await page.evaluate(() => ({ header: document.querySelector("header")!.getBoundingClientRect().y, rail: document.querySelector('[aria-label="Presented nominees"]')!.getBoundingClientRect().y }));
			await page.keyboard.press("ArrowRight");
			const afterReveal = await page.evaluate(() => ({ header: document.querySelector("header")!.getBoundingClientRect().y, rail: document.querySelector('[aria-label="Nominee results"]')!.getBoundingClientRect().y }));
			expect(Math.abs(beforeReveal.header - afterReveal.header)).toBeLessThan(2);
			expect(Math.abs(beforeReveal.rail - afterReveal.rail)).toBeLessThan(2);
			const winner = page.getByLabel("Award winners");
			const others = page.getByLabel("Nominee results");
			await expect(others.getByRole("button")).toHaveCount(5);
			const partialCaptionLines = await others.locator("h3").evaluateAll((headings) =>
				headings.some((heading) => {
					const lines = heading.getBoundingClientRect().height / parseFloat(getComputedStyle(heading).lineHeight);
					return Math.abs(lines - Math.round(lines)) > 0.01;
				}),
			);
			expect(partialCaptionLines).toBe(false);
			const slots = others.locator("[data-award-slot]");
			const positions = await slots.evaluateAll((nodes) =>
				nodes.map((node) => {
					const { x, y, width } = node.getBoundingClientRect();
					return { x, y, width };
				}),
			);
			await page.keyboard.press("ArrowRight");
			const trackPlacement = () =>
				page.evaluate(async () => {
					let top = Infinity,
						bottom = -Infinity,
						overlap = 0;
					for (let frame = 0; frame < 90; frame++) {
						await new Promise(requestAnimationFrame);
						const main = document.querySelector("[data-award-featured]")!;
						const label = main.querySelector("[data-award-placement]")!.getBoundingClientRect();
						const card = main.querySelector("[data-award-flight]")!.getBoundingClientRect();
						top = Math.min(top, label.y);
						bottom = Math.max(bottom, label.y);
						overlap = Math.max(overlap, label.bottom - card.top);
					}
					return { travel: bottom - top, overlap };
				});
			const revealGeometry = [trackPlacement()];
			if (width === 1440 && theme === "dark") {
				for (const [label, wait] of [
					["early", 0],
					["moving", 120],
					["arrived", 180],
					["score", 300],
					["settled", 700],
				] as const) {
					await page.waitForTimeout(wait);
					await page.screenshot({ path: info.outputPath(`reveal-${label}.png`) });
				}
			}
			await expect(page.getByLabel("Featured nominee").getByRole("button", { name: "View Nominee 3", exact: true })).toBeVisible();
			const placement = await revealGeometry[0];
			expect(placement.travel).toBeLessThan(2);
			expect(placement.overlap).toBeLessThanOrEqual(0);
			await expect(others.getByRole("progressbar")).toHaveCount(0);
			await expect.poll(() => page.getByLabel("Featured nominee").getByRole("progressbar").getAttribute("aria-valuenow").then(Number)).toBeCloseTo(20, 1);
			const resultFooterHeight = await page
				.getByLabel("Featured nominee")
				.getByRole("button")
				.evaluate((node) => node.closest("div.overflow-hidden")!.lastElementChild!.getBoundingClientRect().height);
			expect(Math.abs(resultFooterHeight - nomineeFooterHeight)).toBeLessThan(2);

			await page.screenshot({ path: info.outputPath(`third-${theme}-${width}.png`), fullPage: true });
			await page.keyboard.press("ArrowRight");
			revealGeometry.push(trackPlacement());
			await expect(page.getByLabel("Featured nominee").getByRole("button", { name: "View Nominee 2", exact: true })).toBeVisible();
			await expect(others.getByRole("button", { name: "View Nominee 3", exact: true })).toBeVisible();
			await expect.poll(() => page.getByLabel("Featured nominee").getByRole("progressbar").getAttribute("aria-valuenow").then(Number)).toBeCloseTo((100 * 4) / 15, 1);
			await expect(winner).toHaveCount(0);
			await page.keyboard.press("ArrowRight");
			revealGeometry.push(trackPlacement());
			await expect(winner.getByRole("button", { name: "View Nominee 1", exact: true })).toBeVisible();
			await expect(winner.getByRole("heading", { name: "First place", exact: true })).toBeVisible();
			await expect(others.getByRole("button")).toHaveCount(4);
			await expect(others.getByText("20% (3 votes)", { exact: true })).toBeVisible();
			await expect
				.poll(async () => {
					const box = await winner.getByRole("button").boundingBox();
					return Math.abs(box!.x + box!.width / 2 - width / 2);
				})
				.toBeLessThan(2);
			await expect.poll(() => winner.getByRole("progressbar").getAttribute("aria-valuenow").then(Number)).toBeCloseTo(100 / 3, 1);
			await expect
				.poll(async () => {
					const now = await slots.evaluateAll((nodes) =>
						nodes.map((node) => {
							const { x, y, width } = node.getBoundingClientRect();
							return { x, y, width };
						}),
					);
					return Math.max(...now.flatMap((box, i) => [Math.abs(box.x - positions[i].x), Math.abs(box.y - positions[i].y), Math.abs(box.width - positions[i].width)]));
				})
				.toBeLessThan(2);
			for (const pending of revealGeometry) {
				const measured = await pending;
				expect(measured.travel).toBeLessThan(2);
				expect(measured.overlap).toBeLessThanOrEqual(0);
			}
			await page.screenshot({ path: info.outputPath(`results-${theme}-${width}.png`), fullPage: true });
			expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
			await page.keyboard.press("ArrowLeft");
			await page.screenshot({ path: info.outputPath(`back-immediate-${theme}-${width}.png`) });
			const reverse = await page.evaluate(async () => {
				let opacity = 1,
					travel = 0,
					firstY: number | undefined;
				for (let frame = 0; frame < 120; frame++) {
					await new Promise(requestAnimationFrame);
					const featured = document.querySelector("[data-award-featured] button")!;
					const y = featured.getBoundingClientRect().y;
					if (firstY === undefined) firstY = y;
					travel = Math.max(travel, Math.abs(y - firstY));
					for (const heading of document.querySelectorAll("[data-award-candidate]")) {
						let visible = 1;
						for (let node: Element | null = heading; node; node = node.parentElement) visible *= Number(getComputedStyle(node).opacity);
						opacity = Math.min(opacity, visible);
					}
				}
				return { opacity, travel };
			});
			await page.screenshot({ path: info.outputPath(`back-to-second-${theme}-${width}.png`) });
			expect(reverse.opacity).toBeGreaterThan(0.95);
			expect(reverse.travel).toBeLessThan(2);
			for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowLeft");
			await expect(page.getByLabel("Category nominees").getByRole("button", { name: "View Nominee 5", exact: true })).toBeVisible();
			for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
			await expect.poll(() => winner.getByRole("progressbar").getAttribute("aria-valuenow").then(Number)).toBeCloseTo(100 / 3, 1);

			await page.keyboard.press("ArrowRight");
			await expect(page.getByRole("heading", { name: "Best quote", exact: true })).toBeVisible();
			await page.keyboard.press("ArrowRight");
			await page
				.getByLabel("Category nominees")
				.getByRole("button", { name: `View ${quoteTitle}`, exact: true })
				.click();
			await expect(page.getByRole("heading", { name: quoteTitle, exact: true })).toHaveCount(1);
			const textPanel = page.getByText(quoteDescription, { exact: true }).locator("..");
			const textBox = await textPanel.boundingBox(),
				frameBox = await textPanel.locator("..").boundingBox();
			expect(textBox!.y + textBox!.height).toBeLessThanOrEqual(frameBox!.y + frameBox!.height + 1);
			await page.screenshot({ path: info.outputPath(`quote-${theme}-${width}.png`), fullPage: true });
			await page.keyboard.press("Escape");
			await page.keyboard.press("ArrowRight");
			const textScale = await page.evaluate(async () => {
				let distortion = 0;
				for (let frame = 0; frame < 45; frame++) {
					await new Promise(requestAnimationFrame);
					let node: Element | null = document.querySelector("[data-award-slot] button span");
					let scale = 1;
					while (node) {
						const transform = getComputedStyle(node).transform;
						if (transform !== "none") scale *= new DOMMatrix(transform).a;
						node = node.parentElement;
					}
					distortion = Math.max(distortion, Math.abs(scale - 1));
				}
				return distortion;
			});
			expect(textScale).toBeLessThan(0.05);
			await expect(others.getByRole("button")).toHaveCount(1);
			await page.keyboard.press("ArrowRight");
			await expect(others.getByRole("button", { name: `View ${quoteTitle}`, exact: true })).toBeVisible();
			await expect(winner).toHaveCount(0);
			await page.keyboard.press("ArrowRight");
			await expect(page.getByRole("heading", { name: "The winners", exact: true })).toBeVisible();
			await expect(page.getByRole("button", { name: "View Nominee 1" })).toHaveCount(0);
			await page.keyboard.press("ArrowRight");
			const recap = page.getByRole("button", { name: "View Nominee 1" });
			await expect(recap).toBeVisible();
			await expect.poll(() => recap.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
			await expect(page.getByLabel("Winner recap")).toHaveCSS("opacity", "1");
			await page.screenshot({ path: info.outputPath(`recap-${theme}-${width}.png`), fullPage: true });
			configuration.presentation.showChat = true;
			await tourWorld.fixture.pool.query("UPDATE award_events SET configuration=$2 WHERE id=$1", [id, JSON.stringify(configuration)]);
			await page.reload();
			const chat = page.getByRole("complementary", { name: "Twitch chat preview", exact: true });
			await expect(chat).toBeVisible();
			for (let step = 0; step < 4; step++) await page.keyboard.press("ArrowRight");
			await expect(page.getByLabel("Category nominees").getByRole("button", { name: "View Nominee 1", exact: true })).toBeVisible();
			if (width === 1440) {
				const media = await page.getByLabel("Category nominees").boundingBox();
				const sidebar = await chat.boundingBox();
				expect(media!.x + media!.width).toBeLessThanOrEqual(sidebar!.x);
			}
			await page.getByLabel("Category nominees").getByRole("button", { name: "View Nominee 1", exact: true }).click();
			await expect(chat).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(chat).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
			await page.screenshot({ path: info.outputPath(`chat-overview-${theme}-${width}.png`), fullPage: true });
		});
	}
