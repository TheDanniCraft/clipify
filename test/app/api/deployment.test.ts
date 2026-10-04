import { GET } from "@/app/api/deployment/route";
import { DEPLOYMENT_ID_HEADER } from "@/app/lib/deployment";

class TestResponse {
	readonly status: number;
	readonly headers: { get(name: string): string | null };

	constructor(_body: BodyInit | null, init?: ResponseInit) {
		this.status = init?.status ?? 200;
		const headers = new Map(Object.entries(init?.headers ?? {}).map(([name, value]) => [name.toLowerCase(), String(value)]));
		this.headers = { get: (name) => headers.get(name.toLowerCase()) ?? null };
	}
}

describe("deployment endpoint", () => {
	const originalDeploymentId = process.env.NEXT_DEPLOYMENT_ID;
	const originalResponse = global.Response;

	beforeAll(() => {
		global.Response = TestResponse as unknown as typeof Response;
	});

	afterAll(() => {
		if (originalResponse === undefined) delete (global as Partial<typeof globalThis>).Response;
		else global.Response = originalResponse;
	});

	afterEach(() => {
		if (originalDeploymentId === undefined) delete process.env.NEXT_DEPLOYMENT_ID;
		else process.env.NEXT_DEPLOYMENT_ID = originalDeploymentId;
	});

	it("returns the current deployment without a cacheable body", () => {
		process.env.NEXT_DEPLOYMENT_ID = "clipify@test";
		const response = GET();

		expect(response.status).toBe(204);
		expect(response.headers.get(DEPLOYMENT_ID_HEADER)).toBe("clipify-test");
		expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
	});
});
