# GBM Web — Sites para Empresas

Base comercial para criação e clonagem de sites de clientes.

## Stack

- Node.js 20+
- Express 5
- Resend para formulários
- GSAP 3.15 + ScrollTrigger, Lenis e Three.js (empacotado com esbuild)
- HTML/CSS/JavaScript

## Desenvolvimento

```bash
npm install --package-lock=false
npm start
```

Use Node.js 20 ou mais recente. O servidor usa a porta definida em `PORT`
(padrão: 10000). `GET /api/health` confirma a inicialização.
`npm run check` verifica a sintaxe do servidor e da aplicação principal.

## Publicação no Netlify

O frontend é estático, mas os formulários dependem de Functions nativas do Netlify.
O antigo servidor Express em `server.js` permanece disponível para desenvolvimento local com `npm start`.

1. Vincule este repositório (`GBM147/GBM-Web`), branch `main`, ao projeto no Netlify.
2. O arquivo `netlify.toml` já define `command = "npm run build:netlify"`, `publish = "public"`, diretório de Functions e Node.js 22. Deixe o diretório base em branco.
3. Cadastre em **Project configuration > Environment variables** (com escopo **Functions**) as variáveis secretas `RESEND_API_KEY`, `EMAIL_SUPORTE` e `EMAIL_FROM`. Use como remetente um endereço/domínio **verificado no Resend**. Nunca copie as chaves para o GitHub.
4. Faça o deploy e verifique `/api/health`: a resposta JSON deve conter `"success": true` e `"service": "gbm-web"`.
5. Teste manualmente o formulário de contato e o de avaliação e confirme o recebimento dos e-mails de ponta a ponta.
6. Teste a página `/projetos` (abas Barbearia, Restaurante e Pet shop), as animações GSAP e os botões do WhatsApp.

O Netlify publica os arquivos em `public/`; o build copia os bundles locais de GSAP do `node_modules` para `public/vendor/gsap/`.
As Functions modernas estão em `netlify/functions/`, com rotas configuradas por `config.path`, sem proxy para o Render.
As duas rotas que enviam e-mails possuem limites básicos de requisição por IP configurados no Netlify. Os limites diferem dos antigos limites locais de 15 minutos porque a plataforma limita as janelas de regras em código.
Em desenvolvimento local, o Express continua usando os seus limites originais.
A antiga rotina agendada que chamava o Render foi removida: no Netlify não há necessidade de keep-alive.

### Variáveis de ambiente

- `RESEND_API_KEY`: chave de API do serviço Resend, mantida privada.
- `EMAIL_SUPORTE`: endereço de destino para contatos e avaliações.
- `EMAIL_FROM`: nome e endereço remetente verificados, por exemplo `GBM Web <no-reply@dominio-verificado.com>`.
- `PORT`: usada só no servidor Express local, **não** necessária no Netlify.

Comandos: `npm install --package-lock=false`, `npm run check`, `npm run build:netlify` e `npm run test:netlify`.
O teste local verifica segurança básica/contratos, mas não substitui os testes reais de envio no site publicado.

## Visual e demonstrações

A página usa fontes locais e os bundles de GSAP/ScrollTrigger do pacote
instalado, servidos em `/vendor/gsap/`. Não depende de Google Fonts ou de CDN
para funcionar. A direção de movimento segue as
[skills oficiais do GSAP](https://github.com/greensock/gsap-skills): timelines,
ScrollTrigger, animações por transform e respeito a `prefers-reduced-motion`.

`public/animations.js` separa o movimento das funções essenciais de navegação
e contato em `public/app.js`. O conteúdo continua visível sem animações.

O site tem no máximo duas páginas: `/` (topo com demonstração ao vivo, planos e
contato)
e `/projetos`, que reúne em abas as três demonstrações com marcas fictícias:
Época Barbearia, Terra & Mesa e Pata Club (`/projetos#barbearia`,
`#restaurante`, `#petshop`). Seus botões de orçamento levam à GBM Web; não
recebem agendamentos para negócios reais. Os antigos endereços
`/demos/*.html` redirecionam para `/projetos`.

As fontes Manrope e DM Sans estão em `public/assets/fonts/`, com suas
respectivas licenças OFL. As ilustrações SVG são parte do projeto.

## Página cinematográfica (3D)

A página inicial inteira segue o mesmo modelo: fundo escuro com brilho laranja e
um único celular em 3D (Three.js), numa camada fixa atrás da página, que
acompanha a rolagem. Cada parte fica travada (GSAP ScrollTrigger) enquanto passa
por suas etapas:

- **Topo:** 4 etapas com os exemplos e a conversa no WhatsApp.
- **Planos:** abertura e um plano por etapa, com o preço contando. O celular
  troca de exemplo a cada plano. Os painéis são montados por `renderPlans()` a
  partir de `SITE_CONFIG.plans`, e o HTML de reserva em `index.html` segue o
  mesmo formato.
- **Contato:** uma abertura curta com o título, depois o formulário.

A coreografia do celular (`createChoreography` em `public/animations.js`)
mede as colunas vazias de cada parte (`.story-visual`) e calcula a pose para
cada trecho da rolagem. No celular, o 3D aparece só no topo.

- `src/hero3d.js`: cena 3D. O `npm run build:netlify` (esbuild) gera
  `public/vendor/hero3d.js`, carregado só depois que a página aparece. Até lá,
  e com movimento reduzido, aparece uma imagem fixa do celular no topo e os
  planos ficam lado a lado.
- `public/assets/3d/phone.glb`: o celular, modelado por código no Blender
  (`art/phone.py`). Para refazer: crie um ambiente Python com
  `pip install -r art/requirements.txt` e rode `python art/phone.py`.
- `public/assets/screens/*.webp`: telas mostradas no celular. Refaça com
  `npm run screens` quando os exemplos de `/projetos` mudarem.
- Rolagem suave (Lenis), abertura animada (só na primeira visita da sessão) e
  cursor em anel funcionam só no computador. No celular a rolagem é a nativa.

## Arquitetura

O arquivo `public/site-config.js` concentra os dados que mudam de cliente para cliente.

Marca, localização, planos e contato pelo WhatsApp são configurados nesse
arquivo. `whatsapp` usa somente dígitos, com código do país e DDD; o número
comercial atual é `5511958974750`. `whatsappMessage` define a mensagem inicial.

Cada plano define `description`, `idealFor` e `features`, uma lista curta de
entregas. A seção de planos em `index.html`
mantém o mesmo conteúdo para quem navegar sem JavaScript; atualize essa
versão junto com os dados quando mudar a oferta comercial

Para criar um novo site a partir desta base, altere a configuração e substitua os conteúdos visuais necessários sem acoplar o projeto ao GBM Finance.

## Variáveis

Copie `.env.example` para `.env` e preencha as credenciais do Resend.

Nunca publique chaves no repositório.
