/** @jest-environment node */

import { deterministicUuid, validateSyntheticTarget } from "../../../scripts/auth-cutover/seed-synthetic-postgres";

describe("TDD-US6-007 synthetic PostgreSQL rehearsal guard", () => {
	it("accepts only explicitly named 2x rehearsal databases", () => {
		expect(validateSyntheticTarget("postgres://localhost/clipify_auth_rehearsal_synthetic_2x_20260929", "rehearsal")).toBe("clipify_auth_rehearsal_synthetic_2x_20260929");
		expect(() => validateSyntheticTarget("postgres://localhost/clipify", "rehearsal")).toThrow("SYNTHETIC_DATABASE_NAME_REQUIRED");
		expect(() => validateSyntheticTarget("postgres://localhost/clipify_auth_rehearsal_synthetic_2x_20260929", "production")).toThrow("SYNTHETIC_REHEARSAL_ENV_REQUIRED");
	});

	it("creates stable UUIDs and rejects invalid ranges", () => {
		expect(deterministicUuid(1, 42)).toBe("00000001-0000-4000-8000-000000000042");
		expect(() => deterministicUuid(-1, 1)).toThrow("INVALID_UUID_NAMESPACE");
		expect(() => deterministicUuid(1, 0)).toThrow("INVALID_UUID_SEQUENCE");
	});
});
