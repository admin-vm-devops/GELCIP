#!/bin/bash
# =============================================================================
# GELCIP - Destroy da infraestrutura
# Deleta o stack CloudFormation (buckets S3 são retidos vazios)
# =============================================================================
set -e

REGION="us-east-2"
STACK_NAME="gelcip-backend"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}=== GELCIP - Destroy da Infraestrutura ===${NC}"
echo "Região: ${REGION}"
echo "Stack: ${STACK_NAME}"
echo ""
echo "Isso vai DESTRUIR:"
echo "  - API Gateway"
echo "  - Lambdas (inscricao, contato, admin, empty-buckets)"
echo "  - DynamoDB (inscricoes, contatos) — DADOS PERDIDOS!"
echo "  - SES Email Identity"
echo "  - SSM Parameters (admin-password-hash, jwt-secret)"
echo ""
echo "Os buckets S3 serão ESVAZIADOS mas PRESERVADOS (nome/URL mantidos)."
echo ""

read -p "Tem certeza? Digite 'destroy' para confirmar: " CONFIRM
if [ "$CONFIRM" != "destroy" ]; then
  echo -e "${YELLOW}Cancelado.${NC}"
  exit 0
fi

echo ""

# -----------------------------------------------------------------------------
# 1. Verificar se o stack existe
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/2] Verificando stack...${NC}"

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
echo -e "${YELLOW}[2/2] Deletando stack (a Lambda esvazia os buckets automaticamente)...${NC}"

aws cloudformation delete-stack \
  --stack-name "$STACK_NAME" \
  --region "$REGION"

echo "Aguardando deleção..."

aws cloudformation wait stack-delete-complete \
  --stack-name "$STACK_NAME" \
  --region "$REGION"

echo -e "${GREEN}✓ Stack deletado com sucesso${NC}"
echo ""
echo "Buckets preservados (vazios):"
echo "  - s3://gelcip"
echo "  - s3://gelcip-deploy"
echo ""
echo "Para recriar a infra: ./backend/scripts/deploy.sh"
