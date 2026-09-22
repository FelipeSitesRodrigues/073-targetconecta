// 00 · Header: estado ao rolar, link ativo do menu e o painel do celular (base do 069).
// Nada ouve o scroll: rolagem e seção na tela vão por IntersectionObserver.
;(() => {
  const cab = document.getElementById('cab')
  if (!cab) return
  const raiz = document.documentElement
  const temIO = 'IntersectionObserver' in window

  // ---------------------------------------------------------------- transparente no topo, sólido ao rolar
  const sentinela = document.getElementById('cab-sentinela')
  if (sentinela && temIO) {
    new IntersectionObserver(([e]) => cab.classList.toggle('cab--rolado', !e.isIntersecting)).observe(sentinela)
  } else {
    cab.classList.add('cab--rolado')
  }

  // ---------------------------------------------------------------- link ativo conforme a seção no meio da tela
  const links = [...document.querySelectorAll('.cab__link, .cab-menu__link')]
  const idDo = (a) => decodeURIComponent(a.hash.slice(1))
  const alvos = new Map()
  for (const a of links) {
    const el = document.getElementById(idDo(a))
    if (el) alvos.set(el, idDo(a))
  }

  let ativo = null
  const marcar = (id) => {
    if (id === ativo) return
    ativo = id
    for (const a of links) {
      if (id && idDo(a) === id) a.setAttribute('aria-current', 'location')
      else a.removeAttribute('aria-current')
    }
  }
  if (temIO && alvos.size) {
    const dentro = new Set()
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) e.isIntersecting ? dentro.add(e.target) : dentro.delete(e.target)
        const ultimo = [...dentro].pop()
        marcar(ultimo ? alvos.get(ultimo) : null)
      },
      { rootMargin: '-45% 0px -54% 0px' },
    )
    alvos.forEach((_, el) => io.observe(el))
  }

  // ---------------------------------------------------------------- painel do celular
  const botao = cab.querySelector('.cab__abrir')
  const menu = document.getElementById('menu-celular')
  if (!botao || !menu) return
  const desktop = window.matchMedia('(min-width: 1200px)')
  let aberto = false
  let inertes = []

  const abrir = () => {
    if (aberto) return
    aberto = true
    // compensa a barra de rolagem que some com a trava (evita o "pulo" lateral)
    raiz.style.setProperty('--cab-barra', `${Math.max(0, window.innerWidth - raiz.clientWidth)}px`)
    raiz.classList.add('cab-trava')
    cab.classList.add('cab--menu')
    menu.classList.add('cab-menu--aberto')
    botao.setAttribute('aria-expanded', 'true')
    // o resto da página sai do foco e do leitor de tela enquanto o painel está aberto
    inertes = [...document.body.children].filter((el) => el !== cab && el !== menu && !el.inert && !/^(SCRIPT|STYLE)$/.test(el.tagName))
    inertes.forEach((el) => { el.inert = true })
    menu.scrollTop = 0
    const primeiro = menu.querySelector('a')
    if (primeiro) primeiro.focus({ preventScroll: true })
  }

  const fechar = (devolverFoco) => {
    if (!aberto) return
    aberto = false
    inertes.forEach((el) => { el.inert = false })
    inertes = []
    menu.classList.remove('cab-menu--aberto')
    cab.classList.remove('cab--menu')
    botao.setAttribute('aria-expanded', 'false')
    raiz.classList.remove('cab-trava')
    raiz.style.removeProperty('--cab-barra')
    if (devolverFoco) botao.focus({ preventScroll: true })
  }

  botao.addEventListener('click', () => (aberto ? fechar(true) : abrir()))

  // clique num link do painel (ou no logo) fecha antes da navegação acontecer
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) fechar(false)
  })
  cab.querySelector('.cab__marca')?.addEventListener('click', () => fechar(false))

  document.addEventListener('keydown', (e) => {
    if (aberto && e.key === 'Escape') {
      e.preventDefault()
      fechar(true)
    }
  })

  // a tela passou pra desktop com o painel aberto: fecha
  const aoMudar = (e) => { if (e.matches) fechar(false) }
  if (desktop.addEventListener) desktop.addEventListener('change', aoMudar)
  else desktop.addListener(aoMudar)
})()
