"use client";
import { Button, Link, Separator, cn } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import React from "react";

import Logo from "@components/logo";
import { IconChevronRight, IconMenu2, IconX } from "@tabler/icons-react";

const menuItems = [
	{ name: "Home", href: "/#" },
	{ name: "Features", href: "/#features" },
	{ name: "Pricing", href: "/#pricing" },
	{ name: "Community", href: "/community" },
	{ name: "Demo", href: "/#demo" },
	{ name: "FAQ", href: "/#faq" },
];

type BasicNavbarProps = React.ComponentPropsWithoutRef<"nav"> & {
	classNames?: {
		base?: string;
		wrapper?: string;
		item?: string;
	};
	shouldHideOnScroll?: boolean;
};

const BasicNavbar = React.forwardRef<HTMLElement, BasicNavbarProps>(({ classNames = {}, shouldHideOnScroll = true, className, ...props }, ref) => {
	const [isMenuOpen, setIsMenuOpen] = React.useState(false);
	const [isHidden, setIsHidden] = React.useState(false);
	const lastScrollY = React.useRef(0);

	React.useEffect(() => {
		if (!shouldHideOnScroll) return;
		const handleScroll = () => {
			const currentScrollY = window.scrollY;
			setIsHidden(currentScrollY > lastScrollY.current && currentScrollY > 64 && !isMenuOpen);
			lastScrollY.current = currentScrollY;
		};
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, [isMenuOpen, shouldHideOnScroll]);

	React.useEffect(() => {
		document.body.style.overflow = isMenuOpen ? "hidden" : "";
		return () => {
			document.body.style.overflow = "";
		};
	}, [isMenuOpen]);

	return (
		<nav ref={ref} {...props} className={cn("sticky top-0 z-40 w-full bg-background/40 backdrop-blur-lg backdrop-saturate-150 transition-transform duration-300", isMenuOpen && "bg-background/70", isHidden && "-translate-y-full", classNames.base, className)}>
			<header className={cn("mx-auto flex h-[60px] w-full max-w-[1024px] items-center justify-between px-8", classNames.wrapper)}>
				<Link href='/' className='flex items-center'>
					<Logo size={34} />
					<span className='ml-2 text-lg font-bold text-white'>Clipify</span>
				</Link>

				<ul className='hidden items-center justify-center gap-4 md:flex'>
					{menuItems.map((item) => (
						<li className={cn("text-white", classNames.item)} key={item.href}>
							<Link className='text-sm font-bold text-white' href={item.href}>
								{item.name}
							</Link>
						</li>
					))}
				</ul>

				<div className='ml-2 hidden items-center gap-2 md:flex'>
					<Link className={cn(buttonVariants({ variant: "ghost" }), "text-white")} href='/login'>
						Login
					</Link>
					<Link className={buttonVariants({ variant: "primary", className: "gap-2 bg-accent-foreground text-black hover:bg-accent-foreground/90" })} href='/login'>
						Get Started
						<IconChevronRight />
					</Link>
				</div>

				<Button type='button' isIconOnly variant='ghost' className='text-white md:hidden' aria-expanded={isMenuOpen} aria-label='Toggle navigation menu' onPress={() => setIsMenuOpen((open) => !open)}>
					{isMenuOpen ? <IconX /> : <IconMenu2 />}
				</Button>
			</header>

			{isMenuOpen ? (
				<div className='max-h-fit bg-default/50 pb-6 pt-6 shadow-medium backdrop-blur-md backdrop-saturate-150 dark:bg-surface-secondary/50 md:hidden'>
					<ul className='flex flex-col gap-2 px-4'>
						<li>
							<Link href='/login' onPress={() => setIsMenuOpen(false)} className={buttonVariants({ variant: "secondary", fullWidth: true })}>
								Sign In
							</Link>
						</li>
						<li className='mb-4'>
							<Link href='/login' onPress={() => setIsMenuOpen(false)} className={buttonVariants({ variant: "primary", fullWidth: true, className: "bg-accent-foreground text-black hover:bg-accent-foreground/90" })}>
								Get Started
							</Link>
						</li>
						{menuItems.map((item, index) => (
							<li key={item.href}>
								<Link className='mb-2 w-full text-base text-white' href={item.href} onPress={() => setIsMenuOpen(false)}>
									{item.name}
								</Link>
								{index < menuItems.length - 1 ? <Separator className='opacity-50' /> : null}
							</li>
						))}
					</ul>
				</div>
			) : null}
		</nav>
	);
});

BasicNavbar.displayName = "BasicNavbar";

export default BasicNavbar;
