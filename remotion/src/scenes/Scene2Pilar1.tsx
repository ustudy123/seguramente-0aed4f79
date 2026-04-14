import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { TextReveal } from "../components/TextReveal";
import { AccentLine } from "../components/AccentLine";
import { PillarIcon } from "../components/PillarIcon";
import { COLORS } from "../constants";

const features = [
  { icon: "📋", label: "Campanhas de saúde" },
  { icon: "📊", label: "Questionários inteligentes" },
  { icon: "📈", label: "Dashboards em tempo real" },
];

export const Scene2Pilar1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        padding: "0 140px",
        gap: 100,
      }}
    >
      {/* Left - Title */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <PillarIcon icon="⚡" delay={5} />
        <div style={{ height: 12 }} />
        <TextReveal
          text="Organização"
          delay={10}
          fontSize={56}
          color={COLORS.white}
          fontWeight={800}
          textAlign="left"
        />
        <TextReveal
          text="& Eficiência"
          delay={15}
          fontSize={56}
          color={COLORS.orange}
          fontWeight={800}
          textAlign="left"
        />
        <div style={{ height: 8 }} />
        <AccentLine delay={20} width={100} align="left" />
      </div>

      {/* Right - Features */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 28 }}>
        {features.map((feat, i) => {
          const progress = spring({
            frame: frame - 25 - i * 12,
            fps,
            config: { damping: 18, stiffness: 160 },
          });
          const x = interpolate(progress, [0, 1], [80, 0]);
          const opacity = interpolate(progress, [0, 1], [0, 1]);

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                transform: `translateX(${x}px)`,
                opacity,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: `rgba(107, 63, 160, 0.25)`,
                  border: `1px solid rgba(179, 136, 217, 0.3)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                }}
              >
                {feat.icon}
              </div>
              <span
                style={{
                  fontSize: 28,
                  fontFamily: "'Inter', sans-serif",
                  color: COLORS.light,
                  fontWeight: 500,
                }}
              >
                {feat.label}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
