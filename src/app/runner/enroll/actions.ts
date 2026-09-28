"use server";

import { redirect } from "next/navigation";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { validateAuth } from "@actions/auth";
import { authorizeCreatorOperation, listAuthorizedCreatorOperations } from "@/auth/authorize-operation";
import { db } from "@/db/client";
import { runnerEnrollmentsTable, runnersTable, usersTable } from "@/db/schema";
import { isValidUserCode, normalizeUserCode } from "./code";

export type RunnerEnrollActionState = { status: "idle" } | { status: "missing-code" } | { status: "invalid-code" } | { status: "expired" } | { status: "unauthorized" } | { status: "entitlement-required" } | { status: "missing-runner" } | { status: "no-pending-runners" } | { status: "runner-unavailable"; code: string } | { status: "approved"; runnerId: string } | { status: "already-approved"; runnerId: string };

export type PendingRunnerOption = {
	id: string;
	name: string;
	ownerId: string;
	ownerName: string;
	ownerAvatar: string;
	createdAt: string;
};

export async function getAccessiblePendingRunners(userId: string): Promise<PendingRunnerOption[]> {
	void userId;
	const accessibleCreators = await listAuthorizedCreatorOperations({ permission: "runner:read", requiredEntitlement: "runner" });
	const accessibleOwnerIds = accessibleCreators.map((access) => access.creator.id);
	if (accessibleOwnerIds.length === 0) return [];
	const runners = await db.query.runnersTable.findMany({
		where: and(inArray(runnersTable.ownerId, accessibleOwnerIds), isNull(runnersTable.lastHeartbeatAt)),
		orderBy: [desc(runnersTable.createdAt)],
	});

	const ownerIds = Array.from(new Set(runners.map((runner) => runner.ownerId)));
	const owners = ownerIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, ownerIds)).execute() : [];
	const ownersById = new Map(owners.map((owner) => [owner.id, owner]));

	return runners.map((runner) => {
		const owner = ownersById.get(runner.ownerId);
		return {
			id: runner.id,
			name: runner.name,
			ownerId: runner.ownerId,
			ownerName: owner?.username ?? runner.ownerId,
			ownerAvatar: owner?.avatar ?? "",
			createdAt: runner.createdAt.toISOString(),
		};
	});
}

async function getValidEnrollment(code: string) {
	if (!isValidUserCode(code)) return { status: "invalid" as const };

	const enrollment = await db.query.runnerEnrollmentsTable.findFirst({
		where: eq(runnerEnrollmentsTable.userCode, code),
	});

	if (!enrollment) return { status: "invalid" as const };
	if (enrollment.expiresAt.getTime() < Date.now()) return { status: "expired" as const };
	if (enrollment.runnerId && enrollment.approvedAt) return { status: "approved" as const, runnerId: enrollment.runnerId };
	return { status: "valid" as const, enrollment };
}

async function approveRunnerEnrollment(code: string, runnerId?: string): Promise<RunnerEnrollActionState> {
	const user = await validateAuth();
	if (!user) {
		redirect(`/auth?returnUrl=${encodeURIComponent(`/runner/enroll/select?code=${encodeURIComponent(code)}`)}`);
	}

	const enrollmentResult = await getValidEnrollment(code);
	if (enrollmentResult.status === "invalid") return { status: "invalid-code" };
	if (enrollmentResult.status === "expired") return { status: "expired" };
	if (enrollmentResult.status === "approved") return { status: "already-approved", runnerId: enrollmentResult.runnerId };

	let runner = runnerId
		? await db.query.runnersTable.findFirst({
				where: and(eq(runnersTable.id, runnerId), isNull(runnersTable.lastHeartbeatAt)),
			})
		: enrollmentResult.enrollment.runnerId
			? await db.query.runnersTable.findFirst({
					where: eq(runnersTable.id, enrollmentResult.enrollment.runnerId),
				})
			: null;

	if (runnerId && !runner) return { status: "runner-unavailable", code };

	if (!runner) {
		const pendingRunners = await getAccessiblePendingRunners(user.id);
		if (pendingRunners.length === 1) {
			runner = await db.query.runnersTable.findFirst({
				where: eq(runnersTable.id, pendingRunners[0].id),
			});
		} else if (pendingRunners.length === 0) {
			return { status: "no-pending-runners" };
		} else {
			redirect(`/runner/enroll/select?code=${encodeURIComponent(code)}`);
		}
	}

	if (!runner) return { status: "unauthorized" };
	const access = await authorizeCreatorOperation({ creatorId: runner.ownerId, resourceOwnerId: runner.ownerId, permission: "runner:control", requiredEntitlement: "runner" });
	if (!access.allowed) return { status: access.code === "ENTITLEMENT_REQUIRED" ? "entitlement-required" : "unauthorized" };

	await db
		.update(runnersTable)
		.set({
			name: enrollmentResult.enrollment.hostname || runner.name,
			osInfo: enrollmentResult.enrollment.osInfo,
			version: enrollmentResult.enrollment.version,
		})
		.where(eq(runnersTable.id, runner.id));

	await db
		.update(runnerEnrollmentsTable)
		.set({
			ownerId: runner.ownerId,
			runnerId: runner.id,
			approvedAt: new Date(),
		})
		.where(eq(runnerEnrollmentsTable.id, enrollmentResult.enrollment.id));

	return { status: "approved", runnerId: runner.id };
}

export async function submitRunnerEnrollCode(_previousState: RunnerEnrollActionState, formData: FormData): Promise<RunnerEnrollActionState> {
	const codeValue = formData.get("code");
	const code = typeof codeValue === "string" ? normalizeUserCode(codeValue) : "";

	if (!code) {
		return { status: "missing-code" };
	}

	return approveRunnerEnrollment(code);
}

export async function submitRunnerSelection(_previousState: RunnerEnrollActionState, formData: FormData): Promise<RunnerEnrollActionState> {
	const runnerIdValue = formData.get("runnerId");
	const runnerId = typeof runnerIdValue === "string" ? runnerIdValue : "";
	const codeValue = formData.get("code");
	const code = typeof codeValue === "string" ? normalizeUserCode(codeValue) : "";

	if (!code) {
		return { status: "missing-code" };
	}

	if (!runnerId) return { status: "missing-runner" };

	return approveRunnerEnrollment(code, runnerId);
}
