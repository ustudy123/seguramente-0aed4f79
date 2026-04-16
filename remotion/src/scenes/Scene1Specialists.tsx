import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile, Img } from "remotion";

const ORANGE = "#E8753A";
const PURPLE = "#8B5CF6";

const SPECIALISTS = [
  { icon: "🛡️", label: "Segurança do Trabalho", color: ORANGE },
  { icon: "🧠", label: "Psicologia Organizacional", color: PURPLE },
  { icon: "💻", label: "Tecnologia", color: ORANGE },
];

export const Scene1Specialists: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo
  const logoS = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const logoOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  // Title words stagger
  const t1 = spring({ frame: frame - 15, fps, config: { damping: 18, stiffness: 120 } });
  const t2 = spring({ frame: frame - 30, fps, config: { damping: 18, stiffness: 120 } });

  // Floating particles
  const particles = Array.from({ length: 18 }, (_, i) => {
    const baseX = (i * 137.5) % 1920;
    const baseY = (i * 89.3) % 1080;
    const speed = 0.3 + (i % 5) * 0.15;
    const size = 3 + (i % 4) * 2;
    const x = baseX + Math.sin((frame + i * 40) * 0.02 * speed) * 60;
    const y = baseY + Math.cos((frame + i * 30) * 0.015 * speed) * 40;
    const op = interpolate(frame, [10 + i * 3, 30 + i * 3], [0, 0.3 + (i % 3) * 0.1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });
    return { x, y, size, op, isOrange: i % 2 === 0 };
  });

  // Hexagonal grid lines
  const gridOp = interpolate(frame, [5, 35], [0, 0.06], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      {/* Radial glows */}
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse 50% 40% at 50% 45%, rgba(139,92,246,0.12), transparent),
                      radial-gradient(ellipse 35% 30% at 30% 60%, rgba(232,117,58,0.08), transparent),
                      radial-gradient(ellipse 30% 25% at 70% 35%, rgba(192,132,252,0.06), transparent)`,
      }} />

      {/* Animated grid */}
      <svg width="1920" height="1080" style={{ position: "absolute", opacity: gridOp }}>
        {Array.from({ length: 20 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 60} x2={1920} y2={i * 60}
            stroke={PURPLE} strokeWidth={0.5} opacity={0.5} />
        ))}
        {Array.from({ length: 35 }, (_, i) => (
          <line key={`v${i}`} x1={i * 60} y1={0} x2={i * 60} y2={1080}
            stroke={PURPLE} strokeWidth={0.5} opacity={0.5} />
        ))}
      </svg>

      {/* Floating particles */}
      {particles.map((p, i) => (
        <div key={i} style={{
          position: "absolute", left: p.x, top: p.y,
          width: p.size, height: p.size, borderRadius: "50%",
          background: p.isOrange ? ORANGE : PURPLE,
          opacity: p.op,
          boxShadow: `0 0 ${p.size * 3}px ${p.isOrange ? ORANGE : PURPLE}`,
        }} />
      ))}

      {/* Connection arcs */}
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        {[0, 1, 2].map(i => {
          const arcProgress = interpolate(frame, [60 + i * 20, 110 + i * 20], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          const cx = 960;
          const cy = 540;
          const r = 280 + i * 50;
          const startAngle = (i * 120 + frame * 0.3) * Math.PI / 180;
          const endAngle = startAngle + Math.PI * 0.6 * arcProgress;
          const x1 = cx + Math.cos(startAngle) * r;
          const y1 = cy + Math.sin(startAngle) * r * 0.4;
          const x2 = cx + Math.cos(endAngle) * r;
          const y2 = cy + Math.sin(endAngle) * r * 0.4;
          return (
            <path key={i}
              d={`M ${x1} ${y1} A ${r} ${r * 0.4} 0 0 1 ${x2} ${y2}`}
              fill="none" stroke={i % 2 === 0 ? ORANGE : PURPLE}
              strokeWidth={1.5} opacity={arcProgress * 0.25}
              strokeDasharray="8 6"
            />
          );
        })}
      </svg>

      {/* Logo watermark top-left */}
      <div style={{ position: "absolute", top: 36, left: 50, opacity: logoOp * 0.7 }}>
        <Img src={staticFile("images/logo-oficial.png")} style={{ height: 50, objectFit: "contain" }} />
      </div>

      {/* Center content */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "0 140px",
      }}>
        {/* Main logo */}
        <div style={{
          opacity: logoOp,
          transform: `scale(${interpolate(logoS, [0, 1], [0.4, 1])})`,
          marginBottom: 40,
        }}>
          <Img src={staticFile("images/logo-oficial.png")} style={{ height: 100, objectFit: "contain" }} />
        </div>

        {/* Line 1 */}
        <div style={{
          opacity: t1,
          transform: `translateY(${interpolate(t1, [0, 1], [50, 0])}px)`,
          fontSize: 46,
          fontWeight: 700,
          color: "#FFFFFF",
          textAlign: "center",
          lineHeight: 1.35,
          maxWidth: 1200,
          textShadow: "0 4px 40px rgba(0,0,0,0.6)",
        }}>
          Desenvolvido por uma equipe{" "}
          <span style={{
            background: "linear-gradient(90deg, #E8753A, #8B5CF6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>multidisciplinar</span>
        </div>

        {/* Line 2 */}
        <div style={{
          opacity: t2,
          transform: `translateY(${interpolate(t2, [0, 1], [35, 0])}px)`,
          fontSize: 38,
          fontWeight: 500,
          color: "rgba(255,255,255,0.85)",
          textAlign: "center",
          marginTop: 12,
          textShadow: "0 3px 30px rgba(0,0,0,0.5)",
        }}>
          de especialistas em
        </div>

        {/* Specialist pills */}
        <div style={{
          display: "flex", gap: 28, marginTop: 50, flexWrap: "wrap", justifyContent: "center",
        }}>
          {SPECIALISTS.map((spec, i) => {
            const pillS = spring({ frame: frame - 55 - i * 12, fps, config: { damping: 12, stiffness: 140 } });
            const pulse = interpolate(Math.sin((frame - i * 20) * 0.04), [-1, 1], [0.95, 1.05]);
            const isOrange = spec.color === ORANGE;
            return (
              <div key={i} style={{
                opacity: pillS,
                transform: `scale(${pillS * pulse}) translateY(${interpolate(pillS, [0, 1], [30, 0])}px)`,
              }}>
                <div style={{
                  padding: "18px 36px",
                  borderRadius: 50,
                  background: isOrange ? "rgba(232,117,58,0.12)" : "rgba(139,92,246,0.12)",
                  border: `2px solid ${isOrange ? "rgba(232,117,58,0.5)" : "rgba(192,132,252,0.45)"}`,
                  display: "flex", alignItems: "center", gap: 14,
                  boxShadow: `0 0 30px ${isOrange ? "rgba(232,117,58,0.2)" : "rgba(139,92,246,0.2)"}`,
                }}>
                  <span style={{ fontSize: 32 }}>{spec.icon}</span>
                  <span style={{
                    fontSize: 20, fontWeight: 700,
                    color: isOrange ? "#F6A76C" : "#D8B4FE",
                  }}>{spec.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
