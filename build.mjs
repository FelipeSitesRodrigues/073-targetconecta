/**
 * Build do site da Target Connecta. HTML, CSS e JS estático em dist/ (base do 069).
 *
 *   node build.mjs                            página inteira em dist/index.html
 *   node build.mjs --preview 05-planos        só aquela seção, em dist/preview/05-planos.html
 *   node build.mjs --preview 00-header,01-hero
 *   node build.mjs --publicar                 página inteira e apaga dist/preview (antes do commit)
 *
 * Como funciona:
 * - src/index.html é o molde. <!-- @parcial NOME --> puxa src/partials/NOME.html
 *   (um parcial pode puxar outro, como o mapa gerado em _mapa.html).
 *   Trecho entre <!-- @head --> e <!-- /@head --> num parcial sobe pro <head>.
 * - CSS: src/css/_*.css primeiro (fontes e base), depois o arquivo de cada seção,
 *   com o mesmo nome do parcial, em ordem de nome. Entra minificado num <style>.
 * - JS: mesma regra, em src/js, num <script> no fim do <body>. Cada arquivo é um IIFE.
 * - <!-- @planos --> e <!-- @catalogo --> viram as abas, os cards e o catálogo de
 *   apps a partir de src/dados/planos.json. Sai tudo no HTML, pro Google ler preço.
 * - {{wa:chave}} vira o link do WhatsApp com a mensagem mensagens.chave do config.
 *   {{vendedor}} é o painel do vendedor (painelVendedor) ou, enquanto o link não
 *   chega, o WhatsApp com a mensagem de vendedor. {{cfg.caminho}} puxa qualquer
 *   valor do config; {{attr:cfg.caminho}} faz o mesmo dentro de atributo HTML (escapa
 *   aspas e guarda a quebra de linha). {{ano}} é o ano atual.
 * - O botão de assinar de cada plano leva mega, preço e linha em data-plano-*: o JS
 *   abre o formulário e monta a mensagem com mensagens.cadastroPlano. Sem JS, ele
 *   continua sendo o link do WhatsApp com a mensagem do plano.
 * - <!-- @se cfg.caminho --> ... <!-- /@se --> só fica se o valor do config existir.
 * - <i data-i="nome" data-w="light" class="..."></i> vira o SVG do Phosphor embutido.
 * - <img data-img="nome" sizes="..." alt="..."> ganha src, srcset, width e height a
 *   partir de src/assets/img/manifesto.json. data-img-max="640" limita o src.
 * - <!-- @schema --> recebe o JSON-LD da empresa, montado do config.
 * - Avisa: travessão no texto, img sem alt/width/height, id repetido, âncora sem
 *   destino, marcador {{...}} que sobrou, CSS com chave desbalanceada e o que ainda
 *   falta o cliente mandar (domínio, painel do vendedor).
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync, copyFileSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'

const RAIZ = path.dirname(fileURLToPath(import.meta.url))
const P = (...a) => path.join(RAIZ, ...a)
const DIST = P('dist')
const cfg = JSON.parse(readFileSync(P('site.config.json'), 'utf8'))
const planos = JSON.parse(readFileSync(P('src/dados/planos.json'), 'utf8'))
const manifesto = existsSync(P('src/assets/img/manifesto.json')) ? JSON.parse(readFileSync(P('src/assets/img/manifesto.json'), 'utf8')) : {}
const avisos = []

const argPreview = (() => {
  const i = process.argv.indexOf('--preview')
  return i > -1 ? process.argv[i + 1].split(',').map((s) => s.trim()) : null
})()

// ---------------------------------------------------------------- utilidades
function gravar(arq, conteudo) {
  mkdirSync(path.dirname(arq), { recursive: true })
  const tmp = `${arq}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  writeFileSync(tmp, conteudo)
  for (let t = 0; t < 20; t++) {
    try {
      renameSync(tmp, arq)
      return
    } catch (e) {
      if (t === 19) throw e
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
    }
  }
}

function copiarPasta(de, para) {
  if (!existsSync(de)) return
  mkdirSync(para, { recursive: true })
  for (const nome of readdirSync(de)) {
    if (nome.startsWith('.') || nome === 'manifesto.json') continue
    const a = path.join(de, nome)
    const b = path.join(para, nome)
    const st = statSync(a)
    if (st.isDirectory()) copiarPasta(a, b)
    else if (!existsSync(b) || statSync(b).size !== st.size || statSync(b).mtimeMs < st.mtimeMs) {
      try {
        copyFileSync(a, b)
      } catch {
        /* outro processo copiando o mesmo arquivo: ignora */
      }
    }
  }
}

