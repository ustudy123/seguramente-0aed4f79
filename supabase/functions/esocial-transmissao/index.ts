import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// eSocial WebService endpoints
const ESOCIAL_ENDPOINTS = {
  producao: {
    envioLoteEventos:
      "https://webservices.esocial.gov.br/servicos/empregador/envio/lote/eventos/v1_1_0",
    consultaLoteEventos:
      "https://webservices.esocial.gov.br/servicos/empregador/consulta/lote/eventos/v1_1_0",
  },
  homologacao: {
    envioLoteEventos:
      "https://webservices.esocial.gov.br/servicos/empregador/envio/lote/eventos/v1_1_0",
    consultaLoteEventos:
      "https://webservices.esocial.gov.br/servicos/empregador/consulta/lote/eventos/v1_1_0",
  },
};

// Build S-2210 XML (Comunicação de Acidente de Trabalho)
function buildS2210(evento: any, cnpj: string): string {
  const now = new Date();
  const dataHora = now.toISOString().replace("Z", "").slice(0, 19);
  const cnpjLimpo = cnpj.replace(/\D/g, "");

  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtCAT/v_S_01_02_00"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.esocial.gov.br/schema/evt/evtCAT/v_S_01_02_00 evtCAT.xsd">
  <evtCAT id="e${cnpjLimpo}${dataHora.replace(/[-:T]/g, "")}">
    <ideEvento>
      <indRetif>1</indRetif>
      <percTrans>1</percTrans>
      <tpAmb>${evento.ambiente === "homologacao" ? "2" : "1"}</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjLimpo.slice(0, 8)}</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>${(evento.cpf_trabalhador || "").replace(/\D/g, "")}</cpfTrab>
      <matricula>${evento.matricula || ""}</matricula>
    </ideVinculo>
    <cat>
      <dtAcid>${evento.data_evento || now.toISOString().slice(0, 10)}</dtAcid>
      <tpAcid>${evento.tipo_acidente || "3"}</tpAcid>
      <hrAcid>${evento.hora_evento || "08:00"}</hrAcid>
      <hrsTrabAntesAcid>${evento.horas_trabalhadas_antes || "08:00"}</hrsTrabAntesAcid>
      <tpCat>1</tpCat>
      <indCatObito>${evento.obito ? "S" : "N"}</indCatObito>
      <dscLesao>${(evento.descricao || "Acidente de trabalho").slice(0, 200)}</dscLesao>
      <dscCompLesao></dscCompLesao>
      <diagProvavel>${evento.cid || ""}</diagProvavel>
      <codSitGeradora>${evento.codigo_cid_secundario || ""}</codSitGeradora>
      <iniciatCAT>1</iniciatCAT>
      <obsCAT></obsCAT>
      <localAcidente>
        <tpLocal>1</tpLocal>
        <dscLocal>${(evento.local_acidente || "Empresa").slice(0, 80)}</dscLocal>
        <tpLograd>Rua</tpLograd>
        <dscLograd>${(evento.endereco_local || "").slice(0, 80)}</dscLograd>
        <nrLograd>${evento.numero_local || "0"}</nrLograd>
        <bairro>${(evento.bairro_local || "").slice(0, 60)}</bairro>
        <cep>${(evento.cep_local || "").replace(/\D/g, "")}</cep>
        <codMunic>${evento.ibge_local || "3550308"}</codMunic>
        <uf>${evento.uf_local || "SP"}</uf>
        <pais>105</pais>
        <codPostal></codPostal>
      </localAcidente>
      <partesAtingidas>
        <codParteAting>${evento.parte_corpo_atingida || "099999"}</codParteAting>
        <lateralidade>9</lateralidade>
      </partesAtingidas>
      <agenteCausador>
        <codAgntCausador>${evento.agente_causador || "099999"}</codAgntCausador>
      </agenteCausador>
      <atendimento>
        <dtAtendimento>${evento.data_evento || now.toISOString().slice(0, 10)}</dtAtendimento>
        <hrAtendimento>${evento.hora_evento || "08:00"}</hrAtendimento>
        <indInternacao>N</indInternacao>
        <durTrat>0</durTrat>
        <indAfast>${evento.afastamento && evento.afastamento !== "sem_afastamento" ? "S" : "N"}</indAfast>
        <dscLesao>${(evento.descricao || "").slice(0, 200)}</dscLesao>
        <dscCompLesao></dscCompLesao>
        <diagProvavel>${evento.cid || ""}</diagProvavel>
        <codCID>${evento.cid || ""}</codCID>
        <ordMedico>
          <nmMed></nmMed>
          <nrOC></nrOC>
          <ufCRM></ufCRM>
        </ordMedico>
      </atendimento>
    </cat>
  </evtCAT>
