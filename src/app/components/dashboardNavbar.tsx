"use client";

import { IconMoonFilled, IconSunFilled } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { Avatar, Badge, Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Navbar, NavbarBrand, NavbarContent, NavbarItem, Spacer } from "@heroui/react";
import { AuthenticatedUser } from "@types";
import Logo from "@components/logo";

export default function DashboardNavbar({ children, user }: { children: React.ReactNode; user: AuthenticatedUser }) {
	const { theme, setTheme } = useTheme();

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
					<Logo width={30} />
					<Spacer x={2} />
					<p className='font-bold text-white'>Clipify</p>
				</NavbarBrand>
				<NavbarContent className='ml-auto h-12 max-w-fit items-center gap-0' justify='end'>
					<NavbarItem>
						<Button isIconOnly radius='full' variant='light' onPress={() => setTheme(theme === "dark" ? "light" : "dark")}>
							{theme === "dark" ? <IconSunFilled className='text-primary-foreground/60' width={24} /> : <IconMoonFilled className='text-primary-foreground/60' width={24} />}
						</Button>
					</NavbarItem>
					<NavbarItem className='px-2'>
						<Dropdown placement='bottom-end'>
							<DropdownTrigger>
								<button className='mt-1 h-8 w-8 transition-transform'>
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
								<DropdownItem key='settings'>My Settings</DropdownItem>
								<DropdownItem key='help_and_feedback'>Help & Feedback</DropdownItem>
								<DropdownItem key='logout' color='danger'>
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
								<h1 className='text-xl font-bold text-default-900 lg:text-3xl'>Dashboard</h1>
								<p className='text-small text-default-400 lg:text-medium'>Manage your overlays</p>
							</div>
						</header>
						{children}
					</div>
				</main>
			</div>
		</>
	);
}
