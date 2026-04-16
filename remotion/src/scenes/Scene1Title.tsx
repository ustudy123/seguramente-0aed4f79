import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile, Img } from "remotion";

// Brand colors from logo
const ORANGE = "#E8753A";
const PURPLE = "#8B5CF6";
const LIGHT_PURPLE = "#C084FC";

const MODULES = [
  { label: "Psicossocial", angle: 270 },
  { label: "Registro de Ponto", angle: 330 },
  { label: "Onboarding", angle: 30 },
  { label: "PDI", angle: 90 },
  { label: "Documentos", angle: 150 },
  { label: "Avaliações", angle: 210 },
];

export const Scene1Title = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cx = 960;
  const cy = 520;
  const radius = 360;

  // Logo entrance with bounce
  const logoS = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const logoScale = interpolate(logoS, [0, 1], [0.3, 1]);
  const logoOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  // Title staggered
  const t1S = spring({ frame: frame - 20, fps, config: { damping: 18, stiffness: 100 } });
  const t2S = spring({ frame: frame - 40, fps, config: { damping: 18, stiffness: 100 } });

  return (
    <AbsoluteFill>
      {/* Radial glow - orange/purple blend */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 45% 35% at 50% 48%, rgba(232,117,58,0.08), transparent),
                        radial-gradient(ellipse 55% 45% at 50% 48%, rgba(139,92,246,0.1), transparent)`,
        }}
      />

      {/* Connection lines */}
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        {MODULES.map((mod, i) => {
          const a1 = ((mod.angle + frame * 0.12) * Math.PI) / 180;
          const x1 = cx + Math.cos(a1) * radius;
          const y1 = cy + Math.sin(a1) * radius * 0.5;
          return MODULES.filter((_, j) => j > i).map((mod2, j) => {
            const a2 = ((mod2.angle + frame * 0.12) * Math.PI) / 180;
            const x2 = cx + Math.cos(a2) * radius;
            const y2 = cy + Math.sin(a2) * radius * 0.5;
            const lineOp = interpolate(frame, [50 + i * 6, 75 + i * 6], [0, 0.12], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <line key={`${i}-${j}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={i % 2 === 0 ? ORANGE : PURPLE} strokeWidth={1} opacity={lineOp}
                strokeDasharray="6 4"
              />
            );
          });
        })}
      </svg>

      {/* Orbiting module pills */}
      {MODULES.map((mod, i) => {
        const nodeS = spring({ frame: frame - 35 - i * 6, fps, config: { damping: 14, stiffness: 140 } });
        const angle = ((mod.angle + frame * 0.12) * Math.PI) / 180;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius * 0.5;
        const pulse = interpolate(Math.sin((frame - i * 15) * 0.05), [-1, 1], [0.9, 1.08]);
        const isOrange = i % 2 === 0;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `translate(-50%, -50%) scale(${nodeS * pulse})`,
              opacity: nodeS * 0.95,
            }}
          >
            <div
              style={{
                padding: "10px 22px",
                borderRadius: 30,
                background: isOrange ? "rgba(232,117,58,0.12)" : "rgba(139,92,246,0.12)",
                border: `1px solid ${isOrange ? "rgba(232,117,58,0.4)" : "rgba(192,132,252,0.35)"}`,
                fontSize: 15,
                fontWeight: 600,
                color: isOrange ? "#F6A76C" : "#D8B4FE",
                whiteSpace: "nowrap",
                boxShadow: `0 0 18px ${isOrange ? "rgba(232,117,58,0.15)" : "rgba(139,92,246,0.15)"}`,
              }}
            >
              {mod.label}
            </div>
          </div>
        );
      })}

      {/* Center: Logo + Title */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Official Logo */}
        <div
          style={{
            opacity: logoOp,
            transform: `scale(${logoScale})`,
            marginBottom: 28,
          }}
        >
          <Img
            src={staticFile("images/logo-oficial.png")}
            style={{ height: 120, objectFit: "contain" }}
          />
        </div>

        {/* Line 1 */}
        <div
          style={{
            opacity: t1S,
            transform: `translateY(${interpolate(t1S, [0, 1], [40, 0])}px)`,
            fontSize: 52,
            fontWeight: 800,
            color: "#FFFFFF",
            textAlign: "center",
            lineHeight: 1.25,
            textShadow: "0 4px 40px rgba(0,0,0,0.6)",
          }}
        >
          Todos os módulos do{" "}
          <span style={{ 
            background: "linear-gradient(90deg, #E8753A, #8B5CF6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            Seguramente
          </span>
        </div>

        {/* Line 2 */}
        <div
          style={{
            opacity: t2S,
            transform: `translateY(${interpolate(t2S, [0, 1], [30, 0])}px)`,
            fontSize: 48,
            fontWeight: 700,
            color: ORANGE,
            marginTop: 8,
            textShadow: "0 3px 30px rgba(0,0,0,0.5)",
          }}
        >
          conversam entre si.
        </div>
      </div>
    </AbsoluteFill>
  );
};
