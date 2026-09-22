# 073 Target Connecta

Site da Target Connecta (Presidente Prudente/SP): terceirização comercial, telemarketing
e venda porta a porta, mais os planos de internet da Target. HTML, CSS e JavaScript
estáticos, montados por um `build.mjs` em Node e servidos de `dist/`.

## Rodar

```bash
npm install          # só na primeira vez (sharp, puppeteer-core, cheerio, phosphor)
npm run build        # monta dist/index.html
npm run serve        # http://localhost:3073 (ou dois cliques em ABRIR-SITE.bat)
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run build` | monta `dist/` a partir de `src/` e avisa o que está pendente |
| `npm run publicar` | o mesmo, do zero, apagando o preview (antes de subir) |
| `npm run serve` | servidor local na porta 3073 |
| `npm run testar` | 67 verificações no Chrome: layout, menu, abas, catálogo, formulário e links |
| `npm run imagens` | gera as imagens de `src/assets/img` a partir da pasta de recursos do cliente |
| `npm run fontes` | baixa e recorta as fontes (Archivo e Manrope) |
| `npm run mapa` | gera o mapa da região com a geografia do IBGE |

## Estrutura

- `src/index.html` é o molde; cada seção é um parcial em `src/partials/`, com CSS e JS de
  mesmo nome em `src/css/` e `src/js/`.
- `src/dados/planos.json` gera as abas, os cards e o catálogo de aplicativos no build.
- `site.config.json` guarda contatos, endereço e as mensagens de WhatsApp, inclusive a do
  formulário de assinatura (`mensagens.cadastroPlano`).
- `dist/` vai versionado: a Vercel só serve a pasta, sem instalar nem buildar
  (ver `vercel.json`). Depois de mexer em `src/`, rodar `npm run publicar` e commitar.

A copy, o mockup e a memória do projeto ficam fora deste repositório, na pasta
`sites/073 - TARGET CONECTA/` do repositório da Credialta.
