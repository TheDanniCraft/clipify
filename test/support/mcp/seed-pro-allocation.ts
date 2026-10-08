import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
export async function seedCreatorProAllocation(pool: Pool, creatorId: string, creatorOrganizationId: string, authActorId: string) {
	await pool.query("UPDATE users SET plan='free' WHERE id=$1", [creatorId]);
	await pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES('allocation-policy-agency','Allocation policy agency','allocation-policy-agency',now())");
	const linkId = randomUUID();
	await pool.query("INSERT INTO agency_creator_links(id,agency_organization_id,creator_organization_id,status,permission_ceiling,accepted_by,accepted_at) VALUES($1,'allocation-policy-agency',$2,'accepted','[]',$3,now())", [linkId, creatorOrganizationId, authActorId]);
	await pool.query("INSERT INTO agency_license_allocations(link_id,creator_id,product,status,effective_at,source_reference) VALUES($1,$2,'creator_pro','active',now()-interval '1 day','isolated-allocation-policy')", [linkId, creatorId]);
}
