import { useParams, useNavigate } from "react-router-dom";
import { PlanoAcaoDetail } from "@/components/planoAcao/PlanoAcaoDetail";

export default function PlanoAcaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    navigate("/plano-acao");
    return null;
  }

  return (
    <PlanoAcaoDetail
      acaoId={id}
      onClose={() => navigate("/plano-acao")}
    />
  );
}
