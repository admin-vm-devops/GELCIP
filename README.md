# GELCIP - Grupo Espírita Luz e Caridade Irmãos da Paz

Site institucional do GELCIP, uma entidade filantrópica espírita localizada no Ipiranga, São Paulo/SP.

🌐 **Site:** http://gelcip.s3-website.us-east-2.amazonaws.com  
🔒 **Admin:** http://gelcip.s3-website.us-east-2.amazonaws.com/admin.html

## Arquitetura

```
┌──────────────┐       ┌──────────────┐       ┌─────────────┐
│   Browser    │──────▶│  S3 Website  │       │  DynamoDB   │
│  (usuário)   │       │   (gelcip)   │       │  (dados)    │
└──────┬───────┘       └──────────────┘       └──────▲──────┘
       │                                              │
       │  fetch POST/GET                              │
       └──────────────▶┌──────────────┐       ┌──────┴──────┐
                       │ API Gateway  │──────▶│   Lambda    │──▶ SES (e-mail)
                       │   /prod      │       │  (Node 20)  │
                       └──────────────┘       └─────────────┘
```

**Stack:** HTML5 + CSS + JS vanilla (frontend) · Node.js 20 + DynamoDB + SES (backend) · CloudFormation/SAM (IaC)

## Funcionalidades

- **Página principal** — quem somos, horários, tratamentos, cursos, inscrição, doação PIX, contato
- **Formulário de inscrição** — dados salvos no DynamoDB + notificação por e-mail
- **Formulário de contato** — dados salvos no DynamoDB + notificação por e-mail
- **Painel admin** — login JWT, listagem de inscrições/contatos, busca, exportar CSV, excluir

## Estrutura do Projeto

```
├── index.html              Página principal
├── admin.html              Painel administrativo (login JWT)
├── script.js               Lógica dos formulários (fetch → API)
├── styles.css              Estilos responsivos
├── assets/                 Imagens do site
│
└── backend/
    ├── deploy.yaml         Template CloudFormation (deploy incremental)
    ├── template.yaml       Template completo (recriação do zero)
    ├── README.md           Documentação técnica do backend
    ├── inscricao/          Lambda: POST /inscricao
    ├── contato/            Lambda: POST /contato
    └── admin/              Lambda: POST /admin/login, GET/DELETE inscricoes/contatos
```

## Deploy

### Pré-requisitos

- AWS CLI configurado com perfil que tenha acesso à conta 212641463907
- Região: `us-east-2`

### Frontend (site estático)

```bash
aws s3 sync . s3://gelcip \
  --exclude ".git/*" \
  --exclude "backend/*" \
  --exclude ".gitignore" \
  --region us-east-2
```

### Backend (Lambdas + API)

```bash
cd backend

aws cloudformation package \
  --template-file deploy.yaml \
  --s3-bucket gelcip-deploy \
  --output-template-file packaged-deploy.yaml \
  --region us-east-2

aws cloudformation deploy \
  --template-file packaged-deploy.yaml \
  --stack-name gelcip-backend \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --parameter-overrides \
    AdminEmail=contato@gelcip.com \
    SiteDomain=http://gelcip.s3-website.us-east-2.amazonaws.com \
  --region us-east-2
```

## Desenvolvimento Local

O site é HTML/CSS/JS puro — basta abrir `index.html` no navegador ou usar qualquer servidor local:

```bash
npx serve .
```

> **Nota:** Os formulários dependem da API na AWS. Em desenvolvimento local, as chamadas à API falharão por CORS (o CORS está configurado apenas para o domínio S3).

## Contato

- **Endereço:** Av. Dr. Gentil de Moura, 737 - Ipiranga - São Paulo/SP
- **Telefone:** (11) 5068-0524
- **E-mail:** contato@gelcip.com
- **PIX (CNPJ):** 00.127.740/0001-93
