import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";

const MODULES = [
  { label: "Psicossocial", x: 960, y: 280, color: "#A78BFA" },
  { label: "Ponto", x: 1300, y: 400, color: "#6D28D9" },
  { label: "Onboarding", x: 1200, y: 650, color: "#8B5CF6" },
  { label: "Documentos", x: 700, y: 650, color: "#C4B5FD" },
  { label: "Avaliações", x: 620, y: 400, color: "#7C3AED" },
  { label: "PDI", x: 960, y: 540, color: "#DDD6FE" },
];

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 5], [1, 5], [2, 5], [3, 5], [4, 5],
];

export const Scene1Integration = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleY = interpolate(
    spring({ frame, fps, config: { damping: 20, stiffness: 120 } }),
    [0, 1],
    [60, 0]
  );
  const titleOp = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 60,
          width: "100%",
          textAlign: "center",
          transform: `translateY(${titleY}px)`,
          opacity: titleOp,
        }}
      >
        <div style={{ fontSize: 52, fontWeight: 800, color: "#F8F5FF", letterSpacing: -1 }}>
          Todos os módulos do <span style={{ color: "#A78BFA" }}>YourEyes</span>
        </div>
        <div style={{ fontSize: 48, fontWeight: 700, color: "#7C3AED", marginTop: 8 }}>
          conversam entre si.
        </div>
      </div>

      {/* Connections */}
      <svg width="1920" height="1080" style={{ position: "absolute", top: 0, left: 0 }}>
        {CONNECTIONS.map(([a, b], i) => {
          const lineProgress = interpolate(frame, [30 + i * 4, 50 + i * 4], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const mx = MODULES[a].x + (MODULES[b].x - MODULES[a].x) * lineProgress;
          const my = MODULES[a].y + (MODULES[b].y - MODULES[a].y) * lineProgress;
          return (
            <line
              key={i}
              x1={MODULES[a].x}
              y1={MODULES[a].y}
              x2={mx}
              y2={my}
              stroke="#7C3AED"
              strokeWidth={2}
              opacity={0.5}
            />
          );
        })}
      </svg>

      {/* Nodes */}
      {MODULES.map((mod, i) => {
        const s = spring({ frame: frame - 15 - i * 6, fps, config: { damping: 14, stiffness: 180 } });
        const pulse = interpolate(Math.sin((frame - i * 10) * 0.08), [-1, 1], [0.95, 1.05]);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: mod.x,
              top: mod.y,
              transform: `translate(-50%, -50%) scale(${s * pulse})`,
              opacity: s,
            }}
          >
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${mod.color}40, ${mod.color}15)`,
                border: `2px solid ${mod.color}80`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 30px ${mod.color}30`,
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  backgroundColor: mod.color,
                  boxShadow: `0 0 12px ${mod.color}`,
                }}
              />
            </div>
            <div
              style={{
                textAlign: "center",
                marginTop: 10,
                fontSize: 18,
                fontWeight: 600,
                color: "#E8E0F8",
                letterSpacing: 0.5,
              }}
            >
              {mod.label}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
