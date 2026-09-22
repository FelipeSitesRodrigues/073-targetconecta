// Target Connecta: comportamento comum a todas as seções. Sem biblioteca e sem
// ouvir o scroll: o que depende de rolagem vai por IntersectionObserver.
// Cada seção com comportamento próprio tem o seu arquivo (mesmo nome do parcial).
;(() => {
  // ---------------------------------------------------------------- revelação no scroll
  const revelar = document.querySelectorAll('[data-revela]')
  if (!('IntersectionObserver' in window)) {
    revelar.forEach((el) => el.classList.add('visivel'))
  } else {
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue
          e.target.classList.add('visivel')
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    revelar.forEach((el) => io.observe(el))
  }

  // ---------------------------------------------------------------- rastreio dos cliques
  // Três públicos, três eventos (copy, bloco 14): empresa que quer terceirizar,
  // pessoa que quer assinar um plano e vendedor indo pro painel. Vão pro dataLayer
  // (GA4 / Tag Manager) e pro Pixel, se um dia forem instalados.
  const EVENTOS = {
    empresa: ['whatsapp_empresa', 'Contact'],
    plano: ['whatsapp_plano', 'Lead'],
    vendedor: ['area_do_vendedor', null],
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="https://wa.me/"], a[data-evento]')
    // clique cancelado não abriu o WhatsApp (o de assinar plano abre o formulário,
    // e o evento sai no envio, em 05-planos.js)
    if (!a || e.defaultPrevented) return
    const [evento, pixel] = EVENTOS[a.dataset.evento || 'empresa'] || EVENTOS.empresa
    const origem = a.dataset.zap || a.closest('section, header, footer')?.id || 'pagina'
    ;(window.dataLayer = window.dataLayer || []).push({ event: evento, origem })
    if (pixel && typeof window.fbq === 'function') window.fbq('track', pixel, { origem })
  })
})()
