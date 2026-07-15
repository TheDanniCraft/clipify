import crypto from "crypto";

// Ensure this matches the 32-byte secret required for AES-256
const configuredSecret = process.env.ENCRYPTION_SECRET;
if (process.env.NODE_ENV === "production" && !configuredSecret) {
	throw new Error("ENCRYPTION_SECRET environment variable is required in production");
}

const ENCRYPTION_SECRET = configuredSecret || "0123456789abcdef0123456789abcdef"; // 32 chars for local dev fallback

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 16;

/**
 * Encrypts a string using AES-256-GCM.
 * The output format is: iv:salt:authTag:encryptedText (hex encoded)
 */
export function encryptString(text: string): string {
	if (!text) return "";

	const iv = crypto.randomBytes(IV_LENGTH);
	const salt = crypto.randomBytes(SALT_LENGTH);

	// Derive key using PBKDF2 (adds extra security if secret isn't perfectly random)
	const key = crypto.pbkdf2Sync(ENCRYPTION_SECRET, salt, 100000, 32, "sha256");

	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

	let encrypted = cipher.update(text, "utf8", "hex");
	encrypted += cipher.final("hex");

	const authTag = cipher.getAuthTag();

	// Format: iv:salt:authTag:encrypted
	return `${iv.toString("hex")}:${salt.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts a string previously encrypted by encryptString.
 */
export function decryptString(encryptedText: string): string | null {
	if (!encryptedText) return null;

	try {
		const parts = encryptedText.split(":");
		if (parts.length !== 4) return null;

		const [ivHex, saltHex, authTagHex, encryptedHex] = parts;

		const iv = Buffer.from(ivHex, "hex");
		const salt = Buffer.from(saltHex, "hex");
		const authTag = Buffer.from(authTagHex, "hex");

		const key = crypto.pbkdf2Sync(ENCRYPTION_SECRET, salt, 100000, 32, "sha256");

		const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);

		let decrypted = decipher.update(encryptedHex, "hex", "utf8");
		decrypted += decipher.final("utf8");

		return decrypted;
	} catch (error) {
		console.error("Failed to decrypt string:", error);
		return null;
	}
}
