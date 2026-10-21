# Pagamentos, conciliação e reservas

Preparação da fonte em 21/10/2026. Nenhuma conta, credencial, webhook ou agendamento externo foi configurado nesta etapa. Os testes automatizados substituem Firebase e Mercado Pago por serviços simulados; não comprovam uma homologação real.

## Ambientes

Sem Firebase, a demonstração permanece no navegador. Com Firebase, `PAYMENTS_MODE=test` agora chama a API do Mercado Pago: autentica o vendedor em `GET /users/me`, cria uma preferência e exige pagamentos com `live_mode=false`. Não registra mais uma simulação local como se fosse homologação. `live` exige vendedor real, `live_mode=true` e frete configurado. Ambos reservam estoque do respectivo banco.

Para homologação, os donos devem usar um projeto Firebase e bucket isolados, catálogo fictício próprio de teste, vendedor de teste e comprador de teste brasileiros distintos. Nunca apontar o ambiente de teste para o estoque da operação real. Configure os valores diretamente no gerenciador de segredos da conta, sem enviá-los no chat:

| Configuração | Significado |
| --- | --- |
| `PAYMENTS_MODE=test` | Habilita fluxo de homologação com vendedor de teste |
| `MERCADO_PAGO_ACCESS_TOKEN` | Credencial do vendedor de teste para Checkout Pro |
| `MERCADO_PAGO_SELLER_ID` | ID numérico do vendedor esperado; não é segredo |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Chave de assinatura das notificações dessa integração |
| `SITE_URL` | Origem HTTPS do ambiente aprovado, sem trocar o domínio atual nesta entrega |
| `RESERVATION_MINUTES` | Duração da preferência/reserva: padrão 30, mínimo 10, máximo 1440 |
| `RESERVATION_AUTO_RELEASE=false` | Reposição automática desabilitada por padrão; manter assim até os donos aprovarem a política e a homologação dos tempos de propagação |
| `CHECKOUT_ENABLED` | Manter `false` na operação até homologação e aprovação dos responsáveis |

