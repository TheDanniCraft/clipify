import { randomUUID } from "node:crypto";
import type { createMcpPostgresFixture } from "./postgres";
import { createAwardConfiguration } from "../../../src/app/lib/eventDefaults";
export async function runEventProbe(input: { fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>; auth: any; origin: string; token: string; actorId: string }) {
	const { fixture, auth, origin, token, actorId } = input,
		previousFetch = globalThis.fetch;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== origin) throw new Error("EVENT_FIXTURE_EXTERNAL_IO_FORBIDDEN");
		return auth.handler(request);
	}) as typeof fetch;
	try {
		const route = await import("@/app/mcp/route");
		let seq = 0;
		async function request(method: string, params: unknown) {
			const response = await route.POST(new Request(origin + "/mcp", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++seq, method, params }) }));
			const text = await response.text();
			const line = text.split("\n").find((line) => line.startsWith("data: "));
			const body = JSON.parse(line ? line.slice(6) : text);
			return { status: response.status, result: body.result };
		}
		async function call(name: string, args: unknown) {
			const result = await request("tools/call", { name, arguments: args });
			if (result.status !== 200 || result.result?.isError) throw new Error(`EVENT_TOOL_FAILED:${name}:${JSON.stringify(result.result?.structuredContent?.error)}`);
			return result.result.structuredContent;
		}
		const listed = await request("tools/list", {});
		const discovered = ["nominate_event_candidates", "create_event_example", "get_event_preview"].every((name) => listed.result.tools.some((tool: { name: string }) => tool.name === name));
		await fixture.pool.query('INSERT INTO "twitchCache" (type,key,value) VALUES ($1,$2,$3)', ["clip", "clip:fixture-creator:OldBabblerExampleClip", JSON.stringify({ clip: { id: "OldBabblerExampleClip", broadcaster_id: "fixture-creator", title: "An older creator clip", creator_name: "Clipper", view_count: 9999, duration: 12, created_at: "2023-06-01T12:00:00Z", thumbnail_url: "https://static-cdn.jtvnw.net/old-event-example.png" } })]);
		const example = await call("create_event_example", { creatorId: "fixture-creator", example: "babbler" });
		const previewLink = await call("get_event_preview", { creatorId: "fixture-creator", eventId: example.event.id });
		const previewToken = previewLink.previewPath.split("#")[1];
		const preview = await (await import("../../../src/server/events/preview")).readAwardPreview(example.event.id, previewToken);
		const exampleRow = (await fixture.pool.query("SELECT published_at, results_published_at FROM award_events WHERE id=$1", [example.event.id])).rows[0];
		const previewReadOnly = preview.ok && !exampleRow.published_at && !exampleRow.results_published_at && preview.event.categories.some((category) => category.candidates.some((candidate) => candidate.content.createdAt === "2023-06-01T12:00:00Z"));
		const configuration = createAwardConfiguration("Awards", "UTC"),
			now = Date.now(),
			instant = (offset: number) => new Date(now + offset).toISOString();
		configuration.categories[0] = { ...configuration.categories[0], source: "text", selection: "team" };
		const dataId = randomUUID();
		configuration.categories.push({ ...configuration.categories[0], id: dataId, title: "Watchtime", selection: "data" });
		configuration.schedule = { submissionsStart: instant(-3600000), submissionsEnd: instant(3600000), votingStart: instant(7200000), votingEnd: instant(10800000), timezone: "UTC", reviewRequired: true };
		const created = await call("create_event", { creatorId: "fixture-creator", configuration }),
			eventId = created.event.id,
			target = { creatorId: "fixture-creator", eventId },
			categoryId = configuration.categories[0].id;
		const updated = await call("update_event", { ...target, expectedRevision: 1, configuration: { ...configuration, title: "Babbler Awards" } });
		await call("publish_event", { ...target, expectedRevision: updated.event.revision });
		await call("add_event_candidate", { ...target, categoryId, proposal: { title: "hahaha die Lampe" } });
		await call("add_event_candidate", { ...target, categoryId, proposal: { title: "Birne explodiert" } });
		const review = await call("get_event_review", target),
			ids = review.candidates.map((candidate: { id: string }) => candidate.id);
		await call("group_event_candidates", { ...target, categoryId, candidateIds: ids, title: "Lampe raucht ab" });
		const grouped = await call("get_event_review", target),
			group = grouped.candidates.find((candidate: { parentId: string | null; content: { title: string } }) => !candidate.parentId && candidate.content.title === "Lampe raucht ab");
		await call("nominate_event_candidates", { ...target, categoryId, candidateIds: [group.id] });
		const schedule = { ...configuration.schedule, submissionsStart: instant(-14400000), submissionsEnd: instant(-10800000), votingStart: instant(-7200000), votingEnd: instant(3600000) };
		await fixture.pool.query("UPDATE award_events SET configuration=jsonb_set(configuration,'{schedule}',$2::jsonb) WHERE id=$1", [eventId, JSON.stringify(schedule)]);
		await call("release_event_review", target);
		await fixture.pool.query("INSERT INTO award_votes(event_id,category_id,candidate_id,auth_user_id) VALUES($1,$2,$3,$4)", [eventId, categoryId, group.id, actorId]);
		await fixture.pool.query("UPDATE award_events SET configuration=jsonb_set(configuration,'{schedule,votingEnd}',to_jsonb($2::text)) WHERE id=$1", [eventId, instant(-3600000)]);
		await call("set_event_data_result", { ...target, categoryId: dataId, result: { title: "Babbler One", value: 321, description: "Watched hours" } });
		const capability = await call("rotate_event_presenter", target),
			secret = capability.presenterPath.split("#")[1];
		const publicRead = await (await import("../../../src/server/events/public-read")).readPublicAwardEvent(eventId);
		const secretBeforeRelease = publicRead.ok && !JSON.stringify(publicRead).includes('"winner":true');
		const presenter = await (await import("../../../src/server/events/presenter")).readAwardPresenter(eventId, secret);
		await call("publish_event_results", target);
		const archive = await (await import("../../../src/server/events/public-read")).readPublicAwardEvent(eventId);
		const safe = await call("get_event", target);
		return {
			discovered,
			previewReadOnly,
			exampleCategories: example.event.configuration.categories.length,
			title: safe.event.configuration.title,
			secretReturnedAtCreate: Object.hasOwn(created, "presenterSecret"),
			secretBeforeRelease,
			presenterWinner: presenter.ok && presenter.event.categories[0].results?.some((result) => result.winner),
			archive: archive.ok ? { phase: archive.event.phase, winners: archive.event.categories.flatMap((category) => category.results?.filter((result) => result.winner).map((result) => result.id) ?? []), data: archive.event.categories.find((category) => category.id === dataId)?.dataResult } : null,
			safe: !JSON.stringify(safe).includes(secret) && !JSON.stringify(safe).includes("presenterDigest"),
		};
	} finally {
		globalThis.fetch = previousFetch;
	}
}
