/** @jest-environment node */
jest.mock("server-only", () => ({}));
const mockOrdinaryOverlayRead = jest.fn();
const mockOrdinaryOverlayTouch = jest.fn();
jest.mock("@actions/database", () => ({ getOverlayBySecret: (...args: unknown[]) => mockOrdinaryOverlayRead(...args), touchOverlay: (...args: unknown[]) => mockOrdinaryOverlayTouch(...args), getOverlayPublic: jest.fn() }));
jest.mock("@components/overlayPlayer", () => ({ __esModule: true, default: "ordinary-overlay-player" }));
const mockPresentationCookie = jest.fn();
const mockSourceRead = jest.fn();
const mockBrandingRead = jest.fn();
const mockNextBroadcastRead = jest.fn();
jest.mock("@/server/runner/standby-next-broadcast", () => ({ readRunnerNextBroadcastInternal: (...args: unknown[]) => mockNextBroadcastRead(...args) }));
const mockSourceAccess = jest.fn();
jest.mock("next/headers", () => ({ cookies: async () => ({ get: () => mockPresentationCookie() }) }));
jest.mock("@/server/overlays", () => ({ getOverlayRuntimeAccessInternal: (...args: unknown[]) => mockSourceAccess(...args) }));
const mockRunnerRead = jest.fn();
const mockSessionRead = jest.fn();
const mockAdmissionRead = jest.fn();
jest.mock("@/db/client", () => ({
	db: {
		query: {
			runnerBrandingProfilesTable: { findFirst: (...args: unknown[]) => mockBrandingRead(...args) },
			overlaysTable: { findFirst: (...args: unknown[]) => mockSourceRead(...args) },
			runnersTable: { findFirst: (...args: unknown[]) => mockRunnerRead(...args) },
			streamSessionsTable: { findFirst: (...args: unknown[]) => mockSessionRead(...args) },
			runnerBroadcastAdmissionsTable: { findFirst: (...args: unknown[]) => mockAdmissionRead(...args) },
		},
	},
}));
import PrivatePresentationPage from "@/app/runner/presentation/[sessionId]/page";
import RunnerGeneratedPresentation from "@/app/components/runnerGeneratedPresentation";
import { renderToStaticMarkup } from "react-dom/server";
import OrdinaryOverlayPage from "@/app/overlay/[overlayId]/page";
import OverlayPlayer from "@components/overlayPlayer";
import type { ReactElement, ReactNode } from "react";
import { randomUUID } from "node:crypto";
import * as presentation from "@/app/api/runner/presentation/route";
import * as presentationAuthority from "@/server/runner/presentation";
import { resolveRunnerPresentationPolicy } from "@/server/runner/branding";

const ownerId = "presentation-owner";
const runnerId = randomUUID(),
	sessionId = randomUUID(),
	generation = randomUUID(),
	overlayId = randomUUID();
const runner = { id: runnerId, ownerId, token: "private-presentation-runner-token" };
const session = { id: sessionId, ownerId, runnerId, overlayId, mode: "24/7", configurationRevision: 1, desiredState: "running", actualState: "running" };
const admission = { id: randomUUID(), ownerId, runnerId, sessionId, executionGeneration: generation, state: "active", configurationRevision: 1, startedAt: new Date(1000000), revokedAt: null, scheduledEnd: null, leaseExpiresAt: new Date(1300000), benefitsAtStart: { runnerPro: false, sourceIdAtStart: overlayId, sourceRevisionAtStart: 1 } };
let previousSecret: string | undefined;
beforeEach(() => {
	jest.clearAllMocks();
	mockNextBroadcastRead.mockResolvedValue(null);
	mockBrandingRead.mockResolvedValue(undefined);
	previousSecret = process.env.JWT_SECRET;
	process.env.JWT_SECRET = "isolated-presentation-signing-secret-not-for-production";
	jest.spyOn(Date, "now").mockReturnValue(1000000);
	mockRunnerRead.mockResolvedValue(runner);
	mockSessionRead.mockResolvedValue(session);
	mockAdmissionRead.mockResolvedValue(admission);
});
afterEach(() => {
	jest.restoreAllMocks();
	if (previousSecret === undefined) delete process.env.JWT_SECRET;
	else process.env.JWT_SECRET = previousSecret;
});
const request = () => new Request("https://clipify.example/api/runner/presentation", { method: "POST", headers: { authorization: `Bearer ${runner.token}`, "content-type": "application/json" }, body: JSON.stringify({ sessionId, executionGeneration: generation }) });

