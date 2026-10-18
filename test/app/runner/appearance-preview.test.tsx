/** @jest-environment node */
jest.mock("server-only", () => ({}));
const mockPrincipal = jest.fn();
const mockProfile = jest.fn();
const mockRunner = jest.fn();
const mockOverlay = jest.fn();
const mockAccess = jest.fn();
const mockOwnedAsset = jest.fn();
const mockNextBroadcast = jest.fn();
jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: () => mockPrincipal() }));
jest.mock("@/server/runner/branding-profiles", () => ({ getRunnerBrandingProfileForPrincipal: (...args: unknown[]) => mockProfile(...args), readRunnerNextBroadcastInternal: (...args: unknown[]) => mockNextBroadcast(...args) }));
jest.mock("@/server/runner/branding-assets", () => ({ readOwnedRunnerBrandingAsset: (...args: unknown[]) => mockOwnedAsset(...args) }));
jest.mock("@/db/client", () => ({ db: { query: { runnersTable: { findFirst: (...args: unknown[]) => mockRunner(...args) }, overlaysTable: { findFirst: (...args: unknown[]) => mockOverlay(...args) } } } }));
jest.mock("@/server/overlays", () => ({ getOverlayRuntimeAccessInternal: (...args: unknown[]) => mockAccess(...args) }));
jest.mock("@/app/components/overlayPlayer", () => ({ __esModule: true, default: "preview-overlay-player" }));
import Preview from "@/app/runner/preview/[runnerId]/page";
import { renderToStaticMarkup } from "react-dom/server";

const runnerId = "11111111-1111-4111-8111-111111111111";
const overlayId = "22222222-2222-4222-8222-222222222222";
const ownerId = "preview-owner";
beforeEach(() => {
	jest.clearAllMocks();
	mockOwnedAsset.mockImplementation(async (ownerId: string, id: string, kind: string) => ({ ownerId, id, kind }));
	mockNextBroadcast.mockResolvedValue({ startUtc: "2028-01-15T13:00:00.000Z", timezone: "Europe/Berlin" });
	mockPrincipal.mockResolvedValue({ userId: ownerId });
	mockRunner.mockResolvedValue({ id: runnerId, ownerId });
	mockProfile.mockResolvedValue({ success: true, profile: { watermarkCorner: "bottom_right", revision: 1 } });
	mockOverlay.mockResolvedValue({ id: overlayId, ownerId, secret: "private-preview-secret" });
	mockAccess.mockResolvedValue({ allowed: true, overlay: { id: overlayId, ownerId } });
});

test.each(["signed out", "invalid runner", "missing runner", "permission denied", "invalid overlay", "missing overlay", "source denied", "foreign source"])("TDD-US4-FR017: owner preview fails closed for %s", async (boundary) => {
	let requestedRunner = runnerId,
		requestedOverlay = overlayId;
	if (boundary === "signed out") mockPrincipal.mockResolvedValue(null);
	if (boundary === "invalid runner") requestedRunner = "invalid";
	if (boundary === "missing runner") mockRunner.mockResolvedValue(undefined);
	if (boundary === "permission denied") mockProfile.mockResolvedValue({ success: false, error: "Access denied" });
	if (boundary === "invalid overlay") requestedOverlay = "invalid";
	if (boundary === "missing overlay") mockOverlay.mockResolvedValue(undefined);
	if (boundary === "source denied") mockAccess.mockResolvedValue({ allowed: false });
	if (boundary === "foreign source") mockAccess.mockResolvedValue({ allowed: true, overlay: { id: overlayId, ownerId: "another-owner" } });
	const result = renderToStaticMarkup(await Preview({ params: Promise.resolve({ runnerId: requestedRunner }), searchParams: Promise.resolve({ overlayId: requestedOverlay, watermarkCorner: "top_left" }) }));
	expect(result).not.toContain('data-runner-attribution="true"');
	expect(result).not.toContain("preview-overlay-player");
	expect(result).not.toContain("private-preview-secret");
});

