import { motion } from "framer-motion";
import { Info, Server, Clock, Tag, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PROJETO_PRODUCAO = "diayjpsrcerycycyaxst";

const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string) || "";
const isProducao = projectId === PROJETO_PRODUCAO;

const g = globalThis as unknown as { __APP_VERSION__?: string; __APP_BUILD_TIME__?: string };
const versao = g.__APP_VERSION__ ?? "1.0.0";
const buildTime = g.__APP_BUILD_TIME__ ?? "";

function formatarDataHora(iso: string): string {
  if (!iso) return "Não disponível";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Não disponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

interface LinhaProps {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}

const Linha = ({ icon: Icon, label, children }: LinhaProps) => (
  <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="w-4 h-4" />
      <span className="text-sm">{label}</span>
    </div>
    <div className="text-sm font-medium text-foreground text-right">{children}</div>
  </div>
);

export default function SobreSistema() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sobre o Sistema</h1>
        <p className="text-muted-foreground">
          Informações da versão em execução neste navegador
        </p>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="w-4 h-4 text-primary" />
              YourEyes — Plataforma de Gestão de Pessoas e SST
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Linha icon={Tag} label="Versão">
              {versao}
            </Linha>
            <Linha icon={Server} label="Ambiente">
              <Badge variant={isProducao ? "default" : "secondary"}>
                {isProducao ? "Produção" : "Homologação"}
              </Badge>
            </Linha>
            <Linha icon={Clock} label="Última publicação">
              {formatarDataHora(buildTime)}
            </Linha>
            <Linha icon={Database} label="Base de dados">
              <span className="font-mono text-xs">{projectId || "não identificada"}</span>
            </Linha>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
