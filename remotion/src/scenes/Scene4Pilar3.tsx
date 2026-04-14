import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { TextReveal } from "../components/TextReveal";
import { AccentLine } from "../components/AccentLine";
import { PillarIcon } from "../components/PillarIcon";
import { COLORS } from "../constants";

export const Scene4Pilar3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Data visualization bars
  const bars = [65, 82, 45, 90, 72, 58, 85];

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 160px",
        gap: 40,
      }}
    >
      <PillarIcon icon="🧠" delay={5} size={70} />
      <TextReveal
        text="Inteligência de Dados"
        delay={10}
        fontSize={56}
        color={COLORS.white}
        fontWeight={800}
      />
      <AccentLine delay={18} width={140} />
      <TextReveal
        text="Cruzamento de percepção × dados reais"
        delay={22}
        fontSize={30}
        color={COLORS.lilac}
        fontWeight={400}
      />

      {/* Mini bar chart */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 16,
          height: 180,
          marginTop: 20,
        }}
      >
        {bars.map((height, i) => {
          const barProgress = spring({
            frame: frame - 30 - i * 5,
            fps,
            config: { damping: 15, stiffness: 120 },
          });
          const barHeight = interpolate(barProgress, [0, 1], [0, height * 1.8]);
          const barOpacity = interpolate(barProgress, [0, 1], [0, 1]);

          return (
            <div
              key={i}
              style={{
                width: 40,
                height: barHeight,
                borderRadius: 8,
                background:
                  i % 2 === 0
                    ? `linear-gradient(180deg, ${COLORS.purple} 0%, ${COLORS.purpleLight} 100%)`
                    : `linear-gradient(180deg, ${COLORS.orange} 0%, ${COLORS.orangeLight} 100%)`,
                opacity: barOpacity,
                boxShadow:
                  i % 2 === 0
                    ? `0 4px 16px rgba(107, 63, 160, 0.4)`
                    : `0 4px 16px rgba(240, 123, 44, 0.4)`,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