test("TDD-US4-CON012: only an assigned owner's active generation receives a scoped presentation bootstrap", async () => {
	const post = Reflect.get(presentation, "POST");
	expect(post).toEqual(expect.any(Function));
	if (typeof post !== "function") return;
	const allowed = await post(request());
	expect(allowed.status).toBe(200);
	expect(await allowed.json()).toEqual({ url: `/runner/presentation/${sessionId}`, expiresAt: expect.any(Number) });
	const cookie = allowed.headers.get("set-cookie");
	expect(cookie).toContain("HttpOnly");
	expect(cookie).toContain(`Path=/runner/presentation/${sessionId}`);
	expect(cookie).toContain("Secure");
	mockSessionRead.mockResolvedValue({ ...session, ownerId: "foreign-owner" });
	const denied = await post(request());
	expect(denied.status).toBe(403);
	expect(await denied.json()).toEqual({ error: "PRESENTATION_UNAVAILABLE" });
	expect(denied.headers.get("set-cookie")).toBeNull();
});

test("TDD-US4-CON012 U266: a signed bootstrap cannot authorize another session", async () => {
	const post = Reflect.get(presentation, "POST");
	const response = await post(request());
	expect(response.status).toBe(200);
	const cookie = response.headers.get("set-cookie") as string;
	const token = cookie.split(";", 1)[0]!.slice(cookie.indexOf("=") + 1);
	const verify = Reflect.get(presentationAuthority, "verifyRunnerPresentationIdentity");
	expect(verify).toEqual(expect.any(Function));
	if (typeof verify !== "function") return;
	expect(verify(token, sessionId, 1000000)).toMatchObject({ ownerId, runnerId, sessionId, executionGeneration: generation, admissionId: admission.id });
	expect(verify(token, randomUUID(), 1000000)).toBeNull();
});

test.each([1000000, 1000123])("TDD-US4-CON012 U267: bootstrap validity ends exactly at its signed expiration (issued %i)", async (issuedAt) => {
	jest.mocked(Date.now).mockReturnValue(issuedAt);
	const response = await Reflect.get(presentation, "POST")(request());
	expect(response.status).toBe(200);
	const { expiresAt } = await response.json();
	const cookie = response.headers.get("set-cookie") as string;
	const token = cookie.split(";", 1)[0]!.slice(cookie.indexOf("=") + 1);
	const verify = Reflect.get(presentationAuthority, "verifyRunnerPresentationIdentity");
	expect(verify(token, sessionId, expiresAt - 1)).toMatchObject({ sessionId, executionGeneration: generation });
	expect(verify(token, sessionId, expiresAt)).toBeNull();
	expect(verify(token, sessionId, expiresAt + 1)).toBeNull();
});

test("TDD-US4-CON012: a revoked active generation cannot obtain a new presentation credential", async () => {
	mockAdmissionRead.mockResolvedValue({ ...admission, revokedAt: new Date(1000000) });
	const response = await Reflect.get(presentation, "POST")(request());
	expect(response.status).toBe(403);
	expect(response.headers.get("set-cookie")).toBeNull();
	expect(await response.json()).toEqual({ error: "PRESENTATION_UNAVAILABLE" });
});

test("TDD-US4-CON012 U268: forged query flags cannot replace admission-owned Free policy", async () => {
	const forged = new Request(request().url + "?watermark=false&runnerPro=true&attributionRequired=false", request());
	const response = await presentation.POST(forged);
	expect(response.status).toBe(200);
	const body = await response.json();
	expect(body).toEqual({ url: `/runner/presentation/${sessionId}`, expiresAt: expect.any(Number) });
	const cookie = response.headers.get("set-cookie") as string;
	const token = cookie.split(";", 1)[0]!.slice(cookie.indexOf("=") + 1);
	const identity = presentationAuthority.verifyRunnerPresentationIdentity(token, sessionId, 1000000);
	expect(identity).not.toBeNull();
	const execution = await presentationAuthority.resolveRunnerPresentationExecution(identity!);
	expect(execution).not.toBeNull();
	expect(resolveRunnerPresentationPolicy({ runnerPro: execution!.admission.benefitsAtStart.runnerPro === true }, "generated_standby")).toEqual({ attributionRequired: true });
});

