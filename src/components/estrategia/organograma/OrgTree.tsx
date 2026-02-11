import type { EstrategiaOrganograma } from "@/types/estrategia";
import { OrgCard } from "./OrgCard";

interface OrgBranchProps {
  node: EstrategiaOrganograma;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  isRoot?: boolean;
}

function OrgBranch({ node, onDelete, onAddChild, isRoot }: OrgBranchProps) {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      {!isRoot && <div className="w-0.5 h-6 bg-border" />}

      <OrgCard node={node} onDelete={onDelete} onAddChild={onAddChild} />

      {hasChildren && (
        <>
          <div className="w-0.5 h-6 bg-border" />

          <div className="relative flex items-start">
            {node.children!.length > 1 && (
              <div
                className="absolute top-0 h-0.5 bg-border"
                style={{
                  left: `calc(50% / ${node.children!.length})`,
                  right: `calc(50% / ${node.children!.length})`,
                }}
              />
            )}
            <div className="flex gap-4">
              {node.children!.map((child) => (
                <OrgBranch
                  key={child.id}
                  node={child}
                  onDelete={onDelete}
                  onAddChild={onAddChild}
                />
              ))}
            </div>
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
}

export function OrgTree({ roots, onDelete, onAddChild }: OrgTreeProps) {
  return (
    <div className="flex gap-8 justify-center flex-wrap py-6 px-4" data-canvas="true">
      {roots.map((root) => (
        <OrgBranch
          key={root.id}
          node={root}
          onDelete={onDelete}
          onAddChild={onAddChild}
          isRoot
        />
      ))}
    </div>
  );
}
