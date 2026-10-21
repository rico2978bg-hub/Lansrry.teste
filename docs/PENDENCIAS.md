# Pendências externas após a continuação da v7

O código será salvo sem deploy no projeto existente. A aplicação publicada permanece como estava. Testes com serviços simulados não comprovam contas reais ou produção.

- Donos: confirmar identificação/documento empresarial, contato de privacidade, retenção e textos finais. Aprovar minutas, sem informações inventadas. Ver PRIVACIDADE-E-POLITICAS.md.
- Firebase: IAM, Auth, domínios, e-mail de recuperação, Firestore/índices e bucket privado; publicar regras na reunião e comprovar acesso por dois clientes e administrador.
- Mercado Pago: vendedor/comprador de teste, credenciais nas contas dos donos, webhook HTTPS/assinatura e testes de PAGAMENTOS.md. test agora chama o provedor; sandbox ainda NÃO foi homologado.
- Reservas: configurar cron, monitorar fila e revisar pedidos antigos/sem evidência. Busca vazia não libera estoque. Reembolso exige conferir recebimento e condição da peça, sem reposição automática.
- Catálogo/frete: cadastrar produtos, preços, imagens, estoque, dimensões/embalagens/prazos; contratar/configurar adaptador HTTPS. Ver OPERACAO.md.
- Atendimento: persistência/protocolo/painel preparados; confirmação na tela. Definir equipe, prazo e rotina. Não há e-mail automático configurado.
- Analytics: GA4/Measurement Protocol preparado e desligado. Validar ingestão real, retenção e consentimento antes de habilitar. Formulários não integram o payload.
- Segurança/operação: regras reais, recuperação de conta, arquivos reais, dispositivos/tecnologias assistivas; ativar observabilidade, alertas, logs de infraestrutura, backups e ensaio de restauração.
- Domínio: conservar domínio comprado, confirmar nome/DNS/HTTPS/SITE_URL pelos donos. Nenhum DNS alterado.
- SEO/perfis: Search Console e Perfil da Empresa dependem das contas/verificações dos donos, sem promessa de posição ou inclusão em IA.

Os donos controlam contas, cartão e segredos. Esta entrega aguarda resultados da reunião e nova autorização de publicação.
