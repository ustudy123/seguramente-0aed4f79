import { useState, useEffect } from "react";
import { Shield, ShieldCheck, ShieldAlert, Zap, Mountain, Box, FlaskConical, Volume2, Moon, Thermometer, Radio, Cog, Flame, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Cargo } from "@/hooks/useCadastros";
import type { EpiTipo } from "@/types/epi";
import type { CET, FuncaoEpi, FuncaoCet } from "@/hooks/useMatrizEpi";

const ICONE_MAP: Record<string, React.ElementType> = {
  mountain: Mountain,
  box: Box,
  zap: Zap,
  "flask-conical": FlaskConical,
  "volume-2": Volume2,
  moon: Moon,
  thermometer: Thermometer,
  radio: Radio,
  cog: Cog,
  flame: Flame,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cargo: Cargo | null;
  epiTipos: EpiTipo[];
  cets: CET[];
  funcaoEpis: FuncaoEpi[];
  funcaoCets: FuncaoCet[];
  onSave: (data: {
    cargoId: string;
    episIds: string[];
    episComplementaresIds: string[];
    cetIds: string[];
  }) => Promise<void>;
  isSaving: boolean;
}

export function MatrizEpiConfig({
  open,
  onOpenChange,
  cargo,
  epiTipos,
  cets,
  funcaoEpis,
  funcaoCets,
  onSave,
  isSaving,
}: Props) {
  const [episObrigatorios, setEpisObrigatorios] = useState<string[]>([]);
  const [episComplementares, setEpisComplementares] = useState<string[]>([]);
  const [cetsSelected, setCetsSelected] = useState<string[]>([]);

  useEffect(() => {
    if (cargo) {
      const cargoEpis = funcaoEpis.filter((fe) => fe.cargo_id === cargo.id);
      setEpisObrigatorios(cargoEpis.filter((e) => e.obrigatorio).map((e) => e.epi_tipo_id));
      setEpisComplementares(cargoEpis.filter((e) => !e.obrigatorio).map((e) => e.epi_tipo_id));
      setCetsSelected(funcaoCets.filter((fc) => fc.cargo_id === cargo.id).map((fc) => fc.cet_id));
    }
  }, [cargo, funcaoEpis, funcaoCets]);

  const toggleEpiObrigatorio = (id: string) => {
    setEpisObrigatorios((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    // Remove from complementar if it was there
    setEpisComplementares((prev) => prev.filter((x) => x !== id));
  };

  const toggleEpiComplementar = (id: string) => {
    setEpisComplementares((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    // Remove from obrigatorio if it was there
    setEpisObrigatorios((prev) => prev.filter((x) => x !== id));
  };

  const toggleCet = (id: string) => {
    setCetsSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!cargo) return;
    await onSave({
      cargoId: cargo.id,
      episIds: episObrigatorios,
      episComplementaresIds: episComplementares,
      cetIds: cetsSelected,
    });
    onOpenChange(false);
  };

  // Group EPI tipos by category
  const categorias = epiTipos.reduce<Record<string, EpiTipo[]>>((acc, tipo) => {
    const cat = tipo.categoria || "Outros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tipo);
    return acc;
  }, {});

  const totalVinculados = episObrigatorios.length + episComplementares.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Matriz de Proteção — {cargo?.nome}
          </DialogTitle>
          <DialogDescription>
            Vincule EPIs obrigatórios/complementares e Condições Especiais de Trabalho (CET)
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="epis" className="mt-2 flex-1 min-h-0 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="epis" className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              EPIs ({totalVinculados})
            </TabsTrigger>
            <TabsTrigger value="cets" className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              CETs ({cetsSelected.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="epis" className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full max-h-[50vh] pr-4">
              {Object.entries(categorias).sort(([a], [b]) => a.localeCompare(b)).map(([cat, tipos]) => (
                <div key={cat} className="mb-4">
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">{cat}</h4>
                  <div className="space-y-2">
                    {tipos.filter((t) => t.is_active !== false).map((tipo) => {
                      const isObrig = episObrigatorios.includes(tipo.id);
                      const isCompl = episComplementares.includes(tipo.id);
                      return (
                        <div
                          key={tipo.id}
                          className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1">
                            <span className="text-sm font-medium">{tipo.nome}</span>
                            {tipo.ca_numero && (
                              <span className="text-xs text-muted-foreground ml-2">
                                CA: {tipo.ca_numero}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-3">
                            <div className="flex items-center gap-1.5">
                              <Checkbox
                                id={`obrig-${tipo.id}`}
                                checked={isObrig}
                                onCheckedChange={() => toggleEpiObrigatorio(tipo.id)}
                              />
                              <Label htmlFor={`obrig-${tipo.id}`} className="text-xs cursor-pointer">
                                Obrigatório
                              </Label>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Checkbox
                                id={`compl-${tipo.id}`}
                                checked={isCompl}
                                onCheckedChange={() => toggleEpiComplementar(tipo.id)}
                              />
                              <Label htmlFor={`compl-${tipo.id}`} className="text-xs cursor-pointer">
                                Complementar
                              </Label>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Separator className="mt-3" />
                </div>
              ))}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="cets" className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full max-h-[50vh] pr-4">
              <div className="space-y-2">
                {cets.filter((c) => c.ativo).map((cet) => {
                  const Icone = ICONE_MAP[cet.icone || ""] || Shield;
                  const isSelected = cetsSelected.includes(cet.id);
                  return (
                    <div
                      key={cet.id}
                      onClick={() => toggleCet(cet.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "bg-card hover:bg-muted/50"
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        <Icone className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{cet.nome}</span>
                          {cet.norma_regulamentadora && (
                            <Badge variant="outline" className="text-xs">
                              {cet.norma_regulamentadora}
                            </Badge>
                          )}
                        </div>
                        {cet.descricao && (
                          <p className="text-xs text-muted-foreground mt-0.5">{cet.descricao}</p>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar Matriz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
