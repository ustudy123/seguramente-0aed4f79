import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, FileText, Calendar, Heart, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAtestados } from "@/hooks/useAtestados";
import { AtestadoStats } from "@/components/atestados/AtestadoStats";
import { AtestadoList } from "@/components/atestados/AtestadoList";
import { AtestadoForm } from "@/components/atestados/AtestadoForm";
import { AtestadoAlertas } from "@/components/atestados/AtestadoAlertas";
import { AfastamentoList } from "@/components/atestados/AfastamentoList";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateBR } from "@/lib/dataLocal";

const Atestados = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("atestados");
  
  const {
    atestados,
    afastamentos,
    beneficiosINSS,
    alertas,
    stats,
    isLoading,
    createAtestado,
    creatingAtestado,
    deleteAtestado,
    deletingAtestado,
    deleteAfastamento,
    deletingAfastamento,
    resolveAlerta,
    getSignedUrl,
  } = useAtestados();

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Gestão de Afastamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerenciamento integrado de afastamentos, licenças e saúde ocupacional
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Novo Afastamento
        </Button>
      </motion.div>

      {/* Stats */}
      <AtestadoStats stats={stats} />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Lists */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="atestados" className="text-xs sm:text-sm">
                <FileText className="h-4 w-4 mr-1 sm:mr-2 hidden sm:inline" />
                Atestados
              </TabsTrigger>
              <TabsTrigger value="afastamentos" className="text-xs sm:text-sm">
                <Calendar className="h-4 w-4 mr-1 sm:mr-2 hidden sm:inline" />
                Afastamentos
              </TabsTrigger>
              <TabsTrigger value="inss" className="text-xs sm:text-sm">
                <Shield className="h-4 w-4 mr-1 sm:mr-2 hidden sm:inline" />
                INSS
              </TabsTrigger>
            </TabsList>

            <TabsContent value="atestados">
              <AtestadoList
                atestados={atestados}
                onDelete={deleteAtestado}
                onDownload={getSignedUrl}
                deleting={deletingAtestado}
              />
            </TabsContent>

            <TabsContent value="afastamentos">
              <AfastamentoList 
                afastamentos={afastamentos} 
                onDelete={deleteAfastamento}
                deleting={deletingAfastamento}
              />
            </TabsContent>

            <TabsContent value="inss">
              <div className="space-y-4">
                {beneficiosINSS.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">Nenhum benefício INSS registrado</h3>
                    <p className="text-muted-foreground mt-1">
                      Benefícios são registrados quando afastamentos excedem 15 dias
                    </p>
                  </div>
                ) : (
                  beneficiosINSS.map((beneficio) => (
                    <motion.div
                      key={beneficio.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 border rounded-lg bg-card"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{beneficio.colaborador_nome}</p>
                          <p className="text-sm text-muted-foreground">
                            {beneficio.especie === 'b31' ? 'B31 - Auxílio Doença' : 'B91 - Acidentário'}
                          </p>
                          {beneficio.numero_beneficio && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Nº {beneficio.numero_beneficio}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {beneficio.gera_estabilidade && beneficio.data_fim_estabilidade && (
                            <p className="text-xs text-primary font-medium">
                              Estabilidade até {formatDateBR(beneficio.data_fim_estabilidade)}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Alerts sidebar */}
        <div className="lg:col-span-1">
          <AtestadoAlertas
            alertas={alertas}
            afastamentos={afastamentos}
            beneficios={beneficiosINSS}
            onResolveAlerta={resolveAlerta}
          />
        </div>
      </div>

      {/* Form modal */}
      <AtestadoForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={createAtestado}
        loading={creatingAtestado}
      />
    </div>
  );
};

export default Atestados;
