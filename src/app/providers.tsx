"use client";
import { Toast } from "@heroui/react";

import { NavigationGuardProvider } from "nextjs-nav-guard";
import ChatWidget from "@components/chatWidget";

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<NavigationGuardProvider>
			<Toast.Provider />
			<ChatWidget />
			{children}
		</NavigationGuardProvider>
	);
}
