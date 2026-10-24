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

const savedAppearance = { watermarkCorner: "bottom_right", proShowAttribution: false, revision: 3, standbyBackgroundColor: "#16324f", message: "Saved message", backgroundAssetId: "33333333-3333-4333-8333-333333333333", logoAssetId: "44444444-4444-4444-8444-444444444444", showNextBroadcastTime: true };

test.each([false, true])("UX-C3: authenticated preview loads saved appearance with authoritative Pro=%s", async (runnerPro) => {
	mockProfile.mockResolvedValue({ success: true, runnerPro, profile: savedAppearance });
	const result = await Preview({ params: Promise.resolve({ runnerId }), searchParams: Promise.resolve({ overlayId }) });
	expect(result.props).toMatchObject({ runnerId, runnerPro, overlay: { id: overlayId, ownerId }, initial: { watermarkCorner: savedAppearance.watermarkCorner, message: savedAppearance.message, backgroundAssetId: savedAppearance.backgroundAssetId, previewMode: "standby" } });
	expect(mockProfile).toHaveBeenCalledWith({ userId: ownerId }, { ownerId, runnerId });
	expect(mockAccess).toHaveBeenCalledWith(overlayId, "websocket", "private-preview-secret");
	expect(renderToStaticMarkup(result).includes('data-runner-attribution="true"')).toBe(!runnerPro);
	expect(mockNextBroadcast).toHaveBeenCalledTimes(runnerPro ? 1 : 0);
});

test("UX-C3: draft query parameters cannot configure the initial authenticated preview", async () => {
	mockProfile.mockResolvedValue({ success: true, runnerPro: true, profile: savedAppearance });
	const result = await Preview({ params: Promise.resolve({ runnerId }), searchParams: Promise.resolve({ overlayId, proShowAttribution: "true", message: "URL draft", backgroundAssetId: "", watermarkCorner: "top_left" }) });
	expect(result.props.initial).toMatchObject({ watermarkCorner: "bottom_right", message: "Saved message", backgroundAssetId: savedAppearance.backgroundAssetId, proShowAttribution: false, previewMode: "standby" });
	expect(mockOwnedAsset).not.toHaveBeenCalled();
});

test("TDD-US4-EXP001: preview passes the known paid deadline to the mounted renderer", async () => {
	const validUntil = "2028-01-15T13:00:00.000Z";
	mockProfile.mockResolvedValue({ success: true, runnerPro: true, validUntil, profile: savedAppearance });
	const result = await Preview({ params: Promise.resolve({ runnerId }), searchParams: Promise.resolve({ overlayId }) });
	expect(result.props).toMatchObject({ runnerPro: true, validUntil });
});
