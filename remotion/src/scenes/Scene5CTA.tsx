import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, staticFile, Img } from "remotion";
import { TextReveal } from "../components/TextReveal";
import { COLORS } from "../constants";

export const Scene5CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoProgress = spring({
    frame: frame - 5,
    fps,
    config: { damping: 15, stiffness: 120 },
  });
  const logoScale = interpolate(logoProgress, [0, 1], [0.6, 1]);
  const logoOpacity = interpolate(logoProgress, [0, 1], [0, 1]);

  // Glow pulse
  const glow = Math.sin(frame * 0.1) * 0.3 + 0.7;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
      }}
    >
      {/* Glow behind logo */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(107, 63, 160, ${glow * 0.3}) 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />

      {/* Logo */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
        }}
      >
        <Img
          src={staticFile("images/logo-YourEyes.png")}
          style={{ height: 120, width: "auto", objectFit: "contain" }}
        />
      </div>

      <div style={{ height: 10 }} />

      <TextReveal
        text="Conheça o sistema que protege"
        delay={20}
        fontSize={38}
        color={COLORS.light}
        fontWeight={400}
      />
      <TextReveal
        text="sua empresa de verdade."
        delay={28}
        fontSize={42}
        color={COLORS.orange}
        fontWeight={700}
      />

      <div style={{ height: 20 }} />

      {/* URL */}
      <TextReveal
        text="YourEyes.lovable.app"
        delay={40}
        fontSize={26}
        color={COLORS.lilac}
        fontWeight={400}
      />
    </AbsoluteFill>
  );
};
