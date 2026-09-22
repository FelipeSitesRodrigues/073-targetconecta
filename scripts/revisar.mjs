/**
 * Revisão visual de uma seção contra o recorte do mockup, num comando só
 * (adaptado do 066).
 *
 *   node scripts/revisar.mjs 03-antes-depois
 *   node scripts/revisar.mjs 00-header,01-hero --ref 01-hero --larguras 1440,1024,768,390
 *   node scripts/revisar.mjs pagina                  (site montado inteiro)
 *   node scripts/revisar.mjs 03-antes-depois --movimento --esperar 1500
 *
 * Faz o build de preview da seção, tira print da página inteira em cada largura
 * (emulando o celular de verdade abaixo de 600 px) e monta, pra 1440 e 390, a
 * imagem lado a lado com o recorte do mockup:
 *   revisao/<secao>/site-<largura>.png
 *   revisao/<secao>/comparar-<largura>.png   (SITE à esquerda, MOCKUP à direita)
 * O recorte vem de referencias/desktop/<ref>.png (1440) e referencias/mobile/<ref>.png
 * (390). Sem --ref, usa o nome da última seção pedida.
 *
 * Também avisa: estouro horizontal, elementos que passam da borda da tela,
 * erros de console e texto menor que 12 px.
 *
 * Opções: --larguras 1440,390 (padrão) · --movimento (não força reduced motion;
 *         o padrão é o estado final das animações) · --esperar ms · --altura N
 * Precisa do servidor: node scripts/serve.mjs (porta 3073).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, p) => {
  const i = args.indexOf(`--${n}`)
  if (i === -1) return p
  const v = args[i + 1]
  return v === undefined || v.startsWith('--') ? true : v
}
const secao = args[0]
if (!secao || secao.startsWith('--')) {
  console.error('Uso: node scripts/revisar.mjs <parcial[,parcial]> [--ref <recorte>] [--larguras 1440,390]')
  process.exit(1)
}
const inteira = secao === 'pagina'
const ref = opt('ref', inteira ? 'pagina-inteira' : secao.split(',').filter((s) => s !== '00-header' && s !== '10-rodape').pop() || secao.split(',').pop())
const larguras = String(opt('larguras', '1440,390')).split(',').map(Number)
const movimento = opt('movimento', false) === true
const esperar = Number(opt('esperar', 500))
const alturaFixa = opt('altura', null)
const base = process.env.BASE_URL ?? 'http://localhost:3073'
const nome = secao.split(',').join('+')
const pasta = path.join(RAIZ, 'revisao', nome)
mkdirSync(pasta, { recursive: true })

// 1. build (de preview, ou completo no modo página)
const saidaBuild = execFileSync(process.execPath, [path.join(RAIZ, 'build.mjs'), ...(inteira ? [] : ['--preview', secao])], { cwd: RAIZ, encoding: 'utf8' })
process.stdout.write(saidaBuild)

// 2. prints (Chrome: o Edge headless não funciona nesta máquina)
const NAVEGADOR = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p))
const nav = await puppeteer.launch({ executablePath: NAVEGADOR, headless: true, args: ['--no-first-run', '--hide-scrollbars'] })

async function printar(url, largura, arquivo) {
  const page = await nav.newPage()
  const erros = []
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text().slice(0, 200)))
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message.slice(0, 200)}`))
  // ERR_ABORTED é o srcset trocando de candidato, não arquivo faltando
  page.on('requestfailed', (r) => r.failure()?.errorText !== 'net::ERR_ABORTED' && erros.push(`falhou: ${r.url().replace(base, '')}`))
  const celular = largura < 600
  const altura = Number(alturaFixa || (celular ? 844 : 900))
  await page.setViewport({ width: largura, height: altura, deviceScaleFactor: celular ? 2 : 1, isMobile: celular, hasTouch: celular })
  if (!movimento) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto'
    const passo = Math.max(300, innerHeight * 0.7)
    for (let y = 0; y < document.documentElement.scrollHeight; y += passo) {
      scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 90))
    }
    scrollTo(0, 0)
    const imgs = [...document.images]
    imgs.forEach((i) => { i.loading = 'eager' })
    await Promise.race([Promise.all(imgs.map((i) => (i.complete ? i.decode() : new Promise((r) => { i.onload = i.onerror = r })).catch(() => {}))), new Promise((r) => setTimeout(r, 6000))])
  })
  await new Promise((r) => setTimeout(r, esperar))
  const info = await page.evaluate(() => {
    const W = innerWidth
    const fora = []
    const miudo = new Set()
    for (const el of document.body.querySelectorAll('*')) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.width && (r.right > W + 1 || r.left < -1)) {
        let p = el.parentElement, cortado = false
        while (p && p !== document.body) {
          const o = getComputedStyle(p)
          if (/(hidden|clip|auto|scroll)/.test(o.overflowX) || /(hidden|clip)/.test(o.overflow)) { cortado = true; break }
          p = p.parentElement
        }
        if (!cortado) fora.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.classList.length ? '.' + [...el.classList].join('.') : ''} (${Math.round(r.left)}→${Math.round(r.right)})`)
      }
      if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
        const fs = parseFloat(cs.fontSize)
        if (fs < 12) miudo.add(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${fs}px`)
      }
    }
    return { altura: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, W, fora: fora.slice(0, 8), miudo: [...miudo].slice(0, 6) }
  })
  // corta na altura real do conteúdo (numa seção curta, sobraria fundo embaixo)
  const fim = await page.evaluate(() => {
    let b = 0
    for (const el of document.body.children) {
      if (el.matches('script, style, .pular')) continue
      const r = el.getBoundingClientRect()
      if (r.height) b = Math.max(b, r.bottom + scrollY)
    }
    return Math.ceil(b)
  })
  // Print em faixas: rola a tela, tira print só do que está visível e emenda.
  // O captureBeyondViewport refaz o layout no meio da captura: o <picture> do
  // hero trocava pra foto do celular, os trilhos voltavam pro começo e o vw mudava.
  const dpr = celular ? 2 : 1
  const faixas = []
  for (let y = 0; y < fim; y += altura) {
    const real = await page.evaluate((y) => (scrollTo(0, y), scrollY), y)
    await new Promise((r) => setTimeout(r, 120))
    let input = await page.screenshot({ type: 'png' })
    const sobra = Math.round((real + altura - fim) * dpr)
    if (sobra > 0) input = await sharp(input).extract({ left: 0, top: 0, width: largura * dpr, height: altura * dpr - sobra }).toBuffer()
    faixas.push({ input, top: Math.round(real * dpr), left: 0 })
    // header e botão flutuante só na primeira faixa, senão repetem em todas
    if (faixas.length === 1) {
      await page.evaluate(() => {
        for (const el of document.body.querySelectorAll('*')) {
          const p = getComputedStyle(el).position
          if (p === 'fixed' || p === 'sticky') el.style.setProperty('visibility', 'hidden', 'important')
        }
      })
    }
  }
  await sharp({ create: { width: largura * dpr, height: Math.max(50, fim) * dpr, channels: 3, background: '#fff' } })
    .composite(faixas)
    .png()
    .toFile(arquivo)
  await page.close()
  const linhas = [`  ${largura}px · altura ${info.altura}px → ${path.relative(RAIZ, arquivo)}`]
  if (info.sw > info.W + 1) linhas.push(`    ESTOURO horizontal: ${info.sw}px numa janela de ${info.W}px`)
  if (info.fora.length) linhas.push(`    passam da borda: ${info.fora.join(', ')}`)
  if (info.miudo.length) linhas.push(`    texto < 12px: ${info.miudo.join(', ')}`)
  if (erros.length) linhas.push(`    ERROS: ${erros.slice(0, 5).join(' | ')}`)
  console.log(linhas.join('\n'))
}

async function comparar(print, referencia, saida, L) {
  const a = await sharp(print).resize({ width: L }).toBuffer({ resolveWithObject: true })
  const b = await sharp(referencia).resize({ width: L }).toBuffer({ resolveWithObject: true })
  const alt = Math.max(a.info.height, b.info.height)
  const rot = (t) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="36"><rect width="100%" height="100%" fill="#222"/><text x="12" y="24" font-family="Arial" font-size="18" fill="#fff">${t}</text></svg>`)
  await sharp({ create: { width: L * 2 + 20, height: alt + 36, channels: 3, background: '#888' } })
    .composite([
      { input: rot('SITE'), left: 0, top: 0 },
      { input: rot('MOCKUP'), left: L + 20, top: 0 },
      { input: a.data, left: 0, top: 36 },
      { input: b.data, left: L + 20, top: 36 },
    ])
    .png()
    .toFile(saida)
  console.log(`  comparação → ${path.relative(RAIZ, saida)}`)
}

try {
  for (const l of larguras) {
    const arq = path.join(pasta, `site-${l}.png`)
    const url = inteira ? `${base}/` : `${base}/preview/${nome}.html`
    await printar(url, l, arq)
    const tipo = l < 600 ? 'mobile' : 'desktop'
    const r = path.join(RAIZ, 'referencias', tipo, `${ref}.png`)
    if ((l === 1440 || l === 390) && existsSync(r)) await comparar(arq, r, path.join(pasta, `comparar-${l}.png`), l < 600 ? 520 : 900)
  }
} finally {
  await nav.close()
}