test("TDD-US4-CON012 U269: the ordinary overlay page renders its existing player without a Runner attribution wrapper", async () => {
	mockOrdinaryOverlayRead.mockResolvedValue({ id: overlayId, status: "active", ownerId });
	const page = await OrdinaryOverlayPage({ params: Promise.resolve({ overlayId }), searchParams: Promise.resolve({ secret: "ordinary-overlay-secret", standby: "true", runnerPro: "false", watermark: "true" }) });
	const elements: ReactElement[] = [];
	const visit = (node: ReactNode): void => {
		if (Array.isArray(node)) {
			node.forEach(visit);
			return;
		}
		if (!node || typeof node !== "object" || !("props" in node)) return;
		const element = node as ReactElement<{ children?: ReactNode }>;
		elements.push(element);
		visit(element.props.children);
	};
	visit(page);
	expect(mockOrdinaryOverlayRead).toHaveBeenCalledWith(overlayId, "ordinary-overlay-secret");
	expect(mockOrdinaryOverlayTouch).toHaveBeenCalledWith(overlayId);
	expect(elements.filter((element) => element.type === OverlayPlayer)).toHaveLength(1);
	expect(elements.filter((element) => typeof element.type === "function")).toEqual([]);
	expect(elements.some((element) => (element.props as Record<string, unknown>)["data-runner-attribution"])).toBe(false);
});

test("TDD-US4-CON012: an already-issued cached Pro occurrence can prepare its private presentation inside its captured window", async () => {
	mockAdmissionRead.mockResolvedValue({ ...admission, state: "authorized", scheduledEnd: new Date(1200000), leaseExpiresAt: new Date(1500000), dispatchedAt: new Date(990000), leaseId: randomUUID(), protocolSupportsLease: true, benefitsAtStart: { ...admission.benefitsAtStart, runnerPro: true, cacheAuthorization: true, scheduledStart: 990000 } });
	const response = await presentation.POST(request());
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ url: `/runner/presentation/${sessionId}`, expiresAt: expect.any(Number) });
});

test.each([
	{ label: "before start", now: 989999, status: 403 },
	{ label: "exact start", now: 990000, status: 200 },
	{ label: "last millisecond", now: 1199999, status: 200 },
	{ label: "exact end", now: 1200000, status: 403 },
])("TDD-US4-CON012: cached presentation respects the half-open window at $label", async ({ now, status }) => {
	jest.mocked(Date.now).mockReturnValue(now);
	mockAdmissionRead.mockResolvedValue({ ...admission, state: "authorized", scheduledEnd: new Date(1200000), leaseExpiresAt: new Date(1500000), dispatchedAt: new Date(990000), leaseId: randomUUID(), protocolSupportsLease: true, benefitsAtStart: { ...admission.benefitsAtStart, runnerPro: true, cacheAuthorization: true, scheduledStart: 990000 } });
	const response = await presentation.POST(request());
	expect(response.status).toBe(status);
	if (status === 403) expect(response.headers.get("set-cookie")).toBeNull();
});

async function renderPrivatePage() {
	const response = await presentation.POST(request());
	expect(response.status).toBe(200);
	const cookie = response.headers.get("set-cookie") as string;
	const token = cookie.split(";", 1)[0]!.slice(cookie.indexOf("=") + 1);
	mockPresentationCookie.mockReturnValue({ value: token });
	return PrivatePresentationPage({ params: Promise.resolve({ sessionId }) });
}

test("TDD-US4-CON012: the private renderer derives its source and Free attribution from the admitted owner", async () => {
	const source = { id: overlayId, ownerId, secret: "private-source-secret" };
	mockSourceRead.mockResolvedValue(source);
	mockSourceAccess.mockResolvedValue({ allowed: true, overlay: source });
	const page = await renderPrivatePage();
	const nodes = (page.props as { children: ReactElement[] }).children;
	const wrapper = nodes.find((node) => node.type === RunnerGeneratedPresentation);
	expect(wrapper).toBeDefined();
	expect(wrapper!.props).toMatchObject({ attributionRequired: true, executionGeneration: generation });
	expect(mockSourceAccess).toHaveBeenCalledWith(overlayId, "websocket", "private-source-secret");
	const player = (wrapper!.props as { children: ReactElement }).children;
	expect(player.type).toBe(OverlayPlayer);
	expect(player.props).toMatchObject({ overlay: source, overlaySecret: "private-source-secret", initialStandby: true, runnerPresentation: true });
});

