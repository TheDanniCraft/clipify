"use client";
import { Toast } from "@heroui/react";

import { NavigationGuardProvider } from "next-navigation-guard";
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
