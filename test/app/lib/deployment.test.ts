import { getDeploymentId, isLongLivedRuntimePath, isMissingServerActionError } from "@/app/lib/deployment";

describe("deployment recovery", () => {
	it("ignores Next.js' false sentinel when no deployment ID is configured", () => {
		const original = process.env.NEXT_DEPLOYMENT_ID;
		try {
			Object.assign(process.env, { NEXT_DEPLOYMENT_ID: false });
			expect(() => getDeploymentId()).not.toThrow();
		} finally {
			if (original === undefined) delete process.env.NEXT_DEPLOYMENT_ID;
			else process.env.NEXT_DEPLOYMENT_ID = original;
		}
	});

	it.each(["/embed/overlay-1", "/overlay/overlay-1", "/controller/overlay-1", "/gallery/gallery-1/frame", "/gallery/gallery-1/clip/clip-1", "/dashboard/galleries/gallery-1/preview/clip/clip-1", "/demoPlayer"])("monitors the long-lived runtime path %s", (pathname) => {
		expect(isLongLivedRuntimePath(pathname)).toBe(true);
	});

	it.each(["/", "/gallery", "/gallery/gallery-1", "/dashboard/galleries/gallery-1", "/dashboard/overlay/overlay-1"])("does not poll regular application path %s", (pathname) => {
		expect(isLongLivedRuntimePath(pathname)).toBe(false);
	});

	it("recognizes both Next.js missing-action error messages", () => {
		expect(isMissingServerActionError(new Error('Failed to find Server Action "abc". This request might be from an older deployment.'))).toBe(true);
		expect(isMissingServerActionError(new Error('Server Action "abc" was not found on the server.'))).toBe(true);
		expect(isMissingServerActionError(new Error("Network request failed"))).toBe(false);
	});
});
