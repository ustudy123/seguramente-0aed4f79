import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { SceneNetworkGraph } from "./scenes/SceneNetworkGraph";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const NetworkVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame * 0.01) * 30;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0418", fontFamily }}>
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(ellipse 70% 60% at ${50 + drift}% 50%, rgba(124,58,237,0.22), transparent 65%),
            radial-gradient(ellipse 50% 50% at 20% 80%, rgba(232,117,58,0.10), transparent 60%),
            linear-gradient(135deg, #0A0418 0%, #1A0B3D 50%, #0A0418 100%)
          `,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.04,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 100% 80% at 50% 50%, transparent 60%, rgba(10,4,24,0.7) 100%)",
        }}
      />
      <AbsoluteFill
        style={{ opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" }) }}
      >
        <SceneNetworkGraph />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