function lerParcial(nome) {
  const arq = P('src/partials', `${nome}.html`)
  if (!existsSync(arq)) {
    avisos.push(`parcial ausente: ${nome}`)
    return `<!-- parcial ${nome} ainda não existe -->`
  }
  return readFileSync(arq, 'utf8')
}

function arquivos(pasta, ext, so = null) {
  if (!existsSync(P(pasta))) return []
  const todos = readdirSync(P(pasta)).filter((f) => f.endsWith(ext))
  const base = todos.filter((f) => f.startsWith('_')).sort()
  const resto = todos.filter((f) => !f.startsWith('_')).sort().filter((f) => !so || so.includes(f.replace(ext, '')))
  return [...base, ...resto]
}

function juntar(pasta, ext, so) {
  return arquivos(pasta, ext, so)
    .map((f) => {
      const c = readFileSync(P(pasta, f), 'utf8')
      if (ext === '.css') {
        const abre = (c.match(/{/g) || []).length
        const fecha = (c.match(/}/g) || []).length
        if (abre !== fecha) avisos.push(`CSS com chaves desbalanceadas: ${f} (${abre} abre, ${fecha} fecha)`)
      }
      return c
    })
    .join(ext === '.js' ? '\n;\n' : '\n')
}

function minCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};])\s*/g, '$1')
    .replace(/,\s+/g, ',')
    .replace(/;}/g, '}')
    .trim()
}

function minJs(js) {
  // só tira comentário de linha inteira e linhas em branco; o JS é pequeno
  return js
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== '')
    .join('\n')
}

function valor(caminho, avisar = true) {
  const v = caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), cfg)
  if (v === undefined && avisar) avisos.push(`config sem o caminho: ${caminho}`)
  return v ?? ''
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const wa = (msg) => `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(msg)}`
function linkWa(chave) {
  const msg = cfg.mensagens[chave]
  if (!msg) avisos.push(`mensagem de WhatsApp sem chave no config: ${chave}`)
  return wa(msg || '')
}
const linkVendedor = () => cfg.painelVendedor || linkWa('vendedor')

const cacheIcone = new Map()
function icone(nome, peso = 'light', classe = '') {
  const arq = P('node_modules/@phosphor-icons/core/assets', peso, `${nome}${peso === 'regular' ? '' : '-' + peso}.svg`)
  if (!cacheIcone.has(arq)) {
    if (!existsSync(arq)) {
      avisos.push(`ícone não existe: ${nome} (${peso})`)
      return ''
    }
    const svg = readFileSync(arq, 'utf8')
    cacheIcone.set(arq, svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''))
  }
  const cls = ['i', classe].filter(Boolean).join(' ')
  return `<svg class="${cls}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">${cacheIcone.get(arq)}</svg>`
}

// <img data-img="nome"> → src, srcset, width, height a partir do manifesto
function imagens(html) {
  return html.replace(/<img\b([^>]*?)\sdata-img="([\w-]+)"([^>]*)>/g, (tag, antes, nome, depois) => {
    const attrs = antes + depois
    const maxM = attrs.match(/\sdata-img-max="(\d+)"/)
    const vars = Object.entries(manifesto)
      .map(([arq, m]) => ({ arq, m, w: Number((arq.match(new RegExp(`^${nome}-(\\d+)\\.webp$`)) || [])[1]) }))
      .filter((v) => v.w)
      .sort((a, b) => a.w - b.w)
    if (!vars.length) {
      avisos.push(`data-img sem arquivo no manifesto: ${nome}`)
      return tag
    }
    const max = maxM ? Number(maxM[1]) : Infinity
    const principal = [...vars].reverse().find((v) => v.w <= max) || vars[0]
    const srcset = vars.map((v) => `/assets/img/${v.arq} ${v.m.w}w`).join(', ')
    const limpo = attrs.replace(/\sdata-img-max="\d+"/, '')
    return `<img src="/assets/img/${principal.arq}" srcset="${srcset}" width="${principal.m.w}" height="${principal.m.h}"${limpo}>`
  })
}

