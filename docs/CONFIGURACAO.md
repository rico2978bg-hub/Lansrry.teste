# Guia de configuração da Lansrry

## Hospedagem da entrega

A entrega definitiva usa Cloudflare na conta da empresa. Siga TRANSFERENCIA-EMPRESA.md para empacotar, configurar segredos e conectar o mesmo domínio comprado. O Sites existente tem acesso público; esta etapa não altera o acesso e não faz implantação. As configurações de Firebase e Mercado Pago abaixo permanecem válidas para ambos os destinos.

## Quem faz cada etapa

O proprietário registra o domínio, cria as contas de Firebase e Mercado Pago, mantém o controle das credenciais e fornece os dados reais da loja, dos produtos e da entrega. Não envie senhas, tokens nem a chave privada na conversa.

O responsável pela implementação conecta essas contas ao servidor, cadastra os segredos no ambiente apropriado, configura as permissões e o adaptador de frete, configura a rotina de reconciliação preparada e executa os testes reais. As correções de segurança foram testadas com serviços simulados. A versão preparada deve ficar salva sem implantação enquanto essa configuração não for concluída; a publicação será feita depois, conforme combinado com o proprietário.

## 1. Dados e materiais oficiais

Os dados do cliente estão centralizados em src/data.ts. Use o endereço do briefing atual, Rua São Geraldo, 489 — Ermo, Guaíba/RS, CEP 92702-470. O logotipo fornecido já está aplicado sem redesenho ou troca de cores.

O banner oficial fornecido está em public/assets/banner-oficial.jpg e aparece por padrão na home, integralmente e com sua proporção original. A logo original está em public/assets/logo-oficial.jpg; logo.png, favicon e ícone de app são versões dimensionadas da mesma arte. OFFICIAL_BANNER_URL continua disponível para uma troca futura. O TikTok oficial informado é https://www.tiktok.com/@kelly_lansing. A imagem da impressora em public/assets/impressora-personalizados.webp foi preparada com fundo transparente a partir da referência enviada para a seção de personalizados.

Cadastre apenas fotos e dados reais dos produtos. O modo conectado começa com o catálogo vazio; nunca importe os quatro produtos DEMO para vendas reais.

## 2. Firebase: banco, login e arquivos

Crie um projeto em https://console.firebase.google.com. Ative Authentication com e-mail/senha, Firestore em modo de produção e Storage. Confira no console os requisitos de faturamento do Storage antes de ativá-lo.

Crie uma conta de serviço dedicada. No projeto, conceda a função Cloud Datastore User (`roles/datastore.user`). No bucket, limite o acesso dessa conta ao próprio bucket e conceda Storage Object Creator (`roles/storage.objectCreator`) e Storage Object Viewer (`roles/storage.objectViewer`). Este site precisa criar referências e ler imagens/anexos, mas não precisa da permissão de apagar arquivos; evite Storage Object User e Storage Admin. Gere a chave pelo Google Cloud IAM. Guarde a chave privada como segredo no ambiente do servidor da empresa. Não envie o arquivo JSON da conta de serviço ao repositório ou à interface.

No ambiente de execução, configure:

```
FIREBASE_PROJECT_ID=<ID real do projeto>
FIREBASE_API_KEY=<Web API Key do projeto Firebase>
FIREBASE_CLIENT_EMAIL=<e-mail da conta de serviço>
FIREBASE_PRIVATE_KEY=<chave PEM real com quebras de linha>
FIREBASE_STORAGE_BUCKET=<nome exato do bucket>
```

A API Key do Firebase identifica o projeto, mas neste site também fica no servidor. Restrinja seu uso às APIs necessárias no Google Cloud. Ative proteção contra enumeração de e-mails no Firebase e confira o domínio autorizado da aplicação.

Publique firestore.rules e storage.rules usando o console ou Firebase CLI: firebase deploy --only firestore:rules,storage. As regras negam gravações diretas pelo navegador e leitura direta de pedidos/orçamentos. A API do servidor valida a identidade e o UID antes de acessar dados privados usando a conta de serviço IAM.

Teste com duas contas: cada usuário deve ver apenas seus pedidos; um usuário comum não pode cadastrar produto nem ler orçamento/anexo. Um teste direto ao Firestore deve negar gravações mesmo para um usuário autenticado. No destino da empresa, credenciais ausentes bloqueiam o acesso com 503. A demonstração continua apenas na versão de revisão do Sites; credenciais inválidas devem resultar em indisponibilidade sem semear produtos fictícios.

## 3. Conta de administrador

Crie a conta do responsável da empresa no Firebase Authentication. Copie seu UID e configure ADMIN_UIDS no ambiente do servidor. Para múltiplos administradores, separe UIDs por vírgula. E-mail ou botão visível não concede permissão: o servidor confere o UID em cada solicitação administrativa.

