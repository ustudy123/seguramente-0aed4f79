import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { COLORS } from "../constants";

export const PersistentBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const gradientAngle = interpolate(frame, [0, durationInFrames], [135, 225]);
  const accentX = interpolate(frame, [0, durationInFrames], [80, 20]);
  const accentY = interpolate(frame, [0, durationInFrames], [20, 80]);

  return (
    <AbsoluteFill>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: `linear-gradient(${gradientAngle}deg, ${COLORS.dark} 0%, ${COLORS.darkMid} 60%, #1E1535 100%)`,
        }}
      />
      {/* Floating orb 1 */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.lilacFaded} 0%, transparent 70%)`,
          left: `${accentX}%`,
          top: `${accentY}%`,
          transform: "translate(-50%, -50%)",
          filter: "blur(80px)",
        }}
      />
      {/* Floating orb 2 */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(240, 123, 44, 0.1) 0%, transparent 70%)`,
          right: `${100 - accentX}%`,
          bottom: `${100 - accentY}%`,
          transform: "translate(50%, 50%)",
          filter: "blur(60px)",
        }}
      />
      {/* Grid lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.04,
          backgroundImage: `
            linear-gradient(${COLORS.lilac} 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.lilac} 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }}
      />
    </AbsoluteFill>
  );
};
