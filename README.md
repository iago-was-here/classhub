# ClassHub

Plataforma distribuída para comunicação acadêmica desenvolvida como projeto da disciplina de **Sistemas Distribuídos** do Instituto Federal do Sul de Minas Gerais (IFSULDEMINAS) – Campus Poços de Caldas.

O objetivo do projeto é oferecer um ambiente organizado para comunicação entre estudantes e docentes, permitindo a criação de canais por disciplina, troca de mensagens em tempo real, compartilhamento de imagens e materiais de apoio, criação de tópicos de discussão e publicação de avisos importantes.

A aplicação foi projetada utilizando uma **arquitetura baseada em microsserviços**, aplicando conceitos fundamentais de Sistemas Distribuídos como comunicação síncrona e assíncrona, mensageria, containerização, autenticação distribuída e escalabilidade.

## Principais funcionalidades

* Cadastro e autenticação de usuários
* Criação e gerenciamento de canais por disciplina
* Envio de mensagens em tempo real
* Compartilhamento de imagens e arquivos
* Criação de tópicos de discussão
* Publicação de avisos para os participantes do canal
* Notificações em tempo real via WebSocket

## Arquitetura

O sistema é composto pelos seguintes componentes:

* **Frontend** — Interface web da aplicação.
* **API Gateway** — Responsável pelo roteamento das requisições para os microsserviços.
* **Auth Service** — Gerenciamento de autenticação, cadastro e autorização utilizando JWT.
* **Message Service** — Gerenciamento de canais, tópicos e mensagens.
* **Notification Service** — Consome eventos publicados no RabbitMQ e envia notificações em tempo real aos clientes conectados.
* **RabbitMQ** — Broker de mensagens responsável pela comunicação assíncrona entre os serviços.
* **PostgreSQL** — Banco de dados relacional utilizado para persistência das informações.

## Tecnologias

* Node.js
* Express
* PostgreSQL
* RabbitMQ
* Docker
* Docker Compose
* JWT
* WebSocket
* REST API

## Canais e Mensagens

As rotas são disponibilizadas pelo Gateway em `http://localhost:8080` e exigem um JWT válido no cabeçalho `Authorization: Bearer <token>`.

* `POST /api/channels` — cria `{ "name": "...", "description": "..." }`; o criador já fica inscrito.
* `GET /api/channels` — lista canais disponíveis, contagem de membros e `isMember` para o usuário atual.
* `POST /api/channels/:channelId/subscriptions` — inscreve o usuário no canal.
* `DELETE /api/channels/:channelId/subscriptions` — remove a inscrição.
* `POST /api/channels/:channelId/messages` — envia `{ "text": "..." }`; requer inscrição no canal.
* `GET /api/channels/:channelId/messages?limit=50&before=<ISO-8601>` — consulta o histórico do canal; limite máximo de 100 por página.
* `GET /health` — verifica a disponibilidade do PostgreSQL no serviço.

O envio grava a mensagem e um evento na outbox em uma única transação. O evento inclui o `channelId`, é publicado na fila durável `classhub.messages` e entregue por WebSocket apenas aos membros inscritos e conectados. A conexão usa `ws://localhost:8083/ws?token=<jwt>`; clientes desconectados podem consultar o histórico ao retornar. Mensagens antigas são migradas para o canal `Geral`.

O frontend lista todos os canais, inscreve o usuário ao selecionar um canal disponível e cria canais pela mesma API.

Os testes do serviço podem ser executados sem Node.js instalado no host:

```sh
docker compose -f docker-compose-dev.yml run --rm --build --no-deps message-service npm test
```

## Notificações em Tempo Real

O serviço consome os eventos `message.created` da fila `classhub.messages` e os transmite aos clientes conectados por WebSocket. A conexão fica disponível em `ws://localhost:8083/ws?token=<jwt>`; o token é validado pelo Auth Service e as origens permitidas são configuradas em `WS_ALLOWED_ORIGINS`. Como o modelo atual de mensagens não define canais ou destinatários, os eventos são transmitidos a todos os clientes autenticados conectados. Clientes desconectados podem consultar o histórico pela API de mensagens.

Os testes também rodam no container, sem instalar dependências no host:

```sh
docker compose -f docker-compose-dev.yml run --rm --build --no-deps notification-service npm test
```

## Conceitos de Sistemas Distribuídos Aplicados

* Arquitetura de Microsserviços
* Comunicação síncrona utilizando REST
* Comunicação assíncrona utilizando RabbitMQ
* Containerização com Docker
* API Gateway
* Identificadores Globais (UUID)
* Autenticação Stateless com JWT
* Tolerância inicial a falhas utilizando políticas de reinicialização dos containers
* Escalabilidade horizontal dos serviços

## Estrutura do Projeto

```text
.
├── frontend/
├── gateway/
├── services/
│   ├── auth-service/
│   ├── message-service/
│   └── notification-service/
├── database/
├── docker-compose-dev.yml
└── README.md
```

## Objetivo Acadêmico

Este projeto tem como finalidade aplicar, de forma prática, os conceitos estudados na disciplina de Sistemas Distribuídos, explorando a construção de uma aplicação distribuída baseada em microsserviços, comunicação por APIs REST, mensageria assíncrona, persistência de dados e notificações em tempo real.

## Equipe

* Caio Henrique Madalena
* Iago Ananias Silva
* João Gabriel Souza

**Instituto Federal do Sul de Minas Gerais – Campus Poços de Caldas**

Disciplina: **Sistemas Distribuídos**

