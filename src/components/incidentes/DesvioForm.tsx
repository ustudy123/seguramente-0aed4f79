import { useState } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { DesvioInsert } from "@/hooks/useDesviosSeguranca";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: DesvioInsert) => Promise<void>;
  isPending?: boolean;
}

const RISK_COLOR: Record<string, string> = {
  baixo: "bg-blue-100 text-blue-700 border-blue-200",
  medio: "bg-yellow-100 text-yellow-700 border-yellow-200",
  alto: "bg-orange-100 text-orange-700 border-orange-200",
  critico: "bg-red-100 text-red-700 border-red-200",
};

export const DesvioForm = ({ open, onOpenChange, onSubmit, isPending }: Props) => {
  const { register, handleSubmit, setValue, watch, reset } = useForm<DesvioInsert>({
    defaultValues: {
      tipo_desvio: "condicao_insegura",
      potencial_risco: "medio",
      status: "aberto",
      data_desvio: new Date().toISOString().slice(0, 10),
      reportante_anonimo: false,
    },
  });

  const potencial = watch("potencial_risco");
  const anonimo = watch("reportante_anonimo");

  const onValid = async (data: DesvioInsert) => {
    await onSubmit(data);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Registrar Desvio de Segurança
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onValid)} className="space-y-5">
          {/* Tipo e Categoria */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Tipo de Desvio *</Label>
              <Select
                defaultValue="condicao_insegura"
                onValueChange={(v) => setValue("tipo_desvio", v as any)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="condicao_insegura">⚠️ Condição Insegura</SelectItem>
                  <SelectItem value="ato_inseguro">🚶 Ato Inseguro</SelectItem>
                  <SelectItem value="desvio_processo">📋 Desvio de Processo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Categoria Técnica</Label>
              <Select onValueChange={(v) => setValue("categoria", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ergonomia">Ergonomia</SelectItem>
                  <SelectItem value="epi">EPI / EPR</SelectItem>
                  <SelectItem value="maquina">Máquina / Equipamento</SelectItem>
                  <SelectItem value="organizacao_trabalho">Organização do Trabalho</SelectItem>
                  <SelectItem value="ambiente">Ambiente / Layout</SelectItem>
                  <SelectItem value="eletrica">Elétrica</SelectItem>
                  <SelectItem value="quimica">Química / Biológica</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Potencial de risco */}
          <div className="space-y-2">
            <Label>Potencial de Risco *</Label>
            <div className="flex gap-2">
              {(["baixo", "medio", "alto", "critico"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setValue("potencial_risco", r)}
                  className={`flex-1 py-2 rounded border text-xs font-semibold capitalize transition-all ${
                    potencial === r ? RISK_COLOR[r] + " ring-2 ring-offset-1" : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {r === "baixo" ? "🔵 Baixo" : r === "medio" ? "🟡 Médio" : r === "alto" ? "🟠 Alto" : "🔴 Crítico"}
                </button>
              ))}
            </div>
            {(potencial === "alto" || potencial === "critico") && (
              <div className="flex items-center gap-2 p-2 rounded bg-orange-50 border border-orange-200 text-orange-700 text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                Desvio de alto potencial — recomendamos converter em incidente ou criar ação imediata.
              </div>
            )}
          </div>

          {/* Local */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Unidade</Label>
              <Input placeholder="Unidade" {...register("unidade")} />
            </div>
            <div className="space-y-1">
              <Label>Setor</Label>
              <Input placeholder="Setor" {...register("setor")} />
            </div>
            <div className="space-y-1">
              <Label>Turno</Label>
              <Select onValueChange={(v) => setValue("turno", v)}>
                <SelectTrigger><SelectValue placeholder="Turno" /></SelectTrigger>
                <SelectContent>
                  {["1º Turno", "2º Turno", "3º Turno", "Outro"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Data e hora */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data do Desvio *</Label>
              <Input type="date" {...register("data_desvio", { required: true })} />
            </div>
            <div className="space-y-1">
              <Label>Hora (opcional)</Label>
              <Input type="time" {...register("hora_desvio")} />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1">
            <Label>Descrição do Desvio *</Label>
            <Textarea
              placeholder="Descreva detalhadamente o desvio observado..."
              rows={3}
              {...register("descricao", { required: true })}
            />
          </div>

          <div className="space-y-1">
            <Label>Causa Provável</Label>
            <Textarea
              placeholder="Qual a possível causa raiz deste desvio?"
              rows={2}
              {...register("causa_provavel")}
            />
          </div>

          {/* Ação imediata */}
          <div className="space-y-1">
            <Label>Ação Imediata Tomada</Label>
            <Textarea
              placeholder="Descreva qualquer ação imediata já tomada no local..."
              rows={2}
              {...register("acao_imediata")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Responsável pela Ação</Label>
              <Input placeholder="Nome do responsável" {...register("acao_imediata_responsavel")} />
            </div>
            <div className="space-y-1">
              <Label>Prazo para Conclusão</Label>
              <Input type="date" {...register("acao_imediata_prazo")} />
            </div>
          </div>

          {/* Reportante */}
          <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Reportante</Label>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Anônimo</Label>
                <Switch
                  checked={anonimo}
                  onCheckedChange={(v) => setValue("reportante_anonimo", v)}
                />
              </div>
            </div>
            {!anonimo && (
              <Input
                placeholder="Nome de quem reportou o desvio"
                {...register("reportante_nome")}
              />
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Registrar Desvio"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
