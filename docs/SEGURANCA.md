# Segurança e concorrência — versão preparada

## Controles implementados

- Login: limites por IP e por conta normalizada, compartilhados por transações no Firestore. Trocar o IP não remove o limite da conta. Respostas genéricas evitam confirmar se um e-mail existe. O servidor usa CF-Connecting-IP do ingresso da hospedagem; X-Forwarded-For não define o contador.
- Administração: Firebase verifica a identidade; ADMIN_UIDS autoriza o administrador em cada chamada. Pedidos de clientes são consultados pelo UID do dono. Orçamentos e anexos são privados.
- Formulários: tamanho máximo conferido durante a leitura, mesmo sem Content-Length. Os botões também têm bloqueio imediato de chamadas simultâneas.
- Reenvios: orçamento e checkout exigem Idempotency-Key com UUID. O navegador guarda apenas esse UUID na sessão. O servidor cria o registro uma vez, compara os dados dos reenvios e mantém o identificador estável após troca da chave da conta de serviço.
- Estoque: leitura, reserva e pedido são confirmados na mesma transação. Salvar ou excluir um produto exige a versão original, inclusive a precisão completa do updateTime do Firestore. Um painel antigo não pode sobrescrever estoque reservado.
- Pagamento: a chamada ao gateway ocorre fora da transação de estoque. Uma resposta incerta deixa o pedido para revisão, sem repetir o POST nem soltar a reserva. O webhook valida assinatura, consulta a API do provedor e confere modo, moeda e valor.
- Eventos simultâneos: aprovação não é sobrescrita por conclusão tardia da preferência. Liberação da reserva ocorre no máximo uma vez. Aprovação após liberação, pagamentos adicionais e reembolso ficam para conferência.
- Anexos: caminho privado e determinístico, sem sobrescrita. Falha de upload preserva o orçamento e registra o anexo pendente.

Os limites respondem com 429 e Retry-After. Consultas e chamadas externas têm tempo máximo de espera. Conflitos transacionais são repetidos de forma limitada; erros de configuração não são tratados como conflito.

## Verificação feita

Execute npm run typecheck, npm run build e npm test. A suíte de segurança contém 23 cenários com serviços simulados, incluindo trabalhadores independentes disputando o mesmo contador, reenvios concorrentes, dois compradores na última unidade, falha de resposta do gateway, edições antigas, eventos de pagamento fora de ordem e autorização de rotas privadas. O serviço simulado aplica pré-condições e commits atômicos; não usa credenciais reais.

## Etapa ainda necessária antes de vender

A integração deve ser validada com Firebase, Storage e Mercado Pago da empresa, domínio HTTPS e transportadora escolhida. A rotina de expiração/reconciliação e os estados de disputa/reembolso estão preparados; a homologação do gateway e a configuração do agendamento ainda dependem das contas da empresa. A configuração real deve confirmar o ingresso confiável de IP, as regras do banco e o acesso privado aos anexos.

A coleção securityLimits possui expiresAt para limpeza por TTL do Firestore, que pode ser habilitada na configuração. O limite continua funcionando sem essa limpeza; os documentos vencidos são reaproveitados. Limites de aplicação reduzem abuso, mas não substituem proteção de tráfego da hospedagem ou a autenticação do Firebase.

Esta versão fica salva sem publicação até concluir a preparação combinada.

## Destino independente da empresa

O Worker Cloudflare força modo de produção, recusa demonstração por falta de configuração e bloqueia a API de pedido quando CHECKOUT_ENABLED não está liberado. Assets e Worker são empacotados separadamente; a pasta pública não inclui HTML de demonstração, arquivos de configuração, documentação nem fonte. No destino Sites conectado, guia e downloads exigem autorização de administrador e usam Cache-Control: no-store. Segredos reais e vínculos de Sites são excluídos do pacote da empresa. O healthz informa apenas presença/formato de configuração. A proteção externa de tráfego, alertas, backups e responsável técnico ainda precisam ser configurados na conta da empresa.

## Controles acrescentados na continuação

Atendimento idempotente persistente com protocolo; mudança administrativa exige versão e grava auditoria na mesma transação. Recuperação de senha genérica com limites. Uploads conferem conteúdo e estrutura, além da extensão/MIME. CSP com nonce por resposta, HSTS em HTTPS, nosniff e políticas de referência/permissão também cobrem APIs/erros. Consentimento bloqueia medição opcional; proxy aceita somente rotas/eventos permitidos e não encaminha campos pessoais. Logs administrativos não incluem formulários nem segredos. Limites e configuração externa estão em OPERACAO.md.
