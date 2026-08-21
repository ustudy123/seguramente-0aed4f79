#!/usr/bin/env python3
"""
Gera os comandos que copiam os dados da PRODUÇÃO para a HOMOLOGAÇÃO com a
identificação embaralhada.

A IDEIA CENTRAL: MASCARAR NA LEITURA
------------------------------------
A máscara é aplicada dentro do SELECT que roda NA PRODUÇÃO. O dado que
identifica pessoa — CPF, nome, e-mail, atestado — nunca sai de lá: o que
atravessa a rede, o que chega ao servidor da esteira e o que é gravado na
homologação já está embaralhado.

Isso importa por dois motivos concretos deste projeto: o repositório é
público, e a homologação está fora do Brasil. Copiar cru e mascarar depois
resolveria o resultado final, mas colocaria o dado real em trânsito e em
repouso, ainda que por minutos, nos dois lugares onde ele não deve estar.

O DEFAULT É MASCARAR, NÃO PRESERVAR
-----------------------------------
São ~1950 colunas de texto no schema. Classificar uma a uma por padrão de
nome erra nos dois sentidos, e os dois erros não custam igual:

  · mascarar demais  -> o ensaio quebra de um jeito VISÍVEL (uma rotina de
                        QA falha, uma tela fica estranha) e a gente conserta
                        pondo a coluna na lista de preservadas;
  · mascarar de menos -> um CPF real vaza EM SILÊNCIO.

Por isso a regra é invertida em relação ao instinto: **toda coluna de texto
é mascarada, exceto as que estiverem explicitamente na lista de preservadas**.
Falha para o lado seguro, e o lado inseguro é o único que não dá sinal.

Colunas que não são texto (data, número, booleano, uuid) passam intactas:
não carregam nome nem documento, e são elas que dão realismo ao ensaio —
volume, datas, valores, chaves.

Com DUAS exceções, que quase escaparam justamente por não serem "texto":

  · jsonb/json — 120 colunas no schema. O tipo não é texto, mas o conteúdo
    é livre: auth.users.raw_user_meta_data guarda nome completo e e-mail
    do usuário. Passariam inteiras.
  · text[] — 39 colunas. Mesma história, em lista.

As duas viram vazio ('{}'). Perde-se o conteúdo, preserva-se o tipo e o
NULL. Se alguma delas fizer falta no ensaio, entra na lista de preservadas
— de novo, o erro que se conserta é o que aparece.

O QUE É PRESERVADO, E POR QUÊ
-----------------------------
1. Colunas com CHECK do tipo `IN (...)` / `= ANY (ARRAY[...])`. São enums
   escritos como texto — 'aprovado', 'pendente', 'concluido'. Mascarar isso
   violaria o próprio CHECK, e o COPY falharia na cara; além disso é
   exatamente o dado de que a lógica depende.
2. A lista PRESERVAR_SEMPRE abaixo: catálogos públicos (CBO, CID como
   tabela de referência), rótulos organizacionais (cargo, setor, risco) e
   colunas de controle. Cada entrada tem motivo escrito.

O QUE NÃO É EMBARALHADO, E VOCÊ PRECISA SABER
---------------------------------------------
Salários e valores financeiros passam intactos. Não identificam ninguém
depois que nome e CPF viraram outra coisa, e são necessários para o ensaio
ter sentido (cálculo de férias, rescisão, provisão). Se a decisão for outra,
acrescente os nomes de coluna em MASCARAR_SEMPRE.

DETERMINISMO
------------
Todas as máscaras derivam de md5(valor || tempero). O mesmo CPF vira o mesmo
CPF falso em todas as 45 tabelas onde aparece, e o mesmo nome vira o mesmo
nome falso nas 62. Sem isso, as ligações por CPF — que este schema usa muito,
por ser denormalizado — se perderiam, e o ensaio deixaria de refletir a
produção.

O tempero fica num parâmetro para que o mapeamento não seja reproduzível por
quem só conhece o algoritmo: sem ele, não dá para testar "o CPF X virou Y?".
"""

