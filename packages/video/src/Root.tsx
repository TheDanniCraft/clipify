import { Composition } from "remotion";
import { ClipifyFlow } from "./compositions/clipify-flow/ClipifyFlow";
import { FLOW_DURATION, FLOW_FPS } from "./compositions/clipify-flow/timeline";
import { ClipifyRebuilt } from "./compositions/clipify-rebuilt/ClipifyRebuilt";
import { REBUILT_DURATION, REBUILT_FPS } from "./compositions/clipify-rebuilt/timeline";
import { MomentsTrailer } from "./compositions/moments-trailer/MomentsTrailer";
import { TRAILER_DURATION, TRAILER_FPS } from "./compositions/moments-trailer/timeline";
import { MomentsPreview } from "./compositions/moments-preview/MomentsPreview";
import { MOMENTS_DURATION, MOMENTS_FPS } from "./compositions/moments-preview/timeline";
import { ClipifyPulse } from "./compositions/clipify-pulse/ClipifyPulse";
import { CLIPIFY_PULSE_DURATION_IN_FRAMES, CLIPIFY_PULSE_FPS } from "./compositions/clipify-pulse/timeline";
import { ClipifyShowcase } from "./compositions/clipify-showcase/ClipifyShowcase";
import { CLIPIFY_SHOWCASE_DURATION_IN_FRAMES, CLIPIFY_SHOWCASE_FPS } from "./compositions/clipify-showcase/timeline";

export const VideoRoot = () => {
	return (
		<>
			<Composition id='ClipifyFlow' component={ClipifyFlow} durationInFrames={FLOW_DURATION} fps={FLOW_FPS} width={1920} height={1080} />
			<Composition id='ClipifyFlowVertical' component={ClipifyFlow} defaultProps={{ format: "vertical" }} durationInFrames={FLOW_DURATION} fps={FLOW_FPS} width={1080} height={1920} />
			<Composition id='ClipifyFlowFeed' component={ClipifyFlow} defaultProps={{ format: "feed" }} durationInFrames={FLOW_DURATION} fps={FLOW_FPS} width={1080} height={1350} />
			<Composition id='ClipifyRebuilt' component={ClipifyRebuilt} durationInFrames={REBUILT_DURATION} fps={REBUILT_FPS} width={1920} height={1080} />
			<Composition id='MomentsTrailer' component={MomentsTrailer} durationInFrames={TRAILER_DURATION} fps={TRAILER_FPS} width={1920} height={1080} />
			<Composition id='MomentsPreview' component={MomentsPreview} durationInFrames={MOMENTS_DURATION} fps={MOMENTS_FPS} width={1920} height={1080} />
			<Composition id='ClipifyPulse' component={ClipifyPulse} durationInFrames={CLIPIFY_PULSE_DURATION_IN_FRAMES} fps={CLIPIFY_PULSE_FPS} width={1920} height={1080} />
			<Composition id='ClipifyShowcase' component={ClipifyShowcase} defaultProps={{ format: "landscape" }} durationInFrames={CLIPIFY_SHOWCASE_DURATION_IN_FRAMES} fps={CLIPIFY_SHOWCASE_FPS} width={1920} height={1080} />
			<Composition id='ClipifyShowcaseVertical' component={ClipifyShowcase} defaultProps={{ format: "vertical" }} durationInFrames={CLIPIFY_SHOWCASE_DURATION_IN_FRAMES} fps={CLIPIFY_SHOWCASE_FPS} width={1080} height={1920} />
			<Composition id='ClipifyShowcaseFeed' component={ClipifyShowcase} defaultProps={{ format: "feed" }} durationInFrames={CLIPIFY_SHOWCASE_DURATION_IN_FRAMES} fps={CLIPIFY_SHOWCASE_FPS} width={1080} height={1350} />
		</>
	);
};