test("TDD-US4-CON012: a source belonging to another owner is unavailable before any private runtime access", async () => {
	mockSourceRead.mockResolvedValue({ id: overlayId, ownerId: "foreign-owner", secret: "foreign-private-secret" });
	const page = await renderPrivatePage();
	expect(mockSourceAccess).not.toHaveBeenCalled();
	const html = renderToStaticMarkup(page);
	expect(html).toContain("Runner presentation is unavailable");
	expect(html).not.toMatch(/foreign-owner|foreign-private-secret|data-runner-attribution/);
});

test("TDD-US4-CON012: a denied source capability never renders its private presentation", async () => {
	mockSourceRead.mockResolvedValue({ id: overlayId, ownerId, secret: "private-source-secret" });
	mockSourceAccess.mockResolvedValue({ allowed: false, reason: "owner_disabled" });
	const html = renderToStaticMarkup(await renderPrivatePage());
	expect(html).toContain("Runner presentation is unavailable");
	expect(html).not.toMatch(/owner_disabled|private-source-secret|data-runner-attribution/);
});

test("TDD-US4-CON012: an oversized bootstrap body is rejected before any database lookup", async () => {
	const body = " ".repeat(4096) + JSON.stringify({ sessionId, executionGeneration: generation });
	const response = await presentation.POST(new Request(request().url, { method: "POST", headers: request().headers, body }));
	expect(response.status).toBe(413);
	expect(await response.json()).toEqual({ error: "INVALID_INPUT" });
	expect(response.headers.get("set-cookie")).toBeNull();
	expect(mockRunnerRead).not.toHaveBeenCalled();
});

test.each([
	{ label: "missing source runner", mutate: () => mockRunnerRead.mockResolvedValue(null), status: 401 },
	{ label: "foreign runner token", mutate: () => mockRunnerRead.mockResolvedValue({ ...runner, token: "another-device-token" }), status: 401 },
	{ label: "foreign session device", mutate: () => mockSessionRead.mockResolvedValue({ ...session, runnerId: randomUUID() }), status: 403 },
	{ label: "foreign admission owner", mutate: () => mockAdmissionRead.mockResolvedValue({ ...admission, ownerId: "foreign-owner" }), status: 403 },
	{ label: "foreign admission device", mutate: () => mockAdmissionRead.mockResolvedValue({ ...admission, runnerId: randomUUID() }), status: 403 },
	{ label: "foreign admission session", mutate: () => mockAdmissionRead.mockResolvedValue({ ...admission, sessionId: randomUUID() }), status: 403 },
	{ label: "stale execution generation", mutate: () => mockAdmissionRead.mockResolvedValue({ ...admission, executionGeneration: randomUUID() }), status: 403 },
	{ label: "terminal admission", mutate: () => mockAdmissionRead.mockResolvedValue({ ...admission, state: "stopped" }), status: 403 },
])("TDD-US4-CON012: $label receives only a denial without credentials", async ({ mutate, status }) => {
	mutate();
	const response = await presentation.POST(request());
	expect(response.status).toBe(status);
	expect(await response.json()).toEqual({ error: status === 401 ? "UNAUTHORIZED" : "PRESENTATION_UNAVAILABLE" });
	expect(response.headers.get("set-cookie")).toBeNull();
});

test("TDD-US4-CON012: a credential rotated after issuance cannot reopen the private renderer", async () => {
	const response = await presentation.POST(request());
	expect(response.status).toBe(200);
	const cookie = response.headers.get("set-cookie") as string;
	mockPresentationCookie.mockReturnValue({ value: cookie.split(";", 1)[0]!.slice(cookie.indexOf("=") + 1) });
	mockRunnerRead.mockResolvedValue({ ...runner, token: "rotated-private-token" });
	const html = renderToStaticMarkup(await PrivatePresentationPage({ params: Promise.resolve({ sessionId }) }));
	expect(html).toContain("Runner presentation is unavailable");
	expect(html).not.toMatch(/rotated-private-token|private-presentation-runner-token|data-runner-attribution/);
	expect(mockSourceRead).not.toHaveBeenCalled();
});

