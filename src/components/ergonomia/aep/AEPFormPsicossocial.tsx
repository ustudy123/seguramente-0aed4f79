/**
 * AEPFormPsicossocial — Seção obrigatória de fatores psicossociais na AEP
 * RQ-05 · NR-17 §17.5 · ISO 45003
 *
 * Cobre os 6 domínios obrigatórios:
 *   1. Ritmo / Demandas Quantitativas
 *   2. Demandas Cognitivas e Emocionais
 *   3. Autonomia e Controle
 *   4. Relações Interpessoais / Suporte Social
 *   5. Clareza de Papel e Reconhecimento
 *   6. Organização do Trabalho / Recuperação
 */
import { Brain, Info, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NivelRisco } from "@/types/aep";
import { NIVEL_RISCO_LABELS } from "@/types/aep";

export interface FatorPsicossocial {
  observacao: string;
  nivelRisco: NivelRisco;
  fonteDados: "questionario" | "observacao" | "entrevista" | "nao_avaliado";
  scoreVinculado?: number | null;
}

export interface AEPFatoresPsicossociais {
  ritmoDemanda: FatorPsicossocial;
  demandasCognitivasEmocionais: FatorPsicossocial;
  autonomiaControle: FatorPsicossocial;
  relacoesSuporteSocial: FatorPsicossocial;
  clarezaPapelReconhecimento: FatorPsicossocial;
  organizacaoRecuperacao: FatorPsicossocial;
}

export const getDefaultFatoresPsicossociais = (): AEPFatoresPsicossociais => ({
  ritmoDemanda: { observacao: "", nivelRisco: "baixo", fonteDados: "nao_avaliado", scoreVinculado: null },
  demandasCognitivasEmocionais: { observacao: "", nivelRisco: "baixo", fonteDados: "nao_avaliado", scoreVinculado: null },
  autonomiaControle: { observacao: "", nivelRisco: "baixo", fonteDados: "nao_avaliado", scoreVinculado: null },
  relacoesSuporteSocial: { observacao: "", nivelRisco: "baixo", fonteDados: "nao_avaliado", scoreVinculado: null },
  clarezaPapelReconhecimento: { observacao: "", nivelRisco: "baixo", fonteDados: "nao_avaliado", scoreVinculado: null },
  organizacaoRecuperacao: { observacao: "", nivelRisco: "baixo", fonteDados: "nao_avaliado", scoreVinculado: null },
});

const FATORES_CONFIG: {
  key: keyof AEPFatoresPsicossociais;
  label: string;
  ref: string;
  descricao: string;
  sipro?: string[];
}[] = [
  {
    key: "ritmoDemanda",
    label: "Ritmo / Demandas Quantitativas",
    ref: "NR-17 §17.5.1",
    descricao: "Velocidade de trabalho, volume de tarefas, pressão por produção",
    sipro: ["Demandas Quantitativas"],
  },
  {
    key: "demandasCognitivasEmocionais",
    label: "Demandas Cognitivas e Emocionais",
    ref: "ISO 45003 §5.4",
    descricao: "Complexidade, concentração, carga emocional, lidar com conflitos",
    sipro: ["Demandas Cognitivas", "Demandas Emocionais"],
  },
  {
    key: "autonomiaControle",
    label: "Autonomia e Controle sobre o Trabalho",
    ref: "NR-17 §17.5.2",
    descricao: "Liberdade para organizar tarefas, participar em decisões, ritmo próprio",
    sipro: ["Autonomia"],
  },
  {
    key: "relacoesSuporteSocial",
    label: "Relações Interpessoais e Suporte Social",
    ref: "ISO 45003 §6.2",
    descricao: "Relacionamento com colegas, gestores, conflitos, suporte disponível",
    sipro: ["Relacionamentos", "Suporte Social"],
  },
  {
    key: "clarezaPapelReconhecimento",
    label: "Clareza de Papel e Reconhecimento",
    ref: "ISO 45003 §5.3",
    descricao: "Ambiguidade de função, conflito de papel, valorização do trabalho",
    sipro: ["Clareza de Papel", "Reconhecimento"],
  },
  {
    key: "organizacaoRecuperacao",
    label: "Organização do Trabalho e Recuperação",
    ref: "NR-17 §17.5.3",
    descricao: "Pausas, jornada, recuperação entre turnos, previsibilidade",
    sipro: ["Recuperação"],
  },
];

const FONTE_LABELS: Record<FatorPsicossocial["fonteDados"], string> = {
  questionario: "Questionário Psicossocial",
  observacao: "Observação Direta",
  entrevista: "Entrevista / Focus Group",
  nao_avaliado: "Não Avaliado",
};

const NIVEL_COLORS: Record<NivelRisco, string> = {
  baixo: "text-emerald-700 bg-emerald-50 border-emerald-200",
  medio: "text-amber-700 bg-amber-50 border-amber-200",
  alto: "text-orange-700 bg-orange-50 border-orange-200",
  critico: "text-red-700 bg-red-50 border-red-200",
};

interface AEPFormPsicossocialProps {
  data: AEPFatoresPsicossociais;
  onChange: (data: AEPFatoresPsicossociais) => void;
}