A consulta da conta precisa retornar o ID configurado e a tag `test_user` em teste; em `live`, essa tag é recusada. Credenciais Checkout Pro de teste podem começar com `APP_USR`: o prefixo sozinho não define o ambiente. A URL usada é `init_point`, inclusive para a conta de teste, conforme orientação do provedor. [Contas de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/test-accounts), [compras de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/integration-test/test-purchases) e [orientação oficial sobre init_point](https://http2.mlstatic.com/frontend-assets/dx-devsite/devprogram/2022-11-29/checkoutProPT.pdf).

## Conciliação e encerramento

A aplicação consulta pagamentos por `external_reference` com paginação completa, até 100 registros, e consulta novamente cada pagamento individual. Valida referência, vendedor, modo, moeda e valor em centavos. Acima desse limite ou com resposta incompleta/inconsistente, mantém o estoque reservado e exige revisão. O payload bruto de pagamento e dados de cartão não são registrados nos eventos administrativos. [Buscar pagamentos](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api-payments/search-payments/get) e [obter pagamento](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api-payments/get-payment/get).

O painel administrativo oferece conciliação e pedido de cancelamento. As rotas correspondentes exigem autenticação administrativa a cada chamada:

- `POST /api/admin/orders/:id/reconcile`: atualiza o estado a partir do provedor; se a reserva venceu, inicia o encerramento.
- `POST /api/admin/orders/:id/cancel`: fecha a preferência e solicita cancelamento de cobranças ainda pendentes; pagamento aprovado segue para decisão de reembolso dos responsáveis.
- `POST /api/admin/payments/reconcile`: processa um pedido vencido para conciliação, respeitando o mesmo controle de acesso.

Expiração e cancelamento primeiro retiram o link de checkout e fecham a preferência por `PUT`; depois confirmam o fechamento por `GET`. Isso não cancela automaticamente um boleto, Pix ou autorização já emitida. A aplicação solicita o cancelamento de pagamentos pendentes e consulta novamente o resultado. Falha, timeout, preferência sem ID confirmado ou pedido legado sem vendedor/modo verificáveis preservam a reserva. Nunca se repete a criação da preferência quando a resposta do POST foi perdida. [Atualizar preferência](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/update-preference/put) e [cancelar pagamento](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/create-cancellation/put).

A reposição automática exige `RESERVATION_AUTO_RELEASE=true`, preferência fechada, pelo menos um pagamento encontrado, todos os pagamentos conhecidos rejeitados/cancelados e duas consultas completas com a mesma composição e estado separadas por pelo menos 15 minutos. Uma nova tentativa visível reinicia essa observação. Os snapshots locais também precisam ser terminais. Com a flag ausente ou `false`, mesmo evidências completas deixam `terminal_ready_review_required` e preservam o estoque reservado. A transação Firestore impede reposição duplicada e preserva aprovações concorrentes; produtos ou variações removidos exigem conferência manual.

**Limite operacional:** duas buscas consistentes e 15 minutos de observação reduzem a janela de propagação, mas não provam a inexistência absoluta de uma cobrança ainda invisível na API do provedor. Esse intervalo é uma hipótese conservadora do código, não uma garantia do Mercado Pago. Por isso a reposição automática permanece desabilitada por padrão. A empresa deve validar os tempos e os meios habilitados na homologação e aceitar essa política de estoque antes de optar por `RESERVATION_AUTO_RELEASE=true`. Nenhuma flag foi habilitada em serviço externo nesta entrega. Uma busca vazia nunca autoriza reposição automática. Pedidos liberados continuam previstos para conciliação diária; aprovação tardia marca `paid_review_required` sem baixar novamente o estoque, para evitar ocultar venda já prometida a outro comprador.

Reembolsos totais, parciais, contestações e chargebacks ficam em estados explícitos de revisão. Não repõem produtos automaticamente: os donos precisam conferir devolução física, integridade da peça, expedição já realizada, eventual personalização e obrigações legais. O reembolso financeiro é realizado pelos responsáveis no painel Mercado Pago; esta versão concilia o resultado e não inicia reembolsos automáticos. Identificadores de pagamentos adicionais permanecem visíveis para investigação. Eventos antigos não apagam um reembolso e valores parciais reembolsados não diminuem por um evento repetido.

Fluxo operacional de devolução/reembolso: localizar o protocolo em Atendimento; conferir identidade, pedido e direito aplicável; registrar o acompanhamento do atendimento; o dono autorizado inicia o reembolso total/parcial no painel Mercado Pago e guarda o ID; usar Conciliar no pedido para obter `refund_review_required`; informar o cliente pelo canal de atendimento; acompanhar recebimento e inspeção da mercadoria; somente após decisão do responsável ajustar manualmente o estoque no cadastro de produto, cuja gravação é auditada. Encerrar o atendimento após tratar as obrigações e guardar as evidências. O estado de revisão do pagamento não impede o exercício do direito de devolução e não substitui a análise da solicitação. A atualização do pagamento principal não apaga a revisão de reembolso de um pagamento adicional.

## Agendamento e capacidade

`reconcileReservations(env)` está preparado para execução pelo Worker da empresa. Consulta o índice ascendente simples de `orders.nextReconcileAt`, processa **um pedido por invocação**, adia falhas em 15 minutos para não bloquear a fila e grava resumo em `paymentRuns`. Pedidos pagos ou liberados são verificados diariamente. O índice de campo único normalmente é automático no Firestore: confirmar que `nextReconcileAt` não foi excluído da indexação; não criar índice composto sem exigência da consulta real.

O handler preparado não equivale a Cron Trigger ativo. Os donos e o técnico devem configurar um Cron Trigger na conta da empresa, testar a execução e acompanhar atraso da fila, falhas e ausência de resumos. Com um pedido por invocação, a frequência deve comportar o volume real e as revisões diárias. No Sites, nenhum agendamento foi criado nesta entrega; o cron da empresa não deve ser presumido ativo no Sites.

A conciliação pode exceder 50 subrequisições quando há vários pagamentos, cancelamentos ou conflitos transacionais. O lote de um pedido limita trabalho, mas **não assegura compatibilidade com Workers Free**. Confirmar plano pago, orçamento e limites de CPU/subrequisições da conta e realizar teste de carga antes da operação; não aumentar o lote sem medição. A documentação consultada informa 50 subrequisições no Free e 10.000 por padrão no Paid, além de 15 minutos de duração máxima para Cron Triggers. [Limites Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits/).

## Evidências exigidas na reunião

1. Autenticar comprador e vendedor de teste e confirmar que o vendedor esperado é recusado quando o modo configurado é incompatível. Guardar apenas IDs e resultados, sem tokens.
2. Criar preferência pelo site, concluir compra com cartão de teste e confirmar `live_mode=false`, vendedor, BRL, total e referência pela consulta autenticada.
3. Validar assinatura de webhook real, notificação repetida e retorno do navegador sem confiar nos parâmetros da URL como prova de pagamento.
4. Testar aprovação, rejeição, pendência, cancelamento, reembolso total/parcial e evento fora de ordem. Meios não disponíveis no ambiente de teste precisam de validação específica antes da ativação; não marcar o cenário como aprovado sem evidência.
5. Interromper resposta do gateway, reenviar a mesma operação e verificar ausência de segunda preferência e de reposição indevida. Testar duas compras da última unidade.
6. Expirar uma preferência, confirmar fechamento, verificar que pagamentos pendentes foram encerrados e que a reserva aguarda as duas conciliações. Busca vazia ou incerta deve manter o estoque reservado.
7. Confirmar execução real do cron, limites da hospedagem, fila sem atraso, alertas e responsável por revisão diária. Conferir pedidos legados manualmente antes de atribuir vendedor, modo ou agenda; não fazer migração presumindo esses dados.
8. Somente depois das evidências, configurar credenciais reais no ambiente da operação e avaliar a liberação do checkout. Qualquer teste com dinheiro real depende de decisão dos donos; não é necessário para concluir o código desta entrega.

`node tests/payments.mjs` cobre 29 cenários com serviços simulados, incluindo modo teste, concorrência, timeouts, fechamento, período de observação, paginação, reembolso parcial, pagamento adicional, variações removidas, aprovação tardia e bloqueio padrão da reposição automática. Os casos que exercitam a reposição usam opt-in somente nos serviços simulados. Os 23 testes de segurança existentes continuam verificando transações concorrentes e repetição de webhook. Nenhum deles comprova contratação, disponibilidade ou qualidade de serviço em produção.