test.each([
	[undefined, "bottom_right"],
	["invalid", "bottom_right"],
	["top_left", "top_left"],
	["top_right", "top_right"],
	["bottom_left", "bottom_left"],
	["bottom_right", "bottom_right"],
])("TDD-US4-FR017: an authorized draft corner %s resolves safely to %s", async (draft, expected) => {
	const result = await Preview({ params: Promise.resolve({ runnerId }), searchParams: Promise.resolve({ overlayId, watermarkCorner: draft }) });
	expect(result.props).toMatchObject({ attributionRequired: true, executionGeneration: `preview-${runnerId}`, watermarkCorner: expected });
	expect(mockProfile).toHaveBeenCalledWith({ userId: ownerId }, { ownerId, runnerId });
	expect(mockAccess).toHaveBeenCalledWith(overlayId, "websocket", "private-preview-secret");
	expect(result.props.children.props).toMatchObject({ initialStandby: true, runnerPresentation: true });
	expect(renderToStaticMarkup(result)).toContain('data-runner-attribution="true"');
});

test("TDD-US4-FR018 U18: authorized Pro preview defaults clean while retaining its saved corner", async () => {
	mockProfile.mockResolvedValue({ success: true, runnerPro: true, profile: { watermarkCorner: "top_left", proShowAttribution: false, revision: 2 } });
	const result = await Preview({ params: Promise.resolve({ runnerId }), searchParams: Promise.resolve({ overlayId }) });
	expect(result.props).toMatchObject({ attributionRequired: false, executionGeneration: `preview-${runnerId}`, watermarkCorner: "top_left" });
	expect(renderToStaticMarkup(result)).not.toContain('data-runner-attribution="true"');
});

test("TDD-US4-OPT093 U133: authorized Pro preview renders its saved voluntary attribution", async () => {
	mockProfile.mockResolvedValue({ success: true, runnerPro: true, profile: { watermarkCorner: "top_left", proShowAttribution: true, revision: 3 } });
	const result = await Preview({ params: Promise.resolve({ runnerId }), searchParams: Promise.resolve({ overlayId }) });
	expect(result.props).toMatchObject({ attributionRequired: true, executionGeneration: `preview-${runnerId}`, watermarkCorner: "top_left" });
	expect(renderToStaticMarkup(result)).toContain('data-runner-attribution="true"');
});

test.each([
	{ runnerPro: true, saved: false, draft: "true", required: true },
	{ runnerPro: true, saved: true, draft: "false", required: false },
	{ runnerPro: true, saved: true, draft: "invalid", required: true },
	{ runnerPro: false, saved: false, draft: "false", required: true },
])("TDD-US4-OPT093 U133: owned draft $draft with Pro=$runnerPro resolves safely to attribution=$required", async ({ runnerPro, saved, draft, required }) => {
	mockProfile.mockResolvedValue({ success: true, runnerPro, profile: { watermarkCorner: "top_left", proShowAttribution: saved, revision: 3 } });
	const result = await Preview({ params: Promise.resolve({ runnerId }), searchParams: Promise.resolve({ overlayId, proShowAttribution: draft }) });
	expect(result.props).toMatchObject({ attributionRequired: required, executionGeneration: `preview-${runnerId}`, watermarkCorner: "top_left" });
	expect(mockProfile).toHaveBeenCalledWith({ userId: ownerId }, { ownerId, runnerId });
});

test("TDD-US4-EXP001 U288: owner preview passes known paid validity to its mounted generated renderer", async () => {
	const knownPaidUntil = new Date(Date.now() + 60000).toISOString();
	mockProfile.mockResolvedValue({ success: true, runnerPro: true, validUntil: knownPaidUntil, profile: { watermarkCorner: "top_left", proShowAttribution: false, revision: 3 } });
	const result = await Preview({ params: Promise.resolve({ runnerId }), searchParams: Promise.resolve({ overlayId }) });
	expect(result.props).toMatchObject({ attributionRequired: false, executionGeneration: `preview-${runnerId}`, watermarkCorner: "top_left", knownPaidUntil });
});

const savedAppearance = { watermarkCorner: "bottom_right", proShowAttribution: false, revision: 3, standbyBackgroundColor: "#16324f", message: "Saved message", backgroundAssetId: "33333333-3333-4333-8333-333333333333", logoAssetId: "44444444-4444-4444-8444-444444444444", showNextBroadcastTime: true };