import sys

# ---------------------------------------------------------------------------
# Classificação
# ---------------------------------------------------------------------------

TIPOS_TEXTO = {"text", "character varying", "character"}

# Colunas preservadas mesmo sendo texto. Cada uma com o motivo — lista sem
# motivo escrito vira lista que ninguém ousa mexer depois.
PRESERVAR_SEMPRE = {
    # Rótulos organizacionais: 'Soldador', 'Produção', 'Ruído'. Não
    # identificam pessoa e são o que dá sentido a relatório e agrupamento.
    "cargo_nome", "setor_nome", "risco_nome", "funcao_nome",
    "exame_nome", "treinamento_nome", "modulo_nome", "trilha_nome",
    "curso_nome", "epi_nome", "tipo_nome", "perfil_nome",
    # Catálogos públicos: CBO e CID são tabelas de referência, iguais para
    # todo mundo. Não são dado de pessoa; são dicionário.
    "cbo_codigo", "cbo_titulo", "cid_codigo", "cid_descricao",
    "cid_capitulo", "cid_grupo",
    # Geografia grossa: útil para relatório, não identifica sozinha.
    "cidade", "estado", "uf", "pais", "cidade_foro",
    # Controle e navegação do próprio sistema.
    "modulo", "rota", "tabela", "acao", "entidade", "chave_config",

    # Colunas ESTRUTURAIS sem CHECK. São enums que ninguém escreveu como
    # enum: 'ativo', 'pendente', 'mensal', 'noturno'. Medidas no schema:
    # 215 colunas, sendo `tipo` em 48 tabelas e `status` em 30. Mascarar
    # isso não vazaria nada, mas esvaziaria o ensaio — nenhuma regra de
    # negócio funciona sem saber se a admissão está concluída ou o
    # atestado aprovado.
    #
    # A comparação aqui é por NOME EXATO, e isso não é detalhe: `origem`
    # fica, mas `ip_origem` NÃO — endereço IP é dado pessoal, e casar por
    # sufixo o teria preservado junto, em silêncio. Pelo mesmo motivo
    # `origem_descricao` fica de fora: é texto livre.
    "tipo", "status", "situacao", "categoria", "nivel", "unidade",
    "unidade_medida", "frequencia", "periodicidade", "modalidade",
    "tipo_vinculo", "tipo_documento", "tipo_evento", "tipo_usuario",
    "tipo_usuario_sugerido", "tipo_dia", "tipo_contrato", "tipo_jornada",
    "nivel_risco", "nivel_confianca", "entidade_tipo",
    "periculosidade_tipo", "ierm_nivel", "origem", "origem_modulo",
    "turno", "regime", "jornada", "prioridade", "severidade",
    "criticidade", "duplicidade_nivel", "risco_grau",

    # Atributos pessoais de baixa cardinalidade. Depois que nome e CPF
    # viraram outra coisa, não identificam ninguém — e regras dependem
    # deles (licença-maternidade olha sexo; admissão olha escolaridade).
    # Se a decisão for outra, basta tirar daqui.
    "sexo", "genero", "estado_civil", "escolaridade",

    # Colunas do auth.users de que o login depende. `aud` e `role` valem
    # 'authenticated' — embaralhar isso não vazaria nada e impediria
    # qualquer pessoa de entrar, com um erro que não diria por quê.
    "aud", "role", "email_change", "phone_change",
}

