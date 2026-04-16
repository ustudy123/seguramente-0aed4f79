import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export const Scene4Closing = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Line-by-line reveal
  const line1S = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const line2S = spring({ frame: frame - 20, fps, config: { damping: 18, stiffness: 120 } });
  const line3S = spring({ frame: frame - 50, fps, config: { damping: 18, stiffness: 120 } });

  // Accent bar
  const barWidth = interpolate(
    spring({ frame: frame - 10, fps, config: { damping: 25 } }),
    [0, 1],
    [0, 300]
  );

  // Outro fade
  const outroOp = interpolate(frame, [130, 160], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Subtle rotating ring
  const ringAngle = frame * 0.3;
  const ringOp = interpolate(Math.sin(frame * 0.04), [-1, 1], [0.05, 0.15]);

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent", opacity: outroOp }}>
      {/* Rotating accent ring */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) rotate(${ringAngle}deg)`,
          width: 700,
          height: 700,
          borderRadius: "50%",
          border: "1px solid rgba(167,139,250,0.15)",
          opacity: ringOp,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) rotate(${-ringAngle * 0.7}deg)`,
          width: 500,
          height: 500,
          borderRadius: "50%",
          border: "1px solid rgba(124,58,237,0.1)",
          opacity: ringOp,
        }}
      />

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
          padding: "0 200px",
          gap: 16,
        }}
      >
        {/* Line 1: strikethrough "sistema" */}
        <div
          style={{
            opacity: line1S,
            transform: `translateY(${interpolate(line1S, [0, 1], [40, 0])}px)`,
            fontSize: 46,
            fontWeight: 700,
            color: "#9CA3AF",
            letterSpacing: -0.5,
          }}
        >
          Não é só um{" "}
          <span style={{ textDecoration: "line-through", color: "#6B7280" }}>sistema</span>
        </div>

        {/* Accent bar */}
        <div
          style={{
            width: barWidth,
            height: 3,
            background: "linear-gradient(90deg, transparent, #7C3AED, transparent)",
            borderRadius: 2,
          }}
        />

        {/* Line 2: the hook */}
        <div
          style={{
            opacity: line2S,
            transform: `translateY(${interpolate(line2S, [0, 1], [40, 0])}px) scale(${interpolate(line2S, [0, 1], [0.9, 1])})`,
            fontSize: 56,
            fontWeight: 900,
            color: "#F8F5FF",
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          é a <span style={{ color: "#A78BFA" }}>governança completa</span>
        </div>

        {/* Line 3 */}
        <div
          style={{
            opacity: line3S,
            transform: `translateY(${interpolate(line3S, [0, 1], [30, 0])}px)`,
            fontSize: 36,
            fontWeight: 600,
            color: "#D4C8EF",
            textAlign: "center",
          }}
        >
          do trabalho humano na sua empresa.
        </div>

        {/* Brand */}
        <div
          style={{
            opacity: interpolate(
              spring({ frame: frame - 70, fps, config: { damping: 20 } }),
              [0, 1],
              [0, 1]
            ),
            marginTop: 40,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: 6,
            color: "#7C3AED",
            textTransform: "uppercase",
          }}
        >
          Seguramente
        </div>
      </div>
    </AbsoluteFill>
  );
};
