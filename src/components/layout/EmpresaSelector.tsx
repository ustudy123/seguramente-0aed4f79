import { useState } from "react";
import { Shield } from "lucide-react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import {
  Popover,
  PopoverContent,
  PopoverTrigger } from
"@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator } from
"@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";

const formatCnpj = (cnpj: string | null) => {
  if (!cnpj) return "";
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return cnpj;
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
};

const formatCpf = (cpf: string | null | undefined) => {
  if (!cpf) return "";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
};

const formatDoc = (empresa: { cnpj?: string | null; cpf?: string | null }) => {
  if (empresa.cnpj) return formatCnpj(empresa.cnpj);
  if (empresa.cpf) return `CPF ${formatCpf(empresa.cpf)}`;
  return "";
};

export const EmpresaSelector = () => {
  const [open, setOpen] = useState(false);
  const { empresaAtiva, setEmpresaAtiva, empresas, isLoading, initialized, isProfissional, semVinculos } = useEmpresaAtiva();
  const { tenant } = useTenant();

  if (isLoading || !initialized) {
    return (
      <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="w-4 h-4" />
        <span>Sincronizando empresas</span>
      </div>);

  }

  // Profissional sem vínculos: mensagem de erro
  if (semVinculos) {
    return (
      <div className="hidden md:flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-1.5">
        <Building2 className="w-4 h-4" />
        <span className="text-xs font-medium">Nenhuma empresa vinculada — contate o administrador</span>
      </div>
    );
  }

  // Fallback: show tenant name when no companies registered
  if (empresas.length === 0) {
    return (
      <div className="hidden md:flex items-center gap-2 text-sm">
        <Building2 className="w-4 h-4 text-primary" />
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Empresa</p>
          <p className="text-sm font-medium">{tenant?.nome || "—"}</p>
        </div>
      </div>);
  }

  // Quando há apenas 1 empresa vinculada, exibir somente o nome (sem seletor)
  if (empresas.length === 1) {
    const unica = empresaAtiva || empresas[0];
    return (
      <div
        className={cn(
          "hidden md:flex items-center gap-2 max-w-[320px] rounded-md border px-3 py-1.5 text-sm bg-white",
          isProfissional ? "border-amber-400/50" : "border-border/50"
        )}
      >
        {isProfissional && <Shield className="w-3.5 h-3.5 shrink-0 text-amber-500" />}
        <Building2 className="w-4 h-4 shrink-0 text-primary" />
        <span className="truncate text-sm font-semibold text-slate-900">
          {unica.razao_social || unica.nome_fantasia || "Empresa"}
        </span>
        {isProfissional && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 border-amber-400/50 text-amber-600 bg-amber-50">
            Vinculado
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "hidden md:flex items-center gap-2 max-w-[320px] justify-between bg-white hover:bg-white border-border/50 text-slate-900",
            isProfissional && "border-amber-400/50"
          )}>

          {isProfissional && <Shield className="w-3.5 h-3.5 shrink-0 text-amber-500" />}
          <Building2 className="w-4 h-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold text-slate-900">
            {empresaAtiva?.razao_social || empresaAtiva?.nome_fantasia || "Selecionar empresa"}
          </span>
          {isProfissional && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 border-amber-400/50 text-amber-600 bg-amber-50">
              Vinculado
            </Badge>
          )}
          <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 text-slate-600 opacity-80" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 z-50 bg-popover" align="start">
        <Command>
          <CommandInput placeholder="Buscar empresa..." />
          <CommandList>
            <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
            <CommandGroup heading="Empresas">
              {empresas.map((empresa) => {
                // Detecta empresas duplicadas (mesma razão + CNPJ) para exibir sufixo do ID
                const dup = empresas.filter(
                  (x) => x.razao_social === empresa.razao_social && x.cnpj === empresa.cnpj
                ).length > 1;
                return (
              <CommandItem
                key={empresa.id}
                // O id fica no FIM do value (apenas para unicidade). No início ele
                // poluía o fuzzy-score do cmdk (hex do UUID gerava matches falsos e
                // escondia o resultado real). Texto pesquisável vem primeiro.
                value={`${empresa.razao_social ?? ''} ${empresa.nome_fantasia ?? ''} ${empresa.cnpj ?? ''} ${(empresa.cnpj ?? '').replace(/\D/g,'')} ${empresa.cpf ?? ''} ${(empresa.cpf ?? '').replace(/\D/g,'')} ${empresa.id}`}
                onSelect={() => {
                  setEmpresaAtiva(empresa);
                  setOpen(false);
                }}
                className="flex items-center gap-2">

                  <Check
                  className={cn(
                    "w-4 h-4 shrink-0",
                    empresaAtiva?.id === empresa.id ? "opacity-100" : "opacity-0"
                  )} />

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {empresa.razao_social || empresa.nome_fantasia || "Sem nome"}
                        {dup && (
                          <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                            #{empresa.id.slice(0, 6)}
                          </span>
                        )}
                      </span>
                      <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 shrink-0">

                        {empresa.tipo_unidade === "matriz" ? "Matriz" : "Filial"}
                      </Badge>
                    </div>
                    {(empresa.cnpj || empresa.cpf) &&
                  <span className="text-xs text-muted-foreground">
                        {formatDoc(empresa)}
                      </span>
                  }
                  </div>
                </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>);

};