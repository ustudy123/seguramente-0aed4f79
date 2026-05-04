import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const PURPLE = "#A78BFA";
const PURPLE_DEEP = "#7C3AED";
const PURPLE_GLOW = "rgba(167,139,250,";
const ORANGE = "#F6A76C";

// Center: Psicossocial. Others orbit around it (sides only — top/bottom reserved for title/caption).
const CENTER = { x: 960, y: 560 };
const RADIUS_X = 540;
const RADIUS_Y = 280;

const NODES = [
  // Right column
  { name: "Registro de Ponto", angle: -45 },
  { name: "PDI", angle: 0 },
  { name: "Gestão de Pessoas", angle: 45 },
  // Left column
  { name: "Onboarding", angle: 225 }, // -135 → 225
  { name: "Avaliações", angle: 180 },
  { name: "Documentos", angle: 135 },
];

const polar = (angleDeg: number) => {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CENTER.x + Math.cos(a) * RADIUS_X, y: CENTER.y + Math.sin(a) * RADIUS_Y };
};

export const SceneNetworkGraph = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title
  const titleOp = spring({ frame, fps, config: { damping: 18, stiffness: 130 } });
  const titleY = interpolate(titleOp, [0, 1], [-30, 0]);

  // Center hub entrance
  const hubSpring = spring({ frame: frame - 18, fps, config: { damping: 14, stiffness: 140 } });
  const hubScale = interpolate(hubSpring, [0, 1], [0.4, 1]);
  const hubPulse = 1 + Math.sin(frame * 0.07) * 0.03;

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 90,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 800, color: "#FFFFFF", letterSpacing: -1.5, lineHeight: 1.05 }}>
          Todos os módulos do{" "}
          <span style={{ color: PURPLE, textShadow: `0 0 30px ${PURPLE_GLOW}0.6)` }}>YourEyes</span>
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, color: PURPLE, marginTop: 10, letterSpacing: -1 }}>
          conversam entre si.
        </div>
      </div>

      {/* SVG graph */}
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <radialGradient id="hubGrad" cx="0.3" cy="0.3" r="0.9">
            <stop offset="0%" stopColor="#C4B5FD" stopOpacity={0.9} />
            <stop offset="60%" stopColor={PURPLE_DEEP} stopOpacity={0.7} />
            <stop offset="100%" stopColor="#4C1D95" stopOpacity={0.5} />
          </radialGradient>
          <radialGradient id="nodeGrad" cx="0.3" cy="0.3" r="0.9">
            <stop offset="0%" stopColor="#DDD6FE" stopOpacity={0.95} />
            <stop offset="70%" stopColor={PURPLE_DEEP} stopOpacity={0.7} />
            <stop offset="100%" stopColor="#3B0764" stopOpacity={0.6} />
          </radialGradient>
          <linearGradient id="edgeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={PURPLE} stopOpacity={0.9} />
            <stop offset="100%" stopColor={PURPLE} stopOpacity={0.4} />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges from center to each node */}
        {NODES.map((node, i) => {
          const p = polar(node.angle);
          const edgeDelay = 30 + i * 6;
          const edgeP = interpolate(frame, [edgeDelay, edgeDelay + 25], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const x2 = CENTER.x + (p.x - CENTER.x) * edgeP;
          const y2 = CENTER.y + (p.y - CENTER.y) * edgeP;

          // Pulse traveling along the edge
          const pulseT = ((frame - edgeDelay) * 0.012 + i * 0.15) % 1;
          const pulseX = CENTER.x + (p.x - CENTER.x) * pulseT;
          const pulseY = CENTER.y + (p.y - CENTER.y) * pulseT;

          return (
            <g key={`edge-${i}`}>
              <line
                x1={CENTER.x}
                y1={CENTER.y}
                x2={x2}
                y2={y2}
                stroke={`url(#edgeGrad)`}
                strokeWidth={2.5}
                strokeLinecap="round"
                opacity={0.7}
              />
              {edgeP > 0.95 && (
                <circle
                  cx={pulseX}
                  cy={pulseY}
                  r={5}
                  fill={ORANGE}
                  opacity={0.85}
                  filter="url(#glow)"
                />
              )}
            </g>
          );
        })}

        {/* Outer nodes */}
        {NODES.map((node, i) => {
          const p = polar(node.angle);
          const nodeDelay = 50 + i * 8;
          const s = spring({ frame: frame - nodeDelay, fps, config: { damping: 14, stiffness: 160 } });
          const scale = interpolate(s, [0, 1], [0, 1]);
          const pulse = 1 + Math.sin((frame - nodeDelay) * 0.08 + i) * 0.04;

          return (
            <g key={`node-${i}`} transform={`translate(${p.x}, ${p.y}) scale(${scale * pulse})`}>
              {/* Outer halo */}
              <circle r={70} fill={PURPLE_DEEP} opacity={0.18} filter="url(#glow)" />
              {/* Main node */}
              <circle r={48} fill="url(#nodeGrad)" stroke={PURPLE} strokeWidth={2.5} />
              {/* Inner highlight */}
              <circle r={10} fill="#F5F3FF" opacity={0.95} />
            </g>
          );
        })}

        {/* CENTER: Psicossocial */}
        <g transform={`translate(${CENTER.x}, ${CENTER.y}) scale(${hubScale * hubPulse})`}>
          {/* Outer rings */}
          <circle r={150} fill={PURPLE_DEEP} opacity={0.12} />
          <circle r={120} fill={PURPLE_DEEP} opacity={0.18} />
          {/* Orbital */}
          <circle
            r={135}
            fill="none"
            stroke={PURPLE}
            strokeWidth={1.5}
            strokeDasharray="6 6"
            opacity={0.45}
            transform={`rotate(${frame * 0.5})`}
          />
          {/* Main hub */}
          <circle r={100} fill="url(#hubGrad)" stroke="#C4B5FD" strokeWidth={3} filter="url(#glow)" />
          {/* Core highlight */}
          <circle r={20} fill="#FFFFFF" opacity={0.95} />
        </g>
      </svg>

      {/* HTML labels — for crisper, larger typography */}
      {NODES.map((node, i) => {
        const p = polar(node.angle);
        const nodeDelay = 50 + i * 8;
        const labelOp = interpolate(frame, [nodeDelay + 8, nodeDelay + 28], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        // Position label outside the node, away from center
        const offsetDist = 75;
        const a = (node.angle * Math.PI) / 180;
        const labelX = p.x + Math.cos(a) * offsetDist;
        const labelY = p.y + Math.sin(a) * offsetDist;

        // Horizontal alignment based on which side
        const isRight = Math.cos(a) > 0.2;
        const isLeft = Math.cos(a) < -0.2;
        const transform = isRight
          ? "translate(0, -50%)"
          : isLeft
          ? "translate(-100%, -50%)"
          : "translate(-50%, -50%)";

        return (
          <div
            key={`label-${i}`}
            style={{
              position: "absolute",
              left: labelX,
              top: labelY,
              transform,
              opacity: labelOp,
              fontSize: 38,
              fontWeight: 700,
              color: "#FFFFFF",
              letterSpacing: -0.3,
              whiteSpace: "nowrap",
              textShadow: "0 2px 18px rgba(0,0,0,0.7), 0 0 20px rgba(124,58,237,0.4)",
            }}
          >
            {node.name}
          </div>
        );
      })}

      {/* Center label: Psicossocial */}
      <div
        style={{
          position: "absolute",
          left: CENTER.x,
          top: CENTER.y,
          transform: "translate(-50%, -50%)",
          opacity: hubSpring,
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#F6A76C",
            letterSpacing: 5,
            textTransform: "uppercase",
            marginBottom: 4,
            textShadow: "0 2px 8px rgba(0,0,0,0.8)",
          }}
        >
          Núcleo
        </div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: -1.2,
            lineHeight: 1,
            textShadow: "0 4px 24px rgba(0,0,0,0.85), 0 0 30px rgba(167,139,250,0.6)",
          }}
        >
          Psicossocial
        </div>
        <div
          style={{
            marginTop: 8,
            display: "inline-block",
            padding: "4px 16px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.18)",
            border: "1px solid rgba(255,255,255,0.35)",
            fontSize: 18,
            fontWeight: 700,
            color: "#FFFFFF",
            letterSpacing: 2,
          }}
        >
          NR-01
        </div>
      </div>

      {/* Bottom caption */}
      <div
        style={{
          position: "absolute",
          bottom: 70,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(frame, [180, 215], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [180, 215], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 500, color: "#E8E0F8", letterSpacing: 0.3 }}>
          Uma plataforma. Um propósito. <span style={{ color: PURPLE, fontWeight: 800 }}>Pessoas no centro.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
