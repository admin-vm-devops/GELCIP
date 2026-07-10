#!/bin/bash
# =============================================================================
# GELCIP - Destroy da infraestrutura
# Uso: ./scripts/destroy.sh [dev|prod]   (padrão: dev)
# Deleta o stack CloudFormation (buckets S3 são retidos vazios)
# =============================================================================
set -e

# -----------------------------------------------------------------------------
# Configuração do ambiente
# -----------------------------------------------------------------------------
ENV="${1:-dev}"

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "Uso: $0 [dev|prod]"
  echo "  dev  - Destruir ambiente de desenvolvimento (padrão)"
  echo "  prod - Destruir ambiente de produção"
  exit 1
fi

REGION="us-east-2"

if [ "$ENV" = "prod" ]; then
  STACK_NAME="gelcip-backend"
  SSM_PREFIX="/gelcip"
else
  STACK_NAME="gelcip-backend-dev"
  SSM_PREFIX="/gelcip-dev"
fi

ADMIN_EMAIL="contato@gelcip.com"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}=== GELCIP - Destroy da Infraestrutura [${BLUE}${ENV^^}${RED}] ===${NC}"
echo "Região: ${REGION}"
echo "Stack: ${STACK_NAME}"
echo ""
echo "Isso vai DESTRUIR:"
echo "  - API Gateway"
echo "  - Lambdas (inscricao, contato, admin, empty-buckets)"
echo "  - DynamoDB (inscricoes, contatos) — DADOS PERDIDOS!"
echo "  - SSM Parameters (${SSM_PREFIX}/admin-password-hash, ${SSM_PREFIX}/jwt-secret)"

if [ "$ENV" = "prod" ]; then
  echo "  - SES Email Identity"
fi

echo ""
echo "Os buckets S3 serão ESVAZIADOS mas PRESERVADOS (nome/URL mantidos)."
echo ""

if [ "$ENV" = "prod" ]; then
  echo -e "${RED}⚠  ATENÇÃO: Você está destruindo o ambiente de PRODUÇÃO!${NC}"
  read -p "Digite 'destroy prod' para confirmar: " CONFIRM
  if [ "$CONFIRM" != "destroy prod" ]; then
    echo -e "${YELLOW}Cancelado.${NC}"
    exit 0
  fi
else
  read -p "Tem certeza? Digite 'destroy' para confirmar: " CONFIRM
  if [ "$CONFIRM" != "destroy" ]; then
    echo -e "${YELLOW}Cancelado.${NC}"
    exit 0
  fi
fi

echo ""

# -----------------------------------------------------------------------------
# 1. Verificar se o stack existe
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/3] Verificando stack...${NC}"

STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].StackStatus" \
  --output text \
  --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

if [ "$STACK_STATUS" = "NOT_FOUND" ]; then
  echo -e "${YELLOW}Stack '${STACK_NAME}' não encontrado. Nada a destruir.${NC}"
  exit 0
fi

echo "Stack status: ${STACK_STATUS}"

# -----------------------------------------------------------------------------
# 2. Deletar o stack
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[2/3] Deletando stack (a Lambda esvazia os buckets automaticamente)...${NC}"

aws cloudformation delete-stack \
  --stack-name "$STACK_NAME" \
  --region "$REGION"

echo "Aguardando deleção..."

aws cloudformation wait stack-delete-complete \
  --stack-name "$STACK_NAME" \
  --region "$REGION"

echo -e "${GREEN}✓ Stack deletado com sucesso${NC}"

# -----------------------------------------------------------------------------
# 3. Limpar recursos órfãos (SSM Parameters + SES Identity)
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[3/3] Limpando recursos órfãos...${NC}"

# SSM Parameters
for PARAM in "${SSM_PREFIX}/admin-password-hash" "${SSM_PREFIX}/jwt-secret"; do
  if aws ssm get-parameter --name "$PARAM" --region "$REGION" &>/dev/null; then
    aws ssm delete-parameter --name "$PARAM" --region "$REGION"
    echo "  Deletado SSM: $PARAM"
  fi
done

# SES Email Identity (apenas para prod)
if [ "$ENV" = "prod" ]; then
  if aws ses get-identity-verification-attributes --identities "$ADMIN_EMAIL" --region "$REGION" \
     --query "VerificationAttributes.\"${ADMIN_EMAIL}\"" --output text 2>/dev/null | grep -q .; then
    aws ses delete-identity --identity "$ADMIN_EMAIL" --region "$REGION"
    echo "  Deletado SES: $ADMIN_EMAIL"
  fi
fi

echo -e "${GREEN}✓ Recursos órfãos limpos${NC}"
echo ""

if [ "$ENV" = "prod" ]; then
  echo "Buckets preservados (vazios):"
  echo "  - s3://gelcip"
  echo "  - s3://gelcip-deploy"
else
  echo "Buckets preservados (vazios):"
  echo "  - s3://gelcip-dev"
  echo "  - s3://gelcip-deploy-dev"
fi

echo ""
echo "Para recriar a infra: ./scripts/deploy.sh ${ENV}"
