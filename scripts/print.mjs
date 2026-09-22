/**
 * Print de revisão visual com o Edge da máquina (puppeteer-core).
 *
 * Emula viewport de verdade: o Edge headless simples não desce de ~500px no
 * Windows e o print de celular sai recortado.
 *
 * Por padrão emula prefers-reduced-motion, que leva toda animação direto ao
 * estado final. Sem isso o print pega a animação no meio e engana.
 *
 * Uso:
 *   node scripts/print.mjs /preview/hero --largura 1440 --altura 900 --saida ../revisao/hero.png
 *   node scripts/print.mjs / --largura 390 --inteira --saida ../revisao/home-mobile.png
 *   node scripts/print.mjs / --seletor "#destaques" --saida destaques.png
 *   node scripts/print.mjs /preview/hero --movimento --esperar 400 --saida meio.png
 *
 * Opções:
 *   --largura N   (1440)     --altura N (900)       --dpr N (1; 2 se largura < 600)
 *   --inteira     página inteira                    --seletor CSS  print só do elemento
 *   --movimento   não emula reduced motion          --esperar ms   espera antes do print (600)
 *   --rolar Y     rola até Y antes do print         --base URL     (http://localhost:3073)
 */
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
// O Git Bash converte "/preview/hero" em "C:/Program Files/Git/preview/hero".
// Aceita a rota com ou sem barra e desfaz essa conversão.
const bruta = args[0] && !args[0].startsWith('--') ? args[0].replace(/\\/g, '/') : '/'
const semGit = /^[A-Za-z]:\//.test(bruta) ? bruta.replace(/^.*?\/Git(\/|$)/i, '/') : bruta
const rota = '/' + semGit.replace(/^\/+/, '')
const opt = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`)
  if (i === -1) return padrao
  const v = args[i + 1]
  return v === undefined || v.startsWith('--') ? true : v
}

const largura = Number(opt('largura', 1440))
const altura = Number(opt('altura', largura < 600 ? 844 : 900))
const dpr = Number(opt('dpr', largura < 600 ? 2 : 1))
const inteira = opt('inteira', false) === true
const seletor = opt('seletor', null)
const movimento = opt('movimento', false) === true
const esperar = Number(opt('esperar', 600))
const rolar = opt('rolar', null)
const base = opt('base', process.env.BASE_URL ?? 'http://localhost:3073')
const saida = path.resolve(String(opt('saida', `print-${largura}.png`)))

// Chrome primeiro: o Edge 153 desta máquina passou a sair do modo headless sem
// abrir nada (2026-09-21). O Edge fica de reserva.
const EDGE = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!EDGE) {
  console.error('Chrome ou Edge não encontrado.')
  process.exit(1)
}

mkdirSync(path.dirname(saida), { recursive: true })

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', ...(movimento ? [] : ['--force-prefers-reduced-motion'])],
})

try {
  const page = await browser.newPage()
  const erros = []
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text().slice(0, 240)))
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message.slice(0, 240)}`))

  await page.setViewport({ width: largura, height: altura, deviceScaleFactor: dpr, isMobile: largura < 600, hasTouch: largura < 600 })
  if (!movimento) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])

  await page.goto(base + rota, { waitUntil: 'networkidle2', timeout: 90000 })
  await page.evaluate(() => document.fonts.ready)

  // O html tem scroll-behavior: smooth. Sem desligar, o scrollTo anima e o
  // print pega a rolagem no meio (seção deslocada).
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto'
  })

  // Rola a página inteira pra disparar lazy load e o revelar ao rolar.
  if (inteira || seletor) {
    await page.evaluate(async () => {
      const passo = Math.max(300, window.innerHeight * 0.7)
      for (let y = 0; y < document.documentElement.scrollHeight; y += passo) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 120))
      }
      window.scrollTo(0, 0)
    })
    // Imagem lazy que nunca entra na tela (cópias do carrossel, por exemplo)
    // não termina de carregar: espera no máximo 6 s.
    await page.evaluate(() => {
      const pendentes = [...document.images].filter((img) => !img.complete)
      const todas = Promise.all(
        pendentes.map(
          (img) =>
            new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true })
              img.addEventListener('error', resolve, { once: true })
            }),
        ),
      )
      return Promise.race([todas, new Promise((r) => setTimeout(r, 6000))])
    })
  }

  // Na página inteira, imagem lazy às vezes sai em branco no print: força o
  // carregamento e espera decodificar tudo antes de capturar.
  if (inteira) {
    await page.evaluate(async () => {
      const imgs = [...document.images]
      imgs.forEach((img) => { img.loading = 'eager' })
      await Promise.race([
        Promise.all(imgs.map((img) => (img.complete ? img.decode() : new Promise((r) => img.addEventListener('load', r, { once: true }))).catch(() => {}))),
        new Promise((r) => setTimeout(r, 8000)),
      ])
    })
  }

  if (rolar !== null) await page.evaluate((y) => window.scrollTo(0, y), Number(rolar))
  await new Promise((r) => setTimeout(r, esperar))

  const info = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    altura: document.documentElement.scrollHeight,
  }))

  if (seletor) {
    const el = await page.$(seletor)
    if (!el) throw new Error(`Seletor não encontrado: ${seletor}`)
    await el.screenshot({ path: saida })
  } else {
    await page.screenshot({ path: saida, fullPage: inteira })
  }

  console.log(`ok ${saida}`)
  console.log(`viewport ${largura}x${altura} dpr ${dpr} · altura da página ${info.altura}px`)
  if (info.scrollWidth > info.innerWidth + 1) console.log(`ESTOURA horizontal: ${info.scrollWidth}px em janela de ${info.innerWidth}px`)
  if (erros.length) console.log(`ERROS de console:\n  ${erros.slice(0, 6).join('\n  ')}`)
} finally {
  await browser.close()
}
