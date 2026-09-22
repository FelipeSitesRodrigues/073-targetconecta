/**
 * Baixa as fontes do Google Fonts e grava no próprio site (src/assets/fonts),
 * com o @font-face em src/css/_fontes.css (base do 069).
 *
 * O mockup aprovado usa um grotesco condensado e pesado nos títulos. A Archivo
 * tem eixo de largura (62 a 125), então as três versões saem da mesma variável,
 * cortadas no latin e com os eixos travados (subset-font):
 * - 'Archivo Titulo'  largura 70, peso 800: h1, h2 e números grandes
 * - 'Archivo Forte'   largura 76, peso 700: título de card, botão, faixa de prova
 * - 'Archivo Rotulo'  largura 100, peso 600: rótulos em caixa alta com espaçamento
 * - Manrope variável (400 a 700) no texto corrido.
 *
 * Uso: node scripts/baixar-fontes.mjs
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import subsetFont from 'subset-font'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
mkdirSync('src/assets/fonts', { recursive: true })
mkdirSync('scripts/.cache', { recursive: true })

async function css(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.text()
}
async function baixar(url, nome, pasta = 'src/assets/fonts') {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  const buf = Buffer.from(await r.arrayBuffer())
  writeFileSync(`${pasta}/${nome}`, buf)
  console.log('ok', nome, Math.round(buf.length / 1024) + ' KB')
}

const saida = []
const latin = (texto) => [...texto.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g)].find(([, subset]) => subset === 'latin')[2]

// Archivo: baixa a variável inteira e corta as versões fixas
const archivo = latin(await css('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap'))
await baixar(archivo.match(/url\(([^)]+)\)/)[1], 'archivo-var.woff2', 'scripts/.cache')
let letras = ''
for (let c = 0x20; c <= 0x7e; c++) letras += String.fromCharCode(c)
for (let c = 0xa0; c <= 0xff; c++) letras += String.fromCharCode(c)
letras += '‘’“”•…€™½·→'
const variavel = readFileSync('scripts/.cache/archivo-var.woff2')
for (const [familia, arq, eixos] of [
  ['Archivo Titulo', 'archivo-titulo.woff2', { wdth: 70, wght: 800 }],
  ['Archivo Forte', 'archivo-forte.woff2', { wdth: 76, wght: 700 }],
  ['Archivo Rotulo', 'archivo-rotulo.woff2', { wdth: 100, wght: 600 }],
]) {
  const buf = await subsetFont(variavel, letras, { targetFormat: 'woff2', variationAxes: eixos })
  writeFileSync(`src/assets/fonts/${arq}`, buf)
  console.log('ok', arq, Math.round(buf.length / 1024) + ' KB')
  saida.push(`@font-face {
  font-family: '${familia}';
  font-style: normal;
  font-weight: ${eixos.wght};
  font-display: swap;
  src: url('/assets/fonts/${arq}') format('woff2');
}`)
}

// Manrope variável, subset latin do próprio Google
const manrope = latin(await css('https://fonts.googleapis.com/css2?family=Manrope:wght@400..700&display=swap'))
await baixar(manrope.match(/url\(([^)]+)\)/)[1], 'manrope-var.woff2')
saida.push(`@font-face {
  font-family: 'Manrope';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url('/assets/fonts/manrope-var.woff2') format('woff2');
  unicode-range: ${manrope.match(/unicode-range:\s*([^;]+);/)[1]};
}`)

writeFileSync('src/css/_fontes.css', `/* Gerado por scripts/baixar-fontes.mjs. Não editar à mão. */\n${saida.join('\n')}\n`)
console.log('src/css/_fontes.css gravado')
