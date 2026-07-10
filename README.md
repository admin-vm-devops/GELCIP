# GELCIP - Grupo Espírita Luz e Caridade Irmãos da Paz

Site institucional do GELCIP, uma entidade filantrópica espírita localizada no Ipiranga, São Paulo/SP.

| Ambiente | Site | Admin |
|----------|------|-------|
| **Produção** | http://gelcip.s3-website.us-east-2.amazonaws.com | http://gelcip.s3-website.us-east-2.amazonaws.com/admin.html |
| **Desenvolvimento** | http://gelcip-dev.s3-website.us-east-2.amazonaws.com | http://gelcip-dev.s3-website.us-east-2.amazonaws.com/admin.html |

## Arquitetura

```
┌──────────────┐       ┌──────────────┐       ┌─────────────┐
│   Browser    │──────▶│  S3 Website  │       │  DynamoDB   │
│  (usuário)   │       │  (gelcip*)   │       │  (dados)    │
└──────┬───────┘       └──────────────┘       └──────▲──────┘
       │                                              │
       │  fetch POST/GET                              │
       └──────────────▶┌──────────────┐       ┌──────┴──────┐
                       │ API Gateway  │──────▶│   Lambda    │──▶ SES (e-mail)
                       │   /prod      │       │  (Node 20)  │
                       └──────────────┘       └─────────────┘
```

**Stack:** HTML5 + CSS + JS vanilla (frontend) · Node.js 20 + DynamoDB + SES (backend) · CloudFormation/SAM (IaC)

## Ambientes

O projeto possui dois ambientes isolados na mesma conta AWS. Todos os recursos são parametrizados pelo sufixo `-dev` (dev) ou sem sufixo (prod).

| Recurso | Produção | Desenvolvimento |
|---------|----------|-----------------|
| Branch | `main` | `develop` |
| S3 Site | `gelcip` | `gelcip-dev` |
| S3 Deploy | `gelcip-deploy` | `gelcip-deploy-dev` |
| Stack CF | `gelcip-backend` | `gelcip-backend-dev` |
| DynamoDB | `gelcip-inscricoes`, `gelcip-contatos` | `gelcip-inscricoes-dev`, `gelcip-contatos-dev` |
| SSM | `/gelcip/*` | `/gelcip-dev/*` |
| Lambdas | `gelcip-{função}` | `gelcip-{função}-dev` |

### Fluxo de trabalho

```bash
# 1. Desenvolver na branch develop
git checkout develop
# ... fazer alterações ...
./scripts/deploy.sh dev       # testa no ambiente dev

# 2. Promover para produção
git checkout main
git merge develop
./scripts/deploy.sh prod      # deploy em produção (pede confirmação)
git push origin main
```

## Funcionalidades

- **Página principal** — quem somos, horários, tratamentos, cursos, inscrição, doação PIX, contato
- **Formulário de inscrição** — dados salvos no DynamoDB + notificação por e-mail (SES)
- **Formulário de contato** — dados salvos no DynamoDB + notificação por e-mail (SES)
- **Painel admin** — login JWT, listagem de inscrições/contatos, busca, exportar CSV, excluir

## Estrutura do Projeto

```
├── index.html              Página principal
├── admin.html              Painel administrativo (login JWT)
├── script.js               Lógica dos formulários (fetch → API)
├── styles.css              Estilos responsivos (variáveis CSS)
├── assets/                 Imagens do site (logo SVG, fotos)
├── scripts/
│   ├── deploy.sh           Deploy completo (aceita: dev | prod)
│   └── destroy.sh          Destroy completo (aceita: dev | prod)
└── backend/
    ├── README.md           Documentação técnica do backend
    ├── deploy.yaml         Template CloudFormation parametrizado (Environment)
    ├── template.yaml       Template completo (recriação do zero)
    ├── inscricao/          Lambda: POST /inscricao
    ├── contato/            Lambda: POST /contato
    ├── admin/              Lambda: POST /admin/login, GET/DELETE dados
    └── empty-buckets/      Lambda: custom resource (esvazia S3 ao deletar stack)
```

## Deploy

### Via Scripts (recomendado)

```bash
cd ~/Projects/GELCIP

# Deploy em dev (padrão — seguro)
./scripts/deploy.sh dev

# Deploy em produção (pede confirmação)
./scripts/deploy.sh prod

# Destruir dev
./scripts/destroy.sh dev

# Destruir produção (exige digitar 'destroy prod')
./scripts/destroy.sh prod
```

**O que o `deploy.sh` automatiza:**
- Verifica pré-requisitos (AWS CLI, Node, credenciais)
- Coleta/gera segredos (senha admin + JWT secret)
- Instala dependências das Lambdas
- Empacota e deploya via CloudFormation com parâmetro `Environment`
- Captura a URL da API e atualiza `script.js` e `admin.html` automaticamente
- Sincroniza frontend com o bucket S3 do respectivo ambiente

**O que o `destroy.sh` automatiza:**
- Deleta stack CloudFormation (Lambda `empty-buckets` esvazia S3 automaticamente)
- Limpa SSM Parameters órfãos (prefixo dinâmico por ambiente)
- Limpa SES Identity órfã (apenas em prod)
- Buckets S3 preservados (vazios) para manter URLs

### Manual - Frontend

```bash
# Dev
aws s3 sync . s3://gelcip-dev \
  --exclude ".git/*" --exclude "backend/*" --exclude "scripts/*" \
  --exclude ".gitignore" --exclude "*.md" --region us-east-2

# Prod
aws s3 sync . s3://gelcip \
  --exclude ".git/*" --exclude "backend/*" --exclude "scripts/*" \
  --exclude ".gitignore" --exclude "*.md" --region us-east-2
```

### Manual - Backend

```bash
cd backend

# Dev
aws cloudformation package --template-file deploy.yaml --s3-bucket gelcip-deploy-dev --output-template-file packaged-deploy.yaml --region us-east-2
aws cloudformation deploy --template-file packaged-deploy.yaml --stack-name gelcip-backend-dev \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --parameter-overrides Environment=dev AdminEmail=contato@gelcip.com \
    SiteDomain=http://gelcip-dev.s3-website.us-east-2.amazonaws.com \
  --region us-east-2

# Prod
aws cloudformation package --template-file deploy.yaml --s3-bucket gelcip-deploy --output-template-file packaged-deploy.yaml --region us-east-2
aws cloudformation deploy --template-file packaged-deploy.yaml --stack-name gelcip-backend \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --parameter-overrides Environment=prod AdminEmail=contato@gelcip.com \
    SiteDomain=http://gelcip.s3-website.us-east-2.amazonaws.com \
  --region us-east-2
```

## Desenvolvimento Local

O site é HTML/CSS/JS puro — basta abrir `index.html` no navegador ou usar qualquer servidor local:

```bash
npx serve .
```

> **Nota:** Em desenvolvimento local os formulários não enviarão dados, pois a API (AWS) só aceita requisições do domínio S3 (CORS). O site publicado funciona normalmente.

## Contato

- **Endereço:** Av. Dr. Gentil de Moura, 737 - Ipiranga - São Paulo/SP
- **Telefone:** (11) 5068-0524
- **E-mail:** contato@gelcip.com
- **PIX (CNPJ):** 00.127.740/0001-93
