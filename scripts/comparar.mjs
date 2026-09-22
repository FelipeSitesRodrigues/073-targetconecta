/**
 * Junta o print do site e o recorte do mockup lado a lado, na mesma largura,
 * pra comparar numa imagem só.
 *
 * Uso: node scripts/comparar.mjs <print.png> <referencia.png> <saida.png> [--largura 900]
 */
import sharp from 'sharp'

const [printArq, refArq, saida] = process.argv.slice(2)
const i = process.argv.indexOf('--largura')
const largura = i > -1 ? Number(process.argv[i + 1]) : 900

if (!printArq || !refArq || !saida) {
  console.error('Uso: node scripts/comparar.mjs <print.png> <referencia.png> <saida.png> [--largura 900]')
  process.exit(1)
}

const a = await sharp(printArq).resize({ width: largura }).toBuffer({ resolveWithObject: true })
const b = await sharp(refArq).resize({ width: largura }).toBuffer({ resolveWithObject: true })
const alt = Math.max(a.info.height, b.info.height)
const rotulo = (texto) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="36"><rect width="100%" height="100%" fill="#222"/><text x="12" y="24" font-family="Arial" font-size="18" fill="#fff">${texto}</text></svg>`,
  )

await sharp({ create: { width: largura * 2 + 20, height: alt + 36, channels: 3, background: '#888' } })
  .composite([
    { input: rotulo('SITE (print)'), left: 0, top: 0 },
    { input: rotulo('MOCKUP (referência)'), left: largura + 20, top: 0 },
    { input: a.data, left: 0, top: 36 },
    { input: b.data, left: largura + 20, top: 36 },
  ])
  .png()
  .toFile(saida)

console.log(`ok ${saida}`)
