import { motion } from "framer-motion";
import { FileSearch, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  onInitialize: () => void;
  isInitializing: boolean;
}

export function EmptyState({ onInitialize, isInitializing }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-center min-h-[400px]"
    >
      <Card className="max-w-md w-full border-dashed border-2">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-6">
            <FileSearch className="w-10 h-10 text-primary" />
          </div>
          
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Módulo de Ergonomia
          </h3>
          
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Configure os itens da NR-17 para começar a gerenciar a conformidade ergonômica da sua empresa.
          </p>
          
          <Button 
            onClick={onInitialize} 
            disabled={isInitializing}
            size="lg"
          >
            {isInitializing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Inicializando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Inicializar Itens NR-17
              </>
            )}
          </Button>
          
          <p className="text-xs text-muted-foreground mt-4">
            Serão criados os itens padrão da NR-17 para avaliação
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
