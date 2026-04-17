import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";

const MODULOS = [
  { nome: "Registro de Ponto",       conector: "CRUZA COM",  cor: "#E8753A" },
  { nome: "Onboarding",              conector: "ALIMENTA",   cor: "#A78BFA" },
  { nome: "Plano de Desenvolvimento",conector: "SUSTENTA",   cor: "#E8753A" },
  { nome: "Documentos",              conector: "INFORMA",    cor: "#A78BFA" },
  { nome: "Conformidade Legal",      conector: "REFORÇA",    cor: "#E8753A" },
  { nome: "Avaliações de Desempenho",conector: "INTEGRA",    cor: "#A78BFA" },
  { nome: "Gestão de Pessoas",       conector: "ORIENTA",    cor: "#E8753A" },
];

export const SceneCrossMatrix: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 25], [-30, 0], { extrapolateRight: "clamp" });

  const hubScale = spring({ frame: frame - 15, fps, config: { damping: 14, stiffness: 120 } });
  const hubGlow = 0.6 + Math.sin(frame * 0.06) * 0.2;

  return (
    <AbsoluteFill style={{ padding: "70px 90px", justifyContent: "center" }}>
      {/* Título */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 50,
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 6,
            color: "#E8753A",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          Núcleo Integrador
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: -1,
            lineHeight: 1.05,
          }}
        >
          Psicossocial cruza com{" "}
          <span style={{ color: "#A78BFA" }}>todos os módulos</span>
        </div>
      </div>

      {/* Layout: Hub à esquerda, lista de módulos à direita */}
      <div style={{ display: "flex", alignItems: "center", gap: 80, flex: 1 }}>
        {/* Hub Psicossocial */}
        <div
          style={{
            flex: "0 0 480px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            transform: `scale(${hubScale})`,
          }}
        >
          <div
            style={{
              width: 440,
              height: 440,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 30% 30%, rgba(167,139,250,0.95), rgba(124,58,237,0.85) 55%, rgba(76,29,149,0.9) 100%)",
              border: "3px solid rgba(255,255,255,0.35)",
              boxShadow: `
                0 0 ${80 * hubGlow}px rgba(167,139,250,${0.5 * hubGlow}),
                0 0 ${160 * hubGlow}px rgba(124,58,237,${0.4 * hubGlow}),
                inset 0 0 80px rgba(255,255,255,0.15)
              `,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 40,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: 4,
                color: "rgba(255,255,255,0.7)",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              NR-01
            </div>
            <div
              style={{
                fontSize: 68,
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: -1,
                lineHeight: 1,
              }}
            >
              Psicossocial
            </div>
            <div
              style={{
                marginTop: 18,
                fontSize: 22,
                fontWeight: 500,
                color: "rgba(255,255,255,0.85)",
                lineHeight: 1.3,
                maxWidth: 320,
              }}
            >
              Núcleo de governança humana
            </div>
          </div>
        </div>

        {/* Lista de módulos */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
          {MODULOS.map((mod, i) => (
            <ModuloRow key={mod.nome} modulo={mod} index={i} delay={30 + i * 8} />
          ))}
        </div>
      </div>

      {/* Caption inferior */}
      <CaptionInferior />
    </AbsoluteFill>
  );
};

const ModuloRow: React.FC<{
  modulo: { nome: string; conector: string; cor: string };
  index: number;
}> = ({ modulo, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });
  const x = interpolate(enter, [0, 1], [80, 0]);
  const op = interpolate(enter, [0, 1], [0, 1]);

  const arrowPulse = (Math.sin(frame * 0.12 + index) + 1) / 2;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        opacity: op,
        transform: `translateX(${x}px)`,
      }}
    >
      {/* Conector textual */}
      <div
        style={{
          width: 160,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 3,
          color: modulo.cor,
          textTransform: "uppercase",
          textAlign: "right",
        }}
      >
        {modulo.conector}
      </div>

      {/* Seta animada */}
      <div
        style={{
          width: 0,
          height: 0,
          borderTop: "14px solid transparent",
          borderBottom: "14px solid transparent",
          borderLeft: `22px solid ${modulo.cor}`,
          opacity: 0.5 + arrowPulse * 0.5,
          filter: `drop-shadow(0 0 ${6 + arrowPulse * 10}px ${modulo.cor})`,
        }}
      />

      {/* Card do módulo */}
      <div
        style={{
          flex: 1,
          padding: "22px 32px",
          borderRadius: 14,
          background:
            modulo.cor === "#E8753A"
              ? "linear-gradient(135deg, rgba(232,117,58,0.18), rgba(232,117,58,0.08))"
              : "linear-gradient(135deg, rgba(167,139,250,0.18), rgba(167,139,250,0.08))",
          border: `1.5px solid ${modulo.cor}55`,
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            color: "#FFFFFF",
            letterSpacing: -0.3,
          }}
        >
          {modulo.nome}
        </div>
      </div>
    </div>
  );
};

const CaptionInferior: React.FC = () => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [120, 150], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        marginTop: 48,
        textAlign: "center",
        opacity: op,
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 500,
          color: "rgba(255,255,255,0.85)",
          letterSpacing: 0.3,
        }}
      >
        Cada módulo se conecta ao{" "}
        <span style={{ color: "#A78BFA", fontWeight: 700 }}>Psicossocial</span>{" "}
        — gerando inteligência humana para toda a operação.
      </div>
    </div>
  );
};
