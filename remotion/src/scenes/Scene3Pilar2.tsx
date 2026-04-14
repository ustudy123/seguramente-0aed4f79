import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { TextReveal } from "../components/TextReveal";
import { AccentLine } from "../components/AccentLine";
import { PillarIcon } from "../components/PillarIcon";
import { COLORS } from "../constants";

const features = [
  { icon: "🕐", label: "Controle de ponto digital" },
  { icon: "🦺", label: "Gestão de EPI com evidência" },
  { icon: "📑", label: "Onboarding documentado" },
];

export const Scene3Pilar2: React.FC = () => {
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
      {/* Left - Features */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 28 }}>
        {features.map((feat, i) => {
          const progress = spring({
            frame: frame - 25 - i * 12,
            fps,
            config: { damping: 18, stiffness: 160 },
          });
          const x = interpolate(progress, [0, 1], [-80, 0]);
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
                  background: `rgba(240, 123, 44, 0.2)`,
                  border: `1px solid rgba(240, 123, 44, 0.3)`,
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

      {/* Right - Title */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-end" }}>
        <PillarIcon icon="🛡️" delay={5} />
        <div style={{ height: 12 }} />
        <TextReveal
          text="Segurança"
          delay={10}
          fontSize={56}
          color={COLORS.white}
          fontWeight={800}
          textAlign="right"
        />
        <TextReveal
          text="Jurídica"
          delay={15}
          fontSize={56}
          color={COLORS.orange}
          fontWeight={800}
          textAlign="right"
        />
        <div style={{ height: 8 }} />
        <AccentLine delay={20} width={100} align="left" />
      </div>
    </AbsoluteFill>
  );
};