</eSocial>`;
}

// Build S-2240 XML (Condições Ambientais do Trabalho)
function buildS2240(evento: any, cnpj: string): string {
  const now = new Date();
  const dataHora = now.toISOString().replace("Z", "").slice(0, 19);
  const cnpjLimpo = cnpj.replace(/\D/g, "");

  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtExpRisco/v_S_01_02_00"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <evtExpRisco id="e${cnpjLimpo}${dataHora.replace(/[-:T]/g, "")}">
    <ideEvento>
      <indRetif>1</indRetif>
      <tpAmb>${evento.ambiente === "homologacao" ? "2" : "1"}</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjLimpo.slice(0, 8)}</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>${(evento.cpf_trabalhador || "").replace(/\D/g, "")}</cpfTrab>
      <matricula>${evento.matricula || ""}</matricula>
    </ideVinculo>
    <infoExpRisco>
      <dtIniCondicao>${evento.data_evento || now.toISOString().slice(0, 10)}</dtIniCondicao>
      <atividades>
        <dscAtivDes>${(evento.descricao || "Atividade com exposição a risco").slice(0, 999)}</dscAtivDes>
      </atividades>
      <agNoc>
        <grauExpNocivo>3</grauExpNocivo>
      </agNoc>
    </infoExpRisco>
  </evtExpRisco>
</eSocial>`;
}

