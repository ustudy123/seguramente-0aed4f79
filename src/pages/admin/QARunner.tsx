import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Play, Loader2, CheckCircle2, XCircle, AlertCircle,
  CircleDashed, Clock, ChevronRight, Bot,
} from "lucide-react";
import {
  useQaRunner, useQaResultados, type QaSituacao, type QaBateria,
} from "@/hooks/useQaRunner";

// ── aparência de cada situação ──────────────────────────
const SITUACAO: Record<
  QaSituacao,
  { label: string; icon: typeof CheckCircle2; badge: string; row: string }
> = {
  passou: {
    label: "Passou", icon: CheckCircle2,
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    row: "border-l-emerald-400",
  },
  falhou: {
    label: "Falhou", icon: XCircle,
    badge: "bg-red-100 text-red-800 border-red-200",
    row: "border-l-red-500",
  },
  erro: {
    label: "Erro", icon: AlertCircle,
    badge: "bg-orange-100 text-orange-800 border-orange-200",
    row: "border-l-orange-400",
  },
  nao_implementado: {
    label: "Sem rotina", icon: CircleDashed,
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    row: "border-l-slate-300",
  },
};

function Placar({ b }: { b: QaBateria }) {
  const item = (n: number, s: QaSituacao) =>
    n > 0 ? (
      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${SITUACAO[s].badge}`}>
        {n} {SITUACAO[s].label.toLowerCase()}
      </span>
    ) : null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {item(b.passou, "passou")}
      {item(b.falhou, "falhou")}
      {item(b.erro, "erro")}
      {item(b.nao_implementado, "nao_implementado")}
    </div>
  );
}

// ── relatório de uma bateria ────────────────────────────
function Relatorio({ execucaoId }: { execucaoId: string }) {
  const { data: resultados = [], isLoading } = useQaResultados(execucaoId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando resultados…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {resultados.map((r) => {
        const s = SITUACAO[r.situacao];
        const Icon = s.icon;
        const mostrarDetalhe =
          r.situacao === "falhou" || r.situacao === "erro";
        return (
          <div
            key={r.codigo}
            className={`border-l-2 ${s.row} bg-card rounded-r-md border border-l-2 px-3 py-2`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="font-mono text-sm font-medium">{r.codigo}</span>
                <span className="text-sm text-muted-foreground truncate">
                  {r.obtido}
                </span>
              </div>
              <Badge variant="outline" className={`shrink-0 ${s.badge}`}>
                {s.label}
              </Badge>
            </div>

            {mostrarDetalhe && (
              <div className="mt-2 ml-6 space-y-1 text-xs">
                {r.passo_acao && (
                  <p>
                    <span className="text-muted-foreground">Passo que falhou: </span>
                    {r.passo_acao}
                  </p>
                )}
                {r.esperado && (
                  <p>
                    <span className="text-muted-foreground">Esperado: </span>
                    {r.esperado}
                  </p>
                )}
                {r.erro_tecnico && (
                  <p className="font-mono text-orange-700 bg-orange-50 rounded px-2 py-1">
                    {r.erro_tecnico}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function QARunner() {
  const navigate = useNavigate();
  const { modulos, carregandoModulos, baterias, carregandoBaterias, disparar } =
    useQaRunner();

  const [moduloSel, setModuloSel] = useState<string>("");
  const [abertaId, setAbertaId] = useState<string | null>(null);

  const totalCasos = modulos.reduce((n, m) => n + Number(m.casos_executaveis), 0);

  const rodar = async () => {
    const alvo = moduloSel || modulos[0]?.modulo_path;
    if (!alvo) return;
    const id = await disparar.mutateAsync(alvo);
    setAbertaId(id); // abre o relatório da bateria recém-criada
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      {/* cabeçalho */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/qa")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <h1 className="text-xl font-semibold">Testes automatizados</h1>
        </div>
      </div>

      {/* painel de disparo */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">Módulo</label>
              <Select
                value={moduloSel}
                onValueChange={setModuloSel}
                disabled={carregandoModulos || disparar.isPending}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      carregandoModulos
                        ? "Carregando…"
                        : `Todos os testáveis (${totalCasos} casos)`
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {modulos.map((m) => (
                    <SelectItem key={m.modulo_path} value={m.modulo_path}>
                      {m.label} · {m.casos_executaveis} casos
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={rodar} disabled={disparar.isPending || carregandoModulos}>
              {disparar.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rodando…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Rodar bateria
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Os testes rodam em um ambiente isolado. Nenhum dado de cliente é
            criado, alterado ou lido.
          </p>
        </CardContent>
      </Card>

      {/* histórico */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Execuções</h2>

        {carregandoBaterias ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : baterias.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma bateria rodada ainda. Escolha um módulo e clique em
              “Rodar bateria”.
            </CardContent>
          </Card>
        ) : (
          baterias.map((b) => {
            const aberta = abertaId === b.id;
            const quando = new Date(b.iniciada_em).toLocaleString("pt-BR");
            const modLabel =
              modulos.find((m) => m.modulo_path === b.modulo_path)?.label ||
              b.modulo_path;
            return (
              <Card key={b.id}>
                <CardContent className="p-0">
                  <button
                    className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
                    onClick={() => setAbertaId(aberta ? null : b.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 transition-transform ${
                          aberta ? "rotate-90" : ""
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{modLabel}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {quando}
                          {b.duracao_ms != null && ` · ${b.duracao_ms} ms`}
                          {b.disparada_por_nome && ` · ${b.disparada_por_nome}`}
                        </p>
                      </div>
                    </div>
                    <Placar b={b} />
                  </button>

                  {aberta && (
                    <div className="px-4 pb-4">
                      {b.observacao && b.observacao.startsWith(">>>") && (
                        <div className="mb-3 text-xs text-red-700 bg-red-50 rounded px-3 py-2">
                          {b.observacao}
                        </div>
                      )}
                      <Relatorio execucaoId={b.id} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
