// 05 · Planos: abas das linhas de plano, bolinhas do carrossel do celular, o
// catálogo de aplicativos e o formulário de assinatura (os dois em <dialog> nativo:
// foco preso e Esc já vêm do navegador).
;(() => {
  const secao = document.getElementById('planos')
  if (!secao) return

  // ---------------------------------------------------------------- abas (padrão WAI-ARIA, com seta, Home e End)
  const abas = [...secao.querySelectorAll('[role="tab"]')]
  const selecionar = (aba, focar) => {
    for (const a of abas) {
      const ativa = a === aba
      a.setAttribute('aria-selected', String(ativa))
      a.tabIndex = ativa ? 0 : -1
      const painel = document.getElementById(a.getAttribute('aria-controls'))
      if (painel) painel.hidden = !ativa
    }
    const trilho = document.getElementById(aba.getAttribute('aria-controls'))?.querySelector('.planos__trilho')
    if (trilho) trilho.scrollLeft = 0
    if (focar) aba.focus()
    // a aba escolhida fica inteira à vista na fileira que rola de lado (celular)
    aba.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }
  secao.addEventListener('click', (e) => {
    const aba = e.target.closest('[role="tab"]')
    if (aba) selecionar(aba, false)
  })
  secao.querySelector('[role="tablist"]')?.addEventListener('keydown', (e) => {
    const i = abas.indexOf(document.activeElement)
    if (i < 0) return
    const alvo = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: abas.length - 1 }[e.key]
    if (alvo === undefined) return
    e.preventDefault()
    selecionar(abas[(alvo + abas.length) % abas.length], true)
  })

  // ---------------------------------------------------------------- bolinhas do carrossel (celular)
  if ('IntersectionObserver' in window) {
    for (const trilho of secao.querySelectorAll('.planos__trilho')) {
      const pontos = trilho.parentElement.querySelectorAll('.planos__pontos span')
      if (!pontos.length) continue
      const cards = [...trilho.children]
      const io = new IntersectionObserver(
        (entradas) => {
          for (const e of entradas) {
            if (!e.isIntersecting) continue
            const n = cards.indexOf(e.target)
            pontos.forEach((p, j) => p.classList.toggle('ativo', j === n))
          }
        },
        { root: trilho, threshold: 0.6 },
      )
      cards.forEach((c) => io.observe(c))
    }
  }

  // ---------------------------------------------------------------- janelas: catálogo e assinatura
  const catalogo = document.getElementById('catalogo')
  const assinar = document.getElementById('assinar')
  if (!catalogo || typeof catalogo.showModal !== 'function') return
  let origem = null
  const abrir = (janela, botao) => {
    origem = botao
    janela.showModal()
    janela.scrollTop = 0
  }
  for (const janela of [catalogo, assinar]) {
    if (!janela) continue
    // no fundo escurecido, só fecha se o clique começou nele: quem arrasta pra
    // selecionar o texto de um campo e solta fora não perde o formulário
    let noFundo = false
    janela.addEventListener('pointerdown', (e) => {
      noFundo = e.target === janela
    })
    janela.addEventListener('click', (e) => {
      if (e.target.closest('[data-fechar]') || (noFundo && e.target === janela)) janela.close()
    })
    janela.addEventListener('close', () => {
      if (origem && document.contains(origem)) origem.focus({ preventScroll: true })
      origem = null
    })
  }
  document.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-catalogo]')
    if (botao) abrir(catalogo, botao)
  })

  // ---------------------------------------------------------------- assinar: formulário antes do WhatsApp
  // O botão do card é link do WhatsApp (sem JS, abre com a mensagem do plano). Aqui
  // ele abre o formulário, e nome, telefone e e-mail entram na mensagem que a pessoa
  // manda pra Target (mensagens.cadastroPlano no config, escrita na voz dela).
  const form = assinar?.querySelector('form')
  if (!form) return
  const campos = { nome: form.elements.nome, telefone: form.elements.telefone, email: form.elements.email }
  const ordem = Object.values(campos)
  let plano = null
  const rastrear = (evento, pixel) => {
    ;(window.dataLayer = window.dataLayer || []).push({ event: evento, origem: plano.origem })
    if (pixel && typeof window.fbq === 'function') window.fbq('track', pixel, { origem: plano.origem })
  }

  // telefone: só os dígitos, sem o 55 do país nem zero na frente, e a máscara (18) 99999-9999
  const digitos = (v) => {
    let d = v.replace(/\D/g, '').replace(/^0+/, '')
    if (d.length > 11 && d.startsWith('55')) d = d.slice(2)
    return d.slice(0, 11)
  }
  const mascara = (d) => {
    if (d.length < 3) return d && `(${d}`
    const resto = d.slice(2)
    if (resto.length <= 4) return `(${d.slice(0, 2)}) ${resto}`
    const corte = resto.length > 8 ? 5 : 4
    return `(${d.slice(0, 2)}) ${resto.slice(0, corte)}-${resto.slice(corte)}`
  }
  campos.telefone.addEventListener('input', () => {
    const t = campos.telefone
    // mexendo no meio do número, a máscara espera o campo perder o foco
    if (t.selectionStart === t.value.length) t.value = mascara(digitos(t.value))
  })
  campos.telefone.addEventListener('blur', () => {
    campos.telefone.value = mascara(digitos(campos.telefone.value))
  })

  const errado = {
    nome: () => campos.nome.value.trim().length < 2,
    telefone: () => !/^[1-9]{2}\d{8,9}$/.test(digitos(campos.telefone.value)),
    email: () => !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(campos.email.value.trim()),
  }
  // o aviso só entra na descrição do campo quando aparece (leitor de tela lê aviso escondido)
  const marcar = (nome, comErro) => {
    const campo = campos[nome]
    const aviso = document.getElementById(`${campo.id}-erro`)
    aviso.hidden = !comErro
    if (comErro) {
      campo.setAttribute('aria-invalid', 'true')
      campo.setAttribute('aria-describedby', aviso.id)
    } else {
      campo.removeAttribute('aria-invalid')
      campo.removeAttribute('aria-describedby')
    }
    return comErro
  }
  // depois da primeira tentativa, o aviso some assim que o campo fica certo
  let tentou = false
  form.addEventListener('input', (e) => {
    const nome = Object.keys(campos).find((k) => campos[k] === e.target)
    if (tentou && nome) marcar(nome, errado[nome]())
  })
  // Enter no nome e no telefone passa pro próximo campo em vez de enviar
  form.addEventListener('keydown', (e) => {
    const i = ordem.indexOf(e.target)
    if (e.key !== 'Enter' || e.isComposing || i < 0 || i === ordem.length - 1) return
    e.preventDefault()
    ordem[i + 1].focus()
  })

  for (const a of secao.querySelectorAll('a[data-assinar]')) a.setAttribute('aria-haspopup', 'dialog')
  secao.addEventListener('click', (e) => {
    const botao = e.target.closest('a[data-assinar]')
    if (!botao) return
    // o clique só abre o formulário: o evento de lead sai no envio
    e.preventDefault()
    const { planoMega: mega, planoPreco: preco, planoLinha: linha, planoTexto: texto, zap } = botao.dataset
    plano = { mega, preco, linha, texto, origem: zap }
    for (const el of assinar.querySelectorAll('[data-plano]')) el.textContent = plano[el.dataset.plano]
    tentou = false
    for (const k of Object.keys(campos)) marcar(k, false)
    abrir(assinar, botao)
    campos.nome.focus()
    rastrear('plano_formulario')
  })

  const preencher = (modelo, dados) => modelo.replace(/\{(\w+)\}/g, (marca, chave) => dados[chave] ?? marca)
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    tentou = true
    const comErro = Object.keys(campos).filter((k) => marcar(k, errado[k]()))
    if (comErro.length) {
      campos[comErro[0]].focus()
      return
    }
    const numero = form.dataset.numero
    // sem espaço sobrando no fim das linhas nem linha vazia a mais, venha de onde vier
    const limpar = (t) => t.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim()
    const mensagem = limpar(preencher(form.dataset.modelo, {
      numero,
      nome: campos.nome.value.trim().replace(/\s+/g, ' '),
      telefone: mascara(digitos(campos.telefone.value)),
      email: campos.email.value.trim(),
      plano: plano.texto,
      preco: plano.preco,
    }))
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
    rastrear('whatsapp_plano', 'Lead')
    // nova aba, como os outros botões de WhatsApp; se o navegador bloquear, vai na mesma
    const aba = window.open(url, '_blank')
    if (aba) aba.opener = null
    else location.href = url
    assinar.close()
  })
})()
