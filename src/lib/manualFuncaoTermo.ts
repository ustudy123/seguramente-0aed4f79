/**
 * Termo de Ciência, Acordo e Comprometimento — Manual da Função
 * Bloco final injetado no PDF do manual antes/depois das assinaturas.
 */

interface BuildTermoParams {
  cargoNome: string;
  colaboradorNome: string;
  colaboradorCpf?: string | null;
  empresaNome?: string | null;
  gestorNome?: string | null;
  cidade?: string | null;
}

export function buildTermoCienciaHtml(p: BuildTermoParams): string {
  const cidade = p.cidade || "_______________________";
  const empresa = p.empresaNome || "____________________________";
  const gestor = p.gestorNome || "____________________________";
  const colabCpf = p.colaboradorCpf || "_____________________";
  return `
  <section style="page-break-before: always; padding: 32px 28px; font-family: Arial, sans-serif; color: #111;">
    <h1 style="font-size: 22px; color: #1e3a5f; border-bottom: 3px solid #2563eb; padding-bottom: 8px; margin: 0 0 16px;">
      Termo de Ciência, Acordo e Comprometimento
    </h1>

    <p style="font-size: 13px; line-height: 1.7; text-align: justify; margin: 12px 0;">
      Pelo presente instrumento, eu <strong>${escape(p.colaboradorNome)}</strong>,
      portador(a) do CPF nº <strong>${escape(colabCpf)}</strong>, ocupante da função de
      <strong>${escape(p.cargoNome)}</strong> junto à empresa <strong>${escape(empresa)}</strong>,
      <strong>declaro</strong> que recebi, li e compreendi integralmente o presente
      <em>Manual da Função</em>, incluindo as atribuições, responsabilidades, competências, riscos ocupacionais,
      Equipamentos de Proteção Individual (EPIs) e Procedimentos Operacionais Padrão (POPs) aplicáveis ao cargo.
    </p>

    <p style="font-size: 13px; line-height: 1.7; text-align: justify; margin: 12px 0;">
      <strong>Comprometo-me</strong> a:
    </p>
    <ul style="font-size: 13px; line-height: 1.7; padding-left: 22px; margin: 4px 0 12px;">
      <li>Cumprir fielmente as atribuições descritas, observando as normas internas da empresa e a legislação trabalhista vigente;</li>
      <li>Utilizar corretamente, conservar e zelar pelos EPIs fornecidos, comunicando qualquer extravio, dano ou desgaste;</li>
      <li>Seguir os Procedimentos Operacionais Padrão (POPs), priorizando a segurança, a qualidade e a conformidade;</li>
      <li>Cooperar com a empresa na aplicação das medidas de prevenção de riscos (NR-1) e na preservação da saúde e segurança no trabalho (CLT, art. 157 e 158);</li>
      <li>Comunicar imediatamente ao gestor imediato qualquer condição insegura, ato inseguro, incidente ou acidente.</li>
    </ul>

    <p style="font-size: 13px; line-height: 1.7; text-align: justify; margin: 12px 0;">
      Estou ciente de que o descumprimento das responsabilidades descritas neste manual pode ensejar
      medidas administrativas e disciplinares previstas na legislação e no regulamento interno da empresa.
    </p>

    <p style="font-size: 13px; line-height: 1.7; text-align: justify; margin: 18px 0 28px;">
      <strong>Local:</strong> ${escape(cidade)} &nbsp;&nbsp; <strong>Data:</strong> ${new Date().toLocaleDateString("pt-BR")}
    </p>

    <table style="width:100%; margin-top: 36px; font-size: 12px;">
      <tr>
        <td style="width:50%; text-align:center; padding: 0 12px;">
          <div style="border-top: 1px solid #111; padding-top: 6px;">
            <strong>${escape(p.colaboradorNome)}</strong><br/>
            Colaborador(a) — Função: ${escape(p.cargoNome)}<br/>
            CPF: ${escape(colabCpf)}
          </div>
        </td>
        <td style="width:50%; text-align:center; padding: 0 12px;">
          <div style="border-top: 1px solid #111; padding-top: 6px;">
            <strong>${escape(gestor)}</strong><br/>
            Gestor(a) Imediato(a)
          </div>
        </td>
      </tr>
    </table>

    <p style="margin-top: 28px; font-size: 11px; color: #555; text-align: center;">
      Documento assinado digitalmente. Validade jurídica conforme MP 2.200-2/2001 e Lei nº 14.063/2020.
    </p>
  </section>
  `;
}

function escape(v: string | null | undefined): string {
  if (v == null) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Bloco visual com selo de assinatura digital (após assinado), substitui as linhas em branco.
 */
export function buildAssinaturaSeloHtml(params: {
  nome: string;
  cpfMascarado?: string;
  papel: string;
  dataIso: string;
  hash: string;
  ip?: string | null;
  geo?: { lat?: number; lng?: number } | null;
  selfieUrl?: string | null;
}): string {
  const data = new Date(params.dataIso).toLocaleString("pt-BR");
  const geo = params.geo?.lat && params.geo?.lng ? `${params.geo.lat.toFixed(5)}, ${params.geo.lng.toFixed(5)}` : "—";
  return `
    <div style="border: 1px dashed #2563eb; background: #eff6ff; padding: 10px; border-radius: 6px; font-size: 11px; text-align: left;">
      <div style="font-weight: bold; color: #1e3a5f;">✓ Assinatura Digital — ${escape(params.papel)}</div>
      <div><strong>Nome:</strong> ${escape(params.nome)}</div>
      ${params.cpfMascarado ? `<div><strong>CPF:</strong> ${escape(params.cpfMascarado)}</div>` : ""}
      <div><strong>Data/Hora:</strong> ${data}</div>
      <div><strong>IP:</strong> ${escape(params.ip || "—")}</div>
      <div><strong>Geo:</strong> ${escape(geo)}</div>
      <div style="word-break: break-all;"><strong>Hash:</strong> ${escape(params.hash)}</div>
    </div>
  `;
}
