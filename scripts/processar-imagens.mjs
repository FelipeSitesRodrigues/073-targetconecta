/**
 * Imagens da reformulação (11/2026), a partir de "../073 - TARGET CONECTA/Recursos Site".
 * Grava em src/assets/img e junta no src/assets/img/manifesto.json (largura e altura
 * de cada arquivo, pro width/height do <img>).
 *
 * - Hero: a arte que o Rafael mandou em 10/11 (fachada, frota e time). A faixa de
 *   ícones que vem desenhada no pé da arte sai no recorte (o site refaz em HTML).
 * - Marca: o símbolo novo (anel + flecha laranja) vem de src/assets/img/marca.svg,
 *   desenhado à mão a partir da arte. Gera favicons e ícones do app.
 * - Imagem de compartilhamento 1200x630: o hero com película e o símbolo.
 *
 * Não apaga nada: as fotos reais que continuam (equipe-* e fundadores-band-*) foram
 * geradas pela versão anterior deste script (commit 607cba5, no git) e ficam como estão.
 *
 * Uso: node scripts/processar-imagens.mjs
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs'
import path from 'node:path'

const R = '../073 - TARGET CONECTA/Recursos Site'
const OUT = 'src/assets/img'
const MAN = path.join(OUT, 'manifesto.json')
mkdirSync(OUT, { recursive: true })

// o que a versão antiga gerava e o site novo não usa mais
const OBSOLETOS = /^(hero-desktop|hero-celular|o-que-e-a-target|time-comercial|logo-horizontal|logo-empilhado|og-target-connecta)/
for (const f of readdirSync(OUT)) if (OBSOLETOS.test(f)) rmSync(path.join(OUT, f))
const manifesto = existsSync(MAN) ? JSON.parse(readFileSync(MAN, 'utf8')) : {}
for (const k of Object.keys(manifesto)) if (OBSOLETOS.test(k) || !existsSync(path.join(OUT, k))) delete manifesto[k]

async function gravar(pipeline, nome) {
  const info = await pipeline.toFile(path.join(OUT, nome))
  manifesto[nome] = { w: info.width, h: info.height, kb: Math.round(info.size / 1024) }
}
async function variantes(origem, nome, larguras, { formatos = ['webp'], q = 74 } = {}) {
  for (const w of larguras)
    for (const f of formatos) {
      let p = sharp(origem).resize({ width: w, withoutEnlargement: false })
      p = f === 'avif' ? p.avif({ quality: q - 22, effort: 6 }) : p.webp({ quality: q, effort: 6 })
      await gravar(p, `${nome}-${w}.${f}`)
    }
}

// ---------------------------------------------------------------- hero
// a arte tem 1600x900; a faixa de ícones começa por volta da linha 715
const arte = await sharp(`${R}/reformulacao-arte-time-fachada.png`).extract({ left: 0, top: 0, width: 1600, height: 700 }).png().toBuffer()
await variantes(arte, 'hero', [640, 960, 1280, 1600], { formatos: ['avif', 'webp'], q: 72 })
// celular: recorte em retrato no centro do time (o fundo cobre a seção inteira)
const retrato = await sharp(arte).extract({ left: 520, top: 0, width: 700, height: 700 }).png().toBuffer()
await variantes(retrato, 'hero-celular', [480, 700], { formatos: ['avif', 'webp'], q: 70 })

// ---------------------------------------------------------------- favicons e ícones (o símbolo)
const marca = readFileSync(path.join(OUT, 'marca.svg'), 'utf8')
const marcaCor = (fundo) => Buffer.from(marca.replace('<svg ', `<svg width="512" height="512" `).replace('<!--fundo-->', fundo ? `<rect width="64" height="64" rx="14" fill="${fundo}"/>` : ''))
const icone = (lado, fundo) => sharp(marcaCor(fundo), { density: 600 }).resize(lado, lado).png()
mkdirSync('src/raiz', { recursive: true })
await icone(32, '#0B1630').toFile('src/raiz/favicon-32.png')
await icone(180, '#0B1630').toFile('src/raiz/apple-touch-icon.png')
await icone(192, '#0B1630').toFile('src/raiz/icon-192.png')
await icone(512, '#0B1630').toFile('src/raiz/icon-512.png')
const png32 = await icone(32, '#0B1630').toBuffer()
const ico = Buffer.alloc(22)
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4)
ico.writeUInt8(32, 6); ico.writeUInt8(32, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9)
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png32.length, 14); ico.writeUInt32LE(22, 18)
writeFileSync('src/raiz/favicon.ico', Buffer.concat([ico, png32]))

// ---------------------------------------------------------------- compartilhamento 1200x630
const pelicula = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0B1630" stop-opacity=".85"/><stop offset=".45" stop-color="#0B1630" stop-opacity="0"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>`)
await gravar(
  sharp(arte).resize(1200, 630, { fit: 'cover', position: 'top' }).composite([{ input: pelicula }]).jpeg({ quality: 82, mozjpeg: true }),
  'og-target-connect.jpg',
)

writeFileSync(MAN, JSON.stringify(manifesto, null, 1))
console.log('ok', Object.keys(manifesto).length, 'arquivos no manifesto')
