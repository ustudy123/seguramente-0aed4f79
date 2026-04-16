import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";

const PAIRS = [
  { from: "Psicossocial", to: "Registro de Ponto", verb: "cruza com", icon: "🧠↔⏱" },
  { from: "Onboarding", to: "PDI", verb: "alimenta", icon: "🚀→📋" },
  { from: "Documentos", to: "Conformidade Legal", verb: "sustentam", icon: "📄→⚖️" },
  { from: "Avaliações", to: "Gestão de Pessoas", verb: "informam", icon: "📊→👥" },
];

export const Scene2CrossModule = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 28,
          padding: "0 200px",
        }}
      >
        {PAIRS.map((pair, i) => {
          const delay = i * 30;
          const s = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 160 } });
          const x = interpolate(s, [0, 1], [-80, 0]);
          const glow = interpolate(
            Math.sin((frame - delay) * 0.06),
            [-1, 1],
            [0.3, 0.6]
          );

          // Arrow animation
          const arrowProgress = interpolate(frame, [delay + 15, delay + 40], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                opacity: s,
                transform: `translateX(${x}px)`,
                display: "flex",
                alignItems: "center",
                gap: 24,
                width: "100%",
                maxWidth: 1200,
              }}
            >
              {/* From */}
              <div
                style={{
                  flex: 1,
                  padding: "22px 28px",
                  borderRadius: 16,
                  background: "rgba(124,58,237,0.12)",
                  border: "1px solid rgba(167,139,250,0.3)",
                  textAlign: "right",
                  boxShadow: `0 0 ${20 + glow * 20}px rgba(124,58,237,${glow * 0.3})`,
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 700, color: "#E8E0F8" }}>
                  {pair.from}
                </div>
              </div>

              {/* Arrow */}
              <div style={{ width: 140, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <svg width="140" height="30" viewBox="0 0 140 30">
                  <line
                    x1={0}
                    y1={15}
                    x2={140 * arrowProgress}
                    y2={15}
                    stroke="#A78BFA"
                    strokeWidth={3}
                    strokeDasharray="8 4"
                  />
                  {arrowProgress > 0.9 && (
                    <polygon points="125,5 140,15 125,25" fill="#A78BFA" />
                  )}
                </svg>
                <div
                  style={{
                    position: "absolute",
                    top: -22,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#A78BFA",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    opacity: arrowProgress,
                    whiteSpace: "nowrap",
                  }}
                >
                  {pair.verb}
                </div>
              </div>

              {/* To */}
              <div
                style={{
                  flex: 1,
                  padding: "22px 28px",
                  borderRadius: 16,
                  background: "rgba(109,40,217,0.12)",
                  border: "1px solid rgba(139,92,246,0.3)",
                  boxShadow: `0 0 ${20 + glow * 20}px rgba(109,40,217,${glow * 0.3})`,
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 700, color: "#E8E0F8" }}>
                  {pair.to}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
