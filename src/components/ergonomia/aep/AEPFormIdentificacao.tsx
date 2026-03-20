import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Building2, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AEPIdentificacao } from "@/types/aep";
import { formatCnpj, cleanCnpj } from "@/lib/brasilapi";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useDepartamentos, useCargos } from "@/hooks/useCadastros";
import { useEffect } from "react";

interface AEPFormIdentificacaoProps {
  data: AEPIdentificacao;
  onChange: (data: AEPIdentificacao) => void;
}

const TODOS_SETORES = "__todos__";
const TODAS_FUNCOES = "__todas__";

export function AEPFormIdentificacao({ data, onChange }: AEPFormIdentificacaoProps) {
  const { empresaAtiva } = useEmpresaAtiva();
  const { departamentos } = useDepartamentos();
  const { cargos } = useCargos();

  const [setorOpen, setSetorOpen] = useState(false);
  const [funcaoOpen, setFuncaoOpen] = useState(false);

  // Auto-fill empresa and CNPJ from active company on mount / when it changes
  useEffect(() => {
    if (empresaAtiva) {
      const nome = empresaAtiva.nome_fantasia || empresaAtiva.razao_social || "";
      const cnpj = empresaAtiva.cnpj ? formatCnpj(cleanCnpj(empresaAtiva.cnpj)) : "";
      if (data.empresa !== nome || data.cnpj !== cnpj) {
        onChange({ ...data, empresa: nome, cnpj });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id]);

  const handleChange = (field: keyof AEPIdentificacao, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const departamentosAtivos = useMemo(
    () => departamentos.filter((d) => d.ativo),
    [departamentos]
  );

  // Funções filtradas pelo setor selecionado (ou todas)
  const funcoesFiltradas = useMemo(() => {
    const ativas = cargos.filter((c) => c.ativo !== false);
    if (!data.setor || data.setor === TODOS_SETORES) return ativas;
    // match by department name
    return ativas.filter(
      (c) =>
        (c as any).departamento?.nome === data.setor ||
        (c as any).departamento_id ===
          departamentosAtivos.find((d) => d.nome === data.setor)?.id
    );
  }, [cargos, data.setor, departamentosAtivos]);

  // Label displayed for setor
  const setorLabel = useMemo(() => {
    if (!data.setor || data.setor === TODOS_SETORES) return "Todos os setores";
    return data.setor;
  }, [data.setor]);

  // Label displayed for funcao
  const funcaoLabel = useMemo(() => {
    if (!data.funcao || data.funcao === TODAS_FUNCOES) return "Todas as funções";
    return data.funcao;
  }, [data.funcao]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" />
          1. Identificação
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Empresa - auto-filled, read-only */}
        <div className="space-y-2">
          <Label htmlFor="empresa">Empresa *</Label>
          <Input
            id="empresa"
            value={data.empresa}
            onChange={(e) => handleChange("empresa", e.target.value)}
            placeholder="Nome da empresa"
          />
        </div>

        {/* CNPJ - auto-filled, read-only */}
        <div className="space-y-2">
          <Label htmlFor="cnpj">CNPJ *</Label>
          <Input
            id="cnpj"
            value={data.cnpj}
            maxLength={18}
            onChange={(e) => {
              const cleaned = cleanCnpj(e.target.value);
              if (cleaned.length <= 14) handleChange("cnpj", formatCnpj(cleaned));
            }}
            placeholder="00.000.000/0000-00"
          />
        </div>

        {/* Unidade */}
        <div className="space-y-2">
          <Label htmlFor="unidade">Unidade / Local</Label>
          <Input
            id="unidade"
            value={data.unidade}
            onChange={(e) => handleChange("unidade", e.target.value)}
            placeholder="Filial ou unidade"
          />
        </div>

        {/* Setor - searchable combobox */}
        <div className="space-y-2">
          <Label>Setor Avaliado *</Label>
          <Popover open={setorOpen} onOpenChange={setSetorOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={setorOpen}
                className="w-full justify-between font-normal"
              >
                <span className="truncate">{setorLabel}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar setor..." />
                <CommandList>
                  <CommandEmpty>Nenhum setor encontrado.</CommandEmpty>
                  <CommandGroup>
                    {/* Todos os setores */}
                    <CommandItem
                      value={TODOS_SETORES}
                      onSelect={() => {
                        handleChange("setor", TODOS_SETORES);
                        handleChange("funcao", ""); // reset funcao
                        setSetorOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          !data.setor || data.setor === TODOS_SETORES
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      Todos os setores
                    </CommandItem>
                    {departamentosAtivos.map((dept) => (
                      <CommandItem
                        key={dept.id}
                        value={dept.nome}
                        onSelect={() => {
                          handleChange("setor", dept.nome);
                          handleChange("funcao", ""); // reset funcao when setor changes
                          setSetorOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            data.setor === dept.nome ? "opacity-100" : "opacity-0"
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

        {/* Função - searchable combobox filtered by setor */}
        <div className="space-y-2">
          <Label>Função Avaliada *</Label>
          <Popover open={funcaoOpen} onOpenChange={setFuncaoOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={funcaoOpen}
                className="w-full justify-between font-normal"
              >
                <span className="truncate">{funcaoLabel}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar função..." />
                <CommandList>
                  <CommandEmpty>Nenhuma função encontrada.</CommandEmpty>
                  <CommandGroup>
                    {/* Todas as funções */}
                    <CommandItem
                      value={TODAS_FUNCOES}
                      onSelect={() => {
                        handleChange("funcao", TODAS_FUNCOES);
                        setFuncaoOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          !data.funcao || data.funcao === TODAS_FUNCOES
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      Todas as funções
                    </CommandItem>
                    {funcoesFiltradas.map((cargo) => (
                      <CommandItem
                        key={cargo.id}
                        value={cargo.nome}
                        onSelect={(val) => {
                          handleChange("funcao", val);
                          setFuncaoOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            data.funcao === cargo.nome ? "opacity-100" : "opacity-0"
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

        {/* Data da Avaliação */}
        <div className="space-y-2">
          <Label htmlFor="dataAvaliacao">Data da Avaliação *</Label>
          <Input
            id="dataAvaliacao"
            type="date"
            value={data.dataAvaliacao}
            onChange={(e) => handleChange("dataAvaliacao", e.target.value)}
          />
        </div>

        {/* Responsável */}
        <div className="space-y-2">
          <Label htmlFor="responsavelLevantamento">Responsável pelo Levantamento *</Label>
          <Input
            id="responsavelLevantamento"
            value={data.responsavelLevantamento}
            onChange={(e) => handleChange("responsavelLevantamento", e.target.value)}
            placeholder="Nome do responsável"
          />
        </div>

        {/* Profissional Validador */}
        <div className="space-y-2">
          <Label htmlFor="profissionalValidador">Profissional Validador</Label>
          <Input
            id="profissionalValidador"
            value={data.profissionalValidador || ""}
            onChange={(e) => handleChange("profissionalValidador", e.target.value)}
            placeholder="(se houver)"
          />
        </div>

        {/* Versão */}
        <div className="space-y-2">
          <Label htmlFor="versao">Versão do Documento</Label>
          <Input
            id="versao"
            value={data.versao}
            onChange={(e) => handleChange("versao", e.target.value)}
            placeholder="1.0"
          />
        </div>
      </CardContent>
    </Card>
  );
}
