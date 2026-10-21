# Entrega definitiva da Lansrry à empresa

## Decisão de hospedagem

A versão de revisão continua no Sites. A entrega definitiva foi preparada para Cloudflare Workers com Static Assets, em uma conta controlada pela Lansrry. Firebase continua responsável por login, dados e arquivos; Mercado Pago continua responsável pelo pagamento. O destino Cloudflare executa a mesma interface e API, com HTML dinâmico, sem depender da conta ChatGPT do vendedor.

O domínio comprado permanece o mesmo. Este código não alterou domínio, DNS, titularidade, contas ou cobrança, e não publicou a loja. O nome exato do domínio ainda precisa ser informado para configurar SITE_URL e a conexão final.

Esta é uma loja personalizada. A empresa administra o dia a dia pelo painel, mas precisa indicar um responsável técnico para atualizações, falhas de integração e restauração de backups. Se a empresa exige operação sem qualquer responsável técnico, deve avaliar uma plataforma de comércio gerenciada antes de contratar a entrega personalizada. A adaptação de hospedagem não torna software livre de manutenção.

## 1. As contas devem pertencer à empresa

| Serviço | Controle que a Lansrry precisa ter |
| --- | --- |
| Registro.br | Acesso ao domínio comprado, renovação e DNS; conferir os dados do titular no painel |
| Cloudflare | Conta própria, acesso de recuperação, domínio e faturamento do Worker |
| Google/Firebase | Projeto existente, faturamento, Authentication, Firestore, Storage e permissões IAM |
| Mercado Pago | Conta que recebe as vendas e aplicação de integração própria |
| Código | Repositório privado em conta/organização da empresa, fonte completa e package-lock.json |

Use e-mails controlados pela empresa e autenticação de dois fatores nas contas de infraestrutura. Cada responsável deve ter acesso individual. O vendedor pode receber acesso temporário de implementação; a empresa precisa conseguir recuperar e administrar as contas sozinha. Compartilhar o Site atual como editor não comprova transferência de propriedade da hospedagem.

O projeto Firebase já criado pode ser aproveitado se a empresa tiver controle efetivo dele e do faturamento. Não é necessário apagar ou recriar o banco apenas para mudar a hospedagem.

## 2. Sua parte agora

1. Confirme com a Lansrry qual e-mail da empresa controlará os serviços e quem será o administrador do painel.
2. Continue a configuração do Firebase já criado: Blaze e alertas, aplicativo Web, login por e-mail/senha, Firestore de produção e Storage restrito. Siga CONFIGURACAO.md para a conta de serviço com permissões limitadas.
3. Crie a conta Cloudflare com o e-mail responsável da empresa. O código está preparado para o plano Workers pago. Confira preço, impostos e cobrança por uso no painel antes de contratar; a configuração limita CPU por chamada, mas não limita o total da fatura.
4. Prepare a aplicação Checkout Pro na conta Mercado Pago da empresa e suas credenciais de teste.
5. Separe catálogo, política de privacidade, estoque, dados da embalagem e a forma de entrega.
6. Informe ao implementador apenas o domínio comprado, projectId, bucket, e-mail/UID do administrador e forma de entrega. Cadastre segredos no ambiente privado com o implementador; não envie senhas, tokens ou chave privada na conversa.

As próximas etapas de terminal e integração são do responsável pela implementação. A empresa não precisa programar para cadastrar produtos ou consultar pedidos e orçamentos.

## 3. Preparação técnica, sem publicação

Use Node.js 24 e a fonte desta entrega:

```sh
npm ci
npm run typecheck
npm run build
npm run build:company
npm test
npm run package:handoff
npm run verify:handoff
```

O resultado Cloudflare fica em dist/company. A fonte transferível fica em dist/entrega/lansrry-fonte.zip, sem o vínculo .openai do projeto Sites do vendedor. O build detecta esse vínculo somente quando ele existe e não cria outro projeto ou identificador. A verificação TypeScript funciona antes dos arquivos gerados; `npm test` prepara ambos os builds automaticamente. `verify:handoff` valida a fonte realmente extraída do ZIP, com instalação limpa e reempacotamento, sem aproveitar o node_modules ou dist originais. Nenhum desses comandos publica o projeto.

