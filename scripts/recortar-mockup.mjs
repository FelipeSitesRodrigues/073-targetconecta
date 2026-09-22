/**
 * Recorta os mockups aprovados (Recursos Site) por seção, na largura do print:
 * referencias/desktop/<secao>.png em 1440 e referencias/mobile/<secao>.png em 390.
 * É o que o scripts/revisar.mjs põe ao lado do print do site.
 * Os limites vêm da troca de fundo claro/escuro medida nos próprios mockups.
 * Planos e "Antes de fechar" não existem no mockup: o recorte é o bloco que
 * eles substituem (o "Cliente em destaque" e o depoimento), só como estilo.
 *
 * Uso: node scripts/recortar-mockup.mjs
 */
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const R = '../073 - TARGET CONECTA/Recursos Site'
const D = `${R}/DESKTOP/MOCKUP REFERÊNCIA DESKTOP.png`
const M = `${R}/MOBILE/MOCKUP REFERÊNCIA MOBILE.png`
mkdirSync('referencias/desktop', { recursive: true })
mkdirSync('referencias/mobile', { recursive: true })

const desktop = {
  '01-hero': [0, 403],
  '02-sobre': [403, 615],
  '03-servicos': [615, 786],
  '04-como-trabalhamos': [786, 966],
  '05-planos': [966, 1148],
  '06-onde-atuamos': [1148, 1307],
  '07-diferenciais': [1307, 1494],
  '08-antes-de-fechar': [1494, 1580],
  '09-cta': [1580, 1682],
  '10-rodape': [1682, 1821],
  'pagina-inteira': [0, 1821],
}
for (const [nome, [t, b]] of Object.entries(desktop))
  await sharp(D).extract({ left: 0, top: t, width: 864, height: b - t }).resize({ width: 1440, kernel: 'lanczos3' }).toFile(`referencias/desktop/${nome}.png`)

// três telas de celular lado a lado; x da tela de cada coluna
const col = { 1: [12, 226], 2: [254, 459], 3: [487, 701] }
const mobile = {
  '01-hero': [1, 40, 872],
  '02-sobre': [1, 872, 1558],
  '03-servicos': [1, 1558, 2125],
  '04-como-trabalhamos': [2, 47, 739],
  '05-planos': [2, 739, 1388],
  '06-onde-atuamos': [2, 1388, 1938],
  '07-diferenciais': [3, 40, 752],
  '08-antes-de-fechar': [3, 752, 1141],
  '09-cta': [3, 1141, 1487],
  '10-rodape': [3, 1487, 2100],
}
for (const [nome, [c, t, b]] of Object.entries(mobile)) {
  const [l, r] = col[c]
  await sharp(M).extract({ left: l, top: t, width: r - l, height: b - t }).resize({ width: 390, kernel: 'lanczos3' }).toFile(`referencias/mobile/${nome}.png`)
}
console.log('ok referencias/desktop e referencias/mobile')