export function AEPFormPsicossocial({ data, onChange }: AEPFormPsicossocialProps) {
  const handleChange = (
    key: keyof AEPFatoresPsicossociais,
    field: keyof FatorPsicossocial,
    value: string | number | null
  ) => {
    onChange({
      ...data,
      [key]: { ...data[key], [field]: value },
    });
  };

  const naoAvaliados = FATORES_CONFIG.filter((f) => data[f.key].fonteDados === "nao_avaliado").length;
  const criticos = FATORES_CONFIG.filter((f) => data[f.key].nivelRisco === "critico").length;
  const altos = FATORES_CONFIG.filter((f) => data[f.key].nivelRisco === "alto").length;

  return (
    <div className="space-y-4">
      {/* Cabeçalho normativo */}
      <Card className="border-purple-200 bg-purple-50/40">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-3">
            <Brain className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-purple-800">
                5.3 Fatores Psicossociais — Obrigatório conforme RQ-05
              </p>
              <p className="text-[11px] text-purple-700 mt-0.5">
                NR-17 §17.5 · ISO 45003 — Avalie os 6 domínios obrigatórios. Use dados de campanhas
                psicossociais quando disponíveis. Para "Fonte = Não Avaliado", justifique na observação.
              </p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {naoAvaliados > 0 && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-300 text-amber-700 bg-amber-50">
                    <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                    {naoAvaliados} não avaliado(s)
                  </Badge>
                )}
                {criticos > 0 && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-red-300 text-red-700 bg-red-50">
                    {criticos} crítico(s)
                  </Badge>
                )}
                {altos > 0 && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-orange-300 text-orange-700 bg-orange-50">
                    {altos} alto(s)
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de fatores */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-purple-600" />
            Domínios Psicossociais Obrigatórios
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left py-2 px-4 font-medium text-xs">Domínio / Referência</th>
                  <th className="text-left py-2 px-3 font-medium text-xs">Fonte dos Dados</th>
                  <th className="text-left py-2 px-3 font-medium text-xs">Score Vinculado (%)</th>
                  <th className="text-left py-2 px-3 font-medium text-xs">Observação</th>
                  <th className="text-left py-2 px-3 font-medium text-xs w-36">Nível de Risco</th>
                </tr>
              </thead>
              <tbody>
                {FATORES_CONFIG.map((fator, idx) => {
                  const val = data[fator.key];
                  const isNaoAvaliado = val.fonteDados === "nao_avaliado";
                  return (
                    <tr
                      key={fator.key}
                      className={cn(
                        "border-b hover:bg-muted/20 transition-colors",
                        isNaoAvaliado && "bg-amber-50/30"
                      )}
                    >
                      <td className="py-2.5 px-4">
                        <p className="font-medium text-xs leading-tight">{fator.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{fator.descricao}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-purple-200 text-purple-600">
                            {fator.ref}
                          </Badge>
                          {fator.sipro?.map((s) => (
                            <Badge key={s} variant="outline" className="text-[9px] h-3.5 px-1 border-blue-200 text-blue-600">
                              SIPRO: {s}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Select
                          value={val.fonteDados}
                          onValueChange={(v) => handleChange(fator.key, "fonteDados", v as FatorPsicossocial["fonteDados"])}
                        >
                          <SelectTrigger className="h-7 text-xs w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(FONTE_LABELS) as [FatorPsicossocial["fonteDados"], string][]).map(
                              ([k, l]) => (
                                <SelectItem key={k} value={k} className="text-xs">
                                  {l}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2.5 px-3">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={val.scoreVinculado ?? ""}
                          onChange={(e) =>
                            handleChange(
                              fator.key,
                              "scoreVinculado",
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                          placeholder="0–100"
                          className="h-7 w-20 text-xs"
                        />
                        {val.scoreVinculado !== null && val.scoreVinculado !== undefined && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {val.scoreVinculado >= 65 ? (
                              <TrendingUp className="h-3 w-3 text-red-500" />
                            ) : val.scoreVinculado >= 35 ? (
                              <Minus className="h-3 w-3 text-amber-500" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-emerald-500" />
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {val.scoreVinculado >= 65
                                ? "Crítico"
                                : val.scoreVinculado >= 35
                                ? "Moderado"
                                : "Baixo"}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <Input
                          value={val.observacao}
                          onChange={(e) => handleChange(fator.key, "observacao", e.target.value)}
                          placeholder={isNaoAvaliado ? "Justifique a não avaliação..." : "Observações..."}
                          className={cn("h-7 text-xs", isNaoAvaliado && "border-amber-300 placeholder:text-amber-500")}
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <Select
                          value={val.nivelRisco}
                          onValueChange={(v) => handleChange(fator.key, "nivelRisco", v as NivelRisco)}
                        >
                          <SelectTrigger className={cn("h-7 text-xs border", NIVEL_COLORS[val.nivelRisco])}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(NIVEL_RISCO_LABELS) as [NivelRisco, string][]).map(([k, l]) => (
                              <SelectItem key={k} value={k} className="text-xs">
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Instrução ISO 45003 */}
          <div className="px-4 py-3 border-t bg-muted/20">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground">
                <strong>ISO 45003:</strong> Identidade e respostas devem ser separadas. Use dados agregados
                (mínimo 5 respondentes). Para campanhas psicossociais ativas, os scores são importados
                automaticamente via módulo Psicossocial → GRO.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
