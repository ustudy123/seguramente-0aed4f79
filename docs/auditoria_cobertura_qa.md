# Auditoria de Cobertura do Agente de QA

**O que este documento responde:** dos módulos já cobertos por testes, quais tabelas ficaram de fora — e quais dessas realmente merecem cobertura.

**Data:** 18 de julho de 2026
**Motivo:** ao trazer a especificação de testes do módulo Metas, ficou evidente que a cobertura de um módulo estava muito menor do que parecia. Esta auditoria verifica se o mesmo aconteceu nos demais.

---

## 1. O resultado

O sistema tem **323 tabelas**. Os 14 módulos testados cobrem **24 tabelas**. Nas famílias desses mesmos módulos existem outras **43 tabelas sem nenhum teste**.

| Módulo | Testadas | Existem na família | Cobertura |
|---|---|---|---|
| Departamentos | 1 | 1 | completa |
| Estabelecimentos / Obras | 1 | 1 | completa |
| Organograma | 1 | 1 | completa |
| Identidade Estratégica | 1 | 1 | completa |
| Planejamento Estratégico (SWOT) | 2 | 2 | completa |
| Planejamento Estratégico (Oceano) | 2 | 2 | completa |
| Cargos | 1 | 2 | 1 fora |
| Documentos | 3 | 5 | 2 fora |
| Colaboradores | 2 | 5 | 3 fora |
| Empresa | 1 | 4 | 3 fora |
| Prestadores / Terceiros | 2 | 5 | 3 fora |
| Plano de Ação | 2 | 8 | 6 fora |
| **Metas** | **2** | **12** | **10 fora** |
| **Hub Contábil** | **3** | **18** | **15 fora** |

Seis módulos estão completos. Os problemas se concentram em **Metas**, **Hub Contábil** e **Plano de Ação**.

### Um número não é um diagnóstico

Das 43, uma boa parte são tabelas de log, histórico e staging — estruturas simples, com o mesmo padrão (chave estrangeira em `CASCADE`, campos obrigatórios básicos) que os testes já existentes verificam à exaustão. Testá-las somaria casos sem somar informação.

A classificação abaixo separa o que importa do que é volume.

---

## 2. Alta prioridade — regra de negócio própria (12 tabelas)

Estas carregam lógica que nenhum teste atual verifica.

### 2.1 `terceiro_documentos` — controle de validade de documentos de terceiros

**Por que importa:** guarda os documentos das empresas prestadoras (PGR, PCMSO, LTCAT, ASO, contratos) com data de validade e um status calculado por enum (`valido`, `a_vencer`, `vencido`, `pendente`).

**Observação importante:** esta tabela é citada no relatório da equipe como *exemplo de boa prática* — o modelo de validade automática que falta no módulo geral de documentos. Essa citação foi feita a partir da leitura do código, **não de teste executado**. A automação precisa ser verificada na prática antes de ser usada como referência.

### 2.2 `terceiro_treinamentos` — treinamentos de trabalhadores terceirizados

**Por que importa:** controla se o pessoal terceirizado tem os treinamentos de SST exigidos para acessar as instalações. É controle de segurança com implicação legal direta.

### 2.3 `empresa_obrigacoes` — conformidade legal da empresa

**Por que importa:** registra obrigações por categoria (legal, SST, estratégica, financeira) e subcategoria (`cipa`, `sesmt`, `pcd`, `fap`, `tac`), com status de conformidade e criticidade.

E tem uma integração relevante: o campo `acao_gerada_id` aponta para `plano_acoes`. Ou seja, **uma obrigação não conforme pode gerar automaticamente uma ação no plano**. Essa ligação entre módulos não é verificada por nenhum teste.

Também é o ponto onde a cota PcD se conecta ao acompanhamento de conformidade — relevante para a especificação de cotas.

### 2.4 `colaborador_condicoes_especiais` — insalubridade e periculosidade

**Por que importa:** guarda grau de insalubridade, tipo de periculosidade, base de cálculo e **valores calculados de adicional**, incluindo a regra de prevalência do art. 193 §2º da CLT (não se acumula insalubridade e periculosidade; aplica-se a mais vantajosa).

Há cálculo financeiro com fundamento legal aqui, e nenhum teste o verifica.

### 2.5 `usuario_perfil_vinculos` — perfis e permissões

**Por que importa:** liga usuários a perfis de acesso. Nenhum teste atual cobre a atribuição de permissões — que é a base de quem pode ver e fazer o quê.

### 2.6 `cargo_departamentos` — relação entre cargo e departamento

**Por que importa:** é uma tabela de ligação (um cargo pode existir em vários departamentos). O teste atual de Cargos trata a relação como campo simples; a estrutura real é mais rica.