// Wrap XML in SOAP envelope for transmission
function buildSoapEnvelope(xmlEvento: string, cnpj: string, ambiente: string): string {
  const cnpjLimpo = cnpj.replace(/\D/g, "");
  const tpAmb = ambiente === "homologacao" ? "2" : "1";
  const grupo = "2"; // empregador

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Header/>
  <soapenv:Body>
    <eSocial:EnviarLoteEventos xmlns:eSocial="http://www.esocial.gov.br/servicos/empregador/envio/lote/eventos/v1_1_0">
      <eSocial:loteEventos>
        <eSocial:envioLoteEventos grupo="${grupo}">
          <eSocial:ideEmpregador>
            <eSocial:tpInsc>1</eSocial:tpInsc>
            <eSocial:nrInsc>${cnpjLimpo.slice(0, 8)}</eSocial:nrInsc>
          </eSocial:ideEmpregador>
          <eSocial:ideTransmissor>
            <eSocial:tpInsc>1</eSocial:tpInsc>
            <eSocial:nrInsc>${cnpjLimpo}</eSocial:nrInsc>
          </eSocial:ideTransmissor>
          <eSocial:eventos>
            <eSocial:evento Id="ev001">
              ${xmlEvento}
            </eSocial:evento>
          </eSocial:eventos>
        </eSocial:envioLoteEventos>
      </eSocial:loteEventos>
    </eSocial:EnviarLoteEventos>
  </soapenv:Body>
</soapenv:Envelope>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } =
      await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, certificado_id, evento_sst_id, tipo_evento, transmissao_id } = body;

    // =============================================
    // ACTION: gerar_xml — gera XML sem transmitir
    // =============================================
    if (action === "gerar_xml") {
      const { data: cert, error: certErr } = await supabase
        .from("esocial_certificados")
        .select("*")
        .eq("id", certificado_id)
        .single();

      if (certErr || !cert) {
        return new Response(
          JSON.stringify({ error: "Certificado não encontrado" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: evento, error: evtErr } = await supabase
        .from("eventos_sst")
        .select("*")
        .eq("id", evento_sst_id)
        .single();

      if (evtErr || !evento) {
        return new Response(
          JSON.stringify({ error: "Evento SST não encontrado" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const eventoComAmbiente = { ...evento, ambiente: cert.ambiente };
      let xml = "";

      if (tipo_evento === "S-2210") {
        xml = buildS2210(eventoComAmbiente, cert.cnpj);
      } else if (tipo_evento === "S-2240") {
        xml = buildS2240(eventoComAmbiente, cert.cnpj);
      } else {
        xml = buildS2210(eventoComAmbiente, cert.cnpj); // default
      }

      return new Response(JSON.stringify({ xml, tipo_evento }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =============================================
    // ACTION: transmitir — envia para eSocial
    // =============================================
    if (action === "transmitir") {
      const { data: cert, error: certErr } = await supabase
        .from("esocial_certificados")
        .select("*")
        .eq("id", certificado_id)
        .single();

      if (certErr || !cert) {
        return new Response(
          JSON.stringify({ error: "Certificado não encontrado" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: evento, error: evtErr } = await supabase
        .from("eventos_sst")
        .select("*")
        .eq("id", evento_sst_id)
        .single();

      if (evtErr || !evento) {
        return new Response(
          JSON.stringify({ error: "Evento SST não encontrado" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Buscar perfil do usuário
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome_completo, tenant_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      const eventoComAmbiente = { ...evento, ambiente: cert.ambiente };
      let xmlEvento = "";

      if (tipo_evento === "S-2210") {
        xmlEvento = buildS2210(eventoComAmbiente, cert.cnpj);
      } else if (tipo_evento === "S-2240") {
        xmlEvento = buildS2240(eventoComAmbiente, cert.cnpj);
      } else {
        xmlEvento = buildS2210(eventoComAmbiente, cert.cnpj);
      }

      const soapEnvelope = buildSoapEnvelope(xmlEvento, cert.cnpj, cert.ambiente);

      // Criar registro de transmissão
      const { data: transmissao, error: transErr } = await supabase
        .from("esocial_transmissoes")
        .insert({
          tenant_id: profile?.tenant_id || cert.tenant_id,
          empresa_id: cert.empresa_id,
          certificado_id: cert.id,
          evento_sst_id,
          tipo_evento,
          xml_enviado: soapEnvelope,
          status: "enviando",
          tentativas: 1,
          ultima_tentativa: new Date().toISOString(),
          criado_por: userData.user.id,
          criado_por_nome: profile?.nome_completo || userData.user.email,
        })
        .select()
        .single();

      if (transErr) {
        return new Response(
          JSON.stringify({ error: "Erro ao registrar transmissão" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // NOTA IMPORTANTE: A transmissão real ao eSocial requer:
      // 1. O arquivo .pfx do certificado carregado do storage
      // 2. A senha do certificado (armazenada de forma segura)
      // 3. Assinatura XML-DSig com o certificado (xmldsig)
      // 4. Envio via SOAP com mutual TLS (mTLS)
      //
      // Para o ambiente de produção completo, é necessário:
      // - Biblioteca de assinatura XML compatível com Deno (ex: xml-crypto)
      // - Implementação de mTLS com o certificado cliente
      //
      // Por ora, retornamos simulação para homologação e estrutura para produção

      let statusFinal = "pendente_assinatura";
      let mensagem =
        "XML gerado. Para transmissão real, faça o upload do certificado .pfx e configure a senha.";
      let protocolo = null;

      if (cert.certificado_path && cert.certificado_path !== "") {
        // Tentar baixar certificado do storage
        const { data: certFile, error: storageErr } = await supabase.storage
          .from("esocial-certificados")
          .download(cert.certificado_path);

        if (storageErr || !certFile) {
          statusFinal = "erro";
          mensagem = "Não foi possível carregar o certificado digital do storage.";
        } else {
          // Certificado disponível - marcar como pronto para assinatura
          // A assinatura real requer implementação de xmldsig com pkcs12
          statusFinal = cert.ambiente === "homologacao" ? "simulado" : "pendente_assinatura";
          protocolo = `PROT-${Date.now()}`;
          mensagem =
            cert.ambiente === "homologacao"
              ? "Transmissão simulada (homologação). Certificado carregado com sucesso."
              : "XML gerado e certificado carregado. Integração de assinatura digital em implementação.";
        }
      }

      // Atualizar transmissão
      await supabase
        .from("esocial_transmissoes")
        .update({
          status: statusFinal,
          mensagem_retorno: mensagem,
          protocolo,
          xml_enviado: soapEnvelope,
        })
        .eq("id", transmissao.id);

      return new Response(
        JSON.stringify({
          success: true,
          transmissao_id: transmissao.id,
          status: statusFinal,
          mensagem,
          protocolo,
          xml_gerado: xmlEvento,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // =============================================
    // ACTION: consultar — consulta retorno
    // =============================================
    if (action === "consultar") {
      const { data: trans, error: transErr } = await supabase
        .from("esocial_transmissoes")
        .select("*")
        .eq("id", transmissao_id)
        .single();

      if (transErr || !trans) {
        return new Response(
          JSON.stringify({ error: "Transmissão não encontrada" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify({ transmissao: trans }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Erro na edge function esocial-transmissao:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
