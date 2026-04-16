import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export const Scene3AI = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleS = spring({ frame, fps, config: { damping: 16, stiffness: 140 } });
  const titleScale = interpolate(titleS, [0, 1], [0.8, 1]);

  // AI sparkle particles
  const particles = Array.from({ length: 24 }).map((_, i) => {
    const angle = (i / 24) * Math.PI * 2 + frame * 0.015;
    const radius = 200 + Math.sin(frame * 0.04 + i) * 60;
    const px = 960 + Math.cos(angle) * radius;
    const py = 500 + Math.sin(angle) * radius * 0.5;
    const size = 3 + Math.sin(frame * 0.1 + i * 2) * 2;
    const op = interpolate(
      Math.sin(frame * 0.08 + i * 1.5),
      [-1, 1],
      [0.1, 0.8]
    );
    return { px, py, size, op };
  });

  const subtitleOp = interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subtitleY = interpolate(
    spring({ frame: frame - 30, fps, config: { damping: 20 } }),
    [0, 1],
    [30, 0]
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      {/* Radial glow */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse 50% 50% at 50% 46%, rgba(124,58,237,0.2), transparent)",
        }}
      />

      {/* Particles */}
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        {particles.map((p, i) => (
          <circle key={i} cx={p.px} cy={p.py} r={p.size} fill="#A78BFA" opacity={p.op} />
        ))}
      </svg>

      {/* Central AI icon */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "38%",
          transform: `translate(-50%, -50%) scale(${titleScale})`,
          opacity: titleS,
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 80px rgba(124,58,237,0.5)",
            fontSize: 56,
          }}
        >
          ✨
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: "56%",
          width: "100%",
          textAlign: "center",
          opacity: subtitleOp,
          transform: `translateY(${subtitleY}px)`,
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 800, color: "#F8F5FF", lineHeight: 1.3, maxWidth: 1100, margin: "0 auto" }}>
          Automatize seus processos de RH
        </div>
        <div style={{ fontSize: 44, fontWeight: 800, color: "#A78BFA", marginTop: 8 }}>
          com inteligência artificial de última geração.
        </div>
      </div>
    </AbsoluteFill>
  );
};
