import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Building2, MapPin, Calendar, User, Plus, X, Copy,
  ChevronsUpDown, Check, Briefcase, AlertTriangle
} from "lucide-react";
import { useDepartamentos, useCargos } from "@/hooks/useCadastros";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { AEPEmpresaInfo, SituacaoTrabalho } from "@/types/aep-multi";
import { formatCnpj, cleanCnpj } from "@/lib/brasilapi";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface AEPConfigInicialProps {
  empresa: AEPEmpresaInfo;
  situacoes: SituacaoTrabalho[];
  onUpdateEmpresa: (updates: Partial<AEPEmpresaInfo>) => void;
  onAddSituacao: (s: Omit<SituacaoTrabalho, 'id'>) => void;
  onRemoveSituacao: (id: string) => void;
  onDuplicateSituacao: (id: string) => void;
  onUpdateSituacao: (id: string, updates: Partial<Omit<SituacaoTrabalho, 'id'>>) => void;
}

export function AEPConfigInicial({
  empresa,
  situacoes,
  onUpdateEmpresa,
  onAddSituacao,
  onRemoveSituacao,
  onDuplicateSituacao,
  onUpdateSituacao,
}: AEPConfigInicialProps) {
  const { empresaAtiva } = useEmpresaAtiva();
  const { departamentos, isLoading: loadingDepts } = useDepartamentos();
  const { cargos, isLoading: loadingCargos } = useCargos();

  // Auto-fill empresa data
  useEffect(() => {
    if (empresaAtiva) {
      const nome = empresaAtiva.nome_fantasia || empresaAtiva.razao_social || "";
      const cnpj = empresaAtiva.cnpj ? formatCnpj(cleanCnpj(empresaAtiva.cnpj)) : "";
      onUpdateEmpresa({ nome, cnpj });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id]);

  // New situação form state
  const [setorOpen, setSetorOpen] = useState(false);
  const [funcaoOpen, setFuncaoOpen] = useState(false);
  const [newSetorId, setNewSetorId] = useState("");
  const [newSetorNome, setNewSetorNome] = useState("");
  const [newFuncaoId, setNewFuncaoId] = useState("");
  const [newFuncaoNome, setNewFuncaoNome] = useState("");

  const departamentosAtivos = useMemo(
    () => departamentos.filter((d) => d.ativo),
    [departamentos]
  );

  const funcoesFiltradas = useMemo(() => {
    if (!newSetorId) return [];
    return cargos.filter(
      (c) => c.ativo !== false && (c as any).departamento_id === newSetorId
    );
  }, [cargos, newSetorId]);

  const handleAddSituacao = () => {
    if (!newSetorId || !newFuncaoId) return;
    // Avoid duplicates
    const exists = situacoes.some(
      (s) => s.setorId === newSetorId && s.funcaoId === newFuncaoId
    );
    if (exists) return;
    onAddSituacao({
      setorId: newSetorId,
      setorNome: newSetorNome,
      funcaoId: newFuncaoId,
      funcaoNome: newFuncaoNome,
    });
    setNewSetorId("");
    setNewSetorNome("");
    setNewFuncaoId("");
    setNewFuncaoNome("");
  };

  const canAdd = !!newSetorId && !!newFuncaoId &&
    !situacoes.some((s) => s.setorId === newSetorId && s.funcaoId === newFuncaoId);

  return (
    <div className="space-y-6">
      {/* Dados da Empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Identificação da Empresa
          </CardTitle>
          <CardDescription>Dados da empresa para o documento AEP</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="empresa">Razão Social *</Label>
            <Input
              id="empresa"
              placeholder="Nome da empresa"
              value={empresa.nome}
              onChange={(e) => onUpdateEmpresa({ nome: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              placeholder="00.000.000/0000-00"
              value={empresa.cnpj}
              maxLength={18}
              onChange={(e) => {
                const cleaned = cleanCnpj(e.target.value);
                if (cleaned.length <= 14) {
                  onUpdateEmpresa({ cnpj: formatCnpj(cleaned) });
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unidade" className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              Unidade / Filial
            </Label>
            <Input
              id="unidade"
              placeholder="Matriz, Filial SP, etc."
              value={empresa.unidade}
              onChange={(e) => onUpdateEmpresa({ unidade: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataAvaliacao" className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Data da Avaliação
            </Label>
            <Input
              id="dataAvaliacao"
              type="date"
              value={empresa.dataAvaliacao}
              onChange={(e) => onUpdateEmpresa({ dataAvaliacao: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsavel" className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              Responsável pelo Levantamento *
            </Label>
            <Input
              id="responsavel"
              placeholder="Nome do avaliador"
              value={empresa.responsavelLevantamento}
              onChange={(e) => onUpdateEmpresa({ responsavelLevantamento: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="validador">Profissional Validador (opcional)</Label>
            <Input
              id="validador"
              placeholder="Ergonomista, Médico do Trabalho, etc."
              value={empresa.profissionalValidador}
              onChange={(e) => onUpdateEmpresa({ profissionalValidador: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Situações de Trabalho */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Situações de Trabalho a Avaliar
          </CardTitle>
          <CardDescription>
            Adicione cada combinação <strong>Setor + Função</strong> que representa uma realidade de trabalho distinta (NR-17)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info box */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Cada situação distinta deve ter sua própria análise. Funções com realidades diferentes
              precisam de AEPs separadas — a consolidação é feita automaticamente no documento final.
            </span>
          </div>

          {/* Formulário para nova situação */}
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end p-4 bg-muted/50 rounded-lg border border-dashed">
            {/* Setor */}
            <div className="space-y-1.5">
              <Label className="text-xs">Setor *</Label>
              <Popover open={setorOpen} onOpenChange={setSetorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal bg-background"
                  >
                    <span className="truncate">
                      {newSetorNome || "Selecionar setor..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar setor..." />
                    <CommandList>
                      <CommandEmpty>
                        {loadingDepts ? "Carregando..." : "Nenhum setor encontrado."}
                      </CommandEmpty>
                      <CommandGroup>
                        {departamentosAtivos.map((dept) => (
                          <CommandItem
                            key={dept.id}
                            value={dept.nome}
                            onSelect={() => {
                              setNewSetorId(dept.id);
                              setNewSetorNome(dept.nome);
                              setNewFuncaoId("");
                              setNewFuncaoNome("");
                              setSetorOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                newSetorId === dept.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {dept.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Função */}
            <div className="space-y-1.5">
              <Label className="text-xs">Cargo *</Label>
              <Popover open={funcaoOpen} onOpenChange={setFuncaoOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    disabled={!newSetorId}
                    className="w-full justify-between font-normal bg-background"
                  >
                    <span className="truncate">
                      {newFuncaoNome || (newSetorId ? "Selecionar função..." : "Selecione o setor primeiro")}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar função..." />
                    <CommandList>
                      <CommandEmpty>
                        {loadingCargos
                          ? "Carregando..."
                          : funcoesFiltradas.length === 0
                          ? "Nenhuma função cadastrada neste setor."
                          : "Nenhuma função encontrada."}
                      </CommandEmpty>
                      <CommandGroup>
                        {funcoesFiltradas.map((cargo) => (
                          <CommandItem
                            key={cargo.id}
                            value={cargo.nome}
                            onSelect={() => {
                              setNewFuncaoId(cargo.id);
                              setNewFuncaoNome(cargo.nome);
                              setFuncaoOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                newFuncaoId === cargo.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {cargo.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Botão adicionar */}
            <Button
              onClick={handleAddSituacao}
              disabled={!canAdd}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>

          {/* Lista de situações adicionadas */}
          {situacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma situação de trabalho adicionada. Adicione pelo menos uma para continuar.
            </p>
          ) : (
            <div className="space-y-2">
              {situacoes.map((sit) => (
                <div
                  key={sit.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {sit.setorNome}
                    </Badge>
                    <span className="text-muted-foreground">›</span>
                    <span className="text-sm font-medium truncate">{sit.funcaoNome}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Duplicar situação"
                      onClick={() => onDuplicateSituacao(sit.id)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onRemoveSituacao(sit.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Resumo */}
          <div className="pt-2 border-t text-sm text-muted-foreground">
            {situacoes.length > 0 ? (
              <span>
                {situacoes.length} situação(ões) de trabalho definida(s) —{" "}
                {new Set(situacoes.map((s) => s.setorId)).size} setor(es),{" "}
                {new Set(situacoes.map((s) => s.funcaoId)).size} função(ões) distinta(s)
              </span>
            ) : (
              <span className="text-warning">
                Adicione pelo menos uma situação de trabalho (Setor + Função) para continuar
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
