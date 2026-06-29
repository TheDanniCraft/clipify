"use client";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, NavbarMenu, NavbarMenuItem, NavbarMenuToggle, Link, Divider, cn } from "@heroui/react";
import type { NavbarProps } from "@heroui/react";


import React from "react";

import Logo from "@components/logo";
import { IconChevronRight } from "@tabler/icons-react";

const menuItems = [
	{ name: "Home", href: "/#" },
	{ name: "Features", href: "/#features" },
	{ name: "Pricing", href: "/#pricing" },
	{ name: "Community", href: "/community" },
	{ name: "Demo", href: "/#demo" },
	{ name: "FAQ", href: "/#faq" },
];

const BasicNavbar = React.forwardRef<HTMLElement, NavbarProps>(({ classNames = {}, ...props }, ref) => {
	const [isMenuOpen, setIsMenuOpen] = React.useState(false);

	return (
		<Navbar
			ref={ref}
			{...props}
			classNames={{
				base: cn("border-default-100 bg-transparent", {
					"bg-default-200/50 dark:bg-default-100/50": isMenuOpen,
				}),
				wrapper: "w-full justify-center",
				item: "hidden md:flex",
				...classNames,
			}}
			height='60px'
			isMenuOpen={isMenuOpen}
			onMenuOpenChange={setIsMenuOpen}
			shouldHideOnScroll
		>
			{/* Left Content */}
			<NavbarBrand as={Link} href='/'>
				<div>
					<Logo size={34} />
				</div>
				<span className='ml-2 text-large font-bold text-white'>Clipify</span>
			</NavbarBrand>

			{/* Center Content */}
			<NavbarContent justify='center'>
				{menuItems.map((item, index) => (
					<NavbarItem className='text-white' key={index}>
						<Link aria-current='page' className='text-white font-bold text-sm' href={item.href}>
							{item.name}
						</Link>
					</NavbarItem>
				))}
			</NavbarContent>

			{/* Right Content */}
			<NavbarContent className='hidden md:flex' justify='end'>
				<NavbarItem className='ml-2 !flex gap-2'>
					<Link className='text-white rounded-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-medium bg-transparent text-foreground hover:bg-default/40' href='/login'>
						Login
					</Link>
					<Link className='bg-default-foreground font-medium text-background rounded-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-medium bg-transparent text-foreground hover:bg-default/40' href='/login'>
						Get Started
					{<IconChevronRight />}</Link>
				</NavbarItem>
			</NavbarContent>

			<NavbarMenuToggle className='text-white md:hidden' />

			<NavbarMenu
				className='top-[calc(var(--navbar-height)_-_1px)] max-h-fit bg-default-200/50 pb-6 pt-6 shadow-medium backdrop-blur-md backdrop-saturate-150 dark:bg-default-100/50'
				motionProps={{
					initial: { opacity: 0.1, y: -20 },
					animate: { opacity: 1, y: 0 },
					exit: { opacity: 0.1, y: -20 },
					transition: {
						ease: "easeInOut",
						duration: 0.2,
					},
				}}
			>
				<NavbarMenuItem>
					<Link href='/login' className='w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-medium bg-default text-foreground hover:bg-default/80'>
						Sign In
					</Link>
				</NavbarMenuItem>
				<NavbarMenuItem className='mb-4'>
					<Link className='bg-foreground text-background w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-medium bg-accent text-accent-foreground hover:bg-accent-hover' href='/login'>
						Get Started
					</Link>
				</NavbarMenuItem>
				{menuItems.map((item, index) => (
					<NavbarMenuItem key={`${item}-${index}`}>
						<Link className='mb-2 w-full text-white text-base' href={item.href}>
							{item.name}
						</Link>
						{index < menuItems.length - 1 && <Divider className='opacity-50' />}
					</NavbarMenuItem>
				))}
			</NavbarMenu>
		</Navbar>
	);
});

BasicNavbar.displayName = "BasicNavbar";

export default BasicNavbar;
