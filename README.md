# Lansrry — loja de impressão 3D

Continuação do projeto Lansrry existente. O logotipo original foi preservado. O endereço registrado na fonte é Rua São Geraldo, 489 — Ermo, Guaíba/RS, CEP 92702-470; sua confirmação permanece com a empresa.

## Instalar e executar

Requisitos: Node.js 24 e npm. Execute `npm ci`, `npm run build` e `npm start`. O servidor local abre em http://localhost:4173. Para configurar localmente, copie `.env.example` para `.env` e preencha os valores reais. `npm run dev` recompila antes de iniciar.

`npm run typecheck` verifica TypeScript mesmo antes do primeiro build. `npm test` compila automaticamente os dois destinos e testa SSR/API, segurança e concorrência, destino da empresa, pagamentos, atendimento, recuperação e uploads com provedores simulados. A verificação visual e de fluxos está em `tests/browser.mjs`; requer Playwright e Chromium.

`npm run verify:handoff` gera e extrai o ZIP independente em uma pasta temporária, confirma a ausência de `.openai`, Git, dependências e arquivos gerados, instala com `npm ci`, verifica tipos, executa os builds/testes e reempacota a fonte. Requer acesso ao registro npm. O resultado comprova portabilidade da fonte; as integrações dos testes continuam simuladas.

## Arquitetura

React + TypeScript, HTML renderizado no servidor em todas as rotas públicas e Worker compatível com Sites. CSS próprio, sem template de SaaS. O briefing permite adaptar a stack; escolheu-se SSR em Worker para publicar no Sites solicitado, em lugar da hospedagem Netlify recomendada no documento. O código não depende de um banco de arquivo único.

- `src/`: interface, carrinho, formulários, catálogo e painel.
- `server/`: SSR, API, autenticação Firebase, Firestore e upload ao Storage via REST.
- `scripts/build.mjs`: bundle otimizado, HTML de fallback e pacote de publicação.
- `docs/`: guia, pendências e checklist de lançamento.
- `.openai/hosting.json`: vínculo com o projeto do Sites. Preserve seu `project_id`.

Sem credenciais, a aplicação fica em demonstração: os quatro produtos são fictícios e identificados como DEMO; carrinho, pedidos de teste e orçamentos com anexos ficam no navegador. Não há cobrança, cadastro de senha ou envio real de orçamento. Com as quatro configurações Firebase, a aplicação usa o catálogo do Firestore, sem semear produtos DEMO. Falha do catálogo real gera estado indisponível, nunca substituição por produtos fictícios.

## Funcionalidades

Home comercial com banner amplo; categorias; catálogo com busca, filtros, ordenação e paginação; produto com galeria, variações simples, especificações opcionais e frete; carrinho persistente; checkout de homologação Mercado Pago; histórico de pedidos; login/cadastro/logout Firebase; orçamento com anexo e honeypot; painel para produtos, estoque, imagens, SEO, pedidos e anexos.

Metadados SSR, canonical, JSON-LD factual, sitemap dinâmico, robots.txt, llms.txt, favicon e Open Graph derivados da logo. Produtos DEMO não recebem Schema Product/Offer nem entram no sitemap. Rotas privadas e política ainda pendente não são indexáveis. O projeto Sites existente tem acesso público; esta etapa salva fonte sem mudar acesso, domínio ou publicação.

## Segurança

Senhas são encaminhadas ao Firebase Authentication, nunca armazenadas no site. Sessões usam cookies HttpOnly, SameSite e Secure em HTTPS. A identidade é validada no Google em cada operação protegida; autorização administrativa depende do UID no servidor. Regras do banco negam toda gravação direta e leitura direta dos registros privados. O servidor usa uma conta de serviço com IAM; as regras Firebase não substituem o controle de acesso do servidor. Preços e estoque são recalculados e reservados em transação Firestore para pagamentos reais. Webhook valida HMAC e consulta o pagamento no Mercado Pago. Dados de cartão ficam exclusivamente no gateway.

Os limites de login e formulários são compartilhados no Firestore, por IP e, no login, por conta. O ingresso Cloudflare fornece CF-Connecting-IP; cabeçalhos X-Forwarded-For não controlam esses limites. Consulte docs/SEGURANCA.md.

## Entrega definitiva à empresa

A hospedagem definitiva foi preparada para Cloudflare Workers com Static Assets em uma conta da empresa. O destino usa o mesmo SSR e APIs, com os assets separados, sem código-fonte ou HTML DEMO na pasta pública. Não depende da conta Sites/ChatGPT do vendedor. O domínio comprado permanece o mesmo; DNS, contas e implantação não foram alterados nesta etapa.

Execute `npm run build:company`, `npm run check:company` (após preparar company.secrets.json), e `npm run package:handoff`. A fonte transferível fica em dist/entrega/lansrry-fonte.zip e não inclui o vínculo do projeto Sites. O arquivo privado de configuração é ignorado pelo Git e excluído da fonte.

O destino da empresa força modo de produção: configurações básicas ausentes dão 503 sem voltar à demonstração. CHECKOUT_ENABLED começa como false para impedir pedidos antes da homologação. /healthz confere somente a configuração, sem diagnosticar provedores. Código e guia só são acessíveis ao administrador quando o Sites estiver conectado; a fonte Cloudflare não é publicada como download.

Instruções e responsabilidades: docs/TRANSFERENCIA-EMPRESA.md. A empresa precisa de responsável técnico para atualizações e incidentes. Preparar a portabilidade não equivale a implantar ou homologar vendas reais.

## Versão de revisão no Sites

O código está vinculado ao repositório gerenciado do Sites. Execute build, faça commit/push da fonte exata e salve/publique uma versão pelo Sites. O pacote contém `.openai/hosting.json`, `dist/server/index.js` e `dist/client`. Valores de produção são configurados no ambiente do Sites, não no arquivo hosting.json. Não use `dist/client` isoladamente para a loja real: o Worker fornece o banco, sessões, APIs e SSR dinâmico.

Guia completo: `docs/CONFIGURACAO.md`. Pendências: `docs/PENDENCIAS.md`. Lançamento: `docs/CHECKLIST-LANCAMENTO.md`.

## Referências técnicas primárias

- Firebase Authentication REST: https://firebase.google.com/docs/reference/rest/auth
- Firestore REST: https://firebase.google.com/docs/firestore/use-rest-api
- Mercado Pago Checkout Pro: https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/overview
- Notificações Mercado Pago: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications

## Continuação sem publicação

PAYMENTS_MODE=test agora chama o Mercado Pago e exige vendedor de teste confirmado; não é simulação. Use Firebase e catálogo de homologação isolados. O checkout começa bloqueado. Leia docs/PAGAMENTOS.md e docs/OPERACAO.md antes de configurar.

Foram acrescentados atendimento/devolução persistente com protocolo e painel protegido, recuperação de senha, páginas legais em minuta até aprovação dos donos, consentimento recusável/revogável e Analytics via proxy sem campos dos formulários. A operação real exige configuração e homologação externas.
