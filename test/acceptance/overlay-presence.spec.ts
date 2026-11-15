import { test, expect } from "../bdd/support/user-tour";

test("Overlay activity reaches instance health and survives subscription renewal and reconnect", { tag: "@shard:scenario" }, async ({ page, request, tourWorld }) => {
	test.setTimeout(120000);
	const response = await request.post(`${tourWorld.origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { withProviderCredentials: true } });
	expect(response.ok()).toBe(true);
	const { fixture } = await response.json();
	await page.addInitScript(() => {
		const state = window as typeof window & { obsstudio: object; presenceProbe: { sockets: WebSocket[]; reports: boolean[]; subscription?: string; acknowledgements: number } };
		state.obsstudio = {};
		state.presenceProbe = { sockets: [], reports: [], acknowledgements: 0 };
		const NativeSocket = window.WebSocket;
		window.WebSocket = class extends NativeSocket {
			constructor(url: string | URL, protocols?: string | string[]) {
				super(url, protocols);
				if (new URL(String(url), location.href).pathname !== "/ws") return;
				state.presenceProbe.sockets.push(this);
				this.addEventListener("message", (event) => {
					if (typeof event.data === "string" && event.data.startsWith("subscribed ")) state.presenceProbe.acknowledgements++;
				});
			}
			send(data: Parameters<WebSocket["send"]>[0]) {
				if (typeof data === "string") {
					const message = JSON.parse(data);
					if (message.type === "subscribe") state.presenceProbe.subscription = data;
					if (message.type === "source_activity") state.presenceProbe.reports.push(message.data.active);
				}
				super.send(data);
			}
		};
	});
	const readCount = async () => {
		const health = await request.get(`${tourWorld.origin}/internal/health/instance`, { headers: { Authorization: "Bearer clipify-e2e-instance-health-not-for-production" } });
		expect(health.ok()).toBe(true);
		return (await health.json()).presence.connectedCreators;
	};
	await page.goto(`${tourWorld.origin}/overlay/${fixture.overlayId}?secret=${encodeURIComponent(fixture.overlaySecret)}`);
	await expect.poll(() => page.evaluate(() => (window as any).presenceProbe.acknowledgements)).toBe(1);
	expect(await readCount()).toBe(0);
	await page.evaluate(() => window.dispatchEvent(new CustomEvent("obsSourceVisibleChanged", { detail: { visible: true } })));
	expect(await readCount()).toBe(0);
	const activity = (active: boolean) => page.evaluate((active) => window.dispatchEvent(new CustomEvent("obsSourceActiveChanged", { detail: { active } })), active);
	await activity(true);
	await expect.poll(readCount).toBe(1);
	await page.evaluate(() => {
		const probe = (window as any).presenceProbe;
		probe.sockets.at(-1).send(probe.subscription);
	});
	await expect.poll(() => page.evaluate(() => (window as any).presenceProbe.acknowledgements)).toBe(2);
	await expect.poll(() => page.evaluate(() => (window as any).presenceProbe.reports.length)).toBe(2);
	await expect.poll(readCount).toBe(1);
	await page.evaluate(() => (window as any).presenceProbe.sockets.at(-1).close());
	await expect.poll(() => page.evaluate(() => (window as any).presenceProbe.acknowledgements)).toBe(3);
	await expect.poll(readCount).toBe(1);
	await activity(false);
	await expect.poll(readCount).toBe(0);
	const reports = await page.evaluate(() => (window as any).presenceProbe.reports.length);
	await expect.poll(() => page.evaluate(() => (window as any).presenceProbe.reports.length), { timeout: 30000 }).toBeGreaterThan(reports);
	expect(await readCount()).toBe(0);
});
