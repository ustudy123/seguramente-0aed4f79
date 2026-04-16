import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile, Img } from "remotion";

const MODULES = [
  { label: "Psicossocial", angle: 0 },
  { label: "Ponto", angle: 60 },
  { label: "Onboarding", angle: 120 },
  { label: "PDI", angle: 180 },
  { label: "Documentos", angle: 240 },
  { label: "Avaliações", angle: 300 },
];

export const Scene1Title = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo entrance
  const logoS = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
  const logoScale = interpolate(logoS, [0, 1], [0.6, 1]);

  // Title entrance
  const titleS = spring({ frame: frame - 15, fps, config: { damping: 18, stiffness: 100 } });
  const titleY = interpolate(titleS, [0, 1], [50, 0]);

  // Subtitle
  const subS = spring({ frame: frame - 35, fps, config: { damping: 20 } });
  const subY = interpolate(subS, [0, 1], [30, 0]);

  // Module nodes orbiting
  const cx = 960;
  const cy = 540;
  const radius = 380;

  return (
    <AbsoluteFill>
      {/* Radial glow behind content */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(124,58,237,0.15), transparent)",
        }}
      />

      {/* Connection lines between nodes */}
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        {MODULES.map((mod, i) => {
          const a1 = ((mod.angle + frame * 0.15) * Math.PI) / 180;
          const x1 = cx + Math.cos(a1) * radius;
          const y1 = cy + Math.sin(a1) * radius * 0.45;

          return MODULES.filter((_, j) => j > i).map((mod2, j) => {
            const a2 = ((mod2.angle + frame * 0.15) * Math.PI) / 180;
            const x2 = cx + Math.cos(a2) * radius;
            const y2 = cy + Math.sin(a2) * radius * 0.45;
            const lineOp = interpolate(frame, [40 + i * 5, 60 + i * 5], [0, 0.15], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <line key={`${i}-${j}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#A78BFA" strokeWidth={1} opacity={lineOp} />
            );
          });
        })}
      </svg>

      {/* Orbiting module nodes */}
      {MODULES.map((mod, i) => {
        const nodeS = spring({ frame: frame - 25 - i * 5, fps, config: { damping: 14, stiffness: 160 } });
        const angle = ((mod.angle + frame * 0.15) * Math.PI) / 180;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius * 0.45;
        const pulse = interpolate(Math.sin((frame - i * 12) * 0.06), [-1, 1], [0.85, 1.1]);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `translate(-50%, -50%) scale(${nodeS * pulse})`,
              opacity: nodeS * 0.9,
            }}
          >
            <div
              style={{
                padding: "10px 20px",
                borderRadius: 30,
                background: "rgba(124,58,237,0.15)",
                border: "1px solid rgba(167,139,250,0.35)",
                fontSize: 16,
                fontWeight: 600,
                color: "#C4B5FD",
                whiteSpace: "nowrap",
                boxShadow: "0 0 20px rgba(124,58,237,0.15)",
              }}
            >
              {mod.label}
            </div>
          </div>
        );
      })}

      {/* Center content: Logo + Title */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Logo */}
        <div
          style={{
            opacity: logoS,
            transform: `scale(${logoScale})`,
            marginBottom: 30,
          }}
        >
          <Img
            src={staticFile("images/logo-branding.png")}
            style={{ height: 90, objectFit: "contain" }}
          />
        </div>

        {/* Title */}
        <div
          style={{
            opacity: titleS,
            transform: `translateY(${titleY}px)`,
            fontSize: 54,
            fontWeight: 800,
            color: "#FFFFFF",
            textAlign: "center",
            lineHeight: 1.2,
            textShadow: "0 4px 30px rgba(0,0,0,0.5)",
          }}
        >
          Todos os módulos do{" "}
          <span style={{ color: "#A78BFA" }}>Seguramente</span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            opacity: subS,
            transform: `translateY(${subY}px)`,
            fontSize: 50,
            fontWeight: 700,
            color: "#7C3AED",
            marginTop: 10,
            textShadow: "0 4px 30px rgba(0,0,0,0.4)",
          }}
        >
          conversam entre si.
        </div>
      </div>
    </AbsoluteFill>
  );
};
