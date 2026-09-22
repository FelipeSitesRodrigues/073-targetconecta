/**
 * Teste de cliques e de layout do site, no Chrome da máquina (puppeteer-core).
 * Base do 069, adaptado à Target Connecta.
 *
 * - Estouro horizontal em 9 larguras, de 320 a 1920.
 * - Revelação no scroll: rola na roda do mouse, como gente de verdade, e todo
 *   [data-revela] precisa ganhar .visivel (bug do 067: foto que nunca aparecia).
 * - Menu do celular: abre, marca aria-expanded, põe o foco dentro, fecha no
 *   clique do link e no Esc (devolvendo o foco pro botão).
 * - Todo link de WhatsApp: número certo, nova aba, data-zap único e a mensagem;
 *   os dos planos (que só valem sem JS) pedem a cidade.
 * - Planos: as 4 abas trocam o painel (clique e seta do teclado) e cada painel tem
 *   os cards do planos.json. Catálogo: abre, fecha no Esc e devolve o foco.
 * - Assinar: o botão do plano abre o formulário (não o WhatsApp), vazio não envia,
 *   o telefone ganha máscara e o envio abre o WhatsApp com a mensagem de cadastro
 *   exatamente como no config (mensagens.cadastroPlano).
 * - Dúvidas: o acordeão abre uma de cada vez.
 * - Âncoras do menu apontam pra seções que existem. Um h1 só. Erros de console.
 *
 * Uso: node scripts/serve.mjs  (noutro terminal)  e depois  node scripts/testar.mjs
 */
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:3073'
const cfg = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'))
const planos = JSON.parse(readFileSync(new URL('../src/dados/planos.json', import.meta.url), 'utf8'))
const NAVEGADOR = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p))

