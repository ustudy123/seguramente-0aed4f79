import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// Scene1: 260 + Scene2: 280 - transition 30 = 510 frames (~17s)
export const RemotionRoot = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={510}
    fps={30}
    width={1920}
    height={1080}
  />
);
