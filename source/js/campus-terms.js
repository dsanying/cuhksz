(() => {
  const app = document.querySelector('#campus-terms-app')
  if (!app) return

  const fallback = {
    escapeHtml: (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]),
    normalise: (value) => String(value || '').toLocaleLowerCase().trim(),
    toolbar: ({ id, placeholder }) => `<div class="resource-search"><label class="resource-search__field" for="${id}"><span>搜索</span><input id="${id}" type="search" placeholder="${placeholder}" autocomplete="off"></label></div>`,
    bind: ({ root, input, onQuery }) => root.querySelector(input)?.addEventListener('input', (event) => onQuery(event.target.value))
  }
  const { escapeHtml, normalise, toolbar, bind } = window.resourceSearch || fallback
  const perPage = 10

  fetch(app.dataset.source)
    .then((response) => response.ok ? response.json() : Promise.reject(new Error('无法加载术语数据')))
    .then((data) => {
      const terms = data.terms || []
      let query = ''
      let type = 'all'
      let page = 1
      const card = (term) => `<article class="campus-term"><span class="campus-term__english">${escapeHtml(term.english)}</span>${term.fullName ? `<span class="campus-term__full">${escapeHtml(term.fullName)}</span>` : ''}<span class="campus-term__chinese">${escapeHtml(term.chinese)}</span></article>`
      const pageLinks = (pages) => {
        const visible = new Set([1, pages])
        for (let current = Math.max(1, page - 2); current <= Math.min(pages, page + 2); current += 1) visible.add(current)
        return [...visible].sort((left, right) => left - right).map((current, index, list) => `${index && current - list[index - 1] > 1 ? '<span aria-hidden="true">…</span>' : ''}<button type="button" data-page="${current}" class="${page === current ? 'is-active' : ''}" ${page === current ? 'aria-current="page"' : ''}>${current}</button>`).join('')
      }
      const render = () => {
        const result = terms.filter((term) => (type === 'all' || term.type === type) && (!query || normalise([term.english, term.fullName, term.chinese].join(' ')).includes(query)))
        const pages = Math.max(1, Math.ceil(result.length / perPage))
        page = Math.min(page, pages)
        const start = (page - 1) * perPage
        const pageTerms = result.slice(start, start + perPage)
        const pagination = pages > 1 ? `<nav class="campus-terms-pagination" aria-label="术语分页"><button type="button" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>上一页</button>${pageLinks(pages)}<button type="button" data-page="${page + 1}" ${page === pages ? 'disabled' : ''}>下一页</button></nav>` : ''
        app.innerHTML = `${toolbar({ id: 'campus-terms-search', placeholder: '搜索缩写、英文或中文，例如 CGPA、Library、图书馆' })}<p class="resource-search__count">共 ${result.length} 条 · 第 ${page}/${pages} 页</p><div class="campus-terms-filters" aria-label="术语类型"><button class="campus-terms-filter ${type === 'all' ? 'is-active' : ''}" data-type="all" type="button">全部</button><button class="campus-terms-filter ${type === 'abbreviation' ? 'is-active' : ''}" data-type="abbreviation" type="button">英文缩写</button><button class="campus-terms-filter ${type === 'term' ? 'is-active' : ''}" data-type="term" type="button">常用术语</button></div><div class="campus-terms-grid">${pageTerms.length ? pageTerms.map(card).join('') : '<p class="resource-search__empty">未找到匹配术语，请换一个关键词。</p>'}</div>${pagination}`
        bind({ root: app, input: '#campus-terms-search', onQuery: (value) => { query = normalise(value); page = 1; render() } })
        app.querySelectorAll('.campus-terms-filter').forEach((button) => button.addEventListener('click', () => { type = button.dataset.type; page = 1; render() }))
        app.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => { page = Number(button.dataset.page); render(); app.scrollIntoView({ behavior: 'smooth', block: 'start' }) }))
      }
      render()
    })
    .catch(() => {})
})()
