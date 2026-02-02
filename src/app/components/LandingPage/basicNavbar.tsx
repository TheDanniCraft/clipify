"use client";

import type { NavbarProps } from "@heroui/react";

import React from "react";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, NavbarMenu, NavbarMenuItem, NavbarMenuToggle, Link, Button, Divider, cn } from "@heroui/react";

import Logo from "@components/logo";
import { IconChevronRight } from "@tabler/icons-react";

const menuItems = [
	{ name: "Home", href: "/#" },
	{ name: "Features", href: "/#features" },
	{ name: "Pricing", href: "/#pricing" },
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
						<Link aria-current='page' className='text-white font-bold' href={item.href} size='sm'>
							{item.name}
						</Link>
					</NavbarItem>
				))}
			</NavbarContent>

			{/* Right Content */}
			<NavbarContent className='hidden md:flex' justify='end'>
				<NavbarItem className='ml-2 !flex gap-2'>
					<Button className='text-white' radius='full' variant='light' as={Link} href='/login'>
						Login
					</Button>
					<Button className='bg-default-foreground font-medium text-background' color='secondary' endContent={<IconChevronRight />} radius='full' variant='flat' as={Link} href='/login'>
						Get Started
					</Button>
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
					<Button fullWidth as={Link} href='/login' variant='faded'>
						Sign In
					</Button>
				</NavbarMenuItem>
				<NavbarMenuItem className='mb-4'>
					<Button fullWidth as={Link} className='bg-foreground text-background' href='/login'>
						Get Started
					</Button>
				</NavbarMenuItem>
				{menuItems.map((item, index) => (
					<NavbarMenuItem key={`${item}-${index}`}>
						<Link className='mb-2 w-full text-white' href={item.href} size='md'>
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
