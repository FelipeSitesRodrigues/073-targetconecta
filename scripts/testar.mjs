/**
 * Teste de cliques e de layout do site (reformulação de 11/2026), no Chrome da máquina.
 *
 * - Estouro horizontal em 9 larguras, de 320 a 1920.
 * - Revelação no scroll: rola na roda do mouse e todo [data-revela] ganha .visivel.
 * - Menu do celular: abre, põe o foco dentro, fecha no clique do link e no Esc.
 * - Todo link de WhatsApp: número certo, nova aba e mensagem preenchida.
 * - Presença: hover num estado troca o nome embaixo do mapa; hover numa cidade da
 *   lista acende o ponto dela no mapa. Uma cidade por ponto e um ponto por cidade.
 * - Formulário: vazio não envia; preenchido abre o WhatsApp com a mensagem do
 *   config, sem a linha do campo opcional vazio.
 * - Dúvidas: abrem no clique. Âncoras com destino. Um h1 só. Erros de console.
 *
 * Uso: node scripts/serve.mjs  (noutro terminal)  e depois  node scripts/testar.mjs
 */
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:3073'
const cfg = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'))
const cidades = JSON.parse(readFileSync(new URL('../src/dados/cidades.json', import.meta.url), 'utf8')).regioes.flatMap((r) => r.cidades)
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
    for (let y = 0; y < altura; y += 160) {
      await page.mouse.wheel({ deltaY: 160 })
      await espera(20)
    }
    await espera(1500)
    const { total, faltam } = await page.evaluate(() => {
      const t = [...document.querySelectorAll('[data-revela]')].filter((e) => getComputedStyle(e).display !== 'none')
      return { total: t.length, faltam: t.filter((e) => !e.classList.contains('visivel')).map((e) => e.className || e.tagName) }
    })
    ok(faltam.length === 0, `${w}px: ${total - faltam.length}/${total} elementos revelados ${faltam.slice(0, 3).join(' | ')}`)
  }

  console.log('\nMenu do celular')
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  await page.click('.cab__abrir')
  await espera(400)
  ok((await page.$eval('.cab__abrir', (b) => b.getAttribute('aria-expanded'))) === 'true', 'abre e marca aria-expanded')
  ok(await page.evaluate(() => document.getElementById('menu-celular').contains(document.activeElement)), 'foco vai pra dentro do painel')
  await page.keyboard.press('Escape')
  await espera(300)
  ok((await page.$eval('.cab__abrir', (b) => b.getAttribute('aria-expanded'))) === 'false', 'fecha no Esc')
  ok(await page.evaluate(() => document.activeElement?.classList.contains('cab__abrir')), 'Esc devolve o foco pro botão')
  await page.click('.cab__abrir')
  await espera(400)
  await page.click('.cab-menu__link[href="#presenca"]')
  await espera(1200)
  ok(!(await page.$eval('#menu-celular', (m) => m.classList.contains('cab-menu--aberto'))), 'clique num link fecha o painel')

  console.log('\nLinks e estrutura')
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  const links = await page.$$eval('a[href^="https://wa.me/"]', (as) => as.map((a) => ({ href: a.href, alvo: a.target })))
  ok(links.length >= 6, `${links.length} links de WhatsApp`)
  ok(links.every((l) => l.href.startsWith(`https://wa.me/${cfg.whatsapp}?text=`) && l.alvo === '_blank'), 'todos com o número certo, mensagem e nova aba')
  const estrutura = await page.evaluate(() => {
    const ids = new Set([...document.querySelectorAll('[id]')].map((e) => e.id))
    const ancoras = [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href').slice(1)).filter(Boolean)
    return { h1: document.querySelectorAll('h1').length, semDestino: ancoras.filter((a) => !ids.has(a)), texto: document.body.innerText }
  })
  ok(estrutura.h1 === 1, 'um h1 só')
  ok(estrutura.semDestino.length === 0, `âncoras com destino ${estrutura.semDestino.join(', ')}`)
  ok(!/Connecta\b|planos de internet|Mega\b/i.test(estrutura.texto), 'nada do site antigo (Connecta, planos, Mega)')
  ok(/meta estratégica/i.test(estrutura.texto), 'a meta de 800 aparece marcada como meta')

  console.log('\nPresença')
  await page.hover('.br__uf[data-uf="BA"]')
  await espera(150)
  ok((await page.$eval('[data-pres-nome]', (e) => e.textContent)) === 'Bahia', 'hover na Bahia mostra o nome')
  ok(/Disponível/.test(await page.$eval('[data-pres-status]', (e) => e.textContent)), 'Bahia aparece como disponível')
  await page.hover('.br__uf[data-uf="MS"]')
  await espera(150)
  ok(/comprovada/i.test(await page.$eval('[data-pres-status]', (e) => e.textContent)), 'MS aparece como atuação comprovada')
  const n = await page.evaluate(() => ({ pontos: document.querySelectorAll('.rg__ponto').length, chips: document.querySelectorAll('.pres__chip').length }))
  ok(n.pontos === cidades.length && n.chips === cidades.length, `${cidades.length} cidades, ${n.pontos} pontos, ${n.chips} na lista`)
  await page.hover('.pres__chip[data-cidade="navirai"]')
  await espera(150)
  ok(await page.$eval('.rg__ponto[data-cidade="navirai"]', (p) => p.classList.contains('ativo')), 'hover em Naviraí acende o ponto')

  console.log('\nFormulário')
  await page.click('a.cab__cta')
  await espera(1200)
  ok(!!(await page.$('form[data-form-proposta]')), 'botão do topo monta o formulário')
  let aberto = null
  await page.evaluateOnNewDocument(() => {})
  await page.exposeFunction('__abriu', (u) => { aberto = u })
  await page.evaluate(() => { window.open = (u) => { window.__abriu(u); return null } })
  await page.click('.form__enviar')
  await espera(200)
  ok(aberto === null && !(await page.$eval('.form__erro', (e) => e.hidden)), 'vazio não envia e mostra o erro')
  const dados = { nome: 'Ana Teste', provedor: 'Net Teste', cargo: 'Diretora', telefone: '18991234567', email: 'ana@netteste.com.br', cidade: 'Assis (SP)', meta: '200', regioes: 'Assis e Cândido Mota' }
  for (const [k, v] of Object.entries(dados)) await page.type(`input[name="${k}"]`, v)
  await page.click('.form__enviar')
  await espera(300)
  const msg = aberto ? decodeURIComponent(new URL(aberto).searchParams.get('text')) : ''
  const esperado = cfg.mensagens.proposta.replace(/\{(\w+)\}/g, (_, k) => (k === 'telefone' ? '(18) 99123-4567' : dados[k] || '')).split('\n').filter((l) => !/:\s*$/.test(l)).join('\n')
  ok(aberto?.startsWith(`https://wa.me/${cfg.whatsapp}?text=`), 'preenchido abre o WhatsApp')
  ok(msg === esperado, 'mensagem igual ao modelo, sem a linha do opcional vazio')
  if (msg !== esperado) console.log(msg, '\n---\n', esperado)

  console.log('\nDúvidas')
  await page.click('.duv__item summary')
  ok(await page.$eval('.duv__item', (d) => d.open), 'primeira dúvida abre no clique')

  console.log('\nConsole')
  ok(erros.length === 0, `sem erro ${erros.slice(0, 3).join(' | ')}`)
} finally {
  await browser.close()
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTudo certo.')
process.exit(falhas.length ? 1 : 0)