# Colunas mascaradas com formato preservado. A ordem importa: a primeira
# regra que casar é a que vale.
#
# Formato preservado é necessário quando há CHECK de formato na coluna (o
# CPF é validado por dígito verificador neste sistema) ou quando a aplicação
# lê o valor esperando um desenho — e-mail com @, telefone com DDD.
#
# Cada par é (pedaço do nome da coluna, tratamento). Vários nomes caem no
# mesmo tratamento — celular e whatsapp são telefone.
REGRAS_FORMATO = [
    ("cpf",       "cpf"),
    ("cnpj",      "cnpj"),
    ("email",     "email"),
    ("e_mail",    "email"),
    ("telefone",  "telefone"),
    ("celular",   "telefone"),
    ("whatsapp",  "telefone"),
    ("fone",      "telefone"),
    ("cep",       "cep"),
]

# Credenciais: não basta embaralhar, tem que deixar de funcionar. Token
# copiado continua sendo token válido em algum lugar.
# "password" está aqui por causa de auth.users.encrypted_password: o hash da
# senha REAL não pode sair da produção. Hash de senha é credencial, não é
# "dado já protegido" — quem o tem pode atacá-lo offline, no seu tempo.
PADROES_CREDENCIAL = ("token", "senha", "password", "secret", "hash",
                      "chave_api", "api_key")


def eh_texto(tipo: str) -> bool:
    return tipo in TIPOS_TEXTO


def classificar(coluna: str, tipo: str, tem_check_enum: bool,
                coluna_e_lista_de_texto: bool = False) -> str:
    """Devolve o tratamento: 'copiar', 'cpf', 'cnpj', 'email', 'telefone',
    'cep', 'credencial', 'json_vazio', 'lista_vazia' ou 'generico'."""
    c = coluna.lower()

    if tipo in ("jsonb", "json"):
        # Não é texto, mas carrega texto livre — e é onde mora o nome
        # completo do usuário, em auth.users.raw_user_meta_data.
        return "json_vazio"

    if tipo == "ARRAY" and coluna_e_lista_de_texto:
        # text[]: mesma exposição de uma coluna de texto, em lista.
        return "lista_vazia"

    if not eh_texto(tipo):
        # Data, número, booleano, uuid, enum: passam intactos. São eles que
        # dão o volume e as datas de que o ensaio precisa.
        return "copiar"

    if tem_check_enum:
        # O CHECK prova que só um conjunto fechado de valores é aceito —
        # é enum escrito como texto, e mascarar violaria o próprio CHECK.
        return "copiar"

    if c in PRESERVAR_SEMPRE:
        return "copiar"

    if any(p in c for p in PADROES_CREDENCIAL):
        return "credencial"

    # Formato preservado: casa por sufixo/igualdade, nunca por "contém", para
    # não repetir a armadilha do 'cid' dentro de 'periodicidade'.
    for chave, tratamento in REGRAS_FORMATO:
        if c == chave or c.endswith("_" + chave) or c.startswith(chave + "_"):
            return tratamento

    # Todo o resto: mascarado. É aqui que mora a decisão de falhar para o
    # lado seguro — inclusive nome, endereço, atestado, observação livre.
    return "generico"


# ---------------------------------------------------------------------------
# Expressões de máscara (SQL puro — rodam na produção, que é somente leitura)
# ---------------------------------------------------------------------------

def _semente(col: str, tempero: str) -> str:
    """md5 do valor com o tempero. Base de tudo, e a razão de o mesmo CPF
    virar sempre o mesmo CPF falso."""
    return f"md5({col} || {tempero})"


