/**
 * Gera o mapa da seção "Onde atuamos" com a geografia oficial do IBGE (malhas v3),
 * sem desenhar contorno à mão. Grava src/partials/_mapa.html (SVG inline, que o
 * 06-onde-atuamos.html puxa com <!-- @parcial _mapa -->).
 *
 * - Estados: SP e MS em destaque, vizinhos (MT, GO, MG, PR) claros ao fundo.
 * - "Oeste paulista": a Região Geográfica Intermediária de Presidente Prudente
 *   (IBGE 3505), onde caem todas as cidades da operação citadas no material da
 *   Target (Presidente Prudente, Rancharia, Teodoro Sampaio, Quatá, João Ramalho).
 * - Marcadores no centroide oficial de cada município, com os anéis do alvo do logo.
 *
 * Uso: node scripts/gerar-mapa.mjs
 */
import { writeFileSync } from 'node:fs'

const API = 'https://servicodados.ibge.gov.br/api/v3/malhas'
const get = async (u) => {
  const r = await fetch(u, { headers: { Accept: 'application/vnd.geo+json, application/json' } })
  if (!r.ok) throw new Error(`${r.status} ${u}`)
  return r.json()
}

// ---------------------------------------------------------------- dados
const brasil = await get(`${API}/paises/BR?formato=application/vnd.geo+json&qualidade=intermediaria&intrarregiao=UF`)
const oeste = await get(`${API}/regioes-intermediarias/3505?formato=application/vnd.geo+json&qualidade=intermediaria`)
const cidades = [
  { id: 3541406, nome: 'Presidente Prudente', base: true },
  { id: 3542206, nome: 'Rancharia' },
  { id: 3554300, nome: 'Teodoro Sampaio' },
  { id: 3541703, nome: 'Quatá' },
  { id: 3525607, nome: 'João Ramalho' },
]
for (const c of cidades) {
  const [m] = await get(`${API}/municipios/${c.id}/metadados`)
  c.lon = m.centroide.longitude
  c.lat = m.centroide.latitude
}

// ---------------------------------------------------------------- projeção
// Equiretangular com o cosseno da latitude média: em recorte regional, a
// distorção some e a forma dos estados fica fiel.
const LON = [-58.3, -47.3]
const LAT = [-24.3, -17.05]
const COS = Math.cos((((LAT[0] + LAT[1]) / 2) * Math.PI) / 180)
const W = 600
const K = W / ((LON[1] - LON[0]) * COS)
const H = Math.round((LAT[1] - LAT[0]) * K)
const px = ([lon, lat]) => [(lon - LON[0]) * COS * K, (LAT[1] - lat) * K]

// recorte de cada anel no retângulo da vista (com folga, pra borda cortada ficar fora)
const F = 6
function recortar(anel) {
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

// Douglas-Peucker
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

const r1 = (n) => Math.round(n * 10) / 10
function caminho(geometria) {
  const poligonos = geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.coordinates
  let d = ''
  for (const poli of poligonos)
    for (const anel of poli) {
      let pts = recortar(anel.map(px))
      pts = simplificar(pts, 0.32).map(([x, y]) => [r1(x), r1(y)])
      pts = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1])
      if (pts.length < 3) continue
      d += 'M' + pts.map((p) => `${p[0]} ${p[1]}`).join('L') + 'Z'
    }
  return d
}

const uf = (cod) => brasil.features.find((f) => String(f.properties.codarea) === String(cod)).geometry
const vizinhos = [51, 52, 31, 41].map((c) => caminho(uf(c))).join('')
const dSP = caminho(uf(35))
const dMS = caminho(uf(50))
const dOeste = caminho(oeste.features[0].geometry)

// centroide de área (fórmula do polígono) do maior anel: o ponto de equilíbrio
// da forma, melhor que a média dos vértices pra centralizar um nome
function centroide(d) {
  let melhor = null
  for (const anel of d.split('M').filter(Boolean)) {
    const p = [...anel.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])])
    let a = 0, cx = 0, cy = 0
    for (let i = 0; i < p.length; i++) {
      const [x0, y0] = p[i]
      const [x1, y1] = p[(i + 1) % p.length]
      const f = x0 * y1 - x1 * y0
      a += f
      cx += (x0 + x1) * f
      cy += (y0 + y1) * f
    }
    a /= 2
    if (!melhor || Math.abs(a) > Math.abs(melhor.a)) melhor = { a, x: cx / (6 * a), y: cy / (6 * a) }
  }
  return [melhor.x, melhor.y]
}
const caixa = (d) => {
  const p = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])])
  return { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), y0: Math.min(...p.map((q) => q[1])), y1: Math.max(...p.map((q) => q[1])) }
}
const cMS = centroide(dMS)
const bOeste = caixa(dOeste)

