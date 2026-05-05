import { useRef, useState, useCallback, useEffect, type ReactNode, type MouseEvent } from "react";
import { ZoomIn, ZoomOut, Maximize2, FileImage, FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface OrgCanvasProps {
  children: ReactNode;
  className?: string;
}

export function OrgCanvas({ children, className }: OrgCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Attach wheel listener as non-passive so preventDefault works
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setScale((prev) => Math.min(2, Math.max(0.3, prev + delta)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    // Pan with any left-click (we stop propagation on buttons/interactive elements)
    if (e.button === 0 || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
    }
  }, [translate]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning) return;
    setTranslate({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const exportAs = async (format: "png" | "pdf") => {
    if (!contentRef.current) return;
    setIsExporting(true);
    const toastId = toast.loading(`Gerando ${format.toUpperCase()}...`);

    try {
      // Temporarily reset zoom and translate for clean capture
      const originalScale = scale;
      const originalTranslate = translate;
      setScale(1);
      setTranslate({ x: 0, y: 0 });

      // Wait for re-render
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(contentRef.current, {
        useCORS: true,
        scale: 2, // High quality
        backgroundColor: "#f8fafc", // matches muted/20 bg
        logging: false,
      });

      // Restore view
      setScale(originalScale);
      setTranslate(originalTranslate);

      if (format === "png") {
        const link = document.createElement("a");
        link.download = `organograma-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else {
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? "l" : "p",
          unit: "px",
          format: [canvas.width / 2, canvas.height / 2]
        });
        pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
        pdf.save(`organograma-${new Date().toISOString().split('T')[0]}.pdf`);
      }

      toast.success(`${format.toUpperCase()} gerado com sucesso!`, { id: toastId });
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao gerar arquivo", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`relative ${className || ""}`}>
      {/* Zoom and Export controls */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-background/90 backdrop-blur-sm border rounded-lg p-1 shadow-sm">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-xs" disabled={isExporting}>
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-primary" />}
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportAs("png")} className="gap-2 cursor-pointer">
              <FileImage className="w-4 h-4 text-muted-foreground" />
              <span>Imagem (PNG)</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportAs("pdf")} className="gap-2 cursor-pointer">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span>Documento (PDF)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-5 bg-border mx-1" />

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setScale((s) => Math.min(2, s + 0.15))}
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground min-w-[3ch] text-center tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setScale((s) => Math.max(0.3, s - 0.15))}
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-0.5" />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetView}>
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="w-full h-[500px] overflow-hidden rounded-lg border bg-muted/20 select-none"
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        data-canvas="true"
      >
        <div
          className="inline-flex min-w-full min-h-full items-start justify-center pt-8"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: "top center",
            transition: isPanning ? "none" : "transform 0.15s ease-out",
          }}
          data-canvas="true"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
