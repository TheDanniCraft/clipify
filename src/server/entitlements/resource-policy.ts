export type RetainedResourceAccess = {
	read: true;
	delete: true;
	update: boolean;
	runtime: boolean;
	withinFreeAllowance: boolean;
};

export function decideRetainedResourceAccess(input: { effectivePlan: "free" | "pro"; resourceId: string; freeResourceIds: string[] }): RetainedResourceAccess {
	const withinFreeAllowance = input.effectivePlan === "pro" || input.freeResourceIds.includes(input.resourceId);
	return { read: true, delete: true, update: withinFreeAllowance, runtime: withinFreeAllowance, withinFreeAllowance };
}