const marcadores = cidades
  .map((c) => {
    const [x, y] = px([c.lon, c.lat]).map(r1)
    return c.base
      ? `<g class="mapa__base" transform="translate(${x} ${y})"><title>${c.nome} (SP): base da Target</title><circle class="mapa__anel mapa__anel--3" r="15"/><circle class="mapa__anel mapa__anel--2" r="9.5"/><circle class="mapa__anel" r="5.4"/><circle class="mapa__miolo" r="2.8"/></g>`
      : `<g class="mapa__cidade" transform="translate(${x} ${y})"><title>${c.nome} (SP)</title><circle class="mapa__anel" r="4.4"/><circle class="mapa__miolo" r="2"/></g>`
  })
  .join('\n      ')

const base = cidades.find((c) => c.base)
const [bx, by] = px([base.lon, base.lat]).map(r1)
// chamada do oeste paulista: sai do alto da região e sobe em cotovelo até o nome, à direita
const chamada = { x: r1(bOeste.x1 + 26), y: r1(bOeste.y0 - 34) }
const pct = (v, total) => `${r1((v / total) * 100)}%`

const html = `<!-- Gerado por scripts/gerar-mapa.mjs a partir das malhas do IBGE (${new Date().toISOString().slice(0, 10)}). Não editar à mão. -->
<div class="mapa__quadro" style="--mapa-proporcao: ${W} / ${H}">
  <svg class="mapa__svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="mapa-titulo mapa-desc" preserveAspectRatio="xMidYMid meet">
    <title id="mapa-titulo">Mapa das cidades atendidas pela Target Connecta em São Paulo e Mato Grosso do Sul</title>
    <desc id="mapa-desc">Mato Grosso do Sul e o oeste paulista em destaque, com a base em Presidente Prudente e presença comercial em Rancharia, Teodoro Sampaio, Quatá e João Ramalho.</desc>
    <defs>
      <linearGradient id="mapa-marinho" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#13254A"/>
        <stop offset="1" stop-color="#08111F"/>
      </linearGradient>
      <linearGradient id="mapa-oeste-fundo" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#22375A"/>
        <stop offset="1" stop-color="#101F3D"/>
      </linearGradient>
      <radialGradient id="mapa-some" cx=".5" cy=".5" r=".5">
        <stop offset=".5" stop-color="#fff"/>
        <stop offset=".96" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
      <mask id="mapa-mascara"><rect x="-10" y="-10" width="${W + 20}" height="${H + 20}" fill="url(#mapa-some)"/></mask>
    </defs>
    <g mask="url(#mapa-mascara)">
      <path class="mapa__vizinhos" d="${vizinhos}"/>
      <path class="mapa__sp" d="${dSP}"/>
    </g>
    <path class="mapa__ms" d="${dMS}"/>
    <path class="mapa__oeste" d="${dOeste}"/>
    <polyline class="mapa__chamada" points="${r1(bx + 6)},${r1(by - 7)} ${r1(chamada.x - 16)},${chamada.y} ${chamada.x - 2},${chamada.y}"/>
    <g class="mapa__pontos">
      ${marcadores}
    </g>
  </svg>
  <span class="mapa__nome" style="left: ${pct(cMS[0], W)}; top: ${pct(cMS[1], H)}" aria-hidden="true">Mato Grosso<br>do Sul</span>
  <span class="mapa__nome mapa__nome--oeste" style="left: ${pct(chamada.x, W)}; top: ${pct(chamada.y, H)}" aria-hidden="true"><strong>Oeste paulista</strong></span>
</div>
`
writeFileSync('src/partials/_mapa.html', html)
console.log(`ok src/partials/_mapa.html ${(html.length / 1024).toFixed(1)} KB · viewBox ${W}x${H}`)
for (const c of cidades) console.log(`  ${c.nome}: ${c.lat}, ${c.lon} → ${px([c.lon, c.lat]).map(r1).join(', ')}`)
console.log('  oeste paulista (caixa):', bOeste, '· chamada:', chamada, '· centro do MS:', cMS.map(r1))