Não publique dist/client como uma loja estática: ele contém HTML de demonstração para revisão local. O pacote Cloudflare contém somente assets comerciais e usa o Worker para todas as rotas. Não contém a fonte ZIP, documentos de entrega ou HTML de demonstração na pasta pública.

Crie company.secrets.json a partir de company.secrets.example.json, em local privado, com valores reais. Esse arquivo é ignorado pelo Git e excluído do ZIP da fonte. Proteja-o também contra compartilhamento em pastas sincronizadas ou cópias de suporte.

- SITE_URL: origem HTTPS exata, sem caminho. Use o endereço temporário de homologação durante testes; antes do lançamento, configure o domínio comprado.
- FIREBASE_PRIVATE_KEY: campo private_key da conta de serviço, preservando as quebras de linha, representadas por \n no JSON.
- FIREBASE_CLIENT_EMAIL: campo client_email da conta de serviço, não o e-mail do administrador.
- ADMIN_UIDS: UID da conta administrativa Firebase; permite vários UIDs separados por vírgula.
- PRIVACY_POLICY_TEXT: texto oficial completo fornecido pela empresa.
- PAYMENTS_MODE: inicialmente test.
- CHECKOUT_ENABLED: inicialmente false. Orçamentos e administração podem ser testados com compras bloqueadas.
- Credenciais de Mercado Pago e frete: configure-as apenas após definir e validar as integrações.

Verifique o formato sem imprimir valores privados:

```sh
npm run check:company
npx wrangler deploy --config cloudflare/wrangler.json --dry-run
```

Essa verificação não acessa o Firebase nem o Mercado Pago e não comprova que a conta ou as permissões funcionam. O código de produção responde com indisponibilidade se faltar configuração básica, em vez de entrar silenciosamente em demonstração. /healthz informa somente prontidão de configuração e não verifica disponibilidade dos provedores.

## 4. Homologação na conta Cloudflare da empresa

Esta etapa cria uma implantação e deve ser feita pelo implementador depois da preparação. Não foi executada nesta entrega.

1. Autentique o Wrangler com a conta da empresa: npx wrangler login.
2. Confira a conta selecionada: npx wrangler whoami. Nunca publique na conta pessoal do vendedor.
3. Confira novamente o arquivo privado e mantenha CHECKOUT_ENABLED=false.
4. Execute a implantação de homologação:

```sh
npx wrangler deploy --config cloudflare/wrangler.json --secrets-file company.secrets.json
```

5. Proteja o endereço temporário com Cloudflare Access para os responsáveis pela homologação. Sem essa restrição o endereço workers.dev pode ser acessado publicamente. Não coloque nele dados reais de clientes durante a preparação.
6. Informe a origem temporária exata em SITE_URL e configure os domínios autorizados do Firebase. Recompile/reimplante após mudanças de código; mudanças de segredos também exigem uma implantação conforme a ferramenta utilizada.
7. Teste login, usuário comum sem acesso ao painel, cadastro real de produto, orçamento recebido e anexo privado, com Firebase real.
8. Conclua adaptador de frete e homologação de preferências, notificações, reconciliação/expiração e disputas antes de permitir vendas reais. Estes itens ainda estão pendentes; não basta colocar tokens para considerá-los concluídos. Para testar o fluxo de reserva com o gateway, habilite a compra somente em ambiente restrito, com contas e credenciais de teste, e confira o live_mode retornado pelo provedor. Nunca use um teste configurado como pagamento de produção com clientes reais.

## 5. Conectar o mesmo domínio .com.br