// ---------------------------------------------------------------- planos (de src/dados/planos.json)
const cats = planos.categorias
const nomeCat = (c) => cats[c].nome
function cardPlano(linha, p, j) {
  const id = `plano-${linha.id}-${p.mega}`
  const msg = `Olá! Vim pelo site da Target Connecta e quero assinar o *${p.mensagem}*. Minha cidade é: `
  let miolo
  if (p.itens) {
    miolo = `<ul class="plano__itens" role="list">${p.itens.map((t) => `<li><i data-i="check" data-w="bold"></i>${esc(t)}</li>`).join('')}</ul>`
  } else {
    const selos = p.inclui
      .map(([c, n]) => `<span class="selo selo--${c}">${c === 'extra' ? cats[c].apps[0] : `${n} ${nomeCat(c)}`}</span>`)
      .join(`<span class="plano__juntar">${p.juntar === 'ou' ? 'ou' : '+'}</span>`)
    // "Escolha entre": dois apps de vitrine de cada tipo que se escolhe (o Premiere do
    // Combo Sport já vem incluso) e o "+N" com o resto do que dá pra escolher
    const escolhiveis = p.inclui.map(([c]) => c).filter((c) => c !== 'extra')
    const vitrine = escolhiveis.flatMap((c) => planos.vitrine[c] || []).slice(0, 4)
    const todos = new Set(escolhiveis.flatMap((c) => cats[c].apps))
    const resto = todos.size - vitrine.length
    miolo = `<p class="plano__selos">${selos}</p>
        <p class="plano__regra">${esc(p.texto)}</p>
        <p class="plano__escolha-titulo">Escolha entre</p>
        <ul class="plano__escolha" role="list">${vitrine.map((a) => `<li>${esc(a)}</li>`).join('')}${resto > 0 ? `<li class="plano__mais">+${resto}</li>` : ''}</ul>
        <button class="plano__catalogo" type="button" data-catalogo aria-haspopup="dialog">Ver todos os aplicativos<i data-i="arrow-right" data-w="regular"></i></button>`
  }
  return `
      <li class="plano" style="--i:${j}">
        <p class="plano__vel"><span class="plano__num">${p.mega}</span><span class="plano__mega">Mega</span></p>
        <p class="plano__preco"><span class="plano__rs">R$</span>${p.preco}<span class="plano__mes">/mês</span></p>
        <div class="plano__miolo">
        ${miolo}
        </div>
        <a class="btn btn--ouro plano__btn" href="${wa(msg)}" target="_blank" rel="noopener" data-zap="${id}" data-evento="plano" data-assinar data-plano-mega="${p.mega}" data-plano-preco="${p.preco}" data-plano-linha="${esc(linha.naMensagem || linha.nome)}" data-plano-texto="${esc(p.mensagem)}"><i data-i="whatsapp-logo" data-w="regular"></i>Assinar pelo WhatsApp</a>
      </li>`
}

function htmlPlanos() {
  const abas = planos.linhas
    .map((l, i) => `<button class="planos__aba" type="button" role="tab" id="aba-${l.id}" aria-controls="painel-${l.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(l.nome)}</button>`)
    .join('\n      ')
  const paineis = planos.linhas
    .map(
      (l, i) => `
    <div class="planos__painel" role="tabpanel" id="painel-${l.id}" aria-labelledby="aba-${l.id}"${i === 0 ? '' : ' hidden'}>
      ${l.nota ? `<p class="planos__nota-linha">${esc(l.nota)}</p>` : ''}
      <ul class="planos__trilho${l.planos.length < 3 ? ' planos__trilho--poucos' : ''}" role="list" tabindex="-1">${l.planos.map((p, j) => cardPlano(l, p, j)).join('')}
      </ul>
      ${l.planos.length > 1 ? `<div class="planos__pontos" aria-hidden="true">${l.planos.map((_, j) => `<span${j === 0 ? ' class="ativo"' : ''}></span>`).join('')}</div>` : ''}
    </div>`,
    )
    .join('')
  return `<div class="planos__abas" role="tablist" aria-label="Linhas de planos">
      ${abas}
    </div>${paineis}`
}

function htmlCatalogo() {
  return Object.entries(cats)
    .map(
      ([c, cat]) => `
      <section class="catalogo__grupo">
        <h4 class="catalogo__tipo"><span class="selo selo--${c}">${esc(cat.nome)}</span><span class="catalogo__qtd">${cat.apps.length} ${cat.apps.length === 1 ? 'app' : 'apps'}${cat.nota ? ` · ${esc(cat.nota)}` : ''}</span></h4>
        <ul class="catalogo__lista" role="list">${cat.apps.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
      </section>`,
    )
    .join('')
}

