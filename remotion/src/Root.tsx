import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// 4 scenes: 180+210+150+180 = 720, minus 3 transitions x 20 = 60 overlap = 660
export const RemotionRoot = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={660}
    fps={30}
    width={1920}
    height={1080}
  />
);