def expr_cpf(col: str, tempero: str) -> str:
    """CPF falso COM dígito verificador válido — o sistema valida o DV, então
    um CPF inválido seria rejeitado e o ensaio morreria na entrada.

    A base começa com 9 de propósito: na homologação, todo CPF começando com
    9 é reconhecidamente inventado.

    O cálculo é o do próprio DV: soma ponderada decrescente, módulo 11, e o
    resto vira 0 quando é menor que 2.
    """
    s = _semente(col, tempero)
    # 8 dígitos vindos do md5, com o 9 na frente => 9 dígitos de base.
    base = f"('9' || lpad(((('x' || substr({s},1,8))::bit(32)::bigint) % 100000000)::text, 8, '0'))"
    d = lambda i: f"substr(b,{i},1)::int"
    soma1 = " + ".join(f"{d(i)}*{11-i}" for i in range(1, 10))
    dv1 = f"(CASE WHEN (({soma1}) % 11) < 2 THEN 0 ELSE 11 - (({soma1}) % 11) END)"
    # O segundo dígito considera os 9 primeiros mais o primeiro DV.
    soma2 = " + ".join(f"{d(i)}*{12-i}" for i in range(1, 10)) + f" + ({dv1})*2"
    dv2 = f"(CASE WHEN (({soma2}) % 11) < 2 THEN 0 ELSE 11 - (({soma2}) % 11) END)"
    return (f"(CASE WHEN {col} IS NULL THEN NULL ELSE "
            f"(SELECT b || {dv1}::text || {dv2}::text FROM (SELECT {base} AS b) _t) END)")


def expr_cnpj(col: str, tempero: str) -> str:
    """CNPJ falso. Sem cálculo de DV: não achei validação de CNPJ no caminho
    crítico, e um número de 14 dígitos basta para o formato. Se algum CHECK
    reclamar, o COPY falha na cara e a gente conserta — que é o
    comportamento que se quer de um erro."""
    s = _semente(col, tempero)
    return (f"(CASE WHEN {col} IS NULL THEN NULL ELSE "
            f"lpad(((('x' || substr({s},1,8))::bit(32)::bigint) % 100000000)::text, 8, '0') "
            f"|| '000' || lpad(((('x' || substr({s},9,4))::bit(16)::int) % 1000)::text, 3, '0') END)")


def expr_email(col: str, tempero: str) -> str:
    """Domínio .invalid é reservado por norma (RFC 2606) justamente para isto:
    nunca vai existir de verdade, então um disparo acidental de e-mail na
    homologação não chega a lugar nenhum."""
    s = _semente(col, tempero)
    return (f"(CASE WHEN {col} IS NULL THEN NULL ELSE "
            f"'pessoa' || substr({s},1,10) || '@exemplo.invalid' END)")


def expr_telefone(col: str, tempero: str) -> str:
    s = _semente(col, tempero)
    return (f"(CASE WHEN {col} IS NULL THEN NULL ELSE "
            f"'46 9' || lpad(((('x' || substr({s},1,8))::bit(32)::bigint) % 100000000)::text, 8, '0') END)")


def expr_cep(col: str, tempero: str) -> str:
    s = _semente(col, tempero)
    return (f"(CASE WHEN {col} IS NULL THEN NULL ELSE "
            f"lpad(((('x' || substr({s},1,8))::bit(32)::bigint) % 100000000)::text, 8, '0') END)")


def expr_credencial(col: str, tempero: str) -> str:
    """Token não se embaralha para parecer token: se parecer, alguém tenta
    usar. Vira texto que se anuncia."""
    s = _semente(col, tempero)
    return (f"(CASE WHEN {col} IS NULL THEN NULL ELSE "
            f"'invalidado-na-homologacao-' || substr({s},1,12) END)")


def expr_generico(col: str, tempero: str) -> str:
    """Preserva o que a estrutura exige e joga fora o conteúdo:

      · NULL continua NULL  — colunas NOT NULL não quebram, e contagens de
        preenchimento continuam refletindo a produção;
      · valores distintos continuam distintos — restrição de unicidade
        sobrevive, porque o md5 de valores diferentes é diferente;
      · o mesmo valor vira o mesmo texto em toda parte — as ligações por
        nome, que este schema faz por ser denormalizado, continuam de pé.
    """
    s = _semente(col, tempero)
    return f"(CASE WHEN {col} IS NULL THEN NULL ELSE 'anon-' || substr({s},1,12) END)"


