"use client";
import { Toast } from "@heroui/react";

import { NavigationGuardProvider } from "nextjs-nav-guard";
import UmamiRuntime from "./UmamiRuntime";
import ChatWidget from "@components/chatWidget";

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<NavigationGuardProvider>
			<UmamiRuntime />
			<Toast.Provider />
			<ChatWidget />
			{children}
		</NavigationGuardProvider>
	);
}
