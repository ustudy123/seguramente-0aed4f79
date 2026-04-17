import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const MODULES = [
  { name: "Registro de Ponto", verb: "CRUZA COM" },
  { name: "Onboarding", verb: "INTEGRA" },
  { name: "PDI", verb: "ALIMENTA" },
  { name: "Documentos", verb: "SUSTENTA" },
  { name: "Conformidade Legal", verb: "FORTALECE" },
  { name: "Avaliações", verb: "INFORMA" },
  { name: "Gestão de Pessoas", verb: "POTENCIALIZA" },
];

export const Scene2CrossModule = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Hub entrance
  const hubSpring = spring({ frame, fps, config: { damping: 14, stiffness: 140 } });
  const hubScale = interpolate(hubSpring, [0, 1], [0.6, 1]);
  const hubPulse = 1 + Math.sin(frame * 0.08) * 0.025;

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 120px",
          gap: 80,
        }}
      >
        {/* HUB: Psicossocial */}
        <div
          style={{
            opacity: hubSpring,
            transform: `scale(${hubScale * hubPulse})`,
            flexShrink: 0,
            width: 460,
            height: 460,
            borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, rgba(167,139,250,0.45) 0%, rgba(124,58,237,0.35) 40%, rgba(76,29,149,0.25) 100%)",
            border: "3px solid rgba(167,139,250,0.6)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 ${60 + Math.sin(frame * 0.08) * 40}px rgba(167,139,250,0.6), inset 0 0 60px rgba(167,139,250,0.2)`,
            position: "relative",
          }}
        >
          {/* Orbital ring */}
          <div
            style={{
              position: "absolute",
              inset: -30,
              borderRadius: "50%",
              border: "1px dashed rgba(167,139,250,0.35)",
              transform: `rotate(${frame * 0.4}deg)`,
            }}
          />
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: "#C4B5FD",
              letterSpacing: 4,
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Núcleo
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: "#FFFFFF",
              textAlign: "center",
              lineHeight: 1,
              letterSpacing: -1,
              textShadow: "0 4px 30px rgba(167,139,250,0.6)",
            }}
          >
            Psicossocial
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 24,
              fontWeight: 500,
              color: "#E8E0F8",
              opacity: 0.85,
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
            gap: 18,
            flex: 1,
            maxWidth: 780,
          }}
        >
          {MODULES.map((mod, i) => {
            const delay = 20 + i * 14;
            const s = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 170 } });
            const x = interpolate(s, [0, 1], [120, 0]);
            const arrowProgress = interpolate(frame, [delay + 8, delay + 28], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const glow = 0.4 + Math.sin((frame - delay) * 0.07) * 0.2;

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
                <div style={{ width: 180, position: "relative", display: "flex", alignItems: "center" }}>
                  <svg width="180" height="40" viewBox="0 0 180 40" style={{ overflow: "visible" }}>
                    <line
                      x1={0}
                      y1={20}
                      x2={Math.max(0, 165 * arrowProgress)}
                      y2={20}
                      stroke="#A78BFA"
                      strokeWidth={3}
                      strokeDasharray="10 5"
                    />
                    {arrowProgress > 0.85 && (
                      <polygon points="160,10 180,20 160,30" fill="#A78BFA" />
                    )}
                  </svg>
                  <div
                    style={{
                      position: "absolute",
                      top: -8,
                      left: 0,
                      right: 20,
                      textAlign: "center",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#C4B5FD",
                      letterSpacing: 2.5,
                      opacity: arrowProgress,
                    }}
                  >
                    {mod.verb}
                  </div>
                </div>

                {/* Module box */}
                <div
                  style={{
                    flex: 1,
                    padding: "26px 36px",
                    borderRadius: 18,
                    background: "linear-gradient(135deg, rgba(124,58,237,0.20) 0%, rgba(76,29,149,0.15) 100%)",
                    border: "1.5px solid rgba(167,139,250,0.4)",
                    boxShadow: `0 0 ${24 + glow * 28}px rgba(124,58,237,${glow * 0.45})`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 36,
                      fontWeight: 700,
                      color: "#FFFFFF",
                      letterSpacing: -0.3,
                      lineHeight: 1.1,
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
          bottom: 60,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(frame, [180, 210], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        <div
          style={{
            fontSize: 30,
            fontWeight: 600,
            color: "#E8E0F8",
            letterSpacing: 0.5,
          }}
        >
          O <span style={{ color: "#C4B5FD", fontWeight: 800 }}>Psicossocial</span> conecta toda a operação de pessoas
        </div>
      </div>
    </AbsoluteFill>
  );
};
