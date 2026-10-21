# Validação desta continuação — 21/10/2026

Base confirmada: versão salva 7 do projeto `appgprj_6abd6b54f020819184526f9b43c93ce2`, commit `4f13a5ffa19fb73ff7dacbfe84a4d00fca488208`. O repositório foi aberto nessa revisão antes das edições. O ZIP anexado foi lido; a implementação usa a fonte salva, sem depender da aplicação publicada.

## Resultado automatizado

Ambiente executado: Windows, Node 24.17.0, npm 11.13.0. O requisito do pacote agora é Node 24 ou posterior. Não houve execução em Linux nesta sessão.

- `npm ci --no-audit --no-fund`: 46 dependências instaladas a partir do lockfile.
- `npm run typecheck`: passou, inclusive sem módulos gerados prévios.
- `npm test`: seu pretest prepara `build` e `build:company`; passaram runtime SSR/rotas/arquivos/metadados, 23 testes de segurança, 9 do destino empresa, 29 de pagamentos e 17 da continuação — **78/78 subtestes**, sem falhas — além do script assertivo específico de Analytics.
- `npm run verify:handoff`: passou na extração do ZIP independente, inicialmente sem `.openai`, `.git`, `dist`, `node_modules` ou arquivos gerados. Repetiu instalação, TypeScript, os dois builds, a suíte inteira e `package:handoff`. Conferiu que nenhum `.openai` foi criado artificialmente.
- `tests/browser.mjs` com Playwright e Chrome instalado: passou em 11 rotas × 4 larguras (320, 390, 768, 1440), checkout/carrinho/orçamento demonstrativos, atendimento/protocolo/painel, teclado/foco/abas/menu, mapa bloqueado e consentimento aceitar/recusar/revogar. Imagens carregadas e screenshots desktop/mobile inspecionadas. O servidor local foi encerrado pelo teste.
- `git diff --check`: sem erros de whitespace.

A revisão adicional encontrou e corrigiu a aceitação de expoente infinito em STL ASCII e o bloqueio indevido de APIs operacionais por pendências da vitrine. Testes de regressão foram incluídos na suíte de continuação. Imagens PNG/JPEG/WEBP reais do projeto passam; imagens truncadas, CRC PNG alterado e arquivos disfarçados são recusados.

## Limites desta evidência

Firebase, Storage, Mercado Pago, frete, recuperação de senha e Analytics foram exercitados com serviços simulados nos testes. Não houve transação financeira, autenticação nas contas dos donos, e-mail entregue ou comprovação de ingestão Google. O navegador verificou demonstração e consentimento instrumentado com configuração simulada; não valida o checkout real do provedor.

Não se comprovam carga/produção, disponibilidade, dispositivos físicos, todos os leitores de tela, antivírus/decodificação completa de arquivos, conformidade jurídica ou backups/recuperação efetivos. As páginas legais permanecem em minuta até aprovação. Cron, alertas, backups, regras e integrações precisam de configuração externa.

`CHECKOUT_ENABLED=false`, `GA_ANALYTICS_ENABLED=false`, `LEGAL_APPROVED=false` e `RESERVATION_AUTO_RELEASE=false` nos exemplos. A reposição automática depende de opt-in explícito e de todas as evidências da rotina; não é habilitada nesta entrega. Busca vazia/timeout não libera estoque. Reembolso financeiro é feito pelos donos no Mercado Pago e conciliado pelo código, sem reposição automática da mercadoria.

Nenhum deploy, mudança de domínio/DNS/acesso, criação de outro Site ou gravação de segredos externos faz parte desta etapa. A nova fonte será salva como versão sem implantação. Após a reunião, confrontar resultados com PENDENCIAS.md, PAGAMENTOS.md e OPERACAO.md antes de qualquer publicação.