1. Adicione à conta Cloudflare da empresa o domínio exato que já foi comprado. Não compre outro domínio e não transfira o registro para outro provedor por causa da hospedagem.
2. Confira a zona DNS importada. Preserve os registros de e-mail e validação que já existirem, especialmente MX, SPF, DKIM e DMARC.
3. O Cloudflare exibirá servidores DNS específicos para a zona. Se houver DNSSEC ativo, siga o procedimento oficial para removê-lo na troca de servidores e reativá-lo após a zona ficar ativa. No Registro.br, abra o domínio e configure esses servidores exatos. Não use endereços presumidos. A delegação de DNS preserva o nome do domínio e o registro no Registro.br.
4. Aguarde a zona ficar ativa. No Cloudflare, abra Workers & Pages → lansrry-loja → Settings → Domains & Routes → Add → Custom Domain. Adicione o domínio comprado e, se necessário, a versão com www. Confira conflitos de registros antes de substituí-los.
5. Confira HTTPS nas duas versões e escolha a origem oficial em SITE_URL. Configure o redirecionamento da versão alternativa para a oficial no Cloudflare. Não altere o nome comprado.
6. Desative workers.dev e previews no arquivo de configuração para a implantação final, depois de validar o domínio. Atualize o Firebase e a integração de pagamentos para a origem oficial.
7. O webhook exato é SITE_URL/api/payments/webhook. Configure eventos de pagamentos e o segredo correto no Mercado Pago. URLs de retorno não confirmam pagamentos.

## 6. Aceite antes da entrega e das vendas

- Empresa consegue acessar contas, faturamento, recuperação e código sem o vendedor.
- Fonte reinstala e compila usando npm ci em outro computador.
- Domínio oficial e HTTPS funcionam; nenhuma rota pública volta a produtos DEMO.
- Administrador autorizado recebe o orçamento e baixa o anexo; outra conta é recusada.
- Um pedido homologado aparece para o comprador correto e para a administração.
- Pagamento confirmado pelo provedor, webhook duplicado, cancelamento, falha do gateway e disputa de última unidade foram conferidos com a integração real.
- Frete, dados do catálogo, política e rotina de expiração/reconciliação estão concluídos.
- Empresa aprova a operação e só então habilita CHECKOUT_ENABLED=true e o modo/credenciais de produção.

Não houve homologação com contas reais nesta entrega. A suíte automatizada usa serviços simulados. O destino Cloudflare foi preparado para a transferência, mas ainda não foi implantado na conta da empresa.

## 7. Operação após a entrega

No domínio oficial, abra /admin e entre com a conta autorizada da Lansrry:

- Produtos: cadastrar fotos, descrições, preços e estoque. Ao receber aviso de atualização concorrente, recarregue o painel antes de editar novamente.
- Pedidos: conferir pagamento e cliente antes de fabricar ou enviar. Avisos de conferência exigem verificar o Mercado Pago e o estoque.
- Orçamentos: ver pedidos de produtos personalizados, contato e arquivo de referência. Solicitar ao cliente um anexo pendente antes de produzir.

O painel ainda não oferece gestão de etiquetas, rastreamento, estados de fabricação/expedição ou notificações automáticas de orçamento. Defina a rotina da empresa para essas tarefas ou contrate sua implementação antes de prometer essas funcionalidades ao cliente.

Configure backups agendados do Firestore no projeto da empresa e confira custos e retenção. Teste restauração em banco separado, sem sobrescrever a produção. O backup Firestore não inclui anexos do Storage nem contas do Authentication; mantenha também a estratégia de recuperação desses serviços e o repositório privado da fonte. Guarde a última versão funcional para rollback e um contato técnico para incidentes. Monitore indisponibilidade HTTP, erros de webhook, falhas de frete, cobranças e renovação do domínio.

Depois do aceite, revogue acessos temporários do vendedor e substitua credenciais que tenham sido entregues fora do mecanismo privado de configuração. Nunca revogue a conta de serviço usada pela aplicação sem instalar e testar sua substituta. Formalize quem arca com serviços, atualizações, suporte e responsabilidade operacional.

## Referências oficiais

- Cloudflare Workers e assets: https://developers.cloudflare.com/workers/static-assets/
- Preço do Workers: https://developers.cloudflare.com/workers/platform/pricing/
- Domínio próprio: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- Segredos no servidor: https://developers.cloudflare.com/workers/configuration/secrets/
- Delegação de DNS: https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/
- Backups Firestore: https://firebase.google.com/docs/firestore/backups
