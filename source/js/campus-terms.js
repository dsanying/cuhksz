(() => {
  const app = document.querySelector('#campus-terms-app')
  if (!app) return

  const { escapeHtml, normalise, toolbar, bind } = window.resourceSearch

  fetch(app.dataset.source)
    .then((response) => response.ok ? response.json() : Promise.reject(new Error('无法加载术语数据')))
    .then((data) => {
      const terms = data.terms || []
      let query = ''
      let type = 'all'

      app.innerHTML = `
        <section class="campus-terms-hero"><p class="campus-terms-kicker">CUHK-Shenzhen glossary</p><h2>常用中英文对照表</h2><p>按英文缩写、英文全称或中文名称快速查找校园术语。</p></section>
        ${toolbar({ id: 'campus-terms-search', placeholder: '搜索缩写、英文或中文，例如 CGPA、Library、图书馆' })}
        <p class="resource-search__count campus-terms-count"></p>
        <div class="campus-terms-filters" aria-label="术语类型"><button class="campus-terms-filter is-active" data-type="all" type="button">全部</button><button class="campus-terms-filter" data-type="abbreviation" type="button">英文缩写</button><button class="campus-terms-filter" data-type="term" type="button">常用术语</button></div>
        <div class="campus-terms-grid"></div>
        <p class="campus-terms-source">术语收录参考 <a href="${escapeHtml(data.source)}" target="_blank" rel="noopener">校园新生指南公开数据</a>，并补充 <a href="${escapeHtml(data.officialSource)}" target="_blank" rel="noopener">港中深官网组织架构</a>；本站仅展示英文与中文对照。</p>`

      const count = app.querySelector('.campus-terms-count')
      const grid = app.querySelector('.campus-terms-grid')
      const render = () => {
        const result = terms.filter((term) => {
          const matchesType = type === 'all' || term.type === type
          const searchable = normalise([term.english, term.fullName, term.chinese].join(' '))
          return matchesType && (!query || searchable.includes(query))
        })
        count.textContent = `共 ${result.length} 条`
        grid.innerHTML = result.length ? result.map((term) => `<article class="campus-term"><span class="campus-term__english">${escapeHtml(term.english)}</span>${term.fullName ? `<span class="campus-term__full">${escapeHtml(term.fullName)}</span>` : ''}<span class="campus-term__chinese">${escapeHtml(term.chinese)}</span></article>`).join('') : '<p class="resource-search__empty">未找到匹配术语，请换一个关键词。</p>'
      }

      bind({ root: app, input: '#campus-terms-search', onQuery: (value) => { query = normalise(value); render() } })
      app.querySelectorAll('.campus-terms-filter').forEach((button) => button.addEventListener('click', () => {
        type = button.dataset.type
        app.querySelectorAll('.campus-terms-filter').forEach((item) => item.classList.toggle('is-active', item === button))
        render()
      }))
      render()
    })
    .catch(() => {})
})()
