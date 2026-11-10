// 11 · Contato: monta o formulário do <template> quando a seção chega perto da tela,
// valida e abre o WhatsApp comercial com a mensagem do config (mensagens.proposta),
// trocando {campo} pelo que a pessoa escreveu.
;(() => {
  const lugar = document.querySelector('[data-form-lugar]')
  const molde = document.getElementById('form-contato')
  if (!lugar || !molde) return

  const montar = () => {
    if (lugar.classList.contains('montado')) return
    lugar.replaceChildren(molde.content.cloneNode(true))
    lugar.classList.add('montado')
    ligar(lugar.querySelector('form'))
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) {
        io.disconnect()
        montar()
      }
    }, { rootMargin: '600px 0px' })
    io.observe(lugar)
  } else montar()
  // link pra #contato (botões do topo) monta na hora, antes de rolar
  document.addEventListener('click', (e) => {
    if (e.target.closest('a[href="#contato"]')) montar()
  })

  function mascara(v) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d.length ? `(${d}` : ''
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }

  function ligar(form) {
    const erro = form.querySelector('.form__erro')
    const tel = form.elements.telefone
    tel.addEventListener('input', () => { tel.value = mascara(tel.value) })
    form.addEventListener('input', (e) => {
      if (e.target.getAttribute('aria-invalid') === 'true' && valido(e.target)) e.target.removeAttribute('aria-invalid')
    })

    function valido(campo) {
      const v = campo.value.trim()
      if (!campo.required) return true
      if (!v) return false
      if (campo.name === 'telefone') return v.replace(/\D/g, '').length >= 10
      if (campo.type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
      return true
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const campos = [...form.querySelectorAll('input')]
      const ruins = campos.filter((c) => !valido(c))
      campos.forEach((c) => (ruins.includes(c) ? c.setAttribute('aria-invalid', 'true') : c.removeAttribute('aria-invalid')))
      if (ruins.length) {
        erro.hidden = false
        ruins[0].focus()
        return
      }
      erro.hidden = true
      const dados = Object.fromEntries(campos.map((c) => [c.name, c.value.trim()]))
      let msg = form.dataset.modelo.replace(/\{(\w+)\}/g, (_, k) => dados[k] || '')
      // linha do campo opcional vazio sai inteira
      msg = msg.split('\n').filter((l) => !/:\s*$/.test(l)).map((l) => l.trimEnd()).join('\n')
      ;(window.dataLayer = window.dataLayer || []).push({ event: 'proposta_enviada', origem: 'formulario' })
      if (typeof window.fbq === 'function') window.fbq('track', 'Lead', { origem: 'formulario' })
      window.open(`https://wa.me/${form.dataset.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
    })
  }
})()
