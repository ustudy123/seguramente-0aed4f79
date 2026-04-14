import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// 30fps, ~25s = 750 frames
// 5 scenes: 120 + 150 + 150 + 150 + 120 = 690
// 4 transitions x 20 frames = 80 overlap
// Total: 690 - 80 = 610 frames (~20s)
// Let's be more generous: 780 frames
export const RemotionRoot = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={750}
    fps={30}
    width={1920}
    height={1080}
  />
);
