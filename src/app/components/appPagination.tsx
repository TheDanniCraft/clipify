"use client";

import { Pagination } from "@heroui/react";

type AppPaginationProps = {
	page: number;
	total: number;
	onChange: (page: number) => void;
	className?: string;
};

function pageItems(page: number, total: number): Array<number | "ellipsis-start" | "ellipsis-end"> {
	if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

	const items: Array<number | "ellipsis-start" | "ellipsis-end"> = [1];
	if (page > 3) items.push("ellipsis-start");
	for (let value = Math.max(2, page - 1); value <= Math.min(total - 1, page + 1); value += 1) items.push(value);
	if (page < total - 2) items.push("ellipsis-end");
	items.push(total);
	return items;
}

export default function AppPagination({ page, total, onChange, className }: AppPaginationProps) {
	if (total <= 1) return null;

	return (
		<Pagination className={className} size='sm'>
			<Pagination.Content>
				<Pagination.Item>
					<Pagination.Previous isDisabled={page <= 1} onPress={() => onChange(page - 1)}><Pagination.PreviousIcon /><span className='sr-only'>Previous</span></Pagination.Previous>
				</Pagination.Item>
				{pageItems(page, total).map((item) => item === "ellipsis-start" || item === "ellipsis-end" ? (
					<Pagination.Item key={item}><Pagination.Ellipsis /></Pagination.Item>
				) : (
					<Pagination.Item key={item}><Pagination.Link isActive={item === page} onPress={() => onChange(item)}>{item}</Pagination.Link></Pagination.Item>
				))}
				<Pagination.Item>
					<Pagination.Next isDisabled={page >= total} onPress={() => onChange(page + 1)}><span className='sr-only'>Next</span><Pagination.NextIcon /></Pagination.Next>
				</Pagination.Item>
			</Pagination.Content>
		</Pagination>
	);
}
