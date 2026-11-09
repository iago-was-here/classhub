#!/bin/bash

# Cores para o terminal
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # Sem cor

clear

# O parâmetro '-s' esconde o que você digita. A senha vai para a variável DB_PASS
read -s -p "Digite a senha do banco de dados para iniciar: " DB_PASS
echo -e "\n"

echo -e "${CYAN}=====================================================${NC}"
echo -e "${CYAN}  DEMONSTRAÇÃO: REPLICAÇÃO DE DADOS (PRIMARY-REPLICA) ${NC}"
echo -e "${CYAN}=====================================================${NC}\n"

echo -e "${GREEN}[PASSO 1] Consultando usuários atuais na RÉPLICA...${NC}"
docker exec -e PGPASSWORD="$DB_PASS" -t postgres-replica psql -U postgres -d communication -c "SELECT id, username FROM users;"
echo ""

echo -e "${CYAN}Vá ao ClassHub e registre um NOVO USUÁRIO.${NC}"
read -p "Pressione [ENTER] apenas APÓS criar o usuário para verificar a sincronização..."
echo ""

echo -e "${GREEN}[PASSO 2] Consultando a RÉPLICA novamente...${NC}"
echo "O novo usuário deve aparecer abaixo:"
docker exec -e PGPASSWORD="$DB_PASS" -t postgres-replica psql -U postgres -d communication -c "SELECT id, username FROM users;"
echo ""

echo -e "${CYAN}Vamos provar que a Réplica é estritamente Read-Only.${NC}"
read -p "Pressione [ENTER] para tentar forçar um INSERT direto na réplica..."
echo ""

echo -e "${RED}[PASSO 3] Executando comando malicioso na RÉPLICA...${NC}"
echo "Comando: INSERT INTO users (id, username, password_hash) VALUES (gen_random_uuid(), 'escritareplica', '12345');"
docker exec -e PGPASSWORD="$DB_PASS" -t postgres-replica psql -U postgres -d communication -c "INSERT INTO users (id, username, password_hash) VALUES (gen_random_uuid(), 'escritareplica', '12345');"

echo ""
echo -e "${CYAN}=====================================================${NC}"
echo -e "${CYAN}  FIM DA DEMONSTRAÇÃO ${NC}"
echo -e "${CYAN}=====================================================${NC}"