import { AbsoluteFill, useCurrentFrame, interpolate, staticFile, Img } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Scene1Specialists } from "./scenes/Scene1Specialists";
import { Scene2Compliance } from "./scenes/Scene2Compliance";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const MainVideo: React.FC = () => {
  const frame = useCurrentFrame();

  // Ken Burns on scene 1 bg
  const bg1Scale = interpolate(frame, [0, 510], [1.05, 1.2]);
  const bg1X = interpolate(frame, [0, 510], [0, -50]);
  const bg1Y = interpolate(frame, [0, 510], [0, -20]);

  // Crossfade backgrounds
  const bg2Op = interpolate(frame, [210, 260], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0D0520", fontFamily }}>
      {/* BG1: Team meeting */}
      <AbsoluteFill style={{ opacity: 1 - bg2Op * 0.5 }}>
        <Img
          src={staticFile("images/team-bg.jpg")}
          style={{
            width: "130%", height: "130%", objectFit: "cover",
            transform: `scale(${bg1Scale}) translate(${bg1X}px, ${bg1Y}px)`,
          }}
        />
      </AbsoluteFill>

      {/* BG2: Wellness/bokeh */}
      <AbsoluteFill style={{ opacity: bg2Op }}>
        <Img
          src={staticFile("images/wellness-bg.jpg")}
          style={{
            width: "130%", height: "130%", objectFit: "cover",
            transform: `scale(${interpolate(frame, [210, 510], [1.05, 1.15])}) translateX(${interpolate(frame, [210, 510], [0, 30])}px)`,
          }}
        />
      </AbsoluteFill>

      {/* Dark overlay */}
      <AbsoluteFill style={{
        background: "linear-gradient(135deg, rgba(13,5,32,0.88) 0%, rgba(80,30,120,0.75) 40%, rgba(13,5,32,0.85) 70%, rgba(40,15,60,0.88) 100%)",
      }} />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={260}>
          <Scene1Specialists />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 30 })}
        />
        <TransitionSeries.Sequence durationInFrames={280}>
          <Scene2Compliance />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
