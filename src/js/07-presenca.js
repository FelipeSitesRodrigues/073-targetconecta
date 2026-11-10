// 07 · Presença: estado do mapa do Brasil e cidade da lista ligadas aos mapas.
// Passar o mouse (ou tocar) num estado mostra o nome e o status embaixo do mapa;
// passar numa cidade da lista acende o ponto dela no recorte, e vice-versa.
;(() => {
  const sec = document.getElementById('presenca')
  if (!sec) return

  // ---------------------------------------------------------------- estados
  const info = sec.querySelector('.pres__info')
  const nome = sec.querySelector('[data-pres-nome]')
  const status = sec.querySelector('[data-pres-status]')
  const padrao = [nome.textContent, status.textContent]
  let ufAtiva = null
  const mostrar = (uf) => {
    if (ufAtiva) ufAtiva.classList.remove('ativo')
    ufAtiva = uf
    if (uf) {
      uf.classList.add('ativo')
      nome.textContent = uf.dataset.nome
      status.textContent = uf.dataset.status
      info.classList.toggle('disponivel', !uf.classList.contains('br__uf--atua'))
    } else {
      ;[nome.textContent, status.textContent] = padrao
      info.classList.remove('disponivel')
    }
  }
  const estados = sec.querySelector('.br__estados')
  estados.addEventListener('pointerover', (e) => {
    const uf = e.target.closest('[data-uf]')
    if (uf) mostrar(uf)
  })
  estados.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') mostrar(null)
  })

  // ---------------------------------------------------------------- cidades
  const pontos = new Map([...sec.querySelectorAll('.rg__ponto')].map((p) => [p.dataset.cidade, p]))
  const chips = new Map([...sec.querySelectorAll('.pres__chip')].map((c) => [c.dataset.cidade, c]))
  let atual = null
  const acender = (id) => {
    if (atual === id) return
    if (atual) {
      pontos.get(atual)?.classList.remove('ativo')
      chips.get(atual)?.classList.remove('ativo')
    }
    atual = id
    if (id) {
      const p = pontos.get(id)
      // o ponto aceso vai pro fim do grupo, pra ficar por cima dos vizinhos
      if (p) {
        p.parentNode.appendChild(p)
        p.classList.add('ativo')
      }
      chips.get(id)?.classList.add('ativo')
    }
  }
  const alvo = (e) => e.target.closest('[data-cidade]')?.dataset.cidade
  for (const area of [sec.querySelector('.rg__pontos'), sec.querySelector('.pres__cidades')]) {
    area.addEventListener('pointerover', (e) => alvo(e) && acender(alvo(e)))
    area.addEventListener('pointerleave', () => acender(null))
    area.addEventListener('focusin', (e) => alvo(e) && acender(alvo(e)))
    area.addEventListener('focusout', () => acender(null))
  }
})()
