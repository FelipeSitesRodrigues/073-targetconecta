/**
 * Fatia um print de página inteira em pedaços de altura fixa, pra revisar por partes.
 * Uso: node scripts/fatiar.mjs revisao/pagina/site-1440.png 1500 [largura-saida]
 */
import sharp from 'sharp'
import path from 'node:path'
const [arq, alturaArg, larguraArg] = process.argv.slice(2)
const altura = Number(alturaArg || 1500)
const meta = await sharp(arq).metadata()
const base = arq.replace(/\.png$/, '')
let n = 0
for (let y = 0; y < meta.height; y += altura) {
  const h = Math.min(altura, meta.height - y)
  let p = sharp(arq).extract({ left: 0, top: y, width: meta.width, height: h })
  if (larguraArg) p = p.resize({ width: Number(larguraArg) })
  await p.toFile(`${base}-parte${++n}.png`)
}
console.log(`${n} partes de ${path.basename(arq)} (${meta.width}x${meta.height})`)
