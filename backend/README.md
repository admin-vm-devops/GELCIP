# GELCIP - Infraestrutura

## Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS (us-east-2)                           │
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────────┐  │
│  │  S3 Bucket  │     │ API Gateway │     │    DynamoDB      │  │
│  │   gelcip    │     │   (REST)    │     │ gelcip-inscricoes │  │
│  │  (website)  │     │    /prod    │     │ gelcip-contatos   │  │
│  └─────────────┘     └──────┬──────┘     └────────▲─────────┘  │
│         │                   │                      │            │
│         │            ┌──────┴──────┐               │            │
│         │            │   Lambda    │───────────────┘            │
│         │            │ inscricao   │                            │
│         │            │  contato    │──────┐                     │
│         │            └─────────────┘      │                     │
│         │                                 ▼                     │
│         │                          ┌───────────┐                │
│         │                          │    SES    │                │
│         │                          │ (e-mail)  │                │
│         │                          └───────────┘                │
└─────────┼───────────────────────────────────────────────────────┘
          │
    ┌─────┴─────┐
    │  Usuário  │
    │ (browser) │
    └───────────┘
```

## Recursos

| Recurso | Nome/ID | Gerenciado por |
|---------|---------|----------------|
| S3 (site) | `gelcip` | Manual (pré-existente) |
| S3 (deploy) | `gelcip-deploy` | Manual |
| API Gateway | `zj6393ukd0` | Stack `gelcip-backend` |
| Lambda inscricao | `gelcip-inscricao` | Stack `gelcip-backend` |
| Lambda contato | `gelcip-contato` | Stack `gelcip-backend` |
| DynamoDB inscricoes | `gelcip-inscricoes` | Stack `gelcip-backend` |
| DynamoDB contatos | `gelcip-contatos` | Stack `gelcip-backend` |
| SES identity | `contato@gelcip.com` | Manual |

## Comandos

### Deploy do site (frontend)
```bash
aws s3 sync ~/Projects/GELCIP s3://gelcip \
  --exclude ".git/*" \
  --exclude "backend/*" \
  --exclude ".gitignore" \
  --region us-east-2
```

### Deploy do backend (após alterações nas Lambdas)
```bash
cd ~/Projects/GELCIP/backend

aws cloudformation package \
  --template-file template.yaml \
  --s3-bucket gelcip-deploy \
  --output-template-file packaged.yaml \
  --region us-east-2

aws cloudformation deploy \
  --template-file packaged.yaml \
  --stack-name gelcip-backend \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --parameter-overrides AdminEmail=contato@gelcip.com \
  --region us-east-2
```

### Recriação do zero (nova conta)
O `template.yaml` contém toda a infra (S3 + backend). Usar em contas limpas:
```bash
cd ~/Projects/GELCIP/backend

aws cloudformation package \
  --template-file template.yaml \
  --s3-bucket BUCKET_TEMPORARIO \
  --output-template-file packaged.yaml \
  --region us-east-2

aws cloudformation deploy \
  --template-file packaged.yaml \
  --stack-name gelcip-infra \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --region us-east-2
```

## URLs

- **Site:** http://gelcip.s3-website.us-east-2.amazonaws.com
- **API:** https://zj6393ukd0.execute-api.us-east-2.amazonaws.com/prod
- **Endpoints:**
  - `POST /inscricao` — recebe inscrições de cursos
  - `POST /contato` — recebe mensagens de contato

## SES

O e-mail `contato@gelcip.com` precisa ser verificado no SES. Um e-mail de verificação foi enviado para esse endereço. Enquanto não for confirmado, as Lambdas salvam os dados no DynamoDB mas não enviam notificação por e-mail.

Para verificar status:
```bash
aws ses get-identity-verification-attributes \
  --identities contato@gelcip.com \
  --region us-east-2
```
