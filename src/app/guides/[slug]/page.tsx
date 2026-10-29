import { notFound, permanentRedirect } from "next/navigation";
import { publicGuides } from "@lib/publicGuides";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() {
	return publicGuides.map(({ slug }) => ({ slug }));
}
export default async function GuidePage({ params }: Props) {
	const { slug } = await params;
	const guide = publicGuides.find((item) => item.slug === slug);
	if (!guide) notFound();
	permanentRedirect(guide.helpHref);
}