test("TDD-US4-FR019 strength: valid Pro drafts preview all appearance fields and muted playback without saving", async () => {
	mockProfile.mockResolvedValue({ success: true, runnerPro: true, profile: savedAppearance });
	const backgroundAssetId = "55555555-5555-4555-8555-555555555555";
	const logoAssetId = "66666666-6666-4666-8666-666666666666";
	const result = await Preview({ params: Promise.resolve({ runnerId }), searchParams: Promise.resolve({ overlayId, standbyBackgroundColor: "#abcdef", backgroundAssetId, logoAssetId, message: "Draft message", showNextBroadcastTime: "true", previewMode: "playback" }) });
	expect(result.props).toMatchObject({ runnerPro: true, standbyBackgroundColor: "#abcdef", standbyMessage: "Draft message", standbyBackgroundImageUrl: `/runner/preview/${runnerId}/assets/${backgroundAssetId}`, standbyLogoUrl: `/runner/preview/${runnerId}/assets/${logoAssetId}?kind=logo`, standbyNextBroadcast: { startUtc: "2028-01-15T13:00:00.000Z", timezone: "Europe/Berlin" } });
	expect(result.props.children.props).toMatchObject({ initialStandby: false, embedMuted: true, embedAutoplay: true, runnerPresentation: true });
	expect(mockOwnedAsset).toHaveBeenCalledWith(ownerId, backgroundAssetId, "background");
	expect(mockOwnedAsset).toHaveBeenCalledWith(ownerId, logoAssetId, "logo");
	expect(mockNextBroadcast).toHaveBeenCalledWith({ ownerId, runnerId });
});

test("TDD-US4-FR019 strength: invalid Pro drafts retain saved appearance and its enabled next-start hint", async () => {
	mockProfile.mockResolvedValue({ success: true, runnerPro: true, profile: savedAppearance });
	const result = await Preview({ params: Promise.resolve({ runnerId }), searchParams: Promise.resolve({ overlayId, standbyBackgroundColor: "invalid", backgroundAssetId: "invalid", logoAssetId: "invalid", message: "x".repeat(161), showNextBroadcastTime: "invalid" }) });
	expect(result.props).toMatchObject({ standbyBackgroundColor: savedAppearance.standbyBackgroundColor, standbyMessage: savedAppearance.message, standbyBackgroundImageUrl: `/runner/preview/${runnerId}/assets/${savedAppearance.backgroundAssetId}`, standbyLogoUrl: `/runner/preview/${runnerId}/assets/${savedAppearance.logoAssetId}?kind=logo`, standbyNextBroadcast: { timezone: "Europe/Berlin" } });
});

test("TDD-US4-FR019 strength: empty optional-image drafts and a disabled hint clear the preview without storage reads", async () => {
	mockProfile.mockResolvedValue({ success: true, runnerPro: true, profile: savedAppearance });
	const result = await Preview({ params: Promise.resolve({ runnerId }), searchParams: Promise.resolve({ overlayId, backgroundAssetId: "", logoAssetId: "", message: "", showNextBroadcastTime: "false" }) });
	expect(result.props).toMatchObject({ standbyBackgroundImageUrl: undefined, standbyLogoUrl: undefined, standbyNextBroadcast: null, standbyMessage: "" });
	expect(mockOwnedAsset).not.toHaveBeenCalled();
	expect(mockNextBroadcast).not.toHaveBeenCalled();
});

test("TDD-US4-FR019 strength: Free preview cannot apply paid draft fields or enable a next-start hint", async () => {
	mockProfile.mockResolvedValue({ success: true, runnerPro: false, profile: savedAppearance });
	const result = await Preview({ params: Promise.resolve({ runnerId }), searchParams: Promise.resolve({ overlayId, standbyBackgroundColor: "#abcdef", backgroundAssetId: "55555555-5555-4555-8555-555555555555", logoAssetId: "66666666-6666-4666-8666-666666666666", message: "Hidden draft", showNextBroadcastTime: "true" }) });
	expect(result.props).toMatchObject({ runnerPro: false, standbyBackgroundColor: savedAppearance.standbyBackgroundColor, standbyMessage: savedAppearance.message, standbyNextBroadcast: null });
	expect(mockOwnedAsset).toHaveBeenCalledWith(ownerId, savedAppearance.backgroundAssetId, "background");
	expect(mockOwnedAsset).toHaveBeenCalledWith(ownerId, savedAppearance.logoAssetId, "logo");
	expect(mockNextBroadcast).not.toHaveBeenCalled();
});
