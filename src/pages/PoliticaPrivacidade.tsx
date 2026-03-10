import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/register">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao cadastro
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-muted-foreground mb-8">Última atualização: 10 de março de 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold">1. Introdução</h2>
            <p>A Seguramente está comprometida em proteger a privacidade dos dados pessoais dos seus usuários, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Dados Coletados</h2>
            <p>Coletamos os seguintes dados:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Dados de cadastro:</strong> nome, e-mail, CPF/CNPJ, telefone/WhatsApp</li>
              <li><strong>Dados da empresa:</strong> razão social, CNPJ, endereço</li>
              <li><strong>Dados de uso:</strong> logs de acesso, ações realizadas na plataforma</li>
              <li><strong>Dados de colaboradores:</strong> informações inseridas pelo gestor para gestão de RH e SST</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Finalidade do Tratamento</h2>
            <p>Os dados são utilizados para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Prestação dos serviços contratados</li>
              <li>Comunicação com o usuário</li>
              <li>Cumprimento de obrigações legais e regulatórias</li>
              <li>Melhoria contínua da plataforma</li>
              <li>Segurança e prevenção de fraudes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Compartilhamento de Dados</h2>
            <p>Seus dados não são vendidos a terceiros. Podem ser compartilhados apenas com:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Prestadores de serviço essenciais (hospedagem, e-mail)</li>
              <li>Autoridades competentes quando exigido por lei</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Armazenamento e Segurança</h2>
            <p>Os dados são armazenados em servidores seguros com criptografia, controle de acesso e isolamento por tenant (multi-tenancy). Utilizamos as melhores práticas de segurança da informação.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Direitos do Titular</h2>
            <p>Conforme a LGPD, você tem direito a:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos ou desatualizados</li>
              <li>Solicitar a exclusão de dados desnecessários</li>
              <li>Revogar o consentimento</li>
              <li>Solicitar a portabilidade dos dados</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Retenção de Dados</h2>
            <p>Os dados são mantidos enquanto a conta estiver ativa ou conforme necessário para cumprir obrigações legais. Após o encerramento da conta, os dados serão eliminados em até 90 dias.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Cookies</h2>
            <p>Utilizamos cookies essenciais para o funcionamento da plataforma e cookies analíticos para melhorar a experiência do usuário.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Contato do Encarregado (DPO)</h2>
            <p>Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados, entre em contato: privacidade@seguramente.app</p>
          </section>
        </div>
      </div>
    </div>
  );
}