test.each([undefined, "not-a-signed-cookie"])("TDD-US4-CON012: invalid presentation cookie %s never reaches private data", async (token) => {
	mockPresentationCookie.mockReturnValue(token ? { value: token } : undefined);
	const html = renderToStaticMarkup(await PrivatePresentationPage({ params: Promise.resolve({ sessionId }) }));
	expect(html).toContain("Runner presentation is unavailable");
	expect(mockRunnerRead).not.toHaveBeenCalled();
	expect(mockSourceRead).not.toHaveBeenCalled();
});

test.each([
	{ label: "no authorization", header: undefined },
	{ label: "unsupported authorization", header: "Basic invalid" },
	{ label: "empty bearer", header: "Bearer " },
	{ label: "oversized bearer", header: "Bearer " + "x".repeat(4097) },
])("TDD-US4-CON012: $label is refused before reading assignment data", async ({ header }) => {
	const response = await presentation.POST(new Request(request().url, { method: "POST", headers: header ? { authorization: header } : {}, body: JSON.stringify({ sessionId, executionGeneration: generation }) }));
	expect(response.status).toBe(401);
	expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
	expect(response.headers.get("set-cookie")).toBeNull();
	expect(mockRunnerRead).not.toHaveBeenCalled();
});

test.each([
	{ label: "missing body", body: undefined },
	{ label: "malformed JSON", body: "{" },
	{ label: "invalid assignment", body: JSON.stringify({ sessionId: "not-a-session", executionGeneration: generation }) },
	{ label: "caller-supplied owner", body: JSON.stringify({ sessionId, executionGeneration: generation, ownerId: "foreign-owner" }) },
])("TDD-US4-CON012: $label returns a bounded input error without private lookup", async ({ body }) => {
	const response = await presentation.POST(new Request(request().url, { method: "POST", headers: request().headers, body }));
	expect(response.status).toBe(400);
	expect(await response.json()).toEqual({ error: "INVALID_INPUT" });
	expect(response.headers.get("set-cookie")).toBeNull();
	expect(mockRunnerRead).not.toHaveBeenCalled();
});

test("TDD-US4-CON012: missing signing configuration returns unavailable without a credential", async () => {
	delete process.env.JWT_SECRET;
	const response = await presentation.POST(request());
	expect(response.status).toBe(503);
	expect(await response.json()).toEqual({ error: "PRESENTATION_UNAVAILABLE" });
	expect(response.headers.get("set-cookie")).toBeNull();
});

test("TDD-US4-CON012: an older owned admission without a captured source uses its assigned session source", async () => {
	mockAdmissionRead.mockResolvedValue({ ...admission, benefitsAtStart: { runnerPro: false } });
	const source = { id: overlayId, ownerId, secret: "private-source-secret" };
	mockSourceRead.mockResolvedValue(source);
	mockSourceAccess.mockResolvedValue({ allowed: true, overlay: source });
	const page = await renderPrivatePage();
	expect(mockSourceAccess).toHaveBeenCalledWith(overlayId, "websocket", "private-source-secret");
	const nodes = (page.props as { children: ReactElement[] }).children;
	expect(nodes.some((node) => node.type === RunnerGeneratedPresentation)).toBe(true);
});

test("TDD-US4-CON012: an invalid captured source cannot fall back to another source or reveal private rows", async () => {
	mockAdmissionRead.mockResolvedValue({ ...admission, benefitsAtStart: { ...admission.benefitsAtStart, sourceIdAtStart: "invalid-private-source" } });
	const html = renderToStaticMarkup(await renderPrivatePage());
	expect(html).toContain("Runner presentation is unavailable");
	expect(html).not.toContain("invalid-private-source");
	expect(mockSourceRead).not.toHaveBeenCalled();
	expect(mockSourceAccess).not.toHaveBeenCalled();
});

test("TDD-US4-CON012: private presentation denials cannot be cached by shared intermediaries", async () => {
	const response = await presentation.POST(new Request(request().url, { method: "POST" }));
	expect(response.status).toBe(401);
	expect(response.headers.get("cache-control")).toBe("private, no-store");
	expect(response.headers.get("set-cookie")).toBeNull();
});

