"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acceptDatabaseAgencyLink, activateDatabaseAgencyOwner, allocateDatabaseAgencyLicense, listDatabaseAdminAgencies, listDatabaseAgencyOverview, listDatabaseCreatorAgencyLinks, proposeDatabaseAgencyLink, provisionDatabaseAgency, reduceDatabaseAgencyLinkCeiling, revokeDatabaseAgencyLink, scheduleDatabaseAgencyLicenseRemoval } from "@/server/agencies/database";
import { selectAgencyCreatorContext } from "@/server/agencies/access";

function strings(formData: FormData, name: string) {
	return formData
		.getAll(name)
		.map(String)
		.map((value) => value.trim())
		.filter(Boolean);
}

function value(formData: FormData, name: string) {
	return String(formData.get(name) ?? "").trim();
}

function errorCode(error: unknown) {
	return error instanceof Error ? error.message.slice(0, 80) : "UNKNOWN_ERROR";
}

export async function provisionAgencyFormAction(formData: FormData) {
	try {
		await provisionDatabaseAgency({ name: value(formData, "name"), ownerEmail: value(formData, "ownerEmail"), commercialReference: value(formData, "commercialReference") || undefined, creatorSeatLimit: Number.parseInt(value(formData, "creatorSeatLimit"), 10) });
	} catch (error) {
		redirect(`/admin/agencies?error=${encodeURIComponent(errorCode(error))}`);
	}
	revalidatePath("/admin/agencies");
	redirect("/admin/agencies?created=1");
}

export async function activateAgencyOwnerFormAction(formData: FormData) {
	await activateDatabaseAgencyOwner({ organizationId: value(formData, "organizationId") });
	revalidatePath("/dashboard/agency");
}

export async function proposeAgencyLinkFormAction(formData: FormData) {
	await proposeDatabaseAgencyLink({ creatorOrganizationId: value(formData, "creatorOrganizationId"), permissionCeiling: strings(formData, "permission") });
	revalidatePath("/dashboard/agency");
}

export async function acceptAgencyLinkFormAction(formData: FormData) {
	await acceptDatabaseAgencyLink({ linkId: value(formData, "linkId"), permissionCeiling: strings(formData, "permission") });
	revalidatePath("/dashboard/settings/agencies");
	revalidatePath("/dashboard/settings/team");
}

export async function reduceAgencyLinkFormAction(formData: FormData) {
	await reduceDatabaseAgencyLinkCeiling({ linkId: value(formData, "linkId"), permissionCeiling: strings(formData, "permission") });
	revalidatePath("/dashboard/settings/agencies");
	revalidatePath("/dashboard/settings/team");
}

export async function revokeAgencyLinkFormAction(formData: FormData) {
	await revokeDatabaseAgencyLink({ linkId: value(formData, "linkId") });
	revalidatePath("/dashboard/settings/agencies");
	revalidatePath("/dashboard/settings/team");
}

export async function allocateAgencyLicenseFormAction(formData: FormData) {
	const creatorOrganizationId = value(formData, "creatorOrganizationId");
	const destination = creatorOrganizationId ? `/dashboard/agency?creator=${encodeURIComponent(creatorOrganizationId)}` : "/dashboard/agency";
	try {
		await allocateDatabaseAgencyLicense({ linkId: value(formData, "linkId"), sourceReference: value(formData, "sourceReference") });
	} catch (error) {
		const separator = destination.includes("?") ? "&" : "?";
		redirect(`${destination}${separator}error=${encodeURIComponent(errorCode(error))}`);
	}
	revalidatePath("/dashboard/agency");
	revalidatePath("/dashboard/agency/allocations");
	const separator = destination.includes("?") ? "&" : "?";
	redirect(`${destination}${separator}allocated=1`);
}

export async function removeAgencyLicenseFormAction(formData: FormData) {
	await scheduleDatabaseAgencyLicenseRemoval({ allocationId: value(formData, "allocationId") });
	revalidatePath("/dashboard/agency");
	revalidatePath("/dashboard/agency/allocations");
}

export async function getAgencyOverviewAction(requestedCreatorOrganizationId?: string) {
	const overview = await listDatabaseAgencyOverview();
	return { ...overview, creatorContext: selectAgencyCreatorContext(overview.links, requestedCreatorOrganizationId) };
}

export async function getCreatorAgencyLinksAction() {
	return listDatabaseCreatorAgencyLinks();
}

export async function getAdminAgenciesAction() {
	return listDatabaseAdminAgencies();
}
