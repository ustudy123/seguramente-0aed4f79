import { AbsoluteFill, useCurrentFrame, interpolate, staticFile, Img } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Scene1Title } from "./scenes/Scene1Title";
import { Scene2Connections } from "./scenes/Scene2Connections";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export const MainVideo: React.FC = () => {
  const frame = useCurrentFrame();

  // Ken Burns on scene 1 bg
  const bg1Scale = interpolate(frame, [0, 455], [1.05, 1.18]);
  const bg1X = interpolate(frame, [0, 455], [0, -40]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0D0520", fontFamily }}>
      {/* Office background with slow zoom */}
      <AbsoluteFill>
        <Img
          src={staticFile("images/office-bg.jpg")}
          style={{
            width: "120%",
            height: "120%",
            objectFit: "cover",
            transform: `scale(${bg1Scale}) translateX(${bg1X}px)`,
          }}
        />
        {/* Dark overlay with brand gradient */}
        <AbsoluteFill
          style={{
            background: "linear-gradient(135deg, rgba(13,5,32,0.92) 0%, rgba(80,30,120,0.80) 40%, rgba(13,5,32,0.88) 70%, rgba(40,15,60,0.90) 100%)",
          }}
        />
      </AbsoluteFill>

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={210}>
          <Scene1Title />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 25 })}
        />
        <TransitionSeries.Sequence durationInFrames={270}>
          <Scene2Connections />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