Depois de configurar, entre em /conta com a conta autorizada e abra /admin. O painel de demonstração não usa autenticação real porque contém somente dados locais de teste.

## 4. Como cadastrar produtos e estoque

Abra Painel administrativo → Produtos → Novo produto. Informe nome, categoria, preço, estoque, descrição e imagem. SKU, especificações, SEO e variações são opcionais. Sem variações, o estoque pertence ao produto. Com variações, informe uma por linha no formato Nome | Estoque | Preço opcional. O estoque total será a soma das variações. Preço de variação vazio usa o preço principal.

As imagens aceitas são PNG, JPG e WEBP de até 2 MB. Otimize a imagem antes de enviá-la. O formulário envia o arquivo para o Storage por uma rota administrativa autenticada. O sitemap se atualiza automaticamente a partir do catálogo no Firestore. A paginação suporta 51–100 produtos sem mudança de banco.

O servidor confere a versão exata do documento ao salvar ou excluir um produto. Se outro administrador ou uma reserva de estoque alterou o produto, o envio antigo é recusado com 409; recarregue o painel antes de editar novamente. O endereço amigável também tem controle de unicidade em transação.

Variações simples de cor estão disponíveis. Combinações de tamanho × cor × material e grade complexa ficam para a fase 2.

## 5. Orçamentos e anexos

O formulário em /orcamento aceita STL, imagem e PDF, até 10 MB no modo conectado. O modo DEMO limita anexos a 1 MB para armazenamento no navegador. Nome, contato, tipo de pedido e descrição são obrigatórios. O campo opcional aceita e-mail completo ou @ do Instagram; os dois formatos são armazenados separadamente e aparecem no painel e na mensagem preparada para WhatsApp. O honeypot reduz spam básico. O limite por IP é compartilhado entre instâncias por transações no Firestore, com limite adicional de processamento simultâneo por instância.

Os registros ficam em quotes no Firestore e os anexos em quotes no bucket privado. Abra Painel → Orçamentos para ler os dados e baixar o arquivo. Nenhum anexo fica publicamente acessível. O site não envia e-mails de notificação automática nesta versão. A alternativa de WhatsApp prepara a mensagem; a pessoa anexa o arquivo manualmente na conversa.

Reenvios da mesma solicitação usam o mesmo identificador e retornam o registro existente. Uma chave reutilizada com dados diferentes é recusada. Se o envio do arquivo falhar, o orçamento permanece no painel com aviso de anexo pendente; peça a referência por WhatsApp. Uma solicitação interrompida durante o processamento também fica identificada no painel para conferência.

## 6. Política oficial

Configure PRIVACY_POLICY_TEXT com o conteúdo oficial integral fornecido pela Lansrry. A página /privacidade exibirá esse texto sem inventar cláusulas. Cadastro, pedido e orçamento reais ficam bloqueados até o texto oficial estar configurado. Confira a versão com o responsável pela empresa.

## 7. Mercado Pago

Em homologação isolada, PAYMENTS_MODE=test chama o Mercado Pago com vendedor de teste, valida sua conta e exige live_mode=false nos pagamentos. A demonstração local sem Firebase é o único modo sem chamada ao gateway. Nenhum retorno do navegador confirma pagamento. Pix, crédito, débito e boleto são processados pelo mesmo gateway, sujeitos à disponibilidade da conta no checkout do Mercado Pago.

Crie a aplicação da loja no painel do Mercado Pago. Configure MERCADO_PAGO_ACCESS_TOKEN e MERCADO_PAGO_WEBHOOK_SECRET como segredos do servidor. O endpoint de notificações é SITE_URL/api/payments/webhook. O pedido é recalculado no servidor, o estoque é reservado em transação e a preferência do Checkout Pro redireciona ao Mercado Pago.

Antes de ativar, teste a integração em ambiente de homologação do gateway: preferência, Pix, cartão, boleto, retorno, pagamento pendente, aprovado, rejeitado, cancelado e repetição de webhook. O código aceita apenas notificações HMAC válidas, consulta o pagamento na API e compara moeda, modo e valor. Nunca teste cartão real na interface da loja.

A API de homologação e produção e o webhook foram preparados; não foram validados com credenciais da empresa. Leia PAGAMENTOS.md: configure MERCADO_PAGO_SELLER_ID, vendedor/comprador de teste e ambiente Firebase separado. Nunca afrouxe live_mode para homologar. Ative live somente após evidências completas e frete/textos aprovados.

Conciliação e expiração estão implementadas, com fechamento da preferência, consultas autenticadas e preservação de reservas incertas. Rejeição/cancelamento isolado no webhook não libera estoque. Duas consultas completas consistentes, espaçadas, e pagamentos terminais são exigidos. Resultado vazio continua para revisão. Reembolso/disputa não repõem mercadoria. Configure a agenda e siga PAGAMENTOS.md e OPERACAO.md; o retorno para /conta não comprova pagamento.

