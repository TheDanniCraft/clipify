export default async function Overlay({ params }: { params: Promise<{ status: string }> }) {
	const { status } = await params;

	return (
		<div className='flex flex-col items-center justify-center w-full h-screen'>
			<h1 className='text-2xl font-bold'>Payment Status</h1>
			<p className='mt-4 text-lg'>Your payment status is: {status}</p>
			<p className='mt-2 text-sm text-gray-500'>If you have any issues, please contact support.</p>
			<script
				dangerouslySetInnerHTML={{
					__html: `
						setTimeout(() => {
							window.close();
						}, 5000);
					`,
				}}
			/>
		</div>
	);
}
