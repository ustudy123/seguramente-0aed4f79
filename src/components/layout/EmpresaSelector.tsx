import { useState } from "react";
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

export const EmpresaSelector = () => {
  const [open, setOpen] = useState(false);
  const { empresaAtiva, setEmpresaAtiva, empresas, isLoading, isProfissional, semVinculos } = useEmpresaAtiva();
  const { tenant } = useTenant();

  if (isLoading) {
    return (
      <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="w-4 h-4" />
        <span>Carregando...</span>
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="hidden md:flex items-center gap-2 max-w-[280px] justify-between border-border/50 hover:bg-muted/50 text-foreground">

          <Building2 className="w-4 h-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium text-secondary-foreground">
            {empresaAtiva?.razao_social || empresaAtiva?.nome_fantasia || "Todas as empresas"}
          </span>
          <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 z-50 bg-popover" align="start">
        <Command>
          <CommandInput placeholder="Buscar empresa..." />
          <CommandList>
            <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
            {/* Profissionais não podem ver "Todas as empresas" */}
            {!isProfissional && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setEmpresaAtiva(null);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2">
                  <Check
                    className={cn(
                      "w-4 h-4 shrink-0",
                      !empresaAtiva ? "opacity-100" : "opacity-0"
                    )} />
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Todas as empresas</span>
                </CommandItem>
              </CommandGroup>
            )}
            {!isProfissional && <CommandSeparator />}
            <CommandGroup heading="Empresas">
              {empresas.map((empresa) =>
              <CommandItem
                key={empresa.id}
                value={`${empresa.razao_social} ${empresa.nome_fantasia} ${empresa.cnpj}`}
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
                      </span>
                      <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 shrink-0">

                        {empresa.tipo_unidade === "matriz" ? "Matriz" : "Filial"}
                      </Badge>
                    </div>
                    {empresa.cnpj &&
                  <span className="text-xs text-muted-foreground">
                        {formatCnpj(empresa.cnpj)}
                      </span>
                  }
                  </div>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>);

};