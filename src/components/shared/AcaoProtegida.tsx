import type { ReactNode } from "react";
import { usePerfilPermissions } from "@/hooks/usePerfilPermissions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Envolve uma ação (botão de exportar, excluir, aprovar…) e só a oferece a
 * quem o perfil de acesso permite.
 *
 * Recomendação nº 3 do parecer de perfis de acesso (07/08): o modelo já
 * previa ação e recurso, mas o uso era praticamente só de módulo — quem
 * enxergava a tela podia tudo dentro dela. Exportar é o caso mais sensível,
 * porque RETIRA dado do sistema.
 *
 * Duas formas de negar, e a escolha importa:
 *  - `modo="ocultar"` (padrão): a ação some. Bom para o caso comum, em que
 *    oferecer o que não se pode fazer só gera frustração e chamado.
 *  - `modo="desabilitar"`: a ação aparece apagada, com explicação ao passar
 *    o mouse. Bom quando a ausência confundiria — o usuário procuraria o
 *    botão e abriria chamado achando que sumiu por defeito.
 *
 * Sobre o alcance: esconder botão não é tranca. Quem sabe pedir continua
 * pedindo pela API. A tranca de leitura é a camada de perfil no banco
 * (recomendação nº 1, já implementada nas tabelas sensíveis); a de escrita
 * são as políticas de cada tabela. Este componente cuida do que o sistema
 * OFERECE — não substitui nenhuma das duas.
 */
export function AcaoProtegida({
  modulo,
  acao,
  children,
  modo = "ocultar",
  motivo,
}: {
  /** Módulo de `perfil_permissoes.modulo` (ex.: "colaboradores", "atestados"). */
  modulo: string;
  /** Ação de `perfil_permissoes.acao` (ex.: "exportar", "excluir"). */
  acao: string;
  children: ReactNode;
  modo?: "ocultar" | "desabilitar";
  /** Texto do aviso quando `modo="desabilitar"`. */
  motivo?: string;
}) {
  const { podeAcao, isLoading } = usePerfilPermissions();

  // Enquanto carrega, não oferecer: piscar o botão e retirá-lo em seguida é
  // pior do que ele aparecer meio segundo depois.
  if (isLoading) return null;

  if (podeAcao(modulo, acao)) return <>{children}</>;

  if (modo === "ocultar") return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-not-allowed opacity-50">
            <span className="pointer-events-none">{children}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {motivo ?? "Seu perfil de acesso não permite esta ação. Fale com o administrador da empresa."}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
