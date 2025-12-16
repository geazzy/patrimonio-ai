#!/bin/bash

# Script para testar Rate Limiting
# Uso: ./test-rate-limit.sh

API_URL="http://localhost:3001/patrimonio/api"
COLORS_GREEN='\033[0;32m'
COLORS_RED='\033[0;31m'
COLORS_YELLOW='\033[1;33m'
COLORS_BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${COLORS_BLUE}========================================${NC}"
echo -e "${COLORS_BLUE}  Teste de Rate Limiting${NC}"
echo -e "${COLORS_BLUE}========================================${NC}\n"

# Teste 1: Login Rate Limiter
test_login_limiter() {
  echo -e "${COLORS_YELLOW}[Teste 1] Login Rate Limiter (5/15min)${NC}"
  echo "Fazendo 6 tentativas de login..."
  
  for i in {1..6}; do
    echo -n "  Tentativa $i: "
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/google" \
      -H "Content-Type: application/json" \
      -d '{"credential": "test"}')
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | head -1)
    
    if [ "$HTTP_CODE" == "429" ]; then
      echo -e "${COLORS_RED}BLOQUEADO (429)${NC}"
      echo "    Resposta: $(echo $BODY | jq -r '.error' 2>/dev/null || echo $BODY)"
    else
      echo -e "${COLORS_GREEN}OK ($HTTP_CODE)${NC}"
    fi
    
    sleep 1
  done
  echo ""
}

# Teste 2: Refresh Rate Limiter
test_refresh_limiter() {
  echo -e "${COLORS_YELLOW}[Teste 2] Refresh Token Rate Limiter (10/5min)${NC}"
  echo "Fazendo 11 tentativas de refresh..."
  
  for i in {1..11}; do
    echo -n "  Tentativa $i: "
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/refresh" \
      -H "Content-Type: application/json")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | head -1)
    
    if [ "$HTTP_CODE" == "429" ]; then
      echo -e "${COLORS_RED}BLOQUEADO (429)${NC}"
      echo "    Resposta: $(echo $BODY | jq -r '.error' 2>/dev/null || echo $BODY)"
    else
      echo -e "${COLORS_GREEN}OK ($HTTP_CODE)${NC}"
    fi
    
    sleep 0.5
  done
  echo ""
}

# Teste 3: Global API Rate Limiter
test_global_limiter() {
  echo -e "${COLORS_YELLOW}[Teste 3] Global API Rate Limiter (100/15min)${NC}"
  echo "Fazendo 101 requisições rápidas..."
  
  BLOCKED=0
  for i in {1..101}; do
    if [ $((i % 10)) -eq 0 ]; then
      echo -n "  Requisições 1-$i: "
    fi
    
    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/health" 2>/dev/null)
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    
    if [ "$HTTP_CODE" == "429" ]; then
      BLOCKED=$((BLOCKED + 1))
    fi
    
    if [ $((i % 10)) -eq 0 ]; then
      if [ $BLOCKED -gt 0 ]; then
        echo -e "${COLORS_RED}$BLOCKED bloqueadas${NC}"
      else
        echo -e "${COLORS_GREEN}Nenhuma bloqueada${NC}"
      fi
    fi
  done
  
  if [ $BLOCKED -gt 0 ]; then
    echo -e "  ${COLORS_RED}✓ Global rate limiter funcionando: $BLOCKED requisições bloqueadas${NC}"
  else
    echo -e "  ${COLORS_YELLOW}⚠ Limite não atingido (aumente o número de requisições)${NC}"
  fi
  echo ""
}

# Teste 4: Verificar Headers de Rate Limit
test_rate_limit_headers() {
  echo -e "${COLORS_YELLOW}[Teste 4] Headers de Rate Limit${NC}"
  echo "Verificando headers de rate limit..."
  
  HEADERS=$(curl -s -i "$API_URL/health" 2>/dev/null | grep -i "ratelimit")
  
  if [ -z "$HEADERS" ]; then
    echo -e "  ${COLORS_RED}✗ Headers não encontrados${NC}"
  else
    echo -e "  ${COLORS_GREEN}✓ Headers encontrados:${NC}"
    echo "$HEADERS" | sed 's/^/    /'
  fi
  echo ""
}

# Menu
if [ -z "$1" ]; then
  echo "Testes disponíveis:"
  echo "  1 - Login Rate Limiter"
  echo "  2 - Refresh Rate Limiter"
  echo "  3 - Global API Rate Limiter"
  echo "  4 - Verificar Headers"
  echo "  all - Executar todos os testes"
  echo ""
  read -p "Qual teste deseja executar? (1-4 ou all): " CHOICE
else
  CHOICE=$1
fi

case $CHOICE in
  1|login)
    test_login_limiter
    ;;
  2|refresh)
    test_refresh_limiter
    ;;
  3|global)
    test_global_limiter
    ;;
  4|headers)
    test_rate_limit_headers
    ;;
  all)
    test_login_limiter
    test_refresh_limiter
    test_global_limiter
    test_rate_limit_headers
    ;;
  *)
    echo "Opção inválida"
    exit 1
    ;;
esac

echo -e "${COLORS_BLUE}========================================${NC}"
echo -e "${COLORS_BLUE}  Testes Concluídos${NC}"
echo -e "${COLORS_BLUE}========================================${NC}"
