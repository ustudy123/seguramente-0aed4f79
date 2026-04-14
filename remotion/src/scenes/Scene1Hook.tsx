import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { TextReveal } from "../components/TextReveal";
import { AccentLine } from "../components/AccentLine";
import { COLORS } from "../constants";

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Warning badge
  const badgeProgress = spring({
    frame: frame - 5,
    fps,
    config: { damping: 15, stiffness: 200 },
  });
  const badgeScale = interpolate(badgeProgress, [0, 1], [0, 1]);
  const badgeOpacity = interpolate(badgeProgress, [0, 1], [0, 1]);

  // Pulse on the alert icon
  const pulse = Math.sin(frame * 0.15) * 0.05 + 1;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 120,
      }}
    >
      {/* Alert badge */}
      <div
        style={{
          width: 90,
          height: 90,
          borderRadius: 24,
          background: `linear-gradient(135deg, ${COLORS.orange} 0%, ${COLORS.orangeLight} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 44,
          transform: `scale(${badgeScale * pulse})`,
          opacity: badgeOpacity,
          boxShadow: `0 12px 40px rgba(240, 123, 44, 0.5)`,
          marginBottom: 40,
        }}
      >
        ⚠️
      </div>

      {/* Main text */}
      <TextReveal
        text="NR-01 exige gestão de"
        delay={15}
        fontSize={52}
        color={COLORS.light}
        fontWeight={400}
      />
      <div style={{ height: 8 }} />
      <TextReveal
        text="riscos psicossociais."
        delay={22}
        fontSize={62}
        color={COLORS.orange}
        fontWeight={800}
      />

      <div style={{ height: 30 }} />
      <AccentLine delay={35} width={160} />
      <div style={{ height: 30 }} />

      <TextReveal
        text="Sua empresa está preparada?"
        delay={40}
        fontSize={44}
        color={COLORS.lilac}
        fontWeight={500}
      />
    </AbsoluteFill>
  );
};
