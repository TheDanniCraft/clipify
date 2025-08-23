"use client";

import React, { useEffect, useState } from "react";
import { Button, ButtonGroup, Chip, Divider, Link } from "@heroui/react";

import Logo from "@components/logo";
import { IconMoonFilled, IconSunFilled } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import axios from "axios";

export default function Component() {
	const { theme, setTheme } = useTheme();
	const [statusColor, setStatusColor] = useState("#ffffff");
	const [statusText, setStatusText] = useState("Loading...");

	useEffect(() => {
		axios
			.get("https://api.status.thedannicraft.de/clipify", {})
			.then((response) => {
				switch (response.data.status) {
					case "DOWN":
						setStatusColor("hsl(var(--heroui-danger))");
						setStatusText("Major outage");
						break;
					case "UP":
						setStatusColor("hsl(var(--heroui-success))");
						setStatusText("All systems operational");
						break;
					case "PARTIAL":
						setStatusColor("hsl(var(--heroui-warning))");
						setStatusText("Partial outage");
						break;
					case "MAINTENANCE":
						setStatusColor("#006FEE");
						setStatusText("Under maintenance");
						break;
				}
			})
			.catch((error) => {
				console.error("Error fetching service status:", error);

				setStatusColor("#ffffff");
				setStatusText("Service status unknown");
			});
	}, []);

	return (
		<>
			<Divider className='my-4' />
			<footer className='flex w-full flex-col'>
				<div className='mx-auto w-full max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8'>
					<div className='flex flex-col items-center justify-center gap-2 md:order-2 md:items-end'>
						<ButtonGroup>
							<Button isIconOnly onPress={() => setTheme("dark")} color={theme === "dark" ? "primary" : "default"} aria-label='Switch to dark theme'>
								<IconMoonFilled />
							</Button>
							<Button isIconOnly onPress={() => setTheme("light")} color={theme == "light" ? "primary" : "default"} aria-label='Switch to light theme'>
								<IconSunFilled />
							</Button>
						</ButtonGroup>
					</div>
					<div className='mt-4 md:order-1 md:mt-0'>
						<div className='flex items-center justify-center gap-3 md:justify-start'>
							<div className='flex items-center'>
								<Logo size={34} />
								<span className='text-small font-medium'>Clipify</span>
							</div>
							<Divider className='h-4' orientation='vertical' />
							<Link href='https://status.thedannicraft.de/status/clipify'>
								<Chip
									className='border-none px-0 text-default-500'
									classNames={{
										dot: "bg-[var(--chip-dot-bg)]",
									}}
									style={
										{
											"--chip-dot-bg": statusColor,
										} as React.CSSProperties
									}
									variant='dot'
								>
									{statusText}
								</Chip>
							</Link>
						</div>
						<p className='text-center text-tiny text-default-400 md:text-start'>&copy; {new Date().getFullYear()} TheDanniCraft. All rights reserved.</p>
					</div>
				</div>
			</footer>
		</>
	);
}
