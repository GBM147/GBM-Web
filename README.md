# GBM Web — Sites para Empresas

Base comercial para criação e clonagem de sites de clientes.

## Stack

- Node.js 20+
- Express 5
- Resend para formulários
- GSAP 3.15 + ScrollTrigger
- HTML/CSS/JavaScript

## Desenvolvimento

```bash
npm install --package-lock=false
npm start
```

Use Node.js 20 ou mais recente. O servidor usa a porta definida em `PORT`
(padrão: 10000). `GET /api/health` confirma a inicialização.
`npm run check` verifica a sintaxe do servidor e da aplicação principal.

## Monitoramento

O workflow `.github/workflows/keep-alive.yml` faz uma chamada externa a
`https://gbm-web-prod.onrender.com/api/health` a cada cinco minutos e verifica
se a resposta identifica o serviço `gbm-web`. Também permite execução manual
na aba Actions e executa uma primeira verificação quando esse arquivo muda
no `main`. Não precisa de tokens ou credenciais do Render

O GitHub pode atrasar execuções agendadas, portanto o intervalo não garante
disponibilidade contínua. As execuções usam a franquia de minutos do plano
quando aplicável. Em repositórios públicos, o GitHub pode desativar agendas
após 60 dias sem atividade

## Visual e demonstrações

A página usa fontes locais e os bundles de GSAP/ScrollTrigger do pacote
instalado, servidos em `/vendor/gsap/`. Não depende de Google Fonts ou de CDN
para funcionar. A direção de movimento segue as
[skills oficiais do GSAP](https://github.com/greensock/gsap-skills): timelines,
ScrollTrigger, animações por transform e respeito a `prefers-reduced-motion`.

`public/animations.js` separa o movimento das funções essenciais de navegação
e contato em `public/app.js`. O conteúdo continua visível sem animações.

As três páginas em `public/demos/` apresentam marcas fictícias: Época
Barbearia, Terra & Mesa e Pata Club. Seus botões de orçamento levam à GBM Web;
não recebem agendamentos para negócios reais.

As fontes Manrope e DM Sans estão em `public/assets/fonts/`, com suas
respectivas licenças OFL. As ilustrações SVG são parte do projeto.

## Arquitetura

O arquivo `public/site-config.js` concentra os dados que mudam de cliente para cliente.

Marca, localização, planos e contato pelo WhatsApp são configurados nesse
arquivo. `whatsapp` usa somente dígitos, com código do país e DDD; o número
comercial atual é `5511958974750`. `whatsappMessage` define a mensagem inicial.

Cada plano define `description`, `idealFor` e `features`, com `title` e
`description` para explicar cada entrega. A seção de planos em `index.html`
mantém o mesmo conteúdo para quem navegar sem JavaScript; atualize essa
versão junto com os dados quando mudar a oferta comercial

Para criar um novo site a partir desta base, altere a configuração e substitua os conteúdos visuais necessários sem acoplar o projeto ao GBM Finance.

## Variáveis

Copie `.env.example` para `.env` e preencha as credenciais do Resend.

Nunca publique chaves no repositório.