function schema() {
  const e = cfg.endereco
  const base = (cfg.dominio || '').replace(/\/$/, '')
  const dados = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: cfg.nome,
    slogan: 'Do telefone à porta, até o cliente instalado.',
    description: 'Terceirização comercial: telemarketing, televendas e venda porta a porta com time treinado e supervisionado, no oeste paulista e no Mato Grosso do Sul.',
    telephone: `+${cfg.whatsapp}`,
    email: cfg.email || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: e.rua,
      addressLocality: e.cidade,
      addressRegion: e.uf,
      postalCode: e.cep,
      addressCountry: 'BR',
    },
    areaServed: [
      { '@type': 'State', name: 'São Paulo' },
      { '@type': 'State', name: 'Mato Grosso do Sul' },
    ],
    knowsAbout: ['Terceirização comercial', 'Telemarketing', 'Televendas', 'Venda porta a porta'],
  }
  if (cfg.instagram) dados.sameAs = [cfg.instagram]
  if (base) Object.assign(dados, { '@id': `${base}/#empresa`, url: `${base}/`, image: `${base}/assets/img/og-target-connecta.jpg`, logo: `${base}/assets/img/logo-empilhado-600.png` })
  return `<script type="application/ld+json">${JSON.stringify(dados)}</script>`
}

// ---------------------------------------------------------------- montagem
function montar(parciais) {
  let html = readFileSync(P('src/index.html'), 'utf8')
  if (parciais) {
    // preview: só o(s) parcial(is) pedido(s); header e rodapé ficam fora do <main>
    const header = parciais.includes('00-header') ? '<!-- @parcial 00-header -->' : ''
    const rodape = parciais.includes('10-rodape') ? '<!-- @parcial 10-rodape -->' : ''
    const meio = parciais
      .filter((n) => n !== '00-header' && n !== '10-rodape')
      .map((n) => `<!-- @parcial ${n} -->`)
      .join('\n')
    html = html.replace(/<!--\s*@parcial 00-header\s*-->[\s\S]*<!--\s*@parcial 10-rodape\s*-->/, `${header}\n  <main id="conteudo">\n${meio}\n  </main>\n${rodape}`)
  }
  for (let n = 0; n < 4 && /<!--\s*@parcial\s/.test(html); n++) html = html.replace(/<!--\s*@parcial\s+([\w-]+)\s*-->/g, (_, nome) => lerParcial(nome))
  html = html.replace('<!-- @planos -->', htmlPlanos).replace('<!-- @catalogo -->', htmlCatalogo)
  html = html.replace(/<!--\s*@se\s+cfg\.([\w.]+)\s*-->([\s\S]*?)<!--\s*\/@se\s*-->/g, (_, c, dentro) => (valor(c, false) ? dentro : ''))
  const cabeca = []
  html = html.replace(/<!--\s*@head\s*-->([\s\S]*?)<!--\s*\/@head\s*-->/g, (_, c) => {
    cabeca.push(c.trim())
    return ''
  })
  html = html.replace('<!-- @head-parciais -->', cabeca.join('\n  '))
  // o JS entra antes dos marcadores, pra ele também poder usar {{cfg.caminho}}
  html = html.replace('<!-- @js -->', () => `<script>${minJs(juntar('src/js', '.js', parciais))}</script>`)
  html = html.replace('<!-- @css -->', () => `<style>${minCss(juntar('src/css', '.css', parciais))}</style>`)
  html = html.replace(/<i data-i="([\w-]+)"(?: data-w="(\w+)")?(?: class="([^"]*)")?><\/i>/g, (_, nome, peso, classe) => icone(nome, peso || 'light', classe || ''))
  html = html.replace(/\{\{wa:([\w-]+)\}\}/g, (_, chave) => linkWa(chave))
  html = html.replace(/\{\{vendedor\}\}/g, linkVendedor)
  html = html.replace(/\{\{attr:cfg\.([\w.]+)\}\}/g, (_, c) => esc(valor(c)).replace(/\n/g, '&#10;'))
  html = html.replace(/\{\{cfg\.([\w.]+)\}\}/g, (_, c) => valor(c))
  html = html.replace(/\{\{ano\}\}/g, String(new Date().getFullYear()))
  html = html.replace('<!-- @schema -->', schema())
  html = imagens(html)
  const base = (cfg.dominio || '').replace(/\/$/, '')
  html = html.replace(
    '<!-- @meta-dominio -->',
    base ? `<link rel="canonical" href="${base}/">\n  <meta property="og:url" content="${base}/">\n  <meta property="og:image" content="${base}/assets/img/og-target-connecta.jpg">` : '<meta property="og:image" content="/assets/img/og-target-connecta.jpg">',
  )
  return html
}

