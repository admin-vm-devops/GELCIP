# Backend - Detalhes Técnicos

Documentação específica da infraestrutura serverless. Para visão geral do projeto, veja o [README principal](../README.md).

## Deploy / Destroy rápido

```bash
cd ~/Projects/GELCIP

# Deploy completo (cria tudo do zero)
./scripts/deploy.sh

# Destroy (deleta infra, preserva buckets S3 vazios)
./scripts/destroy.sh
```

### Variáveis de ambiente (opcional)

| Variável | Descrição |
|----------|-----------|
| `GELCIP_ADMIN_PASSWORD` | Senha do admin (evita prompt interativo) |
| `GELCIP_JWT_SECRET` | JWT secret fixo (se não definido, gera automaticamente) |

## Recursos AWS

| Recurso | Nome/ID | Gerenciado por |
|---------|---------|----------------|
| S3 (site) | `gelcip` | Manual |
| S3 (artefatos) | `gelcip-deploy` | Manual |
| API Gateway | *(URL dinâmica via CloudFormation Output)* | Stack `gelcip-backend` |
| Lambda | `gelcip-inscricao` | Stack `gelcip-backend` |
| Lambda | `gelcip-contato` | Stack `gelcip-backend` |
| Lambda | `gelcip-admin` | Stack `gelcip-backend` |
| Lambda | `gelcip-empty-buckets` | Stack `gelcip-backend` |
| DynamoDB | `gelcip-inscricoes` | Stack `gelcip-backend` |
| DynamoDB | `gelcip-contatos` | Stack `gelcip-backend` |
| SSM | `/gelcip/admin-password-hash` | Stack `gelcip-backend` |
| SSM | `/gelcip/jwt-secret` | Stack `gelcip-backend` |
| SES | `contato@gelcip.com` | Manual |

> **Nota:** A URL da API Gateway é gerada dinamicamente pelo CloudFormation a cada deploy.
> O `deploy.sh` captura essa URL automaticamente e atualiza o `script.js` do frontend.

## Endpoints da API

Base: *(gerada pelo CloudFormation — consulte o Output `ApiUrl` da stack `gelcip-backend`)*

```bash
aws cloudformation describe-stacks --stack-name gelcip-backend --region us-east-2 \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
```

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/inscricao` | Não | Recebe inscrição de curso |
| POST | `/contato` | Não | Recebe mensagem de contato |
| POST | `/admin/login` | Não | Autentica admin, retorna JWT |
| GET | `/admin/inscricoes` | JWT | Lista inscrições |
| GET | `/admin/contatos` | JWT | Lista contatos |
| DELETE | `/admin/inscricoes/{id}` | JWT | Remove inscrição |
| DELETE | `/admin/contatos/{id}` | JWT | Remove contato |

## Lambdas

| Lambda | Diretório | Função |
|--------|-----------|--------|
| `gelcip-inscricao` | `inscricao/` | Recebe inscrições, salva no DynamoDB, notifica via SES |
| `gelcip-contato` | `contato/` | Recebe contatos, salva no DynamoDB, notifica via SES |
| `gelcip-admin` | `admin/` | Login JWT + CRUD de inscrições/contatos |
| `gelcip-empty-buckets` | `empty-buckets/` | Custom resource — esvazia buckets S3 ao deletar a stack |

## Variáveis de Ambiente (Lambdas)

| Variável | Lambda | Descrição |
|----------|--------|-----------|
| `TABLE_NAME` | inscricao, contato | Nome da tabela DynamoDB |
| `ADMIN_EMAIL` | inscricao, contato | E-mail para notificações SES |
| `SITE_DOMAIN` | todas | Domínio permitido no CORS |
| `INSCRICOES_TABLE` | admin | Tabela de inscrições |
| `CONTATOS_TABLE` | admin | Tabela de contatos |

## Templates CloudFormation

| Arquivo | Uso |
|---------|-----|
| `deploy.yaml` | Deploy incremental (só backend, sem S3) |
| `template.yaml` | Recriação completa (S3 + backend + SES) — usar em conta limpa |

## Instalar dependências da Lambda admin

```bash
cd backend/admin && npm install
```

As Lambdas `inscricao` e `contato` usam apenas o AWS SDK (incluso no runtime).

## SES

Status da verificação:
```bash
aws ses get-identity-verification-attributes \
  --identities contato@gelcip.com --region us-east-2
```

Enquanto não verificado, os dados são salvos no DynamoDB mas o e-mail de notificação não é enviado.

## Alterar senha do admin

```bash
node -e "console.log(require('bcryptjs').hashSync('NOVA_SENHA', 10))"
# Copie o hash e atualize no SSM:
aws ssm put-parameter --name /gelcip/admin-password-hash \
  --value 'HASH_AQUI' --type SecureString --overwrite --region us-east-2
```
