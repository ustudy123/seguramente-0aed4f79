import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile, Img } from "remotion";

const ORANGE = "#E8753A";
const PURPLE = "#8B5CF6";
const LIGHT_ORANGE = "#F6A76C";
const LIGHT_PURPLE = "#D8B4FE";

const PAIRS = [
  { from: "Psicossocial", to: "Registro de Ponto", verb: "cruza com", colorFrom: ORANGE, colorTo: PURPLE },
  { from: "Onboarding", to: "Plano de Desenvolvimento", verb: "alimenta", colorFrom: PURPLE, colorTo: ORANGE },
  { from: "Documentos", to: "Conformidade Legal", verb: "sustentam", colorFrom: ORANGE, colorTo: PURPLE },
  { from: "Avaliações de Desempenho", to: "Gestão de Pessoas", verb: "informam", colorFrom: PURPLE, colorTo: ORANGE },
];

export const Scene2Connections = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoOp = interpolate(frame, [0, 20], [0, 0.7], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      {/* Subtle radial */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 50% 40% at 50% 50%, rgba(139,92,246,0.06), transparent),
                        radial-gradient(ellipse 40% 30% at 60% 40%, rgba(232,117,58,0.05), transparent)`,
        }}
      />

      {/* Logo watermark top-left */}
      <div style={{ position: "absolute", top: 36, left: 50, opacity: logoOp }}>
        <Img
          src={staticFile("images/logo-oficial.png")}
          style={{ height: 50, objectFit: "contain" }}
        />
      </div>

      {/* Pairs */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 28,
          padding: "0 120px",
        }}
      >
        {PAIRS.map((pair, i) => {
          const delay = i * 38;
          const s = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 130 } });
          const xFrom = interpolate(s, [0, 1], [-120, 0]);
          const xTo = interpolate(s, [0, 1], [120, 0]);

          const arrowP = interpolate(frame, [delay + 20, delay + 55], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const glow = interpolate(Math.sin((frame - delay) * 0.04), [-1, 1], [0.15, 0.45]);
          const isOrangeFirst = pair.colorFrom === ORANGE;

          return (
            <div
              key={i}
              style={{
                opacity: s,
                display: "flex",
                alignItems: "center",
                gap: 16,
                width: "100%",
                maxWidth: 1500,
              }}
            >
              {/* From */}
              <div
                style={{
                  flex: 1,
                  padding: "22px 30px",
                  borderRadius: 14,
                  background: `rgba(${isOrangeFirst ? "232,117,58" : "139,92,246"},0.10)`,
                  border: `1.5px solid rgba(${isOrangeFirst ? "232,117,58" : "192,132,252"},0.35)`,
                  textAlign: "right",
                  transform: `translateX(${xFrom}px)`,
                  boxShadow: `0 0 ${20 + glow * 25}px rgba(${isOrangeFirst ? "232,117,58" : "139,92,246"},${glow * 0.2})`,
                }}
              >
                <div style={{ fontSize: 26, fontWeight: 700, color: isOrangeFirst ? LIGHT_ORANGE : LIGHT_PURPLE }}>
                  {pair.from}
                </div>
              </div>

              {/* Arrow */}
              <div style={{ width: 170, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="170" height="36" viewBox="0 0 170 36">
                  {/* Gradient line */}
                  <defs>
                    <linearGradient id={`g${i}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={pair.colorFrom} />
                      <stop offset="100%" stopColor={pair.colorTo} />
                    </linearGradient>
                  </defs>
                  <line x1={10} y1={18} x2={10 + 140 * arrowP} y2={18}
                    stroke={`url(#g${i})`} strokeWidth={2.5} strokeLinecap="round" />
                  {/* Animated dot */}
                  {arrowP > 0.1 && (
                    <circle
                      cx={10 + 140 * Math.min(arrowP, 1)}
                      cy={18}
                      r={4}
                      fill={pair.colorTo}
                      opacity={interpolate(Math.sin(frame * 0.15), [-1, 1], [0.5, 1])}
                    />
                  )}
                  {arrowP > 0.88 && (
                    <polygon points="142,8 160,18 142,28" fill={pair.colorTo}
                      opacity={interpolate(arrowP, [0.88, 1], [0, 1])} />
                  )}
                </svg>
                <div
                  style={{
                    position: "absolute",
                    top: -16,
                    fontSize: 11,
                    fontWeight: 700,
                    color: isOrangeFirst ? ORANGE : PURPLE,
                    textTransform: "uppercase",
                    letterSpacing: 3,
                    opacity: arrowP,
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
                  padding: "22px 30px",
                  borderRadius: 14,
                  background: `rgba(${!isOrangeFirst ? "232,117,58" : "139,92,246"},0.10)`,
                  border: `1.5px solid rgba(${!isOrangeFirst ? "232,117,58" : "192,132,252"},0.35)`,
                  transform: `translateX(${xTo}px)`,
                  boxShadow: `0 0 ${20 + glow * 25}px rgba(${!isOrangeFirst ? "232,117,58" : "139,92,246"},${glow * 0.2})`,
                }}
              >
                <div style={{ fontSize: 26, fontWeight: 700, color: !isOrangeFirst ? LIGHT_ORANGE : LIGHT_PURPLE }}>
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
