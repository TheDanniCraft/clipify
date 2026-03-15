"use client";

import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { NavigationGuardProvider } from "next-navigation-guard";
import ChatWidget from "@components/chatWidget";

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<HeroUIProvider>
			<NavigationGuardProvider>
				<ToastProvider />
				<ChatWidget />
				{children}
			</NavigationGuardProvider>
		</HeroUIProvider>
	);
}
