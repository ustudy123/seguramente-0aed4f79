import type { EstrategiaOrganograma } from "@/types/estrategia";
import { OrgCard } from "./OrgCard";

interface OrgBranchProps {
  node: EstrategiaOrganograma;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (parentId: string | undefined) => void;
  onMove?: (draggedId: string, targetId: string, position: "child" | "sibling") => void;
  onEdit?: (id: string, updates: Partial<EstrategiaOrganograma>) => void;
  isRoot?: boolean;
}

function OrgBranch({ node, onDelete, onAddChild, onAddSibling, onMove, onEdit, isRoot }: OrgBranchProps) {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      {!isRoot && <div className="w-0.5 h-6 bg-border" />}

      <OrgCard
        node={node}
        onDelete={onDelete}
        onAddChild={onAddChild}
        onAddSibling={onAddSibling}
        onMove={onMove}
        onEdit={onEdit}
      />

      {hasChildren && (
        <>
          <div className="w-0.5 h-6 bg-border" />

          <div className="flex">
            {node.children!.map((child, idx) => (
              <div key={child.id} className="relative flex flex-col items-center" style={{ marginLeft: idx > 0 ? '1rem' : 0 }}>
                {/* Horizontal connector: left half (all except first) */}
                {node.children!.length > 1 && idx > 0 && (
                  <div className="absolute top-0 h-0.5 bg-border" style={{ right: '50%', left: '-0.5rem' }} />
                )}
                {/* Horizontal connector: right half (all except last) */}
                {node.children!.length > 1 && idx < node.children!.length - 1 && (
                  <div className="absolute top-0 h-0.5 bg-border" style={{ left: '50%', right: '-0.5rem' }} />
                )}
                <OrgBranch
                  node={child}
                  onDelete={onDelete}
                  onAddChild={onAddChild}
                  onAddSibling={onAddSibling}
                  onMove={onMove}
                  onEdit={onEdit}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface OrgTreeProps {
  roots: EstrategiaOrganograma[];
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (parentId: string | undefined) => void;
  onMove?: (draggedId: string, targetId: string, position: "child" | "sibling") => void;
  onEdit?: (id: string, updates: { titulo: string; nome_ocupante?: string }) => void;
}

export function OrgTree({ roots, onDelete, onAddChild, onAddSibling, onMove, onEdit }: OrgTreeProps) {
  return (
    <div className="flex gap-8 justify-center flex-wrap py-6 px-4" data-canvas="true">
      {roots.map((root) => (
        <OrgBranch
          key={root.id}
          node={root}
          onDelete={onDelete}
          onAddChild={onAddChild}
          onAddSibling={onAddSibling}
          onMove={onMove}
          onEdit={onEdit}
          isRoot
        />
      ))}
    </div>
  );
}
