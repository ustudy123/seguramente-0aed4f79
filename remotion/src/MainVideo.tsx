import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { Scene1Integration } from "./scenes/Scene1Integration";
import { Scene2CrossModule } from "./scenes/Scene2CrossModule";
import { Scene3AI } from "./scenes/Scene3AI";
import { Scene4Closing } from "./scenes/Scene4Closing";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800", "900"],
  subsets: ["latin"],
});

const transitionDur = 20;

export const MainVideo: React.FC = () => {
  const frame = useCurrentFrame();

  const bgPulse = interpolate(Math.sin(frame * 0.02), [-1, 1], [0.03, 0.08]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0118", fontFamily }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 50%, rgba(124,58,237,${bgPulse}), transparent)`,
        }}
      />
      <AbsoluteFill style={{ opacity: 0.04 }}>
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
          <Scene1Integration />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-left" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: transitionDur })}
        />
        <TransitionSeries.Sequence durationInFrames={210}>
          <Scene2CrossModule />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: transitionDur })}
        />
        <TransitionSeries.Sequence durationInFrames={150}>
          <Scene3AI />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-bottom" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: transitionDur })}
        />
        <TransitionSeries.Sequence durationInFrames={180}>
          <Scene4Closing />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
