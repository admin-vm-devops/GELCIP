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
│   ├── deploy.sh           Deploy completo (frontend + backend)
│   └── destroy.sh          Destroy completo (stack + limpeza)
└── backend/
    ├── README.md           Documentação técnica do backend
    ├── deploy.yaml         Template CloudFormation (deploy incremental)
    ├── template.yaml       Template completo (recriação do zero)
    ├── package.json        Dependências compartilhadas
    ├── inscricao/          Lambda: POST /inscricao
    ├── contato/            Lambda: POST /contato
    ├── admin/              Lambda: POST /admin/login, GET/DELETE dados
    └── empty-buckets/      Lambda: custom resource (esvazia S3 ao deletar stack)
```

## Deploy

### Via Scripts (recomendado)

```bash
cd ~/Projects/GELCIP

# Deploy completo (frontend + backend)
./scripts/deploy.sh

# Destruir tudo (esvazia buckets + deleta stack + limpa SSM/SES)
./scripts/destroy.sh
```

O `deploy.sh` automatiza todo o processo:
- Verifica pré-requisitos (AWS CLI, Node, credenciais)
- Coleta/gera segredos (senha admin + JWT secret)
- Instala dependências das Lambdas
- Empacota e deploya via CloudFormation
- Captura a URL da API e atualiza `script.js` automaticamente
- Sincroniza frontend com S3

O `destroy.sh` limpa tudo:
- Deleta stack CloudFormation (Lambda `empty-buckets` esvazia S3 automaticamente)
- Limpa SSM Parameters órfãos
- Limpa SES Identity órfã
- Buckets S3 preservados (vazios)

### Manual - Frontend

```bash
aws s3 sync . s3://gelcip \
  --exclude ".git/*" --exclude "backend/*" --exclude "scripts/*" \
  --exclude ".gitignore" --exclude "packaged-deploy.yaml" \
  --region us-east-2
```

### Manual - Backend

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

> **Nota:** Em desenvolvimento local os formulários não enviarão dados, pois a API (AWS) só aceita requisições do domínio S3 (CORS). O site publicado funciona normalmente.

## Contato

- **Endereço:** Av. Dr. Gentil de Moura, 737 - Ipiranga - São Paulo/SP
- **Telefone:** (11) 5068-0524
- **E-mail:** contato@gelcip.com
- **PIX (CNPJ):** 00.127.740/0001-93
