import React, { createContext, useContext } from "react";
import { components as base } from "../../support/mcp/heroui-fixture";
const Slot = ({ children, ...props }: any) => <span {...props}>{children}</span>;
const modalContext = createContext<any>({});
const Modal = {
	Backdrop: ({ isOpen, onOpenChange, children }: any) => (isOpen ? <modalContext.Provider value={{ onOpenChange }}>{children}</modalContext.Provider> : null),
	Container: ({ children }: any) => <div>{children}</div>,
	Dialog: ({ children, ...props }: any) => (
		<div role='dialog' {...props}>
			{children}
		</div>
	),
	Header: Slot,
	Body: Slot,
	Footer: Slot,
	Heading: ({ children }: any) => <h2>{children}</h2>,
	CloseTrigger: ({ isDisabled, ...props }: any) => {
		const context = useContext(modalContext);
		return <button {...props} disabled={isDisabled} onClick={() => context.onOpenChange(false)} />;
	},
};
const Table = Object.assign(base.Table, {
	LoadMore: ({ onLoadMore, children }: any) => (
		<tr data-testid='activity-load-more' onScroll={() => onLoadMore?.()}>
			<td colSpan={99}>{children}</td>
		</tr>
	),
	LoadMoreContent: ({ children }: any) => <>{children}</>,
});
export const components = { ...base, Modal, Table };
