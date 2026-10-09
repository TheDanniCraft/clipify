import { toolPermissions } from "../permissions";
import { toolAnnotations } from "../risk";
import type { Permission } from "@/auth/permissions";
import { workflowInputSchemas, type WorkflowToolName } from "./schemas";

/** Compatibility projections for browser/backend workflow authorization. */
export const workflowPermissions = Object.fromEntries(Object.keys(workflowInputSchemas).map((name) => [name, toolPermissions[name as WorkflowToolName]])) as Record<WorkflowToolName, Permission>;
export const workflowAnnotations = toolAnnotations;
