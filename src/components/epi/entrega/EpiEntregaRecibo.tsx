import { forwardRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatDateBR } from "@/lib/dataLocal";

interface ReciboData {
  colaboradorNome: string;
  colaboradorCpf?: string;
  colaboradorCargo?: string;
  colaboradorDepartamento?: string;
  epiNome: string;
  epiCa?: string;
  epiFabricante?: string;
  epiMarca?: string;
  quantidade: number;
  dataEntrega: string;
  dataValidade?: string;
  observacoes?: string;
  fotoUrl?: string;
  assinaturaUrl?: string;
  signedAt?: string;
  entregueporNome?: string;
  empresaNome?: string;
}

interface EpiEntregaReciboProps {
  data: ReciboData;
}

export const EpiEntregaRecibo = forwardRef<HTMLDivElement, EpiEntregaReciboProps>(
  ({ data }, ref) => {
    const dataFormatada = format(new Date(data.dataEntrega), "dd 'de' MMMM 'de' yyyy", {
      locale: ptBR,
    });
    
    const horaAssinatura = data.signedAt 
      ? format(new Date(data.signedAt), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })
      : null;

    return (
      <div
        ref={ref}
        className="mx-auto max-w-2xl bg-white p-8 text-black"
        style={{ fontFamily: "Arial, sans-serif" }}
      >
        {/* Cabeçalho */}
        <div className="mb-6 border-b-2 border-black pb-4 text-center">
          <h1 className="text-xl font-bold uppercase">
            Recibo de Entrega de Equipamento de Proteção Individual
          </h1>
          <p className="text-sm text-gray-600">{data.empresaNome || "Empresa"}</p>
        </div>

        {/* Dados do Colaborador */}
        <div className="mb-6">
          <h2 className="mb-2 border-b font-bold uppercase text-gray-700">Dados do Colaborador</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="font-semibold">Nome:</span> {data.colaboradorNome}
            </div>
            {data.colaboradorCpf && (
              <div>
                <span className="font-semibold">CPF:</span> {data.colaboradorCpf}
              </div>
            )}
            {data.colaboradorCargo && (
              <div>
                <span className="font-semibold">Função:</span> {data.colaboradorCargo}
              </div>
            )}
            {data.colaboradorDepartamento && (
              <div>
                <span className="font-semibold">Departamento:</span> {data.colaboradorDepartamento}
              </div>
            )}
          </div>
        </div>

        {/* Dados do EPI */}
        <div className="mb-6">
          <h2 className="mb-2 border-b font-bold uppercase text-gray-700">
            Equipamento de Proteção Individual
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-1 text-left">Descrição</th>
                <th className="py-1 text-center">C.A.</th>
                <th className="py-1 text-center">Qtd.</th>
                <th className="py-1 text-center">Data Entrega</th>
                <th className="py-1 text-center">Validade</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1">
                  {data.epiNome}
                  {data.epiMarca && ` - ${data.epiMarca}`}
                  {data.epiFabricante && ` (${data.epiFabricante})`}
                </td>
                <td className="py-1 text-center">{data.epiCa || "N/A"}</td>
                <td className="py-1 text-center">{data.quantidade}</td>
                <td className="py-1 text-center">
                  {format(new Date(data.dataEntrega), "dd/MM/yyyy")}
                </td>
                <td className="py-1 text-center">
                  {data.dataValidade
                    ? formatDateBR(data.dataValidade, "dd/MM/yyyy")
                    : "N/A"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Observações */}
        {data.observacoes && (
          <div className="mb-6">
            <h2 className="mb-2 border-b font-bold uppercase text-gray-700">Observações</h2>
            <p className="text-sm">{data.observacoes}</p>
          </div>
        )}

        {/* Termo de Responsabilidade */}
        <div className="mb-6 rounded border border-gray-300 bg-gray-50 p-4 text-xs">
          <p className="mb-2 font-bold">TERMO DE RESPONSABILIDADE</p>
          <p className="text-justify leading-relaxed">
            Declaro ter recebido gratuitamente o(s) Equipamento(s) de Proteção Individual (EPI)
            acima descrito(s), em perfeito estado de conservação, comprometendo-me a:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Usá-lo(s) apenas para a finalidade a que se destina(m);</li>
            <li>Responsabilizar-me por sua guarda e conservação;</li>
            <li>Comunicar ao empregador qualquer alteração que o torne impróprio para uso;</li>
            <li>Cumprir as determinações do empregador sobre o uso adequado.</li>
          </ul>
          <p className="mt-2 font-semibold">Conforme NR-6 e Lei 14.063/2020.</p>
        </div>

        {/* Foto e Assinatura */}
        <div className="mb-6 grid grid-cols-2 gap-6">
          {data.fotoUrl && (
            <div className="text-center">
              <p className="mb-2 text-sm font-semibold">Foto do Colaborador</p>
              <img
                src={data.fotoUrl}
                alt="Foto do colaborador"
                className="mx-auto h-32 w-32 rounded border object-cover"
                crossOrigin="anonymous"
              />
            </div>
          )}
          {data.assinaturaUrl && (
            <div className="text-center">
              <p className="mb-2 text-sm font-semibold">Assinatura Digital</p>
              <img
                src={data.assinaturaUrl}
                alt="Assinatura"
                className="mx-auto h-24 rounded border bg-white object-contain p-1"
                crossOrigin="anonymous"
              />
              <p className="mt-1 text-xs text-gray-500">{data.colaboradorNome}</p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="mt-8 border-t pt-4 text-center text-xs text-gray-500">
          <p>
            {dataFormatada}
            {data.entregueporNome && ` | Entregue por: ${data.entregueporNome}`}
          </p>
          {horaAssinatura && <p>Assinado digitalmente em: {horaAssinatura}</p>}
          <p className="mt-2">
            Documento gerado eletronicamente com validade jurídica conforme Lei 14.063/2020
          </p>
        </div>
      </div>
    );
  }
);

EpiEntregaRecibo.displayName = "EpiEntregaRecibo";
