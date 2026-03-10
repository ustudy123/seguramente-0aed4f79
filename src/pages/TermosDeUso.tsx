import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermosDeUso() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/register">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao cadastro
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2">Termos de Uso</h1>
        <p className="text-muted-foreground mb-8">Última atualização: 10 de março de 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold">1. Aceitação dos Termos</h2>
            <p>Ao acessar e utilizar a plataforma Seguramente, você concorda com estes Termos de Uso. Caso não concorde, não utilize nossos serviços.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Descrição do Serviço</h2>
            <p>A Seguramente é uma plataforma de gestão de pessoas, saúde e segurança do trabalho que oferece funcionalidades como gestão de colaboradores, atestados, avaliações, treinamentos, entre outros módulos.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Cadastro e Conta</h2>
            <p>Para utilizar a plataforma, é necessário criar uma conta fornecendo informações verdadeiras e atualizadas. Você é responsável por manter a confidencialidade de suas credenciais de acesso.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Uso Adequado</h2>
            <p>O usuário compromete-se a utilizar a plataforma de forma ética e em conformidade com a legislação vigente, não sendo permitido:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Inserir dados falsos ou fraudulentos</li>
              <li>Compartilhar credenciais de acesso com terceiros não autorizados</li>
              <li>Utilizar a plataforma para fins ilegais</li>
              <li>Tentar acessar dados de outros tenants/empresas</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Propriedade Intelectual</h2>
            <p>Todo o conteúdo, design, código e funcionalidades da plataforma são de propriedade da Seguramente, protegidos por leis de propriedade intelectual.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Disponibilidade</h2>
            <p>A Seguramente se esforça para manter a plataforma disponível 24/7, mas não garante disponibilidade ininterrupta. Manutenções programadas serão comunicadas com antecedência.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Limitação de Responsabilidade</h2>
            <p>A Seguramente não se responsabiliza por danos indiretos, incidentais ou consequentes decorrentes do uso ou impossibilidade de uso da plataforma.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Alterações nos Termos</h2>
            <p>Reservamo-nos o direito de atualizar estes Termos a qualquer momento. Alterações significativas serão notificadas aos usuários por e-mail ou pela própria plataforma.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Contato</h2>
            <p>Em caso de dúvidas sobre estes Termos, entre em contato pelo e-mail: contato@seguramente.app</p>
          </section>
        </div>
      </div>
    </div>
  );
}
