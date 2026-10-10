/** @jest-environment node */
import { safeReturnPath } from "@/auth/return-url";

test.each(["/dashboard", "/dashboard/settings?tab=billing", "/accept-invitation?invitationId=fixture"])("accepts an internal return path %s", (path) => {
	expect(safeReturnPath(path)).toBe(path);
});
test.each([undefined, null, "", "https://external.example", "//external.example", "/\\external.example", "/\t/external.example", "/\n/external.example"])("rejects a browser-normalized external return path %p", (path) => {
	expect(safeReturnPath(path)).toBeNull();
});
