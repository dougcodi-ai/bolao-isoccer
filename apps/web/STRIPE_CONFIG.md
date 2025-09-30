# Configuração do Stripe - ISoccer

## Resumo

Este documento descreve como configurar as chaves do Stripe para desenvolvimento e produção no projeto ISoccer.

## Chaves Fornecidas

### Chaves de Produção (LIVE)
NUNCA publique chaves reais neste repositório. Use placeholders e configure via variáveis de ambiente em produção.
- **Chave Pública** (exemplo): `<STRIPE_PUBLISHABLE_KEY_LIVE>`
- **Chave Secreta** (exemplo): `<STRIPE_SECRET_KEY_LIVE>`

## Configuração no Arquivo .env.local

### Para Desenvolvimento (Recomendado)

```env
# Stripe - Chaves de TESTE para desenvolvimento
STRIPE_SECRET_KEY=<STRIPE_SECRET_KEY_TEST>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<STRIPE_PUBLISHABLE_KEY_TEST>
STRIPE_WEBHOOK_SECRET=<STRIPE_WEBHOOK_SECRET_TEST>

# Mapeamentos de preços de TESTE
STRIPE_PRICE_MAPPING_TEST={"p1":"price_test_example1","p3":"price_test_example2","p5":"price_test_example3"}
```

### Para Produção

```env
# Stripe - Chaves de PRODUÇÃO (usar apenas em produção)
STRIPE_SECRET_KEY=<STRIPE_SECRET_KEY_LIVE>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<STRIPE_PUBLISHABLE_KEY_LIVE>
STRIPE_WEBHOOK_SECRET=<STRIPE_WEBHOOK_SECRET_LIVE>

# Mapeamentos de preços de PRODUÇÃO
STRIPE_PRICE_MAPPING_LIVE={"p1":"price_live_example1","p3":"price_live_example2","p5":"price_live_example3"}

# Definir ambiente como produção
NODE_ENV=production
```

## Proteções de Segurança

O sistema possui proteções automáticas que:

1. **Bloqueiam chaves LIVE em desenvolvimento**: Se `NODE_ENV` não for "production" e a chave secreta começar com "sk_live", as APIs retornarão erro 400.

2. **Validam chaves**: As APIs verificam se as chaves são válidas antes de processar pagamentos.

## Estrutura das APIs Afetadas

As seguintes rotas de API são protegidas:
- `/api/stripe/checkout` - Checkout geral
- `/api/stripe/checkout/booster` - Compra de boosters
- `/api/stripe/checkout/upgrade` - Upgrade de planos
- `/api/stripe/webhook` - Webhooks do Stripe

## Configuração de Webhooks

Para configurar webhooks no Stripe:

1. Acesse o Dashboard do Stripe
2. Vá em "Developers" > "Webhooks"
3. Adicione endpoint: `https://seu-dominio.com/api/stripe/webhook`
4. Selecione os eventos necessários:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

## Mapeamentos de Preços

Os mapeamentos de preços devem ser configurados no Stripe Dashboard:

### Boosters (exemplo)
- `p1`: Pacote pequeno (1-3 boosters)
- `p3`: Pacote médio (5-10 boosters)
- `p5`: Pacote grande (15-20 boosters)

### Upgrades de Planos
- Configurar preços para cada plano: free, craque, lenda, fenomeno, galera

## Verificação da Configuração

Para verificar se a configuração está correta:

1. Execute o servidor: `npm run dev`
2. Teste uma compra de booster
3. Verifique os logs do servidor para confirmar que não há erros de chave inválida

## Segurança

⚠️ **IMPORTANTE**:
- Nunca commitar chaves de produção no repositório (use placeholders).
- Use sempre chaves de teste em desenvolvimento.
- Mantenha as chaves seguras e rotacione periodicamente.
- Configure webhooks com endpoints HTTPS em produção.

## Status Atual

✅ **Configuração Atual**: Chaves de teste configuradas para desenvolvimento
✅ **Proteções**: Sistema bloqueia chaves LIVE em ambiente de desenvolvimento
✅ **APIs**: Todas as rotas de pagamento funcionando corretamente
✅ **Boosters**: Sistema de compra e inventário operacional

## Próximos Passos para Produção

1. Obter chaves de teste válidas do Stripe para desenvolvimento
2. Configurar webhooks no Stripe Dashboard
3. Definir mapeamentos de preços corretos
4. Configurar `NODE_ENV=production` apenas em produção
5. Testar fluxo completo de pagamento em ambiente de staging