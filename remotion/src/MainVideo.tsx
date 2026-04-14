import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { slide } from "@remotion/transitions/slide";

import { PersistentBackground } from "./components/PersistentBackground";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Pilar1 } from "./scenes/Scene2Pilar1";
import { Scene3Pilar2 } from "./scenes/Scene3Pilar2";
import { Scene4Pilar3 } from "./scenes/Scene4Pilar3";
import { Scene5CTA } from "./scenes/Scene5CTA";

// Scene durations
const D = {
  hook: 150,
  p1: 160,
  p2: 160,
  p3: 160,
  cta: 150,
  t: 25, // transition duration
};

// Total = 150+160+160+160+150 - 4*25 = 680 frames ≈ 22.7s at 30fps
// Composition is 750, so we add a bit to CTA

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <PersistentBackground />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={D.hook}>
          <Scene1Hook />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: D.t })}
        />

        <TransitionSeries.Sequence durationInFrames={D.p1}>
          <Scene2Pilar1 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: D.t })}
        />

        <TransitionSeries.Sequence durationInFrames={D.p2}>
          <Scene3Pilar2 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: D.t })}
        />

        <TransitionSeries.Sequence durationInFrames={D.p3}>
          <Scene4Pilar3 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: D.t })}
        />

        <TransitionSeries.Sequence durationInFrames={D.cta + 50}>
          <Scene5CTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
