import React from "react";
import type { IconSvgProps } from "@types";

const Logo: React.FC<IconSvgProps> = ({ size = 32, width, height, ...props }) => (
	<svg id='ClipifyLogo' xmlns='http://www.w3.org/2000/svg' version='1.1' xmlnsXlink='http://www.w3.org/1999/xlink' viewBox='0 0 134.4 158' fill='none' height={size || height} width={size || width} {...props}>
		<defs>
			<linearGradient id='Gradient' data-name='Unbenannter Verlauf 53' x1='-13.6' y1='24.8' x2='77' y2='115.4' gradientUnits='userSpaceOnUse'>
				<stop offset='0' stopColor='#826aad' />
				<stop offset='.4' stopColor='#6355a0' />
				<stop offset='.8' stopColor='#4a4595' />
				<stop offset='1' stopColor='#413f92' />
			</linearGradient>
		</defs>
		<path d='M28.1,30.8l100.3,57.7c3.1,1.8,3.1,6.2,0,7.9l-100,57.7c-3.1,1.8-6.9-.4-6.9-4l-.3-115.4c0-3.5,3.8-5.8,6.9-4Z' fill='#2a2a65' />
		<path d='M11.5,4.8l106.3,61.2c3.2,1.9,3.2,6.6,0,8.4L11.9,135.5c-3.2,1.9-7.3-.5-7.3-4.2l-.4-122.3c0-3.7,4-6.1,7.3-4.2Z' fill='url(#Gradient)' />
		<path d='M33.6,48.2l35.6,20.5c1.2.7,1.2,2.4,0,3.1l-35.5,20.5c-1.2.7-2.7-.2-2.7-1.5v-41c-.1-1.4,1.3-2.2,2.5-1.5Z' fill='#fff' />
	</svg>
);

export default Logo;
