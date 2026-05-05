import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, ListChecks, History, Target } from "lucide-react";
import { AemForm } from "./AemForm";
import { MetaAcoesPanel } from "./MetaAcoesPanel";
import { MetaTimeline } from "./MetaTimeline";
import { IermBadge } from "./IermBadge";
import type { Meta, MetaStatus } from "@/types/avaliacao";
import { STATUS_META_LABELS, PERIODO_LABELS } from "@/types/avaliacao";
import { CATEGORIA_META_LABELS, type CategoriaMetaMEA, type IermNivel } from "@/types/mea";

interface MetaDetailDialogProps {
  meta: Meta & { categoria_meta?: string; ierm_score?: number; ierm_nivel?: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MetaDetailDialog({ meta, open, onOpenChange }: MetaDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <DialogTitle className="text-xl">{meta.titulo}</DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">
                  {PERIODO_LABELS[meta.periodo]} {meta.ano}
                  {meta.trimestre && ` ${meta.trimestre}º Trimestre`}
                </Badge>
                <Badge variant="secondary">
                  {CATEGORIA_META_LABELS[(meta.categoria_meta as CategoriaMetaMEA) || "operacional"]}
                </Badge>
                <Badge>{STATUS_META_LABELS[meta.status]}</Badge>
                {(meta.ierm_score !== undefined && meta.ierm_score > 0) && (
                  <IermBadge 
                    score={meta.ierm_score} 
                    nivel={(meta.ierm_nivel as IermNivel) || "segura"} 
                    compact 
                  />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">{meta.progresso}%</span>
                </div>
                <Progress value={meta.progresso} className="h-2" />
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="acoes" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6">
              <TabsTrigger value="acoes" className="gap-1.5">
                <ListChecks className="h-4 w-4" />
                Ações
              </TabsTrigger>
              <TabsTrigger value="aem" className="gap-1.5">
                <Shield className="h-4 w-4" />
                Análise Ergonômica
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5">
                <History className="h-4 w-4" />
                Histórico
              </TabsTrigger>
            </TabsList>

            <div className="px-6 py-4">
              <TabsContent value="acoes" className="mt-0">
                <MetaAcoesPanel metaId={meta.id} />
              </TabsContent>
              <TabsContent value="aem" className="mt-0">
                <AemForm metaId={meta.id} />
              </TabsContent>
              <TabsContent value="timeline" className="mt-0">
                <MetaTimeline metaId={meta.id} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
