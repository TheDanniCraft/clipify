export type BackupAttestation = {
	createdAt: string;
	checksum: string;
	checksumVerified: boolean;
	restoreDrillReference: string;
	sourceFingerprint: string;
	versions: Record<string, string>;
	availableBytes: number;
	requiredBytes: number;
};

export function verifyBackupAttestation(attestation: BackupAttestation | null, expectations: { sourceFingerprint: string; maximumAgeMs: number; now?: Date }): BackupAttestation {
	if (!attestation) throw new Error("BACKUP_ABSENT");
	if (!attestation.checksumVerified || !attestation.checksum.startsWith("sha256:")) throw new Error("BACKUP_INVALID");
	if (!attestation.restoreDrillReference.trim() || Object.keys(attestation.versions).length === 0 || attestation.availableBytes < attestation.requiredBytes) throw new Error("BACKUP_INCOMPLETE");
	const createdAt = new Date(attestation.createdAt).getTime();
	const now = (expectations.now ?? new Date()).getTime();
	if (!Number.isFinite(createdAt) || createdAt > now || now - createdAt > expectations.maximumAgeMs) throw new Error("BACKUP_STALE");
	if (attestation.sourceFingerprint !== expectations.sourceFingerprint) throw new Error("SOURCE_FINGERPRINT_MISMATCH");
	return attestation;
}