### 2.7 a 2.10 `metas_indicadores`, `metas_configuracao`, `metas_participantes`, `metas_workflow_log`

**Por que importam:** são o coração do módulo Metas, e nenhuma é testada.

- **`metas_configuracao`** parametriza por cliente quais níveis de meta são habilitados e se o vínculo com objetivo estratégico, o indicador e a aprovação são obrigatórios. Ou seja: as regras de obrigatoriedade **variam por cliente**, e nenhum teste verifica se essa parametrização é respeitada.
- **`metas_indicadores`** define o indicador (nome, tipo, unidade, direção, fórmula de medição). É o que torna a meta mensurável.
- **`metas_participantes`** sustenta a meta compartilhada.
- **`metas_workflow_log`** registra as transições do fluxo de aprovação.

### 2.11 e 2.12 `hub_processos`, `hub_certidoes`

**Por que importam:** `hub_processos` é a unidade central de trabalho do Hub Contábil — os testes atuais cobrem contabilidades, competências e guias, mas não o processo em si. `hub_certidoes` guarda certidões com validade, mesmo tema do item 2.1.

---

## 3. Média prioridade — funcionais, padrão conhecido (18 tabelas)

Carregam função real, mas seguem estruturas que os testes atuais já exercitam em outros lugares (vínculo em cascata, campos obrigatórios, isolamento por cliente). Cobrir traz ganho moderado.

**Metas:** `metas_checkins`, `metas_evidencias`, `meta_acoes`, `meta_acao_tempo`, `meta_aem`
**Plano de Ação:** `plano_evidencias`, `plano_participantes`, `plano_tempo`, `plano_templates`
**Hub Contábil:** `hub_documentos`, `hub_processo_documentos`, `hub_processo_checklist`, `hub_processo_assinaturas`, `hub_checklist_templates`, `hub_calendario_envios`, `hub_calendario_status`, `hub_catalogo_documentos`
**Empresa:** `empresa_experiencia_config`

---

## 4. Baixa prioridade — log, histórico e apoio (13 tabelas)

Estruturas de registro sem regra de negócio própria. O padrão delas (chave estrangeira em cascata, campos de quem/quando) já é verificado por dezenas de testes existentes. Testá-las aumentaria a contagem sem aumentar a segurança.

`usuario_audit_log`, `terceiro_audit_log`, `documento_audit_log`, `meta_historico`, `plano_historico`, `hub_historico`, `hub_processo_historico`, `plano_comentarios`, `hub_processo_comentarios`, `documento_categorias_padrao`, `empresa_import_pendencias`, `hub_config`, `hub_notificacao_config`

> **Exceção a considerar:** as tabelas de auditoria têm valor de *governança* — se um dia for preciso provar quem alterou o quê, elas são a evidência. Um teste que confirme "criar registro X gera entrada no log de auditoria" teria valor, mesmo sendo estruturalmente simples. Vale como decisão de produto, não de risco técnico.

---

## 5. O que esta auditoria revelou sobre o método

Os testes foram construídos módulo a módulo, partindo da tabela principal de cada um. Onde o módulo era simples (Departamentos, Cargos, Organograma, Identidade), isso bastou — a cobertura ficou completa.

Onde o módulo é uma estrutura composta, a abordagem falhou de forma consistente. Em Metas, cobrir `metas` e `meta_okrs` deu a impressão de módulo testado, quando dez tabelas com regras próprias ficaram intocadas — incluindo a que parametriza as obrigatoriedades por cliente.

**A correção de método:** antes de escrever os testes de um módulo, listar todas as tabelas da família e decidir explicitamente quais entram e quais ficam de fora — registrando o porquê. Um módulo "coberto" precisa dizer *o que* está coberto.

---

## 6. Recomendação

Uma ordem de trabalho possível:

1. **`terceiro_documentos`** — é usada como referência de boa prática no relatório da equipe e nunca foi verificada. Confirmar primeiro.
2. **`metas_configuracao` + `metas_indicadores`** — as regras do módulo Metas variam por cliente e ninguém verifica se são respeitadas.
3. **`empresa_obrigacoes`** — conformidade legal e a integração que gera ação no plano.
4. **`colaborador_condicoes_especiais`** — cálculo de adicional com fundamento na CLT.
5. **`terceiro_treinamentos`** — controle de acesso de terceirizados.

As demais conforme o risco justificar. As de baixa prioridade, provavelmente nunca — e isso é uma decisão legítima, desde que registrada.

---

*Auditoria feita comparando as tabelas criadas nas migrations com as efetivamente exercitadas pelos casos de teste existentes.*
