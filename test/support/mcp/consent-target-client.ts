import { runMcpProbe } from "./probe";
export function consentTargetProbe(mode: string) {
	return runMcpProbe("consent-target-probe", [mode]);
}
