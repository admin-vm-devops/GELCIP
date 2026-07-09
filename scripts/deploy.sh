#!/bin/bash
# =============================================================================
# GELCIP - Deploy completo da infraestrutura
# Recria toda a infra do zero a partir do repositório
# =============================================================================
set -e

REGION="us-east-2"
STACK_NAME="gelcip-backend"
DEPLOY_BUCKET="gelcip-deploy"
SITE_BUCKET="gelcip"
ADMIN_EMAIL="contato@gelcip.com"
SITE_DOMAIN="http://${SITE_BUCKET}.s3-website.${REGION}.amazonaws.com"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== GELCIP - Deploy Completo ===${NC}"
echo "Região: ${REGION}"
echo "Stack: ${STACK_NAME}"
echo ""

# -----------------------------------------------------------------------------
# 1. Verificar pré-requisitos
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/6] Verificando pré-requisitos...${NC}"

if ! command -v aws &> /dev/null; then
  echo -e "${RED}ERRO: AWS CLI não encontrado. Instale: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html${NC}"
  exit 1
fi

if ! command -v node &> /dev/null; then
  echo -e "${RED}ERRO: Node.js não encontrado.${NC}"
  exit 1
fi

# Verificar credenciais AWS
if ! aws sts get-caller-identity --region "$REGION" &> /dev/null; then
  echo -e "${RED}ERRO: Credenciais AWS inválidas. Configure com 'aws configure' ou SSO.${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Pré-requisitos OK${NC}"

# -----------------------------------------------------------------------------
# 2. Coletar segredos (senha admin + JWT secret)
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[2/6] Configurando segredos...${NC}"

# Senha do admin
if [ -z "$GELCIP_ADMIN_PASSWORD" ]; then
  read -sp "Senha do admin (padrão: kardec): " ADMIN_PASSWORD
  echo ""
  ADMIN_PASSWORD=${ADMIN_PASSWORD:-kardec}
else
  ADMIN_PASSWORD="$GELCIP_ADMIN_PASSWORD"
fi

# Gerar hash bcrypt
ADMIN_HASH=$(node -e "console.log(require('${BACKEND_DIR}/admin/node_modules/bcryptjs').hashSync('${ADMIN_PASSWORD}', 10))")

# JWT Secret
if [ -z "$GELCIP_JWT_SECRET" ]; then
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  echo "JWT Secret gerado automaticamente."
else
  JWT_SECRET="$GELCIP_JWT_SECRET"
fi

echo -e "${GREEN}✓ Segredos configurados${NC}"

# -----------------------------------------------------------------------------
# 3. Instalar dependências das Lambdas
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[3/6] Instalando dependências...${NC}"

cd "${BACKEND_DIR}/admin"
npm install --production --silent
cd "${BACKEND_DIR}"

echo -e "${GREEN}✓ Dependências instaladas${NC}"

# -----------------------------------------------------------------------------
# 4. Verificar/criar bucket de deploy
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[4/6] Verificando bucket de deploy...${NC}"

if ! aws s3api head-bucket --bucket "$DEPLOY_BUCKET" --region "$REGION" 2>/dev/null; then
  echo "Criando bucket ${DEPLOY_BUCKET}..."
  aws s3 mb "s3://${DEPLOY_BUCKET}" --region "$REGION"
fi

echo -e "${GREEN}✓ Bucket de deploy OK${NC}"

# -----------------------------------------------------------------------------
# 5. Empacotar e fazer deploy do CloudFormation
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[5/6] Fazendo deploy do backend (CloudFormation)...${NC}"

aws cloudformation package \
  --template-file "${BACKEND_DIR}/deploy.yaml" \
  --s3-bucket "$DEPLOY_BUCKET" \
  --output-template-file "${BACKEND_DIR}/packaged-deploy.yaml" \
  --region "$REGION"

aws cloudformation deploy \
  --template-file "${BACKEND_DIR}/packaged-deploy.yaml" \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --parameter-overrides \
    AdminEmail="$ADMIN_EMAIL" \
    SiteDomain="$SITE_DOMAIN" \
    AdminPasswordHash="$ADMIN_HASH" \
    JwtSecret="$JWT_SECRET" \
  --region "$REGION"

echo -e "${GREEN}✓ Backend deployado${NC}"

# -----------------------------------------------------------------------------
# 6. Fazer upload do site para S3
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[6/6] Sincronizando site com S3...${NC}"

aws s3 sync "$PROJECT_ROOT" "s3://${SITE_BUCKET}" \
  --exclude ".git/*" \
  --exclude "backend/*" \
  --exclude ".gitignore" \
  --exclude "*.md" \
  --region "$REGION"

echo -e "${GREEN}✓ Site sincronizado${NC}"

# -----------------------------------------------------------------------------
# Resultado
# -----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}=== Deploy completo! ===${NC}"
echo ""
echo "Site:  ${SITE_DOMAIN}"
echo "Admin: ${SITE_DOMAIN}/admin.html"
echo ""

# Mostrar URL da API
API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text \
  --region "$REGION")
echo "API:   ${API_URL}"
echo ""
echo -e "${YELLOW}NOTA: Verifique o e-mail ${ADMIN_EMAIL} no SES para ativar notificações.${NC}"
