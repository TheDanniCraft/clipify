/** @jest-environment node */
jest.mock("server-only", () => ({}));
import { isSafeStorageAddress, storageEndpointSchema, signS3Request } from "@/server/events/storage-http";
it.each(["127.0.0.1", "10.1.2.3", "169.254.169.254", "100.64.0.1", "::1", "::", "::ffff:127.0.0.1", "::ffff:7f00:1", "fe80::1", "fd00::1", "2001:db8::1", "2002:7f00:1::"])("rejects internal or reserved storage address %s", (address) => expect(isSafeStorageAddress(address)).toBe(false));
it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])("accepts public storage address %s", (address) => expect(isSafeStorageAddress(address)).toBe(true));
it.each(["http://s3.example.com", "https://user:pass@s3.example.com", "https://s3.example.com/?token=secret", "https://s3.example.com/#fragment"])("rejects unsafe endpoint %s", (endpoint) => expect(storageEndpointSchema.safeParse(endpoint).success).toBe(false));
it("signs canonical S3 headers with the official AWS example inputs", () => {
	const signed = signS3Request({ endpoint: "https://examplebucket.s3.amazonaws.com", region: "us-east-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" }, "GET", "/test.txt", new Headers({ range: "bytes=0-9" }), new Date("2013-05-24T00:00:00Z"));
	expect(signed.headers.get("x-amz-date")).toBe("20130524T000000Z");
	expect(signed.headers.get("authorization")).toContain("Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request");
	expect(signed.headers.get("authorization")).toContain("SignedHeaders=host;range;x-amz-content-sha256;x-amz-date");
	expect(signed.headers.get("authorization")).toContain("Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41");
});
