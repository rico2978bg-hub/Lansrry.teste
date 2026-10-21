# Operação preparada — serviços ainda não configurados

Esta etapa conserva o projeto Lansrry e seu domínio. Nenhum deploy, DNS, regra Firebase, segredo ou serviço externo foi alterado. Os donos configurarão suas contas na reunião; não enviar senhas, cartões ou chaves privadas na conversa.

## Reunião e liberação

1. Separar homologação e produção: projeto Firebase, bucket, catálogo, usuários e vendedor de teste Mercado Pago. `PAYMENTS_MODE=test` chama o provedor e reserva estoque nesse banco. A demonstração sem Firebase continua local e fictícia.
2. Configurar Auth, conta de serviço com IAM mínimo, Firestore/índices e bucket privado. Conferir regras fornecidas e acesso direto negado. Testar dois clientes e um administrador autorizado por `ADMIN_UIDS`.
3. Aprovar identificação/documento empresarial, contato de privacidade, retenção e textos legais finais. Preencher configuração e só então `LEGAL_APPROVED=true`. O alvo da empresa falha fechado enquanto esses dados faltarem. Ver PRIVACIDADE-E-POLITICAS.md.
4. Manter `CHECKOUT_ENABLED=false` até os testes reais de PAGAMENTOS.md. `check:company` valida formato/presença; `healthz` confere configuração. Nenhum dos dois comprova provedores funcionando.
5. Guardar segredos no ambiente/gerenciador da empresa. O exemplo contém apenas campos. A fonte independente exclui `.openai`, credenciais, gerados e dependências.

## Frete

Adaptador HTTPS preparado, ainda sem transportadora configurada. Confirmar CEP de origem (v7: 92702-470), contratos, cobertura, retirada, embalagem, pesos, medidas e prazo de fabricação. O catálogo atual não resolve esses dados automaticamente.

POST `SHIPPING_QUOTE_URL`: `{fromCep,toCep,items:[{id,variant,qty}]}`; Bearer opcional via `SHIPPING_API_KEY`. O adaptador deve consultar SKU/peso/medidas/preços confiáveis da empresa, nunca valores do navegador. Resposta `{amount:number,label:string}` em BRL, finito não negativo. O servidor recalcula no pedido. Falha bloqueia compra. Sem URL há somente simulação rotulada; live recusa comprar sem adaptador. Ainda não há rastreio, etiqueta ou seleção de modalidades.

Testar CEP atendido/não atendido/remoto, variantes, alteração de quantidade, prazo de fabricação e indisponibilidade. Confirmar se o contrato exige identificador/validade de cotação adicional.

## Conciliação e monitoramento

Handler `scheduled` preparado no alvo Cloudflare; Wrangler não ativa cron. Na homologação, definir intervalo (exemplo a decidir: cinco minutos), conferir plano/limites de CPU/subrequests, executar e observar `paymentRuns`. Lotes limitados precisam de capacidade compatível com a fila. Pedidos v7 sem vendedor/modo/agenda verificáveis exigem migração revisada, sem inventar evidência de pagamento.

Configurar alertas de 5xx/latência, webhook, `review_required`, reservas antigas, falta de `paymentRuns`, cron, consumo e recuperação de conta. Criar monitor autenticado separado de conectividade/compra de teste. Nenhum monitor deve cobrar em produção por padrão.

Observability está declarada, sem garantia de coleta/retencão/alerta no serviço. Logs automáticos podem conter URLs: não colocar dados pessoais em query; filtrar/redigir no destino e restringir retenção/acesso. Código não faz log de corpo de formulário, senha, cartão ou segredo. `GET /api/admin/audit` expõe somente ao administrador UID, ação, alvo e horário registrados no catálogo/atendimento e intenções de conciliação. Essa coleção não é log imutável: IAM de escrita pode alterá-la. Ativar Cloud Audit Logs e retenção protegida conforme decisão dos donos.

## Recuperação e arquivos

`POST /api/auth/recover` solicita PASSWORD_RESET ao Firebase com resposta igual para e-mail conhecido/desconhecido. Habilitar proteção contra enumeração; conferir domínio autorizado, modelo de e-mail, spam, link vencido/reutilizado e novo login. Rate limit e indisponibilidade têm respostas próprias.

Uploads conferem tamanho, extensão, MIME, assinatura/estrutura raster, dimensões e geometria STL ASCII/binária. Não são antivírus nem decodificador completo. PDF/STL devem ser tratados como não confiáveis e abertos em ferramentas isoladas; scanner/quarentena dependem da política da empresa. Conferir exportadores reais. Referências privadas são download com `nosniff`.

## Analytics

`GA_ANALYTICS_ENABLED=false` por padrão. Donos configuram stream GA4, Measurement Protocol secret e ID `G-...`, aprovam aviso/retenção e validam payload/ingestão no Google. `204` não confirma processamento/relatório. O proxy envia só UUID e rota pública permitida; não encaminha cabeçalhos do visitante, query, referrer, conta ou formulários. O Google recebe dados técnicos da conexão do servidor. Sem gtag/enhanced measurement/DOM automático.

Aceite/recusa duram até 180 dias. Recusa/revogação apagam identificador e bloqueiam novos eventos; não desfazem eventos anteriores. Mapa exige ação explícita e pode ser removido. Testar storage bloqueado, outra aba e navegação sem consentimento.

## Backups e recuperação

Nenhum backup ativado. Definir responsável/substituto, RPO/RTO, retenção e orçamento. Ativar backups Firestore e avaliar PITR; manter regras/índices/configuração em repositório privado. Storage exige política própria de soft delete/versionamento/cópia isolada: backup Firestore não inclui objetos.

Ensaiar em ambiente isolado: restaurar banco suportado, recuperar objetos, conferir contagens/amostras, login, anexos e protocolos. Antes de trocar banco, bloquear checkout e conciliar pagamentos posteriores ao ponto restaurado com Mercado Pago. Uma restauração antiga não pode tornar disponível estoque de pedidos já pagos. Conferir reenvios idempotentes. Registrar data, duração, resultado e responsável; implantação/cutover dependem de aprovação posterior.

## Fontes oficiais

- [Firebase Auth REST](https://firebase.google.com/docs/reference/rest/auth)
- [Backups Firestore](https://firebase.google.com/docs/firestore/backups) e [recuperação](https://firebase.google.com/docs/firestore/disaster-recovery)
- [Cloud Storage soft delete](https://docs.cloud.google.com/storage/docs/soft-delete)
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) e [Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/)

Contas, planos, permissões, alertas e recuperação efetiva precisam ser verificados com os donos.
