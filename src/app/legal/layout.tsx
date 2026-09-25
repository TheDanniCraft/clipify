import type { ReactNode } from "react";
import BasicNavbar from "@components/LandingPage/basicNavbar";
import Footer from "@components/footer";

export default function LegalLayout({ children }: { children: ReactNode }) {
	return (
		<>
			<BasicNavbar shouldHideOnScroll={false} />
			{children}
			<div className='max-w-full overflow-hidden'>
				<Footer />
			</div>
		</>
	);
}
