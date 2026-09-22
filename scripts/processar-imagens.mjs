/**
 * Gera todas as imagens do site a partir de "../073 - TARGET CONECTA/Recursos Site",
 * em src/assets/img, com várias larguras pra srcset. Grava src/assets/img/manifesto.json
 * com largura e altura de cada arquivo (pro width/height do <img>, sem salto de layout).
 *
 * - Hero: AVIF e WebP (desktop 960/1280/1672, celular 480/720/941).
 * - Logo horizontal (header e rodapé, como no mockup): o PNG oficial é empilhado,
 *   então o símbolo e o nome saem do próprio arquivo, separados por componente
 *   conectado (o anel encosta no "R" e no "G" sem se tocar), e são postos lado a
 *   lado. Nada é redesenhado: são os pixels do logo que o cliente mandou.
 * - Fotos reais da apresentação da Target: os fundadores na Band Paulista (slide 2)
 *   e o time de camisa azul (slide 6, com os riscos dourados da arte apagados e o céu
 *   estendido pra cima, pras cabeças não encostarem na borda).
 * - Favicons (símbolo) e imagem de compartilhamento 1200x630.
 *
 * Uso: node scripts/processar-imagens.mjs
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const R = '../073 - TARGET CONECTA/Recursos Site'
const APRESENTACAO = `${R}/DOCUMENTO APRESENTAÇÃO TARGET CONECTA/Apresentacao Target  pp-`
const OUT = 'src/assets/img'
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const manifesto = {}

async function gravar(pipeline, nome) {
  const info = await pipeline.toFile(path.join(OUT, nome))
  manifesto[nome] = { w: info.width, h: info.height, kb: Math.round(info.size / 1024) }
}

// uma imagem (arquivo ou buffer) em várias larguras
async function variantes(origem, nome, larguras, { formatos = ['webp'], q = 74 } = {}) {
  for (const w of larguras) {
    for (const f of formatos) {
      let p = sharp(origem).resize({ width: w, withoutEnlargement: true })
      p = f === 'avif' ? p.avif({ quality: q - 22, effort: 6 }) : p.webp({ quality: q, effort: 6 })
      await gravar(p, `${nome}-${w}.${f}`)
    }
  }
}

// ---------------------------------------------------------------- hero
await variantes(`${R}/DESKTOP/IMAGEM HERO DESKTOP.png`, 'hero-desktop', [960, 1280, 1672], { formatos: ['avif', 'webp'], q: 72 })
// 800: celular de 412 px com densidade 1,75 pede ~721 px e pulava pro 941
await variantes(`${R}/MOBILE/IMAGEM HERO MOBILE.png`, 'hero-celular', [480, 720, 800, 941], { formatos: ['avif', 'webp'], q: 72 })

// ---------------------------------------------------------------- logo
const logoArq = `${R}/01 - LOGO TARGET CONNECTA.png`
const { data: px, info: li } = await sharp(logoArq).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const LW = li.width
const LH = li.height
// componentes conectados (8 vizinhos) só nos pixels opacos: na borda suavizada o
// contorno do anel e o do "R" se tocam, com opacidade baixa
const rotulo = new Int32Array(LW * LH).fill(-1)
const comps = []
for (let i = 0; i < LW * LH; i++) {
  if (rotulo[i] !== -1 || px[i * 4 + 3] <= 128) continue
  const c = { topo: LH, id: comps.length }
  const fila = [i]
  rotulo[i] = c.id
  while (fila.length) {
    const j = fila.pop()
    const y = (j / LW) | 0
    const x = j - y * LW
    if (y < c.topo) c.topo = y
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= LW || ny >= LH) continue
        const k = ny * LW + nx
        if (rotulo[k] === -1 && px[k * 4 + 3] > 128) {
          rotulo[k] = c.id
          fila.push(k)
        }
      }
  }
  comps.push(c)
}
// cada pixel semitransparente (borda e sombra) vai pro componente opaco mais perto
{
  let fila = []
  for (let i = 0; i < LW * LH; i++) if (rotulo[i] !== -1) fila.push(i)
  while (fila.length) {
    const prox = []
    for (const j of fila) {
      const y = (j / LW) | 0
      const x = j - y * LW
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= LW || ny >= LH) continue
          const k = ny * LW + nx
          if (rotulo[k] === -1 && px[k * 4 + 3] > 0) {
            rotulo[k] = rotulo[j]
            prox.push(k)
          }
        }
    }
    fila = prox
  }
}
// o nome (TARGET e CONNECTA) começa na linha ~605; tudo que nasce acima é o símbolo
const DIVISA = 598
const parte = async (doSimbolo) => {
  const buf = Buffer.from(px)
  for (let i = 0; i < LW * LH; i++) {
    const r = rotulo[i]
    const ehSimbolo = r !== -1 && comps[r].topo < DIVISA
    if (r === -1 || ehSimbolo !== doSimbolo) buf[i * 4 + 3] = 0
  }
  return sharp(await sharp(buf, { raw: { width: LW, height: LH, channels: 4 } }).png().toBuffer()).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true })
}
const simbolo = await parte(true)
const nome = await parte(false)
const empilhado = await sharp(logoArq).trim({ threshold: 1 }).png().toBuffer()

// horizontal: símbolo 1,3x a altura do bloco do nome (proporção do header do mockup), vão de 13%
const alturaNome = nome.info.height
const simb = await sharp(simbolo.data).resize({ height: Math.round(alturaNome * 1.3) }).png().toBuffer({ resolveWithObject: true })
const vao = Math.round(alturaNome * 0.13)
const altura = Math.max(simb.info.height, alturaNome)
const horizontal = await sharp({
  create: { width: simb.info.width + vao + nome.info.width, height: altura, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([
    { input: simb.data, left: 0, top: Math.round((altura - simb.info.height) / 2) },
    { input: nome.data, left: simb.info.width + vao, top: Math.round((altura - alturaNome) / 2) },
  ])
  .png()
  .toBuffer()
// header: 250 px no desktop e 184 no celular; densidade 1,75 a 3 pede de ~320 a 750 px
for (const w of [260, 400, 520, 780]) await gravar(sharp(horizontal).resize({ width: w }).webp({ quality: 80, alphaQuality: 82, effort: 6 }), `logo-horizontal-${w}.webp`)
await gravar(sharp(empilhado).resize({ width: 600 }).png({ compressionLevel: 9 }), 'logo-empilhado-600.png')

// ---------------------------------------------------------------- favicons (o símbolo)
const quadrado = async (lado, fundo, margem) => {
  const util = Math.round(lado * (1 - margem * 2))
  const ic = await sharp(simbolo.data).resize({ width: util, height: util, fit: 'inside' }).png().toBuffer()
  return sharp({ create: { width: lado, height: lado, channels: 4, background: fundo } }).composite([{ input: ic, gravity: 'center' }])
}
const transparente = { r: 0, g: 0, b: 0, alpha: 0 }
const noite = { r: 5, g: 10, b: 20, alpha: 1 }
mkdirSync('src/raiz', { recursive: true })
await (await quadrado(32, transparente, 0)).png().toFile('src/raiz/favicon-32.png')
await (await quadrado(180, noite, 0.14)).png().toFile('src/raiz/apple-touch-icon.png')
await (await quadrado(192, noite, 0.14)).png().toFile('src/raiz/icon-192.png')
await (await quadrado(512, noite, 0.14)).png().toFile('src/raiz/icon-512.png')
// favicon.ico com o PNG de 32 embutido (formato ICO aceita PNG desde o Vista)
const png32 = await (await quadrado(32, transparente, 0)).png().toBuffer()
const ico = Buffer.alloc(22)
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4)
ico.writeUInt8(32, 6); ico.writeUInt8(32, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9)
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png32.length, 14); ico.writeUInt32LE(22, 18)
writeFileSync('src/raiz/favicon.ico', Buffer.concat([ico, png32]))

// ---------------------------------------------------------------- fundadores na Band Paulista (slide 2, sem a arte por cima)
const band = await sharp(`${APRESENTACAO}2.jpg`).extract({ left: 716, top: 420, width: 1584, height: 1070 }).toBuffer()
await variantes(band, 'fundadores-band', [480, 720, 960, 1280], { q: 76 })

// ---------------------------------------------------------------- time de camisa azul (slide 6)
// A arte do slide passa um sublinhado dourado no alto à esquerda e uma linha
// diagonal na borda direita, os dois sobre céu liso. Nessas áreas (desviando da
// cabeça e da mão), cada pixel que foge da mediana larga da vizinhança é trocado
// por ela: linha fina some, céu e degradê ficam.
const TX = 20, TY = 690, TW = 1320, TH = 740
const recorte = await sharp(`${APRESENTACAO}6.jpg`).extract({ left: TX, top: TY, width: TW, height: TH }).removeAlpha().toBuffer()
const { data: tp } = await sharp(recorte).raw().toBuffer({ resolveWithObject: true })
const { data: med } = await sharp(recorte).median(35).raw().toBuffer({ resolveWithObject: true })
// o cabelo do primeiro começa em x ~228 e y ~35: as áreas param antes dele
const areas = [
  [80, 224, 0, 90],
  [224, 262, 0, 28],
  [1284, TW, 342, 404],
]
for (const [x0, x1, y0, y1] of areas)
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * TW + x) * 3
      const d = Math.abs(tp[i] - med[i]) + Math.abs(tp[i + 1] - med[i + 1]) + Math.abs(tp[i + 2] - med[i + 2])
      // mistura suave: diferença pequena fica, grande vira a mediana
      const t = Math.min(1, Math.max(0, (d - 14) / 26))
      for (let c = 0; c < 3; c++) tp[i + c] = Math.round(tp[i + c] + (med[i + c] - tp[i + c]) * t)
    }
// O sublinhado do alto à esquerda é grosso demais pra mediana. Ali o céu é um
// degradê: ajusta um plano de cor (mínimos quadrados) nas áreas limpas em volta e
// troca o que foge dele, fora da cabeça do primeiro vendedor.
{
  const amostras = [
    [20, 84, 0, 55],
    [20, 210, 84, 132],
    [366, 450, 0, 48],
  ]
  const pts = []
  for (const [x0, x1, y0, y1] of amostras) for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) pts.push([x, y])
  // resolve [a b d] de c = a + b*x + d*y pelas equações normais (3x3)
  const resolver = (canal) => {
    let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sc = 0, sxc = 0, syc = 0
    for (const [x, y] of pts) {
      const c = tp[(y * TW + x) * 3 + canal]
      n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sc += c; sxc += x * c; syc += y * c
    }
    const M = [[n, sx, sy], [sx, sxx, sxy], [sy, sxy, syy]]
    const v = [sc, sxc, syc]
    const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    const D = det(M)
    return [0, 1, 2].map((k) => det(M.map((linha, i) => linha.map((val, j) => (j === k ? v[i] : val)))) / D)
  }
  const coef = [0, 1, 2].map(resolver)
  // o cabelo começa em x ~228 (lado esquerdo) e y ~35 (topo): a área para antes dele
  const naArea = (x, y) => (x < 224 && y < 96) || (y < 28)
  for (let y = 0; y < 96; y++)
    for (let x = 76; x < 268; x++) {
      if (!naArea(x, y)) continue
      const i = (y * TW + x) * 3
      const alvo = coef.map(([a, b, d]) => a + b * x + d * y)
      const dif = Math.abs(tp[i] - alvo[0]) + Math.abs(tp[i + 1] - alvo[1]) + Math.abs(tp[i + 2] - alvo[2])
      const t = Math.min(1, Math.max(0, (dif - 16) / 22))
      for (let c = 0; c < 3; c++) tp[i + c] = Math.round(tp[i + c] + (alvo[c] - tp[i + c]) * t)
    }
}
// Respiro em cima: o recorte para logo acima das cabeças (o cabelo do primeiro está
// a 35 px da borda) porque mais alto vem a frase manuscrita do slide. O céu ali é um
// degradê liso, então ele sobe mais CEU linhas: cada coluna repete a média das
// primeiras linhas, suavizada na horizontal pra não riscar, e escurece aos poucos pro
// azul-noite do site. As primeiras linhas da foto se misturam com a extensão.
const CEU = 90
const EH = TH + CEU
const ext = Buffer.alloc(TW * EH * 3)
const topo = new Float32Array(TW * 3)
for (let x = 0; x < TW; x++)
  for (let c = 0; c < 3; c++) {
    let s = 0
    for (let y = 0; y < 6; y++) s += tp[(y * TW + x) * 3 + c]
    topo[x * 3 + c] = s / 6
  }
const RAIO = 40
const ceu = new Float32Array(TW * 3)
for (let x = 0; x < TW; x++)
  for (let c = 0; c < 3; c++) {
    let s = 0, n = 0
    for (let k = Math.max(0, x - RAIO); k <= Math.min(TW - 1, x + RAIO); k++) { s += topo[k * 3 + c]; n++ }
    ceu[x * 3 + c] = s / n
  }
const NOITE = [2, 11, 26]
// ruído leve (sempre o mesmo, pra imagem não mudar a cada execução), senão o
// degradê liso vira faixas no WebP
let semente = 73
const ruido = () => ((semente = (Math.imul(semente, 1103515245) + 12345) >>> 0) / 4294967296 - 0.5) * 3
for (let y = 0; y < CEU; y++) {
  const t = (CEU - y) / CEU
  const escurece = 0.45 * t * t
  for (let x = 0; x < TW; x++)
    for (let c = 0; c < 3; c++) {
      const v = ceu[x * 3 + c] + (NOITE[c] - ceu[x * 3 + c]) * escurece + ruido()
      ext[(y * TW + x) * 3 + c] = Math.max(0, Math.min(255, Math.round(v)))
    }
}
tp.copy(ext, CEU * TW * 3)
const COSTURA = 14
for (let y = 0; y < COSTURA; y++) {
  const peso = 1 - y / COSTURA
  for (let x = 0; x < TW; x++)
    for (let c = 0; c < 3; c++) {
      const i = ((CEU + y) * TW + x) * 3 + c
      ext[i] = Math.round(ext[i] * (1 - peso) + ceu[x * 3 + c] * peso)
    }
}
const equipe = await sharp(ext, { raw: { width: TW, height: EH, channels: 3 } }).png().toBuffer()
await variantes(equipe, 'equipe', [480, 720, 960, 1320], { q: 76 })

// ---------------------------------------------------------------- compartilhamento (1200x630): hero com o logo à esquerda
const logoOg = await sharp(empilhado).resize({ width: 360 }).png().toBuffer()
const veu = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#050A14" stop-opacity=".96"/><stop offset=".42" stop-color="#050A14" stop-opacity=".82"/><stop offset=".62" stop-color="#050A14" stop-opacity="0"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>`,
)
await gravar(
  sharp(`${R}/DESKTOP/IMAGEM HERO DESKTOP.png`)
    .resize({ width: 1200, height: 630, fit: 'cover', position: 'right' })
    .composite([{ input: veu }, { input: logoOg, left: 80, top: 206 }])
    .jpeg({ quality: 82, mozjpeg: true }),
  'og-target-connecta.jpg',
)

writeFileSync(path.join(OUT, 'manifesto.json'), JSON.stringify(manifesto, null, 1))
const total = Object.values(manifesto).reduce((s, m) => s + m.kb, 0)
console.log(`${Object.keys(manifesto).length} arquivos em ${OUT} (${total} KB no total), manifesto.json gravado`)
console.log(`logo: ${comps.length} componentes · símbolo ${simbolo.info.width}x${simbolo.info.height} · nome ${nome.info.width}x${nome.info.height}`)
console.log('favicons em src/raiz:', readdirSync('src/raiz').join(', '))
