"use client";

import { IconMoonFilled, IconSunFilled } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { Avatar, Badge, Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Link, Navbar, NavbarBrand, NavbarContent, NavbarItem, Spacer } from "@heroui/react";
import { AuthenticatedUser } from "@types";
import Logo from "@components/logo";
import { useRouter } from "next/navigation";

export default function DashboardNavbar({ children, user, title, tagline }: { children: React.ReactNode; user: AuthenticatedUser; title: string; tagline: string }) {
	const { theme, setTheme } = useTheme();
	const router = useRouter();

	return (
		<>
			<Navbar
				classNames={{
					base: "bg-primary",
					wrapper: "px-4 sm:px-6",
					item: "data-[active=true]:text-primary",
				}}
				height='64px'
			>
				<NavbarBrand>
					<Link href='/dashboard'>
						<Logo width={30} />
						<Spacer x={2} />
						<p className='font-bold text-white'>Clipify</p>
					</Link>
				</NavbarBrand>
				<NavbarContent className='ml-auto h-12 max-w-fit items-center gap-0' justify='end'>
					<NavbarItem>
						<Button isIconOnly radius='full' variant='light' onPress={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label='Toggle Theme'>
							{theme === "dark" ? <IconSunFilled className='text-primary-foreground/60' width={24} /> : <IconMoonFilled className='text-primary-foreground/60' width={24} />}
						</Button>
					</NavbarItem>
					<NavbarItem className='px-2'>
						<Dropdown placement='bottom-end'>
							<DropdownTrigger>
								<button className='mt-1 h-8 w-8 transition-transform' aria-label='Open profile menu'>
									<Badge
										classNames={{
											badge: "border-primary",
										}}
										color='success'
										content=''
										placement='bottom-right'
										shape='circle'
									>
										<Avatar size='sm' src={user?.avatar} />
									</Badge>
								</button>
							</DropdownTrigger>
							<DropdownMenu aria-label='Profile Actions' variant='flat'>
								<DropdownItem key='profile' className='h-14 gap-2'>
									<p className='font-semibold'>Signed in as</p>
									<p className='font-semibold'>{user?.username}</p>
								</DropdownItem>
								<DropdownItem key='settings' onPress={() => router.push("/dashboard/settings")}>
									My Settings
								</DropdownItem>
								<DropdownItem key='help_and_feedback' onPress={() => router.push("https://help.clipify.us/")}>
									Help & Feedback
								</DropdownItem>
								<DropdownItem key='logout' color='danger' onPress={() => router.push("/logout")}>
									Log Out
								</DropdownItem>
							</DropdownMenu>
						</Dropdown>
					</NavbarItem>
				</NavbarContent>
			</Navbar>
			<div className='w-full'>
				<main className='mt-6 flex w-full flex-col items-center'>
					<div className='w-full max-w-[1024px] px-4 lg:px-8'>
						<header className=' flex w-full items-center justify-between'>
							<div className='flex flex-col'>
								<h1 className='text-xl font-bold text-default-900 lg:text-3xl'>{title}</h1>
								<p className='text-small text-default-400 lg:text-medium'>{tagline}</p>
							</div>
						</header>
						{children}
					</div>
				</main>
			</div>
		</>
	);
}
