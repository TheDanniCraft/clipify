/** @jest-environment node */
export {};
it("serves only the installed built-in font files without accepting paths", async () => {
	const route = await import("@/app/api/brand-font/route").catch(() => null);
	expect(route).not.toBeNull();
	if (!route) return;
	const response = await route.GET(new Request("http://localhost/api/brand-font?family=DejaVu%20Sans&weight=400"));
	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toBe("font/ttf");
	expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1000);
	expect((await route.GET(new Request("http://localhost/api/brand-font?family=../../etc/passwd&weight=400"))).status).toBe(404);
	expect((await route.GET(new Request("http://localhost/api/brand-font?family=DejaVu%20Sans&weight=900"))).status).toBe(404);
});
it("serves bold fonts and reports a missing runtime font without disclosing paths", async () => {
	const { GET } = await import("@/app/api/brand-font/route");
	expect((await GET(new Request("http://localhost/api/brand-font?family=DejaVu%20Sans&weight=700"))).status).toBe(200);
	expect((await GET(new Request("http://localhost/api/brand-font"))).status).toBe(404);
	const fs = (await import("node:fs/promises")).default;
	const spy = jest.spyOn(fs, "readFile").mockRejectedValueOnce(Error("missing"));
	try {
		expect((await GET(new Request("http://localhost/api/brand-font?family=DejaVu%20Sans"))).status).toBe(503);
	} finally {
		spy.mockRestore();
	}
});
