"use client";

import { useEffect, useState } from "react";
import { consentServices, matchesStorageDeclaration, necessaryConsentServices, type StorageDeclarationInput } from "@lib/consent/registry";

export type DeviceStorageObservation = {
	type: "cookie" | "localStorage" | "sessionStorage";
	name: string;
	value: string;
};

const storageTypeLabels: Record<DeviceStorageObservation["type"], string> = {
	cookie: "Cookie",
	localStorage: "Local storage",
	sessionStorage: "Session storage",
};

const approvedStorageDeclarations: readonly StorageDeclarationInput[] = [...necessaryConsentServices, ...consentServices].flatMap((service): StorageDeclarationInput[] => ("storageDeclarations" in service ? [...service.storageDeclarations] : []));

function inspectBrowserStorage() {
	const observations: DeviceStorageObservation[] = [];
	const appendApproved = (type: DeviceStorageObservation["type"], name: string) => {
		if (approvedStorageDeclarations.some((declaration) => declaration.type === type && matchesStorageDeclaration(declaration, name))) observations.push({ type, name, value: "" });
	};

	for (let index = 0; index < localStorage.length; index += 1) {
		const name = localStorage.key(index);
		if (name) appendApproved("localStorage", name);
	}
	for (let index = 0; index < sessionStorage.length; index += 1) {
		const name = sessionStorage.key(index);
		if (name) appendApproved("sessionStorage", name);
	}
	for (const cookie of document.cookie.split(";")) {
		const name = cookie.split("=", 1)[0]?.trim();
		if (name) appendApproved("cookie", name);
	}

	return observations;
}

export default function DeviceStorageInspector({ observations: suppliedObservations, unavailable = false }: { observations?: readonly DeviceStorageObservation[]; unavailable?: boolean }) {
	const [observations, setObservations] = useState<readonly DeviceStorageObservation[]>(suppliedObservations ?? []);
	const [inspectionUnavailable, setInspectionUnavailable] = useState(unavailable);

	useEffect(() => {
		if (suppliedObservations) return;
		let cancelled = false;
		queueMicrotask(() => {
			if (cancelled) return;
			try {
				setObservations(inspectBrowserStorage());
			} catch {
				setInspectionUnavailable(true);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [suppliedObservations]);

	return (
		<section aria-labelledby='device-storage-heading'>
			<h2 id='device-storage-heading'>Activity visible on this device</h2>
			<p>This supplemental view can only show storage exposed by this browser. The complete declared inventory remains authoritative.</p>
			{inspectionUnavailable && <p>Browser inspection is currently unavailable.</p>}
			<ul>
				{observations.map((observation) => (
					<li key={`${observation.type}:${observation.name}`}>
						<span>{observation.name}</span> <span>{storageTypeLabels[observation.type]}</span>
					</li>
				))}
			</ul>
		</section>
	);
}
