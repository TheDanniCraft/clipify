"use client";

import dynamic from "next/dynamic";

const GalleryPlayerClientOnly = dynamic(() => import("./GalleryPlayer"), {
	ssr: false,
	loading: () => <div className='flex h-dvh items-center justify-center bg-transparent text-sm text-muted'>Loading player…</div>,
});

export default GalleryPlayerClientOnly;
