import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { Fase, Cliente, Documento } from './types';
import { FASES } from './constants';

export function FaseBadge({ fase }: { fase: Fase }) {
  const cfg = FASES.find(f => f.value === fase)!;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>;
}

export function DocStatusIcon({ status }: { status: Documento['status'] }) {
  if (status === 'aceito')   return <CheckCircle2 className="w-4 h-4 text-primary" />;
  if (status === 'recusado') return <XCircle className="w-4 h-4 text-destructive" />;
  if (status === 'enviado')  return <Clock className="w-4 h-4 text-accent-foreground" />;
  return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
}

export function KanbanCard({
  cliente,
  onOpen,
  faseAtual,
}: {
  cliente: Cliente;
  onOpen: () => void;
  faseAtual: Fase;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/cliente-id', cliente.id);
        e.dataTransfer.effectAllowed = 'move';
        (e.currentTarget as HTMLElement).style.opacity = '0.5';
      }}
      onDragEnd={(e) => {
        (e.currentTarget as HTMLElement).style.opacity = '1';
      }}
      className="bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-all space-y-2 cursor-grab active:cursor-grabbing"
    >
      <div className="cursor-pointer" onClick={onOpen}>
        <div className="flex items-center justify-between gap-1">
          <p className="font-semibold text-sm leading-tight truncate">{cliente.nome_empresa}</p>
          <span className={`text-xs shrink-0 ${cliente.tipo_cliente === 'pagante' ? 'text-primary' : 'text-muted-foreground'}`}>
            {cliente.tipo_cliente === 'pagante' ? '💼' : '🧪'}
          </span>
        </div>
        {cliente.poc_nome && (
          <p className="text-xs text-muted-foreground mt-0.5">{cliente.poc_nome}</p>
        )}
        {cliente.segmento && (
          <p className="text-xs text-muted-foreground">{cliente.segmento}</p>
        )}
        {cliente.data_inicio_piloto && (
          <p className="text-xs text-muted-foreground mt-1">
            Início: {format(new Date(cliente.data_inicio_piloto), 'dd/MM/yyyy')}
          </p>
        )}
      </div>
    </div>
  );
}
