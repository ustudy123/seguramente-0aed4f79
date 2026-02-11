import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LucideIcon } from "lucide-react";

interface DetailItem {
  cargo: string;
  detalhe: string;
  extra?: string;
}

interface IndicadorDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon: LucideIcon;
  color: string;
  total: number;
  items: DetailItem[];
  columns: { label: string; key: keyof DetailItem }[];
}

export function IndicadorDetailModal({
  open,
  onOpenChange,
  title,
  icon: Icon,
  color,
  total,
  items,
  columns,
}: IndicadorDetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${color}`} />
            {title}
            <Badge variant="secondary" className="ml-2">{total}</Badge>
          </DialogTitle>
        </DialogHeader>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum registro encontrado.
          </p>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col.key}>{col.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell key={col.key} className="text-sm">
                        {item[col.key] || "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
