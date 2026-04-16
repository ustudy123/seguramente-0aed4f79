import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// 2 scenes: 180 + 240 = 420, minus 1 transition x 25 = 395 frames (~13s)
export const RemotionRoot = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={395}
    fps={30}
    width={1920}
    height={1080}
  />
);
