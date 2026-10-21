# Políticas, consentimento e medição — revisão preparada

As quatro páginas têm conteúdo completo de revisão, sem inventar razão social, CNPJ, encarregado, prazo de guarda ou procedimento de logística. Até a aprovação, a interface identifica a minuta e as páginas não são indexáveis. Os textos fornecidos em PRIVACY_POLICY_TEXT, TERMS_TEXT e RETURNS_POLICY_TEXT substituem as respectivas minutas; não são interpretados como HTML.

## Decisões dos donos antes da coleta real

- Confirmar razão social/nome do fornecedor e documento (LEGAL_CONTROLLER_NAME, LEGAL_CONTROLLER_DOCUMENT), endereço, horário e contatos já presentes na v7.
- Confirmar o canal e responsável pela privacidade (PRIVACY_CONTACT), as bases por finalidade e o inventário de tratamentos. Definir DATA_RETENTION_POLICY com prazos, exceções legais, exclusão e descarte dos backups.
- Revisar os textos oficiais da empresa e as minutas, incluindo tratamento de menores, operadores, países e transferências internacionais. Publicar os textos aprovados nas variáveis correspondentes e só então configurar LEGAL_APPROVED=true.
- Definir resposta ao consumidor, logística reversa, custeio aplicável, endereço de retorno e acompanhamento de estorno sem reduzir garantias legais. A minuta não exclui automaticamente produtos personalizados do arrependimento.
- Confirmar que protocolo na tela é a confirmação efetivamente implementada. Não há confirmação por e-mail nem SLA de atendimento ativado.

## Consentimento

Necessários permanecem separados da medição opcional. O banner oferece aceitar e recusar com o mesmo destaque; o controle permanente no rodapé permite recusar após aceitar. A escolha contém somente versão, categoria booleana e data no armazenamento local, com validade de até 180 dias. Medição recusada/não decidida não faz chamada de Analytics. Bloqueio de localStorage impede ativar a medição. A revogação remove o identificador local e aborta chamadas do navegador em andamento; não remove dados já recebidos por Google. Limpar dados do navegador reinicia a escolha. O mapa só é carregado após clique específico por página e pode ser removido; essa autorização não ativa Analytics.

## Analytics: código pronto, propriedade ainda não homologada

Optou-se por Measurement Protocol no servidor. Nenhum gtag.js, GTM, pixel ou biblioteca de medição roda no navegador, evitando coleta automática de campos ou eventos de formulários. Após aceite, o navegador envia exclusivamente consent:true, UUID aleatório e uma rota fixa permitida. Só `/`, `/loja`, `/produtos`, `/servicos`, `/sobre` e `/localizacao` são medidas. Busca, parâmetros, referrer, conta, produto, checkout, suporte, orçamento e administração não entram no evento. O servidor rejeita campos adicionais e constrói o payload por allowlist, sem encaminhar IP, User-Agent ou outros cabeçalhos do visitante. O Google recebe a conexão do servidor e aplica seus próprios tratamentos técnicos.

Para ativar: configurar GA_MEASUREMENT_ID, GA_API_SECRET no gerenciador de segredos, GA_ANALYTICS_ENABLED=true e aprovação legal. O segredo nunca é entregue ao navegador. A presença de configuração não comprova recebimento ou qualidade do relatório. O Measurement Protocol é uma medição limitada e não fornece, por este código, atribuição, sessão, comércio eletrônico ou relatório completo equivalente à tag do Google. Validar o evento com a ferramenta oficial de validação, depois verificar sua recepção na propriedade da empresa; definir retenção, filtros de tráfego interno e acesso. Resposta HTTP 2xx do Google indica recebimento HTTP, não validação ou processamento do evento. Não há reenvio automático de falhas.

## Fontes consultadas em 21/10/2026

- [LGPD compilada, Planalto](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm): informação ao titular, bases de tratamento e direitos.
- [CDC compilado, Planalto](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm): garantias, vícios e arrependimento em contratação à distância.
- [Guia de cookies da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais): escolhas específicas, recusa acessível e revogação.
- [Google Analytics — envio pelo Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events) e [referência do protocolo](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference): payload mínimo e limites de comprovação pelo status HTTP.

São referências para a implementação, não certificado de conformidade. A configuração, a operação e a revisão dos textos precisam ser confirmadas pelos responsáveis.