function verificar(html, rotulo) {
  const $ = cheerio.load(html)
  $('script, style').remove()
  const texto = $('body').text()
  const tracos = texto.match(/.{0,30}[—–].{0,30}/g)
  if (tracos) avisos.push(`[${rotulo}] travessão no texto (regra da casa): ${tracos.slice(0, 4).map((s) => JSON.stringify(s.trim())).join(' | ')}`)
  const sobrou = html.match(/\{\{[^}]+\}\}/g)
  if (sobrou) avisos.push(`[${rotulo}] marcadores sem valor: ${[...new Set(sobrou)].join(', ')}`)
  const pendente = texto.match(/\[(CONFIRMAR|INSERIR)[^\]]*\]/g)
  if (pendente) avisos.push(`[${rotulo}] marcação de pendência da copy no texto: ${pendente.slice(0, 3).join(' | ')}`)
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '?'
    if ($(el).attr('alt') === undefined) avisos.push(`[${rotulo}] img sem alt: ${src}`)
    if (!$(el).attr('width') || !$(el).attr('height')) avisos.push(`[${rotulo}] img sem width/height (salto de layout): ${src}`)
  })
  const ids = {}
  $('[id]').each((_, el) => {
    const id = $(el).attr('id')
    ids[id] = (ids[id] || 0) + 1
  })
  for (const [id, n] of Object.entries(ids)) if (n > 1) avisos.push(`[${rotulo}] id repetido: #${id} (${n}x)`)
  if (!argPreview)
    $('a[href^="#"]').each((_, el) => {
      const alvo = $(el).attr('href').slice(1)
      if (alvo && !ids[alvo]) avisos.push(`[${rotulo}] âncora sem destino: #${alvo}`)
    })
  if (!argPreview && $('h1').length !== 1) avisos.push(`[${rotulo}] ${$('h1').length} h1 na página (precisa ser 1)`)
}

// ---------------------------------------------------------------- execução
// No --publicar, dist sai do zero: a cópia só acrescenta, então imagem que saiu
// de src/assets ficaria esquecida em dist e iria pro GitHub. Fora dele não
// apaga nada, porque vários builds de preview podem rodar ao mesmo tempo.
if (process.argv.includes('--publicar')) rmSync(DIST, { recursive: true, force: true })
copiarPasta(P('src/assets'), path.join(DIST, 'assets'))
copiarPasta(P('src/raiz'), DIST)

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`
if (!argPreview) {
  const html = montar(null)
  verificar(html, 'página')
  gravar(path.join(DIST, 'index.html'), html)
  const base = (cfg.dominio || '').replace(/\/$/, '')
  gravar(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`)
  if (base) gravar(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n</urlset>\n`)
  gravar(
    path.join(DIST, 'site.webmanifest'),
    JSON.stringify({ name: cfg.nome, short_name: 'Target', start_url: '/', display: 'standalone', background_color: '#050A14', theme_color: '#050A14', icons: [192, 512].map((s) => ({ src: `/icon-${s}.png`, sizes: `${s}x${s}`, type: 'image/png' })) }),
  )
  if (!base) avisos.push('dominio vazio no site.config.json: sem canonical, sem sitemap e og:image relativo')
  if (!cfg.painelVendedor) avisos.push('painelVendedor vazio: "Área do vendedor" leva pro WhatsApp até o Rafael mandar o link do painel')
  if (process.argv.includes('--publicar')) rmSync(path.join(DIST, 'preview'), { recursive: true, force: true })
  console.log(`ok dist/index.html ${kb(html)}`)
} else {
  const nome = argPreview.join('+')
  const html = montar(argPreview)
  verificar(html, `preview ${nome}`)
  gravar(path.join(DIST, `preview/${nome}.html`), html)
  console.log(`ok /preview/${nome}.html ${kb(html)}`)
}
if (avisos.length) console.log(`AVISOS:\n  ${avisos.join('\n  ')}`)
