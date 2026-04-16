import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// Scene1: 210 frames (7s) + Scene2: 270 frames (9s) - transition 25 = 455 frames (~15s)
export const RemotionRoot = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={455}
    fps={30}
    width={1920}
    height={1080}
  />
);
