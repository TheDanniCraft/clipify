import { Avatar } from "@heroui/react";

export default function DashboardUserAvatar({ username, avatar, showStatus = false }: { username: string; avatar: string; showStatus?: boolean }) {
	return (
		<span className='relative inline-flex h-8 w-8 shrink-0 overflow-visible'>
			<Avatar size='sm'>
				<Avatar.Image alt={username} src={avatar} />
				<Avatar.Fallback>{username.slice(0, 2).toUpperCase()}</Avatar.Fallback>
			</Avatar>
			{showStatus ? <span aria-label='Online' className='absolute bottom-0 right-0 h-2 w-2 rounded-full bg-success ring-2 ring-accent' role='status' /> : null}
		</span>
	);
}