test("TDD-US4-OPT093 U133: an admitted Pro private renderer applies its owned saved attribution choice", async () => {
	const source = { id: overlayId, ownerId, secret: "private-source-secret" };
	mockSourceRead.mockResolvedValue(source);
	mockSourceAccess.mockResolvedValue({ allowed: true, overlay: source });
	mockAdmissionRead.mockResolvedValue({ ...admission, benefitsAtStart: { ...admission.benefitsAtStart, runnerPro: true } });
	mockBrandingRead.mockResolvedValue({ id: randomUUID(), ownerId, runnerId, watermarkCorner: "top_left", proShowAttribution: true, revision: 3 });
	const page = await renderPrivatePage();
	const nodes = (page.props as { children: ReactElement[] }).children;
	const wrapper = nodes.find((node) => node.type === RunnerGeneratedPresentation);
	expect(wrapper!.props).toMatchObject({ attributionRequired: true, executionGeneration: generation, watermarkCorner: "top_left" });
	expect(renderToStaticMarkup(page)).toContain('data-runner-attribution="true"');
});

test.each([
	{ boundary: "before", end: 1000001, required: false },
	{ boundary: "at", end: 1000000, required: true },
	{ boundary: "after", end: 999999, required: true },
])("TDD-US4-EXP001 U288: private output $boundary its captured paid deadline starts with required branding=$required", async ({ end, required }) => {
	const knownPaidUntil = new Date(end).toISOString();
	const source = { id: overlayId, ownerId, secret: "private-source-secret" };
	mockSourceRead.mockResolvedValue(source);
	mockSourceAccess.mockResolvedValue({ allowed: true, overlay: source });
	mockAdmissionRead.mockResolvedValue({ ...admission, benefitsAtStart: { ...admission.benefitsAtStart, runnerPro: true, validUntil: knownPaidUntil } });
	const page = await renderPrivatePage();
	const nodes = (page.props as { children: ReactElement[] }).children;
	const wrapper = nodes.find((node) => node.type === RunnerGeneratedPresentation);
	expect(wrapper!.props).toMatchObject({ attributionRequired: required, executionGeneration: generation, knownPaidUntil });
	const player = (wrapper!.props as { children: ReactElement }).children;
	expect(player.type).toBe(OverlayPlayer);
	expect(player.props).toMatchObject({ overlay: source, initialStandby: true });
});

test.each([true, false])("TDD-US4-FR019 strength: assigned appearance forwards saved media while next-start access follows captured Pro=%s", async (runnerPro) => {
	const source = { id: overlayId, ownerId, secret: "private-source-secret" };
	const backgroundAssetId = randomUUID(),
		logoAssetId = randomUUID();
	const next = { startUtc: "2028-01-15T13:00:00.000Z", timezone: "Europe/Berlin" };
	mockSourceRead.mockResolvedValue(source);
	mockSourceAccess.mockResolvedValue({ allowed: true, overlay: source });
	mockAdmissionRead.mockResolvedValue({ ...admission, benefitsAtStart: { ...admission.benefitsAtStart, runnerPro } });
	mockBrandingRead.mockResolvedValue({ id: randomUUID(), ownerId, runnerId, watermarkCorner: "top_left", proShowAttribution: false, revision: 3, standbyBackgroundColor: "#16324f", backgroundAssetId, logoAssetId, message: "Saved scene", showNextBroadcastTime: true });
	mockNextBroadcastRead.mockResolvedValue(next);
	const page = await renderPrivatePage();
	const nodes = (page.props as { children: ReactElement[] }).children;
	const wrapper = nodes.find((node) => node.type === RunnerGeneratedPresentation);
	expect(wrapper!.props).toMatchObject({ runnerPro, standbyBackgroundColor: "#16324f", standbyMessage: "Saved scene", standbyBackgroundImageUrl: `/runner/presentation/${sessionId}/assets/${backgroundAssetId}`, standbyLogoUrl: `/runner/presentation/${sessionId}/assets/${logoAssetId}`, standbyNextBroadcast: runnerPro ? next : null, executionGeneration: generation });
	if (runnerPro) expect(mockNextBroadcastRead).toHaveBeenCalledWith({ ownerId, runnerId });
	else expect(mockNextBroadcastRead).not.toHaveBeenCalled();
});
