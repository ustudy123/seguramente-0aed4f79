import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { Scene2Connections } from "./scenes/Scene2Connections";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const CrossModuleVideo: React.FC = () => {
  const frame = useCurrentFrame();

  // Subtle ambient drift for the gradient
  const drift = Math.sin(frame * 0.01) * 30;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0D0520", fontFamily }}>
      {/* Layered ambient gradient */}
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at ${30 + drift}% 40%, rgba(232,117,58,0.18), transparent 60%),
            radial-gradient(ellipse 60% 50% at ${70 - drift}% 60%, rgba(139,92,246,0.18), transparent 60%),
            linear-gradient(135deg, #0D0520 0%, #1A0B3D 50%, #0D0520 100%)
          `,
        }}
      />

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 100% 80% at 50% 50%, transparent 60%, rgba(13,5,32,0.7) 100%)",
        }}
      />

      {/* Subtle noise grid */}
      <AbsoluteFill
        style={{
          opacity: 0.04,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Fade in */}
      <AbsoluteFill
        style={{
          opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <Scene2Connections />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
