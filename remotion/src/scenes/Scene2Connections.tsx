import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile, Img } from "remotion";

const PAIRS = [
  {
    from: "Psicossocial",
    to: "Registro de Ponto",
    verb: "cruza com",
    iconFrom: "🧠",
    iconTo: "⏱",
  },
  {
    from: "Onboarding",
    to: "Plano de Desenvolvimento",
    verb: "alimenta",
    iconFrom: "🚀",
    iconTo: "📋",
  },
  {
    from: "Documentos",
    to: "Conformidade Legal",
    verb: "sustentam",
    iconFrom: "📄",
    iconTo: "⚖️",
  },
  {
    from: "Avaliações de Desempenho",
    to: "Gestão de Pessoas",
    verb: "informam",
    iconFrom: "📊",
    iconTo: "👥",
  },
];

export const Scene2Connections = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo top-right watermark
  const logoOp = interpolate(frame, [0, 20], [0, 0.6], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      {/* Radial accent */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(124,58,237,0.1), transparent)",
        }}
      />

      {/* Logo watermark top-right */}
      <div style={{ position: "absolute", top: 40, right: 50, opacity: logoOp }}>
        <Img
          src={staticFile("images/logo-branding.png")}
          style={{ height: 45, objectFit: "contain" }}
        />
      </div>

      {/* Pairs */}
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
          gap: 32,
          padding: "0 140px",
        }}
      >
        {PAIRS.map((pair, i) => {
          const delay = i * 35;
          const s = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 140 } });
          const x = interpolate(s, [0, 1], [-100, 0]);

          // Arrow animation
          const arrowP = interpolate(frame, [delay + 20, delay + 50], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          // Glow pulse
          const glow = interpolate(Math.sin((frame - delay) * 0.05), [-1, 1], [0.2, 0.5]);

          return (
            <div
              key={i}
              style={{
                opacity: s,
                transform: `translateX(${x}px)`,
                display: "flex",
                alignItems: "center",
                gap: 20,
                width: "100%",
                maxWidth: 1400,
              }}
            >
              {/* From card */}
              <div
                style={{
                  flex: 1,
                  padding: "24px 32px",
                  borderRadius: 16,
                  background: "rgba(124,58,237,0.12)",
                  border: "1px solid rgba(167,139,250,0.3)",
                  textAlign: "right",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 14,
                  boxShadow: `0 0 ${25 + glow * 30}px rgba(124,58,237,${glow * 0.25})`,
                }}
              >
                <div style={{ fontSize: 26, fontWeight: 700, color: "#F0EAFF" }}>
                  {pair.from}
                </div>
                <div style={{ fontSize: 32 }}>{pair.iconFrom}</div>
              </div>

              {/* Arrow connector */}
              <div style={{ width: 160, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="160" height="40" viewBox="0 0 160 40">
                  {/* Track line */}
                  <line x1={10} y1={20} x2={10 + 130 * arrowP} y2={20} stroke="#7C3AED" strokeWidth={2.5} strokeLinecap="round" />
                  {/* Glow dots along the line */}
                  {[0.2, 0.5, 0.8].map((p, di) => {
                    const dotX = 10 + 130 * Math.min(arrowP, p);
                    const dotOp = arrowP > p ? interpolate(Math.sin((frame - delay) * 0.1 + di), [-1, 1], [0.3, 1]) : 0;
                    return <circle key={di} cx={dotX} cy={20} r={3} fill="#A78BFA" opacity={dotOp} />;
                  })}
                  {/* Arrow head */}
                  {arrowP > 0.85 && (
                    <polygon points="135,10 155,20 135,30" fill="#7C3AED" opacity={interpolate(arrowP, [0.85, 1], [0, 1])} />
                  )}
                </svg>
                <div
                  style={{
                    position: "absolute",
                    top: -18,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#A78BFA",
                    textTransform: "uppercase",
                    letterSpacing: 3,
                    opacity: arrowP,
                    whiteSpace: "nowrap",
                  }}
                >
                  {pair.verb}
                </div>
              </div>

              {/* To card */}
              <div
                style={{
                  flex: 1,
                  padding: "24px 32px",
                  borderRadius: 16,
                  background: "rgba(109,40,217,0.12)",
                  border: "1px solid rgba(139,92,246,0.3)",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  boxShadow: `0 0 ${25 + glow * 30}px rgba(109,40,217,${glow * 0.25})`,
                }}
              >
                <div style={{ fontSize: 32 }}>{pair.iconTo}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#F0EAFF" }}>
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
