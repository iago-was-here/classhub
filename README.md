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

