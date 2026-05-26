import { useEffect, useMemo, useState } from "react";
import { Building2, Check, LogOut, Search } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { EmpresaCadastro } from "@/types/empresa";

// Grace period (ms) antes de exibir a tela de "Acesso Restrito".
// Evita o flash quando os dados de vínculo/empresa ainda estão estabilizando
// logo após o login (race entre auth, usuario_base e queries).
const SEM_VINCULOS_GRACE_MS = 1500;

const formatCnpj = (cnpj: string | null) => {
  if (!cnpj) return "";
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return cnpj;
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
};

/**
 * Tela de seleção obrigatória de empresa para usuários profissionais.
 * Exibida como overlay bloqueante quando:
 * - O usuário é profissional (consultor, clínica, auditor, etc.)
 * - Ainda não selecionou uma empresa
 * - Tem 2+ vínculos (com 1 vínculo, seleciona automaticamente)
 */
export function EmpresaSelecaoObrigatoria() {
  const { empresas, empresaAtiva, setEmpresaAtiva, isProfissional, semVinculos, isLoading } = useEmpresaAtiva();
  const { loading: authLoading, user } = useAuth();
  const [selected, setSelected] = useState<EmpresaCadastro | null>(null);
  const [busca, setBusca] = useState("");

  const empresasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return empresas;
    const qDigits = q.replace(/\D/g, "");
    return empresas.filter((e) => {
      const nome = `${e.razao_social ?? ""} ${e.nome_fantasia ?? ""}`.toLowerCase();
      const cnpjDigits = (e.cnpj ?? "").replace(/\D/g, "");
      return nome.includes(q) || (qDigits && cnpjDigits.includes(qDigits));
    });
  }, [empresas, busca]);

  // Debounce do "semVinculos" para evitar flash da tela de Acesso Restrito
  // enquanto auth/usuario_base/empresas ainda estão sincronizando após login.
  const [semVinculosConfirmado, setSemVinculosConfirmado] = useState(false);
  useEffect(() => {
    if (!semVinculos || authLoading || isLoading) {
      setSemVinculosConfirmado(false);
      return;
    }
    const t = setTimeout(() => setSemVinculosConfirmado(true), SEM_VINCULOS_GRACE_MS);
    return () => clearTimeout(t);
  }, [semVinculos, authLoading, isLoading]);

  // Não mostrar se ainda não temos usuário ou auth carregando
  if (!user || authLoading) return null;

  // Não mostrar para não-profissionais
  if (!isProfissional) return null;

  // Não mostrar durante loading dos dados de empresas/vínculos
  if (isLoading) return null;

  // Profissional sem vínculos — só mostra após o grace period confirmar
  if (semVinculos) {
    if (!semVinculosConfirmado) return null;
    return (
      <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Building2 className="w-12 h-12 mx-auto text-destructive mb-2" />
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription>
              Nenhuma empresa vinculada à sua conta. Entre em contato com o administrador para receber acesso.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => window.location.href = "/login"}>
              <LogOut className="w-4 h-4 mr-2" /> Voltar ao Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se já tem empresa ativa selecionada, não bloquear
  if (empresaAtiva) return null;

  // Se tem apenas 1 empresa, auto-selecionar (o context já faz isso)
  if (empresas.length <= 1) return null;

  // Tela de seleção para profissionais com 2+ vínculos
  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg"
      >
        <Card>
          <CardHeader className="text-center">
            <Building2 className="w-10 h-10 mx-auto text-primary mb-2" />
            <CardTitle>Selecione a Empresa</CardTitle>
            <CardDescription>
              Escolha com qual empresa deseja trabalhar nesta sessão. Você poderá trocar depois pelo seletor no cabeçalho.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {empresas.map((empresa, i) => (
                <motion.div
                  key={empresa.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <button
                    onClick={() => setSelected(empresa)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border-2 transition-all",
                      selected?.id === empresa.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/30 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        selected?.id === empresa.id ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        {selected?.id === empresa.id
                          ? <Check className="w-4 h-4" />
                          : <Building2 className="w-4 h-4 text-muted-foreground" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {empresa.razao_social || empresa.nome_fantasia || "Sem nome"}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                            {empresa.tipo_unidade === "matriz" ? "Matriz" : "Filial"}
                          </Badge>
                        </div>
                        {empresa.cnpj && (
                          <span className="text-xs text-muted-foreground">{formatCnpj(empresa.cnpj)}</span>
                        )}
                      </div>
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!selected}
              onClick={() => {
                if (selected) setEmpresaAtiva(selected);
              }}
            >
              {selected ? `Acessar ${selected.nome_fantasia || selected.razao_social}` : "Selecione uma empresa"}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
