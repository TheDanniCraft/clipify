import { test, expect } from "../bdd/support/user-tour";
import { WebSocket } from "ws";
import { once } from "node:events";
import { source as axeSource } from "axe-core";

for (const theme of ["light", "dark"])
	for (const width of [390, 1440])
		test(`Creator presence chips at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			test.setTimeout(120000);
			await page.setViewportSize({ width, height: 960 });
			await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
			const creators = [];
			let player: { overlayId: string; overlaySecret: string } | undefined;
			for (const [index, name, status] of [
				[0, "Twitch creator", "live"],
				[1, "Clipify creator", "live"],
				[2, "Offline creator", "offline"],
			] as const) {
				const response = await request.post(`${tourWorld.origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { withProviderCredentials: true } });
				expect(response.ok()).toBe(true);
				const { fixture } = await response.json();
				await tourWorld.fixture.pool.query("INSERT INTO \"userSettings\"(id,creator_page_enabled,creator_page_visibility) VALUES($1,true,'discoverable') ON CONFLICT(id) DO UPDATE SET creator_page_enabled=true,creator_page_visibility='discoverable'", [fixture.creatorId]);
				creators.push({ id: fixture.creatorId, username: `presence_${index}`, displayName: name, avatar: "", plan: "free", partner: false, status, viewCount: 0, lastActiveAt: null });
				if (index === 1) player = fixture;
			}
			await tourWorld.fixture.pool.query("INSERT INTO \"twitchCache\"(type,key,value,expires_at) VALUES('user','community:snapshot:obs-presence',$1,now()+interval '2 minutes')", [JSON.stringify({ streamers: creators, totalCount: 3, liveCount: 2, liveStatusKnownCount: 3, overlayActiveCount: 0, updatedAt: new Date().toISOString() })]);
			const socket = new WebSocket(tourWorld.origin.replace("http:", "ws:") + "/ws");
			try {
				await once(socket, "open");
				const subscribed = once(socket, "message");
				socket.send(JSON.stringify({ type: "subscribe", data: { overlayId: player!.overlayId, secret: player!.overlaySecret } }));
				expect(String((await subscribed)[0])).toBe(`subscribed ${player!.overlayId}`);
				socket.send(JSON.stringify({ type: "source_activity", data: { active: true } }));
				await page.goto(`${tourWorld.origin}/community`);
				await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
				await expect(page.getByRole("button", { name: "Clipify creator creator", exact: true }).getByRole("img", { name: "Clipify creator: Live with Clipify", exact: true })).toBeVisible();
				await page.addScriptTag({ content: axeSource });
				const colors: string[] = [];
				for (const [creator, label, color] of [
					["Twitch creator", "Live on Twitch", "danger"],
					["Clipify creator", "Live with Clipify", "success"],
					["Offline creator", "Offline", "default"],
				] as const) {
					await page.getByRole("button", { name: `${creator} creator`, exact: true }).click();
					const profile = page.getByRole("dialog", { name: `${creator} profile`, exact: true });
					await expect(profile.locator("..")).not.toHaveAttribute("data-entering", "true");
					const chip = profile.getByText(label, { exact: true }).locator("..");
					await expect(chip).toHaveClass(new RegExp(`chip--${color}`));
					colors.push(await chip.evaluate((element) => getComputedStyle(element).color));
					await expect(profile.getByText("0 clips on Clipify", { exact: true })).toBeVisible();
					expect(await page.evaluate(async () => (await (window as typeof window & { axe: typeof import("axe-core") }).axe.run(document.querySelector('[role="dialog"]')!, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })))).toEqual([]);
					await profile.screenshot({ path: info.outputPath(`presence-${color}-${width}-${theme}.png`), animations: "disabled" });
					await page.keyboard.press("Escape");
				}
				expect(new Set(colors).size).toBe(3);
				socket.close();
				await once(socket, "close");
				await page.reload();
				await expect(page.getByRole("button", { name: "Clipify creator creator", exact: true }).getByRole("img", { name: "Clipify creator: Live on Twitch", exact: true })).toBeVisible();
			} finally {
				socket.terminate();
			}
		});
