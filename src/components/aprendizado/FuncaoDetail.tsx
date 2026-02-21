import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Brain, Shield, FileText } from "lucide-react";
import { AtividadesSection } from "./AtividadesSection";
import { CompetenciasSection } from "./CompetenciasSection";
import { EpisSection } from "./EpisSection";
import { EvidenciasSection } from "./EvidenciasSection";
import { Badge } from "@/components/ui/badge";

interface Cargo {
  id: string;
  nome: string;
  nivel: string | null;
  descricao: string | null;
}

interface FuncaoDetailProps {
  cargo: Cargo;
}

export function FuncaoDetail({ cargo }: FuncaoDetailProps) {
  const nivelLabel: Record<string, string> = {
    operacional: "Operacional",
    tatico: "Tático",
    estrategico: "Estratégico",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-foreground">{cargo.nome}</h2>
        {cargo.nivel && (
          <Badge variant="outline">{nivelLabel[cargo.nivel] || cargo.nivel}</Badge>
        )}
      </div>
      {cargo.descricao && (
        <p className="text-sm text-muted-foreground">{cargo.descricao}</p>
      )}

      <Tabs defaultValue="atividades">
        <TabsList className="flex-wrap">
          <TabsTrigger value="atividades" className="gap-1">
            <ClipboardList className="w-4 h-4" /> Atividades
          </TabsTrigger>
          <TabsTrigger value="competencias" className="gap-1">
            <Brain className="w-4 h-4" /> Competências
          </TabsTrigger>
          <TabsTrigger value="epis" className="gap-1">
            <Shield className="w-4 h-4" /> EPIs & Treinamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="atividades" className="mt-4">
          <AtividadesSection cargoId={cargo.id} funcaoNome={cargo.nome} nivel={cargo.nivel || undefined} />
        </TabsContent>
        <TabsContent value="competencias" className="mt-4">
          <CompetenciasSection cargoId={cargo.id} />
        </TabsContent>
        <TabsContent value="epis" className="mt-4">
          <EpisSection cargoId={cargo.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
