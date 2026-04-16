import { AbsoluteFill, useCurrentFrame, interpolate, staticFile, Img } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { Scene1Title } from "./scenes/Scene1Title";
import { Scene2Connections } from "./scenes/Scene2Connections";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export const MainVideo: React.FC = () => {
  const frame = useCurrentFrame();

  // Slow Ken Burns zoom on corporate bg
  const bgScale = interpolate(frame, [0, 395], [1.0, 1.12]);
  const bgX = interpolate(frame, [0, 395], [0, -30]);
  const bgY = interpolate(frame, [0, 395], [0, -15]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0118", fontFamily }}>
      {/* Corporate background with dark overlay */}
      <AbsoluteFill>
        <Img
          src={staticFile("images/corporate-bg.jpg")}
          style={{
            width: "110%",
            height: "110%",
            objectFit: "cover",
            transform: `scale(${bgScale}) translate(${bgX}px, ${bgY}px)`,
          }}
        />
        {/* Purple-tinted overlay */}
        <AbsoluteFill
          style={{
            background: "linear-gradient(135deg, rgba(10,1,24,0.88) 0%, rgba(62,20,130,0.82) 50%, rgba(10,1,24,0.90) 100%)",
          }}
        />
      </AbsoluteFill>

      {/* Subtle grid overlay */}
      <AbsoluteFill style={{ opacity: 0.03 }}>
        <svg width="1920" height="1080">
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 57} x2={1920} y2={i * 57} stroke="#A78BFA" strokeWidth={0.5} />
          ))}
          {Array.from({ length: 34 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 57} y1={0} x2={i * 57} y2={1080} stroke="#A78BFA" strokeWidth={0.5} />
          ))}
        </svg>
      </AbsoluteFill>

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={180}>
          <Scene1Title />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-left" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 25 })}
        />
        <TransitionSeries.Sequence durationInFrames={240}>
          <Scene2Connections />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
