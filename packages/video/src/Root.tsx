import { Composition } from "remotion";
import { ClipifyShowcase } from "./compositions/clipify-showcase/ClipifyShowcase";
import { CLIPIFY_SHOWCASE_DURATION_IN_FRAMES, CLIPIFY_SHOWCASE_FPS } from "./compositions/clipify-showcase/timeline";

export const VideoRoot = () => {
	return (
		<>
			<Composition id='ClipifyShowcase' component={ClipifyShowcase} defaultProps={{ format: "landscape" }} durationInFrames={CLIPIFY_SHOWCASE_DURATION_IN_FRAMES} fps={CLIPIFY_SHOWCASE_FPS} width={1920} height={1080} />
			<Composition id='ClipifyShowcaseVertical' component={ClipifyShowcase} defaultProps={{ format: "vertical" }} durationInFrames={CLIPIFY_SHOWCASE_DURATION_IN_FRAMES} fps={CLIPIFY_SHOWCASE_FPS} width={1080} height={1920} />
			<Composition id='ClipifyShowcaseFeed' component={ClipifyShowcase} defaultProps={{ format: "feed" }} durationInFrames={CLIPIFY_SHOWCASE_DURATION_IN_FRAMES} fps={CLIPIFY_SHOWCASE_FPS} width={1080} height={1350} />
		</>
	);
};
