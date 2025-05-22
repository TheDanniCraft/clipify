"use client";

import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { NavigationGuardProvider } from "next-navigation-guard";
import { ThemeProvider } from "next-themes";
import ChatWidget from "@components/chatWidget";

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<HeroUIProvider>
			<ThemeProvider attribute='class' defaultTheme='dark'>
				<NavigationGuardProvider>
					<ToastProvider />
					<ChatWidget />
					{children}
				</NavigationGuardProvider>
			</ThemeProvider>
		</HeroUIProvider>
	);
}