def expr_json_vazio(col: str, tempero: str) -> str:
    """Objeto vazio, não NULL: coluna NOT NULL continua válida, e quem lê
    encontra json legítimo em vez de quebrar no parse."""
    return f"(CASE WHEN {col} IS NULL THEN NULL ELSE '{{}}'::jsonb END)"


def expr_lista_vazia(col: str, tempero: str) -> str:
    return f"(CASE WHEN {col} IS NULL THEN NULL ELSE '{{}}'::text[] END)"


EXPRESSOES = {
    "json_vazio": expr_json_vazio,
    "lista_vazia": expr_lista_vazia,
    "cpf": expr_cpf,
    "cnpj": expr_cnpj,
    "email": expr_email,
    "telefone": expr_telefone,
    "cep": expr_cep,
    "credencial": expr_credencial,
    "generico": expr_generico,
}


def expressao(coluna: str, tratamento: str, tempero_sql: str) -> str:
    col = f'"{coluna}"'
    if tratamento == "copiar":
        return col
    return f'{EXPRESSOES[tratamento](col, tempero_sql)} AS {col}'


# ---------------------------------------------------------------------------
# Entrada / saída
# ---------------------------------------------------------------------------

def main() -> int:
    if len(sys.argv) < 3:
        print("uso: gerar_copia_mascarada.py <catalogo.tsv> <tempero>", file=sys.stderr)
        print("  catalogo.tsv: tabela|coluna|tipo|tem_check_enum, vindo do psql", file=sys.stderr)
        return 2

    caminho, tempero = sys.argv[1], sys.argv[2]
    # O tempero entra no SQL como literal entre aspas simples; escapa aspa.
    tempero_sql = "'" + tempero.replace("'", "''") + "'"

    tabelas: dict[str, list[str]] = {}
    nomes: dict[str, list[str]] = {}
    resumo = {"copiar": 0, "generico": 0, "credencial": 0, "json_vazio": 0,
              "lista_vazia": 0, "cpf": 0, "cnpj": 0, "email": 0,
              "telefone": 0, "cep": 0}

    with open(caminho, encoding="utf-8") as f:
        for linha in f:
            linha = linha.rstrip("\n")
            if not linha:
                continue
            partes = linha.split("|")
            if len(partes) < 4:
                continue
            tabela, coluna, tipo, check = partes[0], partes[1], partes[2], partes[3]
            # 5ª coluna, opcional: 't' quando é lista DE TEXTO (text[]).
            lista_texto = len(partes) > 4 and partes[4] in ("t", "true", "1")
            tratamento = classificar(coluna, tipo, check in ("t", "true", "1"),
                                     lista_texto)
            resumo[tratamento] = resumo.get(tratamento, 0) + 1
            tabelas.setdefault(tabela, []).append(
                expressao(coluna, tratamento, tempero_sql))
            nomes.setdefault(tabela, []).append(f'"{coluna}"')

    for tabela, colunas in sorted(tabelas.items()):
        # Uma linha por tabela, três campos separados por TAB:
        #   tabela | expressões já mascaradas | nomes das colunas
        #
        # O terceiro existe para o COPY do destino nomear as colunas em vez
        # de confiar na ordem. Se um dia as duas estruturas divergirem em
        # ordem, um COPY posicional carregaria a coluna errada em silêncio —
        # data em campo de texto, e o erro apareceria longe daqui.
        print(f"{tabela}\t{', '.join(colunas)}\t{', '.join(nomes[tabela])}")

    total = sum(resumo.values())
    mascaradas = total - resumo["copiar"]
    print(f"-- colunas: {total} | copiadas: {resumo['copiar']} | mascaradas: {mascaradas}",
          file=sys.stderr)
    for k in ("cpf", "cnpj", "email", "telefone", "cep", "credencial",
              "json_vazio", "lista_vazia", "generico"):
        if resumo.get(k):
            print(f"--   {k}: {resumo[k]}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
