import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile, Img } from "remotion";

const ORANGE = "#E8753A";
const PURPLE = "#8B5CF6";
const LIGHT_ORANGE = "#F6A76C";
const LIGHT_PURPLE = "#D8B4FE";

const MODULES = [
  { name: "Registro de Ponto", verb: "cruza com" },
  { name: "Onboarding", verb: "integra" },
  { name: "PDI", verb: "alimenta" },
  { name: "Documentos", verb: "sustenta" },
  { name: "Conformidade Legal", verb: "fortalece" },
  { name: "Avaliações", verb: "informa" },
  { name: "Gestão de Pessoas", verb: "potencializa" },
];

export const Scene2Connections = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoOp = interpolate(frame, [0, 20], [0, 0.7], { extrapolateRight: "clamp" });

  // Hub Psicossocial entrance
  const hubSpring = spring({ frame, fps, config: { damping: 14, stiffness: 130 } });
  const hubScale = interpolate(hubSpring, [0, 1], [0.5, 1]);
  const hubPulse = 1 + Math.sin(frame * 0.07) * 0.03;
  const hubGlow = 60 + Math.sin(frame * 0.07) * 35;

  return (
    <AbsoluteFill>
      {/* Subtle radial */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 50% 40% at 30% 50%, rgba(232,117,58,0.08), transparent),
                        radial-gradient(ellipse 50% 40% at 75% 50%, rgba(139,92,246,0.06), transparent)`,
        }}
      />

      {/* Logo watermark top-left */}
      <div style={{ position: "absolute", top: 36, left: 50, opacity: logoOp }}>
        <Img
          src={staticFile("images/logo-oficial.png")}
          style={{ height: 50, objectFit: "contain" }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "100px 100px 120px",
          gap: 70,
        }}
      >
        {/* HUB: Psicossocial (left) */}
        <div
          style={{
            opacity: hubSpring,
            transform: `scale(${hubScale * hubPulse})`,
            flexShrink: 0,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%, rgba(246,167,108,0.45) 0%, rgba(232,117,58,0.35) 45%, rgba(180,80,30,0.25) 100%)`,
            border: `3px solid rgba(246,167,108,0.65)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 ${hubGlow}px rgba(232,117,58,0.55), inset 0 0 70px rgba(246,167,108,0.2)`,
            position: "relative",
          }}
        >
          {/* Orbital ring */}
          <div
            style={{
              position: "absolute",
              inset: -34,
              borderRadius: "50%",
              border: "1.5px dashed rgba(246,167,108,0.4)",
              transform: `rotate(${frame * 0.4}deg)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: -70,
              borderRadius: "50%",
              border: "1px dashed rgba(246,167,108,0.18)",
              transform: `rotate(${-frame * 0.25}deg)`,
            }}
          />
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: LIGHT_ORANGE,
              letterSpacing: 6,
              textTransform: "uppercase",
              marginBottom: 16,
              opacity: 0.95,
            }}
          >
            Núcleo
          </div>
          <div
            style={{
              fontSize: 78,
              fontWeight: 800,
              color: "#FFFFFF",
              textAlign: "center",
              lineHeight: 0.95,
              letterSpacing: -2,
              textShadow: "0 6px 40px rgba(232,117,58,0.7)",
            }}
          >
            Psicossocial
          </div>
          <div
            style={{
              marginTop: 22,
              padding: "8px 22px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.25)",
              fontSize: 28,
              fontWeight: 600,
              color: "#FFFFFF",
              letterSpacing: 2,
            }}
          >
            NR-01
          </div>
        </div>

        {/* RIGHT: Modules list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            flex: 1,
            maxWidth: 900,
          }}
        >
          {MODULES.map((mod, i) => {
            const delay = 22 + i * 12;
            const s = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 160 } });
            const x = interpolate(s, [0, 1], [140, 0]);
            const arrowP = interpolate(frame, [delay + 6, delay + 28], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const glow = interpolate(Math.sin((frame - delay) * 0.05), [-1, 1], [0.2, 0.5]);

            return (
              <div
                key={i}
                style={{
                  opacity: s,
                  transform: `translateX(${x}px)`,
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                }}
              >
                {/* Arrow + verb */}
                <div style={{ width: 200, position: "relative", display: "flex", alignItems: "center", flexShrink: 0 }}>
                  <svg width="200" height="42" viewBox="0 0 200 42" style={{ overflow: "visible" }}>
                    <defs>
                      <linearGradient id={`g${i}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={ORANGE} />
                        <stop offset="100%" stopColor={PURPLE} />
                      </linearGradient>
                    </defs>
                    <line
                      x1={6}
                      y1={21}
                      x2={6 + 170 * arrowP}
                      y2={21}
                      stroke={`url(#g${i})`}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeDasharray="10 5"
                    />
                    {arrowP > 0.15 && (
                      <circle
                        cx={6 + 170 * Math.min(arrowP, 1)}
                        cy={21}
                        r={5}
                        fill={PURPLE}
                        opacity={interpolate(Math.sin(frame * 0.18), [-1, 1], [0.6, 1])}
                      />
                    )}
                    {arrowP > 0.88 && (
                      <polygon
                        points="176,11 196,21 176,31"
                        fill={PURPLE}
                        opacity={interpolate(arrowP, [0.88, 1], [0, 1])}
                      />
                    )}
                  </svg>
                  <div
                    style={{
                      position: "absolute",
                      top: -10,
                      left: 0,
                      right: 18,
                      textAlign: "center",
                      fontSize: 16,
                      fontWeight: 700,
                      color: LIGHT_ORANGE,
                      letterSpacing: 3,
                      textTransform: "uppercase",
                      opacity: arrowP,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {mod.verb}
                  </div>
                </div>

                {/* Module box */}
                <div
                  style={{
                    flex: 1,
                    padding: "26px 38px",
                    borderRadius: 16,
                    background: "linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(76,29,149,0.12) 100%)",
                    border: `1.8px solid rgba(192,132,252,0.4)`,
                    boxShadow: `0 0 ${24 + glow * 28}px rgba(139,92,246,${glow * 0.4})`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 40,
                      fontWeight: 700,
                      color: "#FFFFFF",
                      letterSpacing: -0.5,
                      lineHeight: 1.05,
                    }}
                  >
                    {mod.name}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom caption */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(frame, [180, 215], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [180, 215], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
        }}
      >
        <div
          style={{
            fontSize: 34,
            fontWeight: 600,
            color: "#E8E0F8",
            letterSpacing: 0.3,
          }}
        >
          O <span style={{ color: LIGHT_ORANGE, fontWeight: 800 }}>Psicossocial</span> conecta toda a operação de pessoas
        </div>
      </div>
    </AbsoluteFill>
  );
};
