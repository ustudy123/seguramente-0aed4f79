import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronDown, 
  ChevronRight,
  Users,
  Armchair,
  Monitor,
  Thermometer,
  Package,
  FileSearch,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
  MoreHorizontal,
  Eye,
  Edit,
  FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CATEGORIA_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  type ItemNR17,
  type ErgonomiaCategoria,
  type ErgonomiaStatus
} from "@/types/ergonomia";

const CATEGORIA_ICONS: Record<ErgonomiaCategoria, React.ElementType> = {
  organizacao_trabalho: Users,
  mobiliario: Armchair,
  equipamentos: Monitor,
  condicoes_ambientais: Thermometer,
  levantamento_cargas: Package,
  aet: FileSearch,
};

const STATUS_ICONS: Record<ErgonomiaStatus, React.ElementType> = {
  atendido: CheckCircle2,
  parcial: AlertTriangle,
  nao_atendido: XCircle,
  nao_aplicavel: MinusCircle,
};

interface CategoriaCardProps {
  categoria: ErgonomiaCategoria;
  itens: ItemNR17[];
  onUpdateStatus: (id: string, status: ErgonomiaStatus) => void;
  onViewItem: (item: ItemNR17) => void;
}

export function CategoriaCard({ categoria, itens, onUpdateStatus, onViewItem }: CategoriaCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const Icon = CATEGORIA_ICONS[categoria];
  
  // Calcular estatísticas da categoria
  const stats = {
    atendidos: itens.filter(i => i.status === 'atendido').length,
    parciais: itens.filter(i => i.status === 'parcial').length,
    naoAtendidos: itens.filter(i => i.status === 'nao_atendido').length,
    naoAplicaveis: itens.filter(i => i.status === 'nao_aplicavel').length,
  };
  
  const total = itens.length;
  const aplicaveis = total - stats.naoAplicaveis;
  const percentual = aplicaveis > 0 
    ? Math.round(((stats.atendidos + stats.parciais * 0.5) / aplicaveis) * 100) 
    : 0;

  const getProgressColor = () => {
    if (percentual >= 80) return "bg-success";
    if (percentual >= 50) return "bg-warning";
    return "bg-destructive";
  };

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader 
        className="cursor-pointer hover:bg-muted/30 transition-colors pb-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                {CATEGORIA_LABELS[categoria]}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {total} itens normativos
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Mini stats */}
            <div className="hidden md:flex items-center gap-2">
              <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                {stats.atendidos}
              </Badge>
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                {stats.parciais}
              </Badge>
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                {stats.naoAtendidos}
              </Badge>
            </div>
            
            {/* Percentual */}
            <div className="flex items-center gap-2 min-w-[100px]">
              <Progress value={percentual} className={`h-2 flex-1 ${getProgressColor()}`} />
              <span className="text-sm font-medium w-10 text-right">{percentual}%</span>
            </div>
            
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-0 pb-4">
              <div className="border-t border-border/50 pt-4 space-y-2">
                {itens.map((item) => {
                  const StatusIcon = STATUS_ICONS[item.status];
                  
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <StatusIcon className={`h-4 w-4 flex-shrink-0 ${
                          item.status === 'atendido' ? 'text-success' :
                          item.status === 'parcial' ? 'text-warning' :
                          item.status === 'nao_atendido' ? 'text-destructive' :
                          'text-muted-foreground'
                        }`} />
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              {item.codigo}
                            </span>
                            <span className="text-sm font-medium truncate">
                              {item.titulo}
                            </span>
                          </div>
                          {item.descricao && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {item.descricao}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${STATUS_COLORS[item.status]}`}
                        >
                          {STATUS_LABELS[item.status]}
                        </Badge>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewItem(item)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUpdateStatus(item.id, 'atendido')}>
                              <CheckCircle2 className="h-4 w-4 mr-2 text-success" />
                              Marcar como Atendido
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUpdateStatus(item.id, 'parcial')}>
                              <AlertTriangle className="h-4 w-4 mr-2 text-warning" />
                              Marcar como Parcial
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUpdateStatus(item.id, 'nao_atendido')}>
                              <XCircle className="h-4 w-4 mr-2 text-destructive" />
                              Marcar como Não Atendido
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUpdateStatus(item.id, 'nao_aplicavel')}>
                              <MinusCircle className="h-4 w-4 mr-2" />
                              Marcar como N/A
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
