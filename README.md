# GBM Web — Sites para Empresas

Base comercial para criação e clonagem de sites de clientes.

## Stack

- Node.js 20+
- Express 5
- Resend para formulários
- GSAP 3.15 + ScrollTrigger
- HTML/CSS/JavaScript

## Arquitetura

O arquivo `public/site-config.js` concentra os dados que mudam de cliente para cliente.

Para criar um novo site a partir desta base, altere a configuração e substitua os conteúdos visuais necessários sem acoplar o projeto ao GBM Finance.

## Variáveis

Copie `.env.example` para `.env` e preencha as credenciais do Resend.

Nunca publique chaves no repositório.
