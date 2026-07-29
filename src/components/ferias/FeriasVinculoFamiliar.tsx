import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Trash2, Loader2, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useTenant } from "@/hooks/useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ColaboradorMin {
  nome_completo: string;
  cpf: string;
}

const GRAU_LABEL: Record<string, string> = {
  conjuge: "Cônjuge",
  pai_mae: "Pai/Mãe",
  filho: "Filho(a)",
  irmao: "Irmão(ã)",
  outro: "Outro",
};

export function FeriasVinculoFamiliar({ colaboradores }: { colaboradores: ColaboradorMin[] }) {
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [cpfA, setCpfA] = useState("");
  const [cpfB, setCpfB] = useState("");
  const [grau, setGrau] = useState("conjuge");

  const comCpf = useMemo(
    () => colaboradores.filter(c => (c.cpf || "").replace(/\D/g, "").length === 11),
    [colaboradores],
  );

  const vinculosQuery = useQuery({
    queryKey: ["ferias-vinculos-lista", tenantId, empresaAtivaId],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = fromTable("ferias_vinculo_familiar").select("*").eq("tenant_id", tenantId);
      if (empresaAtivaId) q = q.eq("empresa_id", empresaAtivaId);
      const { data } = await q.order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const a = comCpf.find(c => c.cpf.replace(/\D/g, "") === cpfA);
      const b = comCpf.find(c => c.cpf.replace(/\D/g, "") === cpfB);
      if (!a || !b) throw new Error("Selecione os dois colaboradores.");
      if (cpfA === cpfB) throw new Error("Um colaborador não pode ser parente de si mesmo.");
      // Normaliza a ordem do par para a constraint única (cpf_a < cpf_b).
      const [x, y] = cpfA < cpfB ? [a, b] : [b, a];
      const { error } = await fromTable("ferias_vinculo_familiar").insert({
        tenant_id: tenantId,
        empresa_id: empresaAtivaId ?? null,
        cpf_a: x.cpf.replace(/\D/g, ""), nome_a: x.nome_completo,
        cpf_b: y.cpf.replace(/\D/g, ""), nome_b: y.nome_completo,
        grau,
        criado_por: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ferias-vinculos-lista"] });
      qc.invalidateQueries({ queryKey: ["ferias-prog-vinculos"] });
      toast.success("Vínculo cadastrado.");
      setAberto(false); setCpfA(""); setCpfB(""); setGrau("conjuge");
    },
    onError: (e) => toast.error("Falha ao cadastrar", {
      description: e instanceof Error ? e.message : String(e),
    }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("ferias_vinculo_familiar").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ferias-vinculos-lista"] });
      qc.invalidateQueries({ queryKey: ["ferias-prog-vinculos"] });
      toast.success("Vínculo removido.");
    },
  });

  const vinculos = vinculosQuery.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" />
              Vínculo familiar
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Familiares no mesmo estabelecimento podem gozar férias no mesmo período (art. 136,
              §1º). Cadastre os vínculos para o sistema sugerir períodos coincidentes na programação.
            </p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setAberto(true)}>
            <Plus className="h-4 w-4" /> Novo vínculo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {vinculosQuery.isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : vinculos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Heart className="h-7 w-7 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum vínculo cadastrado.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {vinculos.map((v: Record<string, unknown>) => (
              <div key={String(v.id)} className="flex items-center gap-3 rounded-lg border p-2.5">
                <div className="flex-1 text-sm">
                  <span className="font-medium">{String(v.nome_a)}</span>
                  <span className="text-muted-foreground mx-2">e</span>
                  <span className="font-medium">{String(v.nome_b)}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {GRAU_LABEL[String(v.grau)] ?? String(v.grau)}
                </Badge>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500"
                  onClick={() => remover.mutate(String(v.id))} disabled={remover.isPending}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo vínculo familiar</DialogTitle>
            <DialogDescription>Relacione dois colaboradores da mesma empresa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <SelectColaborador label="Colaborador" valor={cpfA} onChange={setCpfA} lista={comCpf} exceto={cpfB} />
            <SelectColaborador label="Familiar" valor={cpfB} onChange={setCpfB} lista={comCpf} exceto={cpfA} />
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Grau de parentesco</label>
              <Select value={grau} onValueChange={setGrau}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(GRAU_LABEL).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !cpfA || !cpfB} className="gap-2">
              {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SelectColaborador({ label, valor, onChange, lista, exceto }: {
  label: string; valor: string; onChange: (v: string) => void;
  lista: ColaboradorMin[]; exceto: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Select value={valor} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
        <SelectContent>
          {lista.filter(c => c.cpf.replace(/\D/g, "") !== exceto).map(c => (
            <SelectItem key={c.cpf} value={c.cpf.replace(/\D/g, "")}>{c.nome_completo}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
