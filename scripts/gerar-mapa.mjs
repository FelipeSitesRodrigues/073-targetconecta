/**
 * Gera os dois mapas da seção "Presença" com a geografia oficial do IBGE (malhas v3),
 * sem desenhar contorno à mão (reformulação de 11/2026):
 *
 * - src/partials/_mapa-brasil.html: o Brasil por estado. SP e MS (atuação comprovada)
 *   em laranja, o resto como território disponível pra novas parcerias. Cada estado
 *   leva data-uf, data-nome e data-status, que o 07-presenca.js mostra no hover e no toque.
 * - src/partials/_mapa-regiao.html: o recorte do oeste paulista, do Pontal e do sul
 *   do MS, com um ponto no centroide oficial de cada cidade atendida. Cada ponto leva
 *   data-cidade, ligado à lista de cidades do 07-presenca.html.
 *
 * As cidades saem de src/dados/cidades.json (lista do briefing do Rafael). Primavera é
 * distrito de Rosana, não município: vai com a coordenada do distrito, à mão.
 *
 * Uso: node scripts/gerar-mapa.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const API = 'https://servicodados.ibge.gov.br/api/v3/malhas'
const get = async (u) => {
  const r = await fetch(u, { headers: { Accept: 'application/vnd.geo+json, application/json' } })
  if (!r.ok) throw new Error(`${r.status} ${u}`)
  return r.json()
}

const dados = JSON.parse(readFileSync('src/dados/cidades.json', 'utf8'))
const cidades = dados.regioes.flatMap((r) => r.cidades.map((c) => ({ ...c, regiao: r.id })))
const nomes = Object.fromEntries(cidades.map((c) => [c.id, c.nome]))
for (const c of cidades) {
  if (c.lat) continue
  const [m] = await get(`${API}/municipios/${c.ibge}/metadados`)
  c.lon = m.centroide.longitude
  c.lat = m.centroide.latitude
}
const brasil = await get(`${API}/paises/BR?formato=application/vnd.geo+json&qualidade=intermediaria&intrarregiao=UF`)

const NOMES = { 11: ['RO', 'Rondônia'], 12: ['AC', 'Acre'], 13: ['AM', 'Amazonas'], 14: ['RR', 'Roraima'], 15: ['PA', 'Pará'], 16: ['AP', 'Amapá'], 17: ['TO', 'Tocantins'], 21: ['MA', 'Maranhão'], 22: ['PI', 'Piauí'], 23: ['CE', 'Ceará'], 24: ['RN', 'Rio Grande do Norte'], 25: ['PB', 'Paraíba'], 26: ['PE', 'Pernambuco'], 27: ['AL', 'Alagoas'], 28: ['SE', 'Sergipe'], 29: ['BA', 'Bahia'], 31: ['MG', 'Minas Gerais'], 32: ['ES', 'Espírito Santo'], 33: ['RJ', 'Rio de Janeiro'], 35: ['SP', 'São Paulo'], 41: ['PR', 'Paraná'], 42: ['SC', 'Santa Catarina'], 43: ['RS', 'Rio Grande do Sul'], 50: ['MS', 'Mato Grosso do Sul'], 51: ['MT', 'Mato Grosso'], 52: ['GO', 'Goiás'], 53: ['DF', 'Distrito Federal'] }
const ATUA = new Set(['SP', 'MS'])

// ---------------------------------------------------------------- geometria
const r1 = (n) => Math.round(n * 10) / 10

function simplificar(pts, tol) {
  if (pts.length < 4) return pts
  const d2 = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const l = dx * dx + dy * dy
    let t = l ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l : 0
    t = Math.max(0, Math.min(1, t))
    const x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1]
    return x * x + y * y
  }
  const manter = new Uint8Array(pts.length)
  manter[0] = manter[pts.length - 1] = 1
  const pilha = [[0, pts.length - 1]]
  while (pilha.length) {
    const [i, j] = pilha.pop()
    let max = 0, k = -1
    for (let m = i + 1; m < j; m++) {
      const d = d2(pts[m], pts[i], pts[j])
      if (d > max) { max = d; k = m }
    }
    if (max > tol * tol) {
      manter[k] = 1
      pilha.push([i, k], [k, j])
    }
  }
  return pts.filter((_, i) => manter[i])
}

// recorte de um anel num retângulo (Sutherland-Hodgman), com folga F pra borda ficar fora
function recortar(anel, W, H, F = 6) {
  const lados = [
    [(p) => p[0] >= -F, (a, b) => { const t = (-F - a[0]) / (b[0] - a[0]); return [-F, a[1] + t * (b[1] - a[1])] }],
    [(p) => p[0] <= W + F, (a, b) => { const t = (W + F - a[0]) / (b[0] - a[0]); return [W + F, a[1] + t * (b[1] - a[1])] }],
    [(p) => p[1] >= -F, (a, b) => { const t = (-F - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), -F] }],
    [(p) => p[1] <= H + F, (a, b) => { const t = (H + F - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), H + F] }],
  ]
  let saida = anel
  for (const [dentro, cruza] of lados) {
    const entrada = saida
    saida = []
    for (let i = 0; i < entrada.length; i++) {
      const a = entrada[i]
      const b = entrada[(i + 1) % entrada.length]
      if (dentro(b)) {
        if (!dentro(a)) saida.push(cruza(a, b))
        saida.push(b)
      } else if (dentro(a)) saida.push(cruza(a, b))
    }
    if (!saida.length) return []
  }
  return saida
}

// projeção equiretangular com o cosseno da latitude média (fiel em recorte regional)
function projecao(LON, LAT, W) {
  const COS = Math.cos((((LAT[0] + LAT[1]) / 2) * Math.PI) / 180)
  const K = W / ((LON[1] - LON[0]) * COS)
  const H = Math.round((LAT[1] - LAT[0]) * K)
  const px = ([lon, lat]) => [(lon - LON[0]) * COS * K, (LAT[1] - lat) * K]
  const caminho = (geo, tol) => {
    const poligonos = geo.type === 'Polygon' ? [geo.coordinates] : geo.coordinates
    let d = ''
    for (const poli of poligonos)
      for (const anel of poli) {
        let pts = recortar(anel.map(px), W, H)
        pts = simplificar(pts, tol).map(([x, y]) => [r1(x), r1(y)])
        pts = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1])
        if (pts.length < 3) continue
        d += 'M' + pts.map((p) => `${p[0]} ${p[1]}`).join('L') + 'Z'
      }
    return d
  }
  return { W, H, px, caminho }
}

// ---------------------------------------------------------------- Brasil
const BR = projecao([-74.2, -34.6], [-33.9, 5.4], 560)
const estados = brasil.features
  .map((f) => {
    const [sigla, nome] = NOMES[f.properties.codarea]
    const atua = ATUA.has(sigla)
    const d = BR.caminho(f.geometry, 0.9)
    const status = atua ? 'Atuação comprovada' : 'Disponível para novas parcerias'
    return `<path class="br__uf${atua ? ' br__uf--atua' : ''}" d="${d}" data-uf="${sigla}" data-nome="${nome}" data-status="${status}"><title>${nome}: ${status.toLowerCase()}</title></path>`
  })
  .join('\n      ')
// moldura da região do recorte, pra ligar os dois mapas
const REG_LON = [-55.95, -50.15]
const REG_LAT = [-24.15, -21.55]
const [mx0, my0] = BR.px([REG_LON[0], REG_LAT[1]]).map(r1)
const [mx1, my1] = BR.px([REG_LON[1], REG_LAT[0]]).map(r1)

const htmlBrasil = `<!-- Gerado por scripts/gerar-mapa.mjs a partir das malhas do IBGE (${new Date().toISOString().slice(0, 10)}). Não editar à mão. -->
<svg class="br" viewBox="0 0 ${BR.W} ${BR.H}" role="img" aria-labelledby="br-titulo br-desc">
    <title id="br-titulo">Mapa do Brasil com os estados de atuação da Target Connect</title>
    <desc id="br-desc">São Paulo e Mato Grosso do Sul em destaque, com atuação comprovada. Os demais estados estão disponíveis para novas parcerias.</desc>
    <g class="br__estados">
      ${estados}
    </g>
    <rect class="br__moldura" x="${mx0}" y="${my0}" width="${r1(mx1 - mx0)}" height="${r1(my1 - my0)}" rx="3"/>
  </svg>
`

// ---------------------------------------------------------------- recorte regional
const RG = projecao(REG_LON, REG_LAT, 720)
const vizinhos = brasil.features
  .filter((f) => [41, 51, 52, 31].includes(Number(f.properties.codarea)))
  .map((f) => RG.caminho(f.geometry, 0.3))
  .join('')
const uf = (cod) => RG.caminho(brasil.features.find((f) => Number(f.properties.codarea) === cod).geometry, 0.3)

const pontos = cidades
  .map((c) => {
    const [x, y] = RG.px([c.lon, c.lat]).map(r1)
    const rotulo = c.nome + (c.distrito ? ` (distrito de ${c.distrito})` : '') + ` (${c.uf})`
    return c.base
      ? `<g class="rg__ponto rg__ponto--base" transform="translate(${x} ${y})" data-cidade="${c.id}"><title>${rotulo}: base da Target Connect</title><circle class="rg__anel rg__anel--2" r="16"/><circle class="rg__anel" r="9"/><circle class="rg__miolo" r="4.4"/></g>`
      : `<g class="rg__ponto" transform="translate(${x} ${y})" data-cidade="${c.id}"><title>${rotulo}</title><circle class="rg__anel" r="7"/><circle class="rg__miolo" r="3.4"/></g>`
  })
  .join('\n      ')

// nomes fixos no mapa: só a base e um por região, o resto aparece no hover
const nomeFixo = (id, dx, dy, ancora = 'start') => {
  const c = cidades.find((q) => q.id === id)
  const [x, y] = RG.px([c.lon, c.lat]).map(r1)
  return `<text class="rg__nome${c.base ? ' rg__nome--base' : ''}" x="${r1(x + dx)}" y="${r1(y + dy)}" text-anchor="${ancora}">${c.nome}</text>`
}
const legendaUF = (lon, lat, txt) => {
  const [x, y] = RG.px([lon, lat]).map(r1)
  return `<text class="rg__uf" x="${x}" y="${y}" text-anchor="middle">${txt}</text>`
}

const htmlRegiao = `<!-- Gerado por scripts/gerar-mapa.mjs a partir das malhas do IBGE (${new Date().toISOString().slice(0, 10)}). Não editar à mão. -->
<svg class="rg" viewBox="0 0 ${RG.W} ${RG.H}" role="img" aria-labelledby="rg-titulo rg-desc">
    <title id="rg-titulo">Cidades atendidas pela operação comercial da Target Connect</title>
    <desc id="rg-desc">${cidades.length} cidades no oeste paulista, no Pontal do Paranapanema e no sul de Mato Grosso do Sul, com base em Presidente Prudente.</desc>
    <path class="rg__vizinho" d="${vizinhos}"/>
    <path class="rg__estado" d="${uf(50)}"/>
    <path class="rg__estado" d="${uf(35)}"/>
    ${legendaUF(-54.1, -21.8, 'MATO GROSSO DO SUL')}
    ${legendaUF(-50.75, -21.75, 'SÃO PAULO')}
    ${legendaUF(-52.6, -23.85, 'PARANÁ')}
    <g class="rg__pontos">
      ${pontos}
    </g>
    ${nomeFixo('presidente-prudente', 14, -14)}
    ${nomeFixo('navirai', 12, -10)}
    ${nomeFixo('amambai', -12, -10, 'end')}
  </svg>
`

writeFileSync('src/partials/_mapa-brasil.html', htmlBrasil)
writeFileSync('src/partials/_mapa-regiao.html', htmlRegiao)
console.log(`ok _mapa-brasil.html ${(htmlBrasil.length / 1024).toFixed(1)} KB · ${BR.W}x${BR.H}`)
console.log(`ok _mapa-regiao.html ${(htmlRegiao.length / 1024).toFixed(1)} KB · ${RG.W}x${RG.H}`)
