import Financeiro from "./Financeiro";

/**
 * Rota dedicada para Benefícios — renderiza o módulo Financeiro com a aba "beneficios" ativa.
 */
const FinanceiroBeneficios = () => {
  return <Financeiro defaultTab="beneficios" />;
};

export default FinanceiroBeneficios;
