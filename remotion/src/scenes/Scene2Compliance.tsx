import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile, Img } from "remotion";

const ORANGE = "#E8753A";
const PURPLE = "#8B5CF6";

const PILLARS = [
  { icon: "⚖️", label: "Conformidade Legal", color: ORANGE },
  { icon: "💚", label: "Bem-estar dos Colaboradores", color: PURPLE },
];

export const Scene2Compliance: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoOp = interpolate(frame, [0, 20], [0, 0.7], { extrapolateRight: "clamp" });

  // Shield drawing
  const shieldProgress = interpolate(frame, [10, 60], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Title
  const titleS = spring({ frame: frame - 15, fps, config: { damping: 16, stiffness: 110 } });

  // Highlight
  const highlightS = spring({ frame: frame - 40, fps, config: { damping: 18, stiffness: 100 } });

  // Orbiting rings
  const ringOp = interpolate(frame, [20, 50], [0, 0.15], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Particles
  const particles = Array.from({ length: 24 }, (_, i) => {
    const angle = ((i * 15 + frame * 0.5) * Math.PI) / 180;
    const r = 320 + (i % 3) * 60 + Math.sin(frame * 0.03 + i) * 30;
    const x = 960 + Math.cos(angle) * r;
    const y = 500 + Math.sin(angle) * r * 0.35;
    const op = interpolate(frame, [15 + i * 2, 40 + i * 2], [0, 0.4], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });
    const size = 2 + (i % 4) * 1.5;
    return { x, y, op, size, isOrange: i % 3 === 0 };
  });

  return (
    <AbsoluteFill>
      {/* Background gradient */}
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse 60% 50% at 50% 50%, rgba(232,117,58,0.08), transparent),
                      radial-gradient(ellipse 45% 40% at 40% 55%, rgba(139,92,246,0.1), transparent)`,
      }} />

      {/* Orbiting rings */}
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        {[0, 1, 2].map(i => {
          const r = 250 + i * 70;
          const rotation = frame * (0.2 + i * 0.1);
          return (
            <ellipse key={i} cx={960} cy={500} rx={r} ry={r * 0.35}
              fill="none" stroke={i % 2 === 0 ? PURPLE : ORANGE}
              strokeWidth={1} opacity={ringOp}
              strokeDasharray="12 8"
              transform={`rotate(${rotation} 960 500)`}
            />
          );
        })}
      </svg>

      {/* Particles */}
      {particles.map((p, i) => (
        <div key={i} style={{
          position: "absolute", left: p.x, top: p.y,
          width: p.size, height: p.size, borderRadius: "50%",
          background: p.isOrange ? ORANGE : PURPLE,
          opacity: p.op,
          boxShadow: `0 0 ${p.size * 4}px ${p.isOrange ? ORANGE : PURPLE}`,
        }} />
      ))}

      {/* Logo watermark */}
      <div style={{ position: "absolute", top: 36, left: 50, opacity: logoOp }}>
        <Img src={staticFile("images/logo-oficial.png")} style={{ height: 50, objectFit: "contain" }} />
      </div>

      {/* Center shield SVG */}
      <div style={{
        position: "absolute", left: "50%", top: 160,
        transform: "translateX(-50%)",
      }}>
        <svg width="200" height="220" viewBox="0 0 200 220">
          <defs>
            <linearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={ORANGE} />
              <stop offset="100%" stopColor={PURPLE} />
            </linearGradient>
          </defs>
          <path
            d="M100 10 L185 55 L185 130 Q185 190 100 210 Q15 190 15 130 L15 55 Z"
            fill="none" stroke="url(#shieldGrad)" strokeWidth={3}
            strokeDasharray={600}
            strokeDashoffset={600 - 600 * shieldProgress}
            opacity={0.7}
          />
          {shieldProgress > 0.8 && (
            <path
              d="M65 115 L90 140 L140 85"
              fill="none" stroke={ORANGE} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"
              opacity={interpolate(shieldProgress, [0.8, 1], [0, 1])}
            />
          )}
        </svg>
      </div>

      {/* Main content */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "0 120px", paddingTop: 100,
      }}>
        {/* Title */}
        <div style={{
          opacity: titleS,
          transform: `translateY(${interpolate(titleS, [0, 1], [40, 0])}px)`,
          fontSize: 44,
          fontWeight: 700,
          color: "#FFFFFF",
          textAlign: "center",
          lineHeight: 1.4,
          maxWidth: 1100,
          textShadow: "0 4px 40px rgba(0,0,0,0.6)",
        }}>
          Para empresas que levam{" "}
          <span style={{
            background: "linear-gradient(90deg, #E8753A, #F6A76C)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>a sério</span>
        </div>

        {/* Pillar cards */}
        <div style={{
          display: "flex", gap: 40, marginTop: 50,
        }}>
          {PILLARS.map((pillar, i) => {
            const cardS = spring({ frame: frame - 55 - i * 18, fps, config: { damping: 14, stiffness: 130 } });
            const xDir = i === 0 ? -1 : 1;
            const glow = interpolate(Math.sin((frame - i * 25) * 0.04), [-1, 1], [0.15, 0.4]);
            const isOrange = pillar.color === ORANGE;
            return (
              <div key={i} style={{
                opacity: cardS,
                transform: `translateX(${interpolate(cardS, [0, 1], [80 * xDir, 0])}px) scale(${cardS})`,
              }}>
                <div style={{
                  padding: "40px 50px",
                  borderRadius: 20,
                  background: isOrange
                    ? "linear-gradient(135deg, rgba(232,117,58,0.15), rgba(232,117,58,0.05))"
                    : "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05))",
                  border: `2px solid ${isOrange ? "rgba(232,117,58,0.4)" : "rgba(192,132,252,0.35)"}`,
                  textAlign: "center",
                  minWidth: 340,
                  boxShadow: `0 0 ${30 + glow * 30}px rgba(${isOrange ? "232,117,58" : "139,92,246"},${glow * 0.25})`,
                }}>
                  <div style={{ fontSize: 56, marginBottom: 16 }}>{pillar.icon}</div>
                  <div style={{
                    fontSize: 24, fontWeight: 700,
                    color: isOrange ? "#F6A76C" : "#D8B4FE",
                  }}>{pillar.label}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom accent line */}
        <div style={{
          marginTop: 50,
          width: interpolate(highlightS, [0, 1], [0, 500]),
          height: 3,
          background: `linear-gradient(90deg, ${ORANGE}, ${PURPLE})`,
          borderRadius: 2,
          opacity: highlightS * 0.6,
        }} />
      </div>
    </AbsoluteFill>
  );
};
