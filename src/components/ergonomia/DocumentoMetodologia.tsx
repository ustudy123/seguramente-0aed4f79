/**
 * DocumentoMetodologia — RQ-26
 * Geração automática do Documento de Metodologia GRO/PGR
 * NR-1 §1.4.6 · NR-17 · ISO 45003
 */
import { useState, useRef } from "react";
import {
  FileText,
  Download,
  CheckCircle2,
  Brain,
  Activity,
  Zap,
  Shield,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Printer,
  Calendar,
  Building2,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { GRORisco } from "@/types/gro";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useAuth } from "@/hooks/useAuth";

interface DocumentoMetodologiaProps {
  riscos: GRORisco[];
}

const VERSAO = "1.0";

export function DocumentoMetodologia({ riscos }: DocumentoMetodologiaProps) {
  const [open, setOpen] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set(["criterios", "matriz"]));
  const docRef = useRef<HTMLDivElement>(null);
  const { empresaAtivaId } = useEmpresaAtiva();

  const dataGeracao = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const toggle = (id: string) =>
    setExpandidos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const fontes = [...new Set(riscos.map((r) => r.fonte))];
  const totalFisicos = riscos.filter((r) => r.subtipo === "fisico").length;
  const totalPsico = riscos.filter((r) => r.subtipo === "psicossocial").length;

  const secoes = [
    {
      id: "escopo",
      titulo: "1. Escopo e Objetivo",
      icone: Shield,
      cor: "text-primary",
      conteudo: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Este documento descreve a metodologia adotada no sistema <strong>YourEyes</strong> para
            identificação, avaliação, controle e monitoramento de riscos ergonômicos (físicos e
            psicossociais) no âmbito do <strong>Gerenciamento de Riscos Ocupacionais (GRO)</strong>,
            como parte integrante do Programa de Gerenciamento de Riscos (PGR).
          </p>
          <p>
            <strong>Base legal:</strong> NR-1 (Portaria MTE 1.419/2024), NR-17, ISO 45001 e ISO 45003.
          </p>
          <p>
            <strong>Escopo:</strong> Riscos ergonômicos físicos (biomecânica, postura, cargas, mobiliário,
            ambiente) e psicossociais (organização do trabalho, demandas, autonomia, relações, suporte,
            clareza de papel). Exclui outros grupos de risco cobertos por laudos específicos.
          </p>
          <div className="flex gap-2 flex-wrap pt-1">
            <Badge variant="outline">NR-1</Badge>
            <Badge variant="outline">NR-17</Badge>
            <Badge variant="outline">ISO 45001</Badge>
            <Badge variant="outline">ISO 45003</Badge>
            <Badge variant="outline">Portaria MTE 1.419/2024</Badge>
          </div>
        </div>
      ),
    },
    {
      id: "criterios",
      titulo: "2. Critérios de Avaliação de Risco",
      icone: Activity,
      cor: "text-blue-600",
      conteudo: (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            O risco é calculado pela combinação de <strong>Probabilidade</strong> e{" "}
            <strong>Severidade</strong>, gerando quatro níveis de classificação.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold mb-1.5">Probabilidade (5 níveis)</p>
              {[
                ["Muito Baixa", "Evento improvável / condições controladas"],
                ["Baixa", "Exposição esporádica, medidas parciais"],
                ["Moderada", "Exposição regular, medidas insuficientes"],
                ["Alta", "Exposição frequente sem controle efetivo"],
                ["Muito Alta", "Exposição contínua / ausência de controles"],
              ].map(([n, d]) => (
                <div key={n} className="text-xs text-muted-foreground py-0.5 border-b border-border/30 flex gap-2">
                  <span className="font-medium w-20 shrink-0">{n}</span>
                  <span>{d}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold mb-1.5">Severidade (4 níveis)</p>
              {[
                ["Leve", "Desconforto passageiro, sem afastamento"],
                ["Moderada", "Lesão reversível, afastamento curto"],
                ["Grave", "Lesão irreversível / afastamento prolongado"],
                ["Gravíssima", "Incapacidade permanente / óbito"],
              ].map(([n, d]) => (
                <div key={n} className="text-xs text-muted-foreground py-0.5 border-b border-border/30 flex gap-2">
                  <span className="font-medium w-20 shrink-0">{n}</span>
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "matriz",
      titulo: "3. Matriz de Risco (Probabilidade × Severidade)",
      icone: Activity,
      cor: "text-amber-600",
      conteudo: (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="border border-border p-2 bg-muted/50 text-left">Probabilidade ↓ / Severidade →</th>
                  {["Leve", "Moderada", "Grave", "Gravíssima"].map((s) => (
                    <th key={s} className="border border-border p-2 bg-muted/50 text-center">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { prob: "Muito Alta", valores: ["Médio", "Alto", "Crítico", "Crítico"] },
                  { prob: "Alta", valores: ["Médio", "Alto", "Crítico", "Crítico"] },
                  { prob: "Moderada", valores: ["Baixo", "Médio", "Alto", "Alto"] },
                  { prob: "Baixa", valores: ["Baixo", "Baixo", "Médio", "Médio"] },
                  { prob: "Muito Baixa", valores: ["Baixo", "Baixo", "Baixo", "Médio"] },
                ].map((row) => (
                  <tr key={row.prob}>
                    <td className="border border-border p-2 font-medium bg-muted/20">{row.prob}</td>
                    {row.valores.map((v, i) => (
                      <td
                        key={i}
                        className={cn(
                          "border border-border p-2 text-center font-semibold",
                          v === "Crítico" && "bg-red-100 text-red-700",
                          v === "Alto" && "bg-orange-100 text-orange-700",
                          v === "Médio" && "bg-amber-100 text-amber-700",
                          v === "Baixo" && "bg-emerald-100 text-emerald-700"
                        )}
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            <strong>Tolerabilidade:</strong> Baixo = tolerável (monitorar); Médio = atenção (plano em 90 dias);
            Alto = não tolerável (ação imediata); Crítico = intolerável (paralisação / AET obrigatória).
          </p>
        </div>
      ),
    },
    {
      id: "psicossocial",
      titulo: "4. Metodologia Psicossocial",
      icone: Brain,
      cor: "text-purple-600",
      conteudo: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            O instrumento psicossocial adotado é o <strong>SIPRO (YourEyes Instrumento de Rastreio
            Psicossocial Ocupacional)</strong>, adaptado ao contexto brasileiro com base no
            COPSOQ III e na ISO 45003.
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li><strong>Escala Likert 5 pontos</strong>: Nunca (0) → Sempre (4)</li>
            <li><strong>10 eixos temáticos</strong> com pesos estratégicos (5%–15%)</li>
            <li><strong>6 índices sintéticos</strong>: IRP-S, IBO-S, IBD-S, IREC-S, ICOP-S, INOT-S</li>
            <li><strong>Anonimização</strong>: mínimo 5 respondentes por agregação</li>
            <li><strong>Score 0–100</strong>: scores altos = maior risco psicossocial</li>
          </ul>
          <p>
            Dimensões avaliadas: Demandas Quantitativas, Cognitivas, Emocionais, Autonomia, Clareza
            de Papel, Reconhecimento, Relacionamentos, Suporte Social, Recuperação e Sentido do Trabalho.
          </p>
          <div className="mt-2 p-2.5 bg-purple-50/60 rounded border border-purple-200/60">
            <p className="text-[11px] text-purple-700">
              <strong>Integração GRO:</strong> Dimensões com score ≥ 35% são automaticamente importadas
              como riscos psicossociais no inventário GRO, calculando probabilidade e severidade
              proporcionalmente ao score da dimensão.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "ia",
      titulo: "5. Uso de Inteligência Artificial",
      icone: Zap,
      cor: "text-primary",
      conteudo: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            O sistema YourEyes utiliza modelos de IA generativa para apoiar — não substituir — a
            análise ergonômica e psicossocial. As funcionalidades de IA incluem:
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Identificação preliminar de perigos ergonômicos a partir de imagens (AEP IA)</li>
            <li>Sugestão de ações 5W2H baseada no contexto do risco identificado</li>
            <li>Geração assistida de relatórios e documentos normativos</li>
            <li>Cálculo automático do nível de risco via lógica estruturada (trigger SQL)</li>
          </ul>
          <div className="mt-2 p-2.5 bg-amber-50/60 rounded border border-amber-200/60">
            <p className="text-[11px] text-amber-700">
              <strong>Limitação:</strong> As sugestões de IA são preliminares e requerem validação
              por profissional habilitado (ergonomista, médico do trabalho ou eng. de segurança).
              O sistema não emite laudos técnicos de forma autônoma.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "fontes",
      titulo: "6. Fontes de Dados e Evidências",
      icone: BookOpen,
      cor: "text-blue-600",
      conteudo: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>As fontes de dados aceitas para alimentar o GRO são:</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["AEP", "Avaliação Ergonômica Preliminar", "NR-17"],
              ["Questionário", "Instrumento SIPRO / COPSOQ", "ISO 45003"],
              ["Análise IA", "Imagens e análise ergonômica por IA", "NR-17"],
              ["Observação", "Levantamento técnico in loco", "NR-1"],
              ["Manual", "Registro técnico direto", "NR-1"],
              ["Psicossocial", "Campanhas do módulo Psicossocial", "ISO 45003"],
            ].map(([fonte, desc, ref]) => (
              <div key={fonte} className="p-2 border border-border/40 rounded-md">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-semibold">{fonte}</span>
                  <Badge variant="outline" className="text-[9px] h-3.5 px-1">{ref}</Badge>
                </div>
                <p className="text-[11px]">{desc}</p>
              </div>
            ))}
          </div>
          {fontes.length > 0 && (
            <div className="mt-2 p-2.5 bg-muted/40 rounded border border-border/40">
              <p className="text-[11px] font-medium text-foreground mb-1">Fontes ativas nesta empresa:</p>
              <div className="flex gap-1.5 flex-wrap">
                {fontes.map((f) => (
                  <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "limitacoes",
      titulo: "7. Limitações e Declaração de Conformidade",
      icone: AlertTriangle,
      cor: "text-amber-600",
      conteudo: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Limitações declaradas:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>A AEP não substitui a AET (NR-17 §17.1) em casos de risco alto ou crítico</li>
            <li>Dados psicossociais com &lt;5 respondentes são suprimidos por anonimização</li>
            <li>Análises de IA são sugestões preliminares — não constituem laudos</li>
            <li>O GRO deve ser revisado a cada mudança no processo produtivo (NR-1 §1.4.4)</li>
            <li>Riscos de outros grupos (químicos, biológicos) não são cobertos por este módulo</li>
          </ul>
          <Separator className="my-2" />
          <p className="font-medium text-foreground">Declaração de conformidade:</p>
          <p className="text-xs">
            Este processo de Gerenciamento de Riscos Ergonômicos e Psicossociais foi estruturado
            em conformidade com a NR-1 (ciclo PDCA, §1.4.1 a §1.4.5), NR-17 (ergonomia), ISO 45001
            (SGSST) e ISO 45003 (psicossocial), garantindo rastreabilidade, participação dos
            trabalhadores e documentação adequada para auditorias.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="text-[11px] text-emerald-700 font-medium">
              Documento gerado automaticamente pelo sistema YourEyes — v{VERSAO}
            </p>
          </div>
        </div>
      ),
    },
  ];

  const handlePrint = () => {
    if (!docRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Documento de Metodologia GRO</title>
      <style>body{font-family:sans-serif;margin:2rem;color:#111}h1,h2,h3{color:#1a1a1a}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px 8px;font-size:12px}
      .critico{background:#fee2e2;color:#b91c1c}.alto{background:#ffedd5;color:#c2410c}.medio{background:#fef9c3;color:#a16207}.baixo{background:#d1fae5;color:#065f46}
      </style></head><body>${docRef.current.innerHTML}</body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <>
      {/* Cartão de acesso */}
      <Card
        className="border-border/50 hover:shadow-md transition-all cursor-pointer group"
        onClick={() => setOpen(true)}
      >
        <CardContent className="py-4 px-5">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-primary/10 shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Documento de Metodologia GRO/PGR</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                RQ-26 · NR-1 §1.4.6 — Critérios, matriz, metodologia psicossocial, IA e limitações
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant="outline" className="text-[10px] h-4">v{VERSAO}</Badge>
                <Badge variant="outline" className="text-[10px] h-4">{totalFisicos} físicos · {totalPsico} psicossociais</Badge>
                <Badge variant="outline" className="text-[10px] h-4 text-emerald-600 border-emerald-200">Gerado automaticamente</Badge>
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0 group-hover:border-primary group-hover:text-primary">
              <FileText className="h-3.5 w-3.5" />
              Visualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal do documento */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Documento de Metodologia GRO/PGR
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  RQ-26 · Versão {VERSAO} · Gerado em {dataGeracao}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            <div ref={docRef} className="space-y-3">
              {/* Cabeçalho do documento */}
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 text-center">
                <p className="text-sm font-bold text-foreground">DOCUMENTO DE METODOLOGIA</p>
                <p className="text-sm font-bold text-foreground">Gerenciamento de Riscos Ergonômicos e Psicossociais</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Versão {VERSAO} · {dataGeracao} · Sistema YourEyes
                </p>
                <div className="flex justify-center gap-2 mt-2 flex-wrap">
                  {["NR-1", "NR-17", "ISO 45001", "ISO 45003"].map((n) => (
                    <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>
                  ))}
                </div>
              </div>

              {/* Seções expansíveis */}
              {secoes.map((secao) => {
                const Icone = secao.icone;
                const isOpen = expandidos.has(secao.id);
                return (
                  <Card key={secao.id} className="border-border/60">
                    <button
                      className="w-full text-left"
                      onClick={() => toggle(secao.id)}
                    >
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icone className={cn("h-4 w-4 shrink-0", secao.cor)} />
                            <CardTitle className="text-sm">{secao.titulo}</CardTitle>
                          </div>
                          {isOpen ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </CardHeader>
                    </button>
                    {isOpen && (
                      <CardContent className="pt-0 pb-4 px-4 border-t border-border/40">
                        <div className="mt-3">{secao.conteudo}</div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