## 8. Frete

Sem transportadora, /api/shipping retorna R$ 18,90 como valor fictício de teste, sem prazo de entrega. O CEP calculado precisa ser igual ao CEP do endereço.

A função shipping em server/shipping.ts isola o cálculo. O responsável pela implementação preparará o adaptador da transportadora escolhida e configurará SHIPPING_QUOTE_URL com HTTPS e SHIPPING_API_KEY como segredo, quando necessário. Contrato:

```
POST: { fromCep: "92702470", toCep: "<CEP>", items: [...] }
Resposta: { amount: <valor numérico em reais>, label: "<serviço e prazo reais>" }
```

A interface envia o CEP; o checkout envia os itens completos para o cálculo final no servidor. O adaptador precisa buscar pesos e medidas reais no catálogo ou exigir esses dados antes de cotar. Sem eles, não ative frete real. Não foi escolhida transportadora, nem criado prazo de entrega. Teste cotação para diferentes CEPs da Região Sul, indisponibilidade e alteração de valor.

## 9. Google Maps, domínio e hospedagem

O mapa atual usa uma busca pelo endereço fornecido. Valide visualmente se o ponto é o correto antes do lançamento. Se houver uma ficha oficial ou Place ID confirmado, substitua o iframe por esse endereço. O código não afirma que existe Perfil da Empresa no Google.

O proprietário já comprou o domínio; seu nome exato ainda precisa ser informado. Preserve esse nome. A revisão continua no Sites e a entrega definitiva foi preparada para Cloudflare na conta da empresa. Siga TRANSFERENCIA-EMPRESA.md para conectar o domínio comprado, conferir HTTPS e configurar SITE_URL com a origem real. Atualizar a hospedagem sem atualizar SITE_URL deixa canonical, sitemap e retorno de pagamento apontando para a origem anterior.

## 10. SEO, GEO e Perfil da Empresa

O site já gera metadados SSR, canonical, robots.txt, sitemap dinâmico, dados estruturados factuais e llms.txt. Não há garantias de posição no Google ou de citação por IA. Uma publicação privada não é indexável pelo público; a mudança de acesso deve ser solicitada pelo proprietário.

Após disponibilizar o site ao público e conectar o domínio, adicione-o em https://search.google.com/search-console e verifique a propriedade pelo método oferecido. Envie /sitemap.xml. Use a inspeção de URL e o teste de resultados enriquecidos para uma página de produto real. Verifique que as rotas privadas continuam sem indexação e que itens DEMO não estão no sitemap.

Para criar o Perfil da Empresa, acesse https://www.google.com/business com a conta da empresa. Informe exatamente Lansrry, endereço, telefone e horário do briefing. Escolha a categoria disponível que descreva a atividade real, sem inventar áreas ou serviços. Confirme com o proprietário se o local recebe clientes e configure endereço/área de atendimento segundo a situação real. Conclua o método de verificação que o Google oferecer. Adicione o site e fotos oficiais; não crie avaliações fictícias. Mantenha os dados consistentes entre site, perfil e redes sociais.

## 11. Como testar depois de configurar

Visite home, loja, produto, orçamento, contato, carrinho e conta em desktop e celular. Cadastre um produto real de teste e confira a página SSR e o sitemap. Faça dois pedidos simultâneos com o último item do estoque: só uma reserva pode ser concluída. Confirme que usuário A não vê pedido de B. Confirme 401/403 em rotas administrativas sem permissão. Envie orçamento com arquivo e baixe no painel autorizado. Teste pagamento apenas após a homologação acima e confira o webhook no servidor.

O comando npm test inclui as verificações de rotas e 23 cenários de segurança/concorrência com serviços simulados. Esses testes já cobrem limites de login, reenvios, disputa de estoque, edição antiga de produto, pagamento com resposta incerta, notificações repetidas e acesso privado. Eles não substituem os testes com as contas da empresa. Consulte SEGURANCA.md para os controles e limites dessa validação.

## Continuação da versão 7

Leia OPERACAO.md, PAGAMENTOS.md e PRIVACIDADE-E-POLITICAS.md para configuração atual. LEGAL_APPROVED deve permanecer false até identificação/documento, contato, retenção, privacidade, termos e devoluções finais aprovados. O alvo da empresa recusa operação sem esses dados. Atendimento persistente: /atendimento e Painel → Atendimento; confirmação por protocolo na tela, sem e-mail automático. Recuperação de senha usa Firebase e precisa de teste real de e-mail. Analytics é opcional, desabilitado por padrão e exige GA4/secret/consentimento e validação externa. Nenhum serviço externo foi ativado neste trabalho.
