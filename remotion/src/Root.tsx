import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { CrossModuleVideo } from "./CrossModuleVideo";
import { NetworkVideo } from "./NetworkVideo";
import { CrossMatrixVideo } from "./CrossMatrixVideo";

export const RemotionRoot = () => (
  <>
    <Composition id="main" component={MainVideo} durationInFrames={510} fps={30} width={1920} height={1080} />
    <Composition id="crossmodule" component={CrossModuleVideo} durationInFrames={300} fps={30} width={1920} height={1080} />
    <Composition id="network" component={NetworkVideo} durationInFrames={300} fps={30} width={1920} height={1080} />
    <Composition id="crossmatrix" component={CrossMatrixVideo} durationInFrames={330} fps={30} width={1920} height={1080} />
  </>
);
