# 073 Target Connect

Site B2B da Target Connect (Presidente Prudente/SP): terceirização de operações comerciais
porta a porta (PAP) para provedores de internet. Reformulado em 11/2026 a partir do briefing
do Rafael (marinho e laranja, sem os planos da Fleetnet). HTML, CSS e JavaScript estáticos,
montados por um `build.mjs` em Node e servidos de `dist/`.

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
| `npm run testar` | verificações no Chrome: larguras, revelação, menu, links do WhatsApp, mapas, formulário e dúvidas |
| `npm run imagens` | hero (da arte do Rafael), favicons e imagem de compartilhamento |
| `npm run fontes` | baixa e recorta as fontes (Archivo e Manrope) |
| `npm run mapa` | gera os mapas do Brasil e da região (IBGE) a partir de `src/dados/cidades.json` |

## Estrutura

- `src/index.html` é o molde; cada seção é um parcial em `src/partials/`, com CSS e JS de
  mesmo nome em `src/css/` e `src/js/`.
- `src/dados/cidades.json` alimenta o mapa e a lista de cidades; `src/dados/duvidas.json` o acordeão e o FAQPage.
- O símbolo do logo é `src/assets/img/marca.svg` (desenhado a partir da arte); o nome vai em texto.
- `site.config.json` guarda contatos, endereço e as mensagens de WhatsApp, inclusive o modelo do
  formulário de proposta (`mensagens.proposta`).
- `dist/` vai versionado: a Vercel só serve a pasta, sem instalar nem buildar
  (ver `vercel.json`). Depois de mexer em `src/`, rodar `npm run publicar` e commitar.

A copy, o mockup e a memória do projeto ficam fora deste repositório, na pasta
`sites/073 - TARGET CONECTA/` do repositório da Credialta.