const falhas = []
const ok = (cond, msg) => (cond ? console.log('  ok', msg) : (falhas.push(msg), console.log('  FALHA', msg)))
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: NAVEGADOR, headless: true, args: ['--no-first-run'] })
try {
  const page = await browser.newPage()
  const erros = []
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
  page.on('pageerror', (e) => erros.push(e.message))
  // ERR_ABORTED é o srcset/picture trocando de candidato quando a janela muda, não arquivo faltando
  page.on('requestfailed', (r) => !/wa\.me|instagram|google/.test(r.url()) && r.failure()?.errorText !== 'net::ERR_ABORTED' && erros.push(`falhou: ${r.url()} (${r.failure()?.errorText})`))

  console.log('\nLarguras (estouro horizontal)')
  for (const w of [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewport({ width: w, height: w < 768 ? 800 : 900, isMobile: w < 768, hasTouch: w < 768 })
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    ok(sw <= iw, `${w}px sem rolagem lateral (${sw}/${iw})`)
  }

  console.log('\nRevelação no scroll')
  for (const w of [1440, 390]) {
    await page.setViewport({ width: w, height: w < 768 ? 844 : 900, isMobile: w < 768, hasTouch: w < 768 })
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    const altura = await page.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y < altura; y += 120) {
      await page.mouse.wheel({ deltaY: 120 })
      await espera(25)
    }
    await espera(1500)
    const presos = await page.evaluate(() => [...document.querySelectorAll('[data-revela]:not(.visivel)')].filter((e) => e.checkVisibility()).map((e) => `${e.tagName.toLowerCase()}.${e.classList[0] || '?'}`))
    ok(presos.length === 0, `${w}px: todo elemento animado aparece${presos.length ? ` (presos: ${presos.join(', ')})` : ''}`)
  }

  console.log('\nMenu do celular')
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  const botao = await page.evaluateHandle(() => document.querySelector('header button[aria-expanded]'))
  if (!(await botao.evaluate((b) => !!b))) ok(false, 'botão do menu (header button[aria-expanded]) existe')
  else {
    await botao.click()
    await espera(500)
    let e = await page.evaluate(() => {
      const b = document.querySelector('header button[aria-expanded]')
      const painel = document.getElementById(b.getAttribute('aria-controls'))
      return { aria: b.getAttribute('aria-expanded'), visivel: !!painel && painel.checkVisibility(), focoDentro: !!painel && painel.contains(document.activeElement) }
    })
    ok(e.aria === 'true' && e.visivel, 'abre e marca aria-expanded=true')
    ok(e.focoDentro, 'foco vai pra dentro do menu')
    await page.evaluate(() => {
      const b = document.querySelector('header button[aria-expanded]')
      document.getElementById(b.getAttribute('aria-controls')).querySelector('a[href="#servicos"]').click()
    })
    await espera(1100)
    e = await page.evaluate(() => {
      const b = document.querySelector('header button[aria-expanded]')
      return { aria: b.getAttribute('aria-expanded'), y: Math.round(document.getElementById('servicos').getBoundingClientRect().top) }
    })
    ok(e.aria === 'false', 'fecha ao tocar num link')
    ok(e.y >= 0 && e.y < 160, `rola até Serviços sem ficar escondido sob o header (topo em ${e.y}px)`)
    await botao.click()
    await espera(400)
    await page.keyboard.press('Escape')
    await espera(400)
    e = await page.evaluate(() => ({ aria: document.querySelector('header button[aria-expanded]').getAttribute('aria-expanded'), foco: document.activeElement?.matches('header button[aria-expanded]') }))
    ok(e.aria === 'false' && e.foco, 'Esc fecha e devolve o foco pro botão')
  }

  console.log('\nLinks de WhatsApp')
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="wa.me"]')].map((a) => ({ href: a.href, origem: a.dataset.zap || '', evento: a.dataset.evento || 'empresa', texto: (a.getAttribute('aria-label') || a.textContent).replace(/\s+/g, ' ').trim(), alvo: a.target })),
  )
  const origens = links.map((l) => l.origem)
  const totalPlanos = planos.linhas.reduce((s, l) => s + l.planos.length, 0)
  // header (2), menu (1), hero (1), 4 serviços, onde atuamos (1), CTA (1), rodapé (1)
  // e os 4 da Área do vendedor enquanto o painel não tem link = 15, fora os planos
  ok(links.length >= 15 + totalPlanos, `${links.length} links de WhatsApp na página (${totalPlanos} de plano)`)
  ok(new Set(origens).size === origens.length && !origens.includes(''), `todo link tem data-zap único${new Set(origens).size !== origens.length ? ': repetidos ' + origens.filter((o, i) => origens.indexOf(o) !== i).join(', ') : ''}`)
  for (const l of links) {
    const u = new URL(l.href)
    const numero = u.pathname.replace(/\//g, '')
    const msg = u.searchParams.get('text') || ''
    const planoOk = l.evento !== 'plano' || (/quero assinar o \*.+\*/.test(msg) && /Minha cidade é:\s*$/.test(msg))
    ok(numero === cfg.whatsapp && l.alvo === '_blank' && msg && planoOk, `${l.origem.padEnd(26)} [${l.evento}] "${l.texto.slice(0, 32)}" -> ${msg.slice(0, 90)}`)
  }

  console.log('\nPlanos: abas e catálogo')
  await page.evaluate(() => document.getElementById('planos').scrollIntoView({ behavior: 'instant' }))
  const abas = await page.$$('#planos [role="tab"]')
  ok(abas.length === planos.linhas.length, `${abas.length} abas (${planos.linhas.map((l) => l.nome).join(', ')})`)
  for (let i = 0; i < planos.linhas.length; i++) {
    const l = planos.linhas[i]
    await abas[i].click()
    await espera(250)
    const r = await page.evaluate((id) => {
      const paineis = [...document.querySelectorAll('#planos [role="tabpanel"]')]
      const visiveis = paineis.filter((p) => !p.hidden)
      return { visiveis: visiveis.map((p) => p.id), cards: document.querySelectorAll(`#painel-${id} .plano`).length, selecionada: document.querySelector('#planos [aria-selected="true"]')?.id }
    }, l.id)
    ok(r.visiveis.length === 1 && r.visiveis[0] === `painel-${l.id}` && r.selecionada === `aba-${l.id}` && r.cards === l.planos.length, `aba "${l.nome}": só o painel dela à vista, com ${r.cards} card(s)`)
  }
  await abas[0].focus()
  await page.keyboard.press('ArrowRight')
  await espera(200)
  const viaTeclado = await page.evaluate(() => ({ foco: document.activeElement?.id, sel: document.querySelector('#planos [aria-selected="true"]')?.id }))
  ok(viaTeclado.foco === `aba-${planos.linhas[1].id}` && viaTeclado.sel === viaTeclado.foco, 'seta pra direita passa pra próxima aba')

  await page.click('.planos__todos')
  await espera(400)
  let cat = await page.evaluate(() => ({ aberto: document.getElementById('catalogo').open, grupos: document.querySelectorAll('#catalogo .catalogo__grupo').length }))
  ok(cat.aberto && cat.grupos === Object.keys(planos.categorias).length, `catálogo abre com ${cat.grupos} tipos de app`)
  await page.keyboard.press('Escape')
  await espera(400)
  cat = await page.evaluate(() => ({ aberto: document.getElementById('catalogo').open, foco: document.activeElement?.classList.contains('planos__todos') }))
  ok(!cat.aberto && cat.foco, 'Esc fecha o catálogo e devolve o foco pro botão')

  console.log('\nAssinar: formulário antes do WhatsApp')
  const linha = planos.linhas[0]
  const primeiro = linha.planos[0]
  await abas[0].click()
  await espera(250)
  // window.open anotado em vez de abrir aba de verdade
  await page.evaluate(() => {
    window.__abertos = []
    window.open = (u) => (window.__abertos.push(u), {})
  })
  await page.click(`#painel-${linha.id} .plano__btn`)
  await espera(400)
  let fm = await page.evaluate(() => ({
    aberto: document.getElementById('assinar').open,
    foco: document.activeElement?.id,
    titulo: document.getElementById('assinar-titulo').textContent.replace(/\s+/g, ' ').trim(),
    resumo: document.getElementById('assinar-resumo').textContent.replace(/\s+/g, ' ').trim(),
    abertos: window.__abertos.length,
  }))
  ok(fm.aberto && fm.foco === 'assinar-nome' && fm.titulo === `${primeiro.mega} Mega` && fm.abertos === 0, `o botão do plano abre o formulário, não o WhatsApp: "${fm.titulo}", ${fm.resumo}, foco no nome`)
  await page.click('#assinar [type="submit"]')
  await espera(200)
  fm = await page.evaluate(() => ({ invalidos: [...document.querySelectorAll('#assinar [aria-invalid="true"]')].map((c) => c.name), foco: document.activeElement?.id, abertos: window.__abertos.length, aberto: document.getElementById('assinar').open }))
  ok(fm.invalidos.length === 3 && fm.foco === 'assinar-nome' && fm.abertos === 0 && fm.aberto, `vazio não envia: avisa nos 3 campos (${fm.invalidos.join(', ')}) e volta o foco pro primeiro`)
  await page.type('#assinar-nome', '  Maria  da Silva ')
  await page.keyboard.press('Enter')
  const focoDepoisDoNome = await page.evaluate(() => document.activeElement?.id)
  ok(focoDepoisDoNome === 'assinar-telefone', 'Enter no nome passa pro telefone, sem enviar')
  await page.type('#assinar-telefone', '18991234567')
  const comMascara = await page.$eval('#assinar-telefone', (c) => c.value)
  ok(comMascara === '(18) 99123-4567', `o telefone ganha a máscara: ${comMascara}`)
  await page.type('#assinar-email', 'maria@exemplo.com')
  await page.keyboard.press('Enter')
  await espera(300)
  fm = await page.evaluate(() => ({ abertos: window.__abertos, aberto: document.getElementById('assinar').open, foco: document.activeElement?.classList.contains('plano__btn'), eventos: (window.dataLayer || []).map((d) => d.event) }))
  // função no replace: "R$119" no texto viraria referência de grupo ($1)
  const dados = { numero: cfg.whatsapp, nome: 'Maria da Silva', telefone: '(18) 99123-4567', email: 'maria@exemplo.com', plano: primeiro.mensagem, preco: primeiro.preco }
  // o site limpa espaço sobrando no fim das linhas; o esperado passa pela mesma limpeza
  const esperado = cfg.mensagens.cadastroPlano.replace(/\{(\w+)\}/g, (_, k) => dados[k]).replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim()
  const enviado = fm.abertos[0] ? new URL(fm.abertos[0]) : null
  const texto = enviado?.searchParams.get('text') || '(nada)'
  ok(enviado && enviado.pathname === `/${cfg.whatsapp}` && texto === esperado, `envia pro WhatsApp ${cfg.whatsapp} com a mensagem de cadastro:\n${texto.replace(/^/gm, '       ')}`)
  ok(!/[ \t]$/m.test(texto) && !/\n{3,}/.test(texto), 'mensagem sem espaço sobrando no fim das linhas')
  ok(!fm.aberto && fm.foco && fm.eventos.includes('plano_formulario') && fm.eventos.includes('whatsapp_plano'), 'fecha, devolve o foco pro botão e registra plano_formulario e whatsapp_plano')

  console.log('\nDúvidas')
  const faq = await page.evaluate(async () => {
    const itens = [...document.querySelectorAll('#duvidas details')]
    itens[0].open = true
    itens[1].open = true
    await new Promise((r) => setTimeout(r, 50))
    return { total: itens.length, abertos: itens.filter((d) => d.open).length }
  })
  ok(faq.total >= 3 && faq.abertos === 1, `acordeão abre uma de cada vez (${faq.total} dúvidas, ${faq.abertos} aberta)`)

  console.log('\nÂncoras, h1 e imagens')
  const ancoras = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')))].filter((h) => h.length > 1).map((h) => [h, !!document.querySelector(h)]))
  for (const [h, existe] of ancoras) ok(existe, `${h} existe`)
  const estrutura = await page.evaluate(() => ({ h1: document.querySelectorAll('h1').length, semAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length }))
  ok(estrutura.h1 === 1, `um h1 só (${estrutura.h1})`)
  ok(estrutura.semAlt === 0, `toda imagem tem alt (${estrutura.semAlt} sem)`)

  console.log('\nConsole')
  ok(erros.length === 0, `sem erros no console${erros.length ? ': ' + [...new Set(erros)].slice(0, 5).join(' | ') : ''}`)
} finally {
  await browser.close()
}
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTudo certo.')
process.exitCode = falhas.length ? 1 : 0
