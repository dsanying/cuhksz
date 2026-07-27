(() => {
  const app = document.querySelector('#course-resource-app')
  if (!app) return

  document.body.classList.add('course-resources-page')
  const formatSize = (bytes) => {
    if (!bytes) return '—'
    const units = ['B', 'KB', 'MB', 'GB']
    const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    return `${(bytes / 1024 ** power).toFixed(power ? 1 : 0)} ${units[power]}`
  }
  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
  const formatDate = (value) => value ? new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value)) : '—'

  const loadManifest = async () => {
    const sources = [app.dataset.liveManifest, app.dataset.manifest].filter(Boolean)
    let lastError
    for (const source of sources) {
      try {
        const response = await fetch(source, { cache: 'no-store' })
        if (!response.ok) throw new Error(`索引加载失败：${response.status}`)
        return await response.json()
      } catch (error) {
        lastError = error
      }
    }
    throw lastError || new Error('索引加载失败')
  }

  loadManifest()
    .then((manifest) => {
      const params = new URLSearchParams(window.location.search)
      const state = { query: params.get('q') || '', category: 'all', selectedCourse: null, fileCategory: 'all' }
      const categoryMap = new Map(manifest.stats.categories.map((item) => [item.key, item]))

      const filteredCourses = () => manifest.courses.filter((course) => {
        const needle = state.query.trim().toLowerCase()
        const categoryMatch = state.category === 'all' || course.files.some((file) => file.category === state.category)
        const queryMatch = !needle || course.name.toLowerCase().includes(needle) || course.files.some((file) => file.name.toLowerCase().includes(needle))
        return categoryMatch && queryMatch
      })

      const renderCards = () => filteredCourses().map((course) => {
        const categorySummary = manifest.stats.categories
          .map(({ key, label }) => {
            const count = course.files.filter((file) => file.category === key).length
            return count ? `<span>${label} ${count}</span>` : ''
          }).join('')
        return `<button class="course-resource-card" type="button" data-course="${escapeHtml(course.name)}">
          <strong>${escapeHtml(course.name)}</strong>
          <span class="course-resource-card-meta">${course.fileCount} 个文件 · ${formatSize(course.totalSize)}</span>
          <span class="course-resource-card-categories">${categorySummary}</span>
        </button>`
      }).join('') || '<p class="course-resource-empty">没有匹配的课程或资料。</p>'

      const renderDetail = () => {
        const course = manifest.courses.find((item) => item.name === state.selectedCourse)
        if (!course) return ''
        const files = course.files.filter((file) => state.fileCategory === 'all' || file.category === state.fileCategory)
        const categoryButtons = ['all', ...manifest.stats.categories.map((item) => item.key)].map((key) => {
          const active = key === state.fileCategory ? ' is-active' : ''
          const label = key === 'all' ? '全部' : categoryMap.get(key).label
          const count = key === 'all' ? course.fileCount : course.files.filter((file) => file.category === key).length
          return `<button class="course-resource-filter${active}" type="button" data-file-category="${key}">${label} <b>${count}</b></button>`
        }).join('')
        const rows = files.map((file) => `<a class="course-resource-file" href="${escapeHtml(file.downloadUrl)}" target="_blank" rel="noopener">
          <span class="course-resource-file-type">${escapeHtml(file.extension.toUpperCase())}</span>
          <span class="course-resource-file-main"><b>${escapeHtml(file.name)}</b><small>${escapeHtml(file.parentPath || file.categoryLabel)}</small></span>
          <span class="course-resource-file-meta">${formatSize(file.size)}<small>${formatDate(file.updatedAt)}</small></span>
        </a>`).join('') || '<p class="course-resource-empty">该分类下暂未收录资料。</p>'
        const folderLink = course.folderUrl ? `<a class="course-resource-folder-link" href="${escapeHtml(course.folderUrl)}" target="_blank" rel="noopener">打开课程文件夹${course.folderPassword ? `（密码：${escapeHtml(course.folderPassword)}）` : ''}</a>` : ''
        return `<section class="course-resource-detail" aria-live="polite">
          <div class="course-resource-detail-head"><div><button class="course-resource-back" type="button">← 返回课程列表</button><h2>${escapeHtml(course.name)}</h2><p>${course.fileCount} 个文件 · 最近整理于 ${formatDate(course.latestUpdate)}</p></div>${folderLink}</div>
          <div class="course-resource-filters">${categoryButtons}</div>
          <div class="course-resource-files">${rows}</div>
        </section>`
      }

      const render = () => {
        const categoryButtons = [{ key: 'all', label: '全部资料', count: manifest.stats.fileCount }, ...manifest.stats.categories]
          .map(({ key, label, count }) => `<button class="course-resource-filter${key === state.category ? ' is-active' : ''}" type="button" data-category="${key}">${label} <b>${count}</b></button>`).join('')
        app.innerHTML = `<section class="course-resource-portal">
          <header class="course-resource-hero"><p>课程资源库</p><h2>按课程、资料类型或关键词查找</h2><span>资料文件托管于网盘；本站仅提供可检索的目录与下载入口。</span></header>
          <div class="course-resource-stats"><span><b>${manifest.stats.courseCount}</b> 门课程</span><span><b>${manifest.stats.fileCount}</b> 个文件</span><span><b>${formatSize(manifest.stats.totalSize)}</b> 已整理资料</span></div>
          <div class="course-resource-toolbar"><label><span>搜索</span><input id="course-resource-search" value="${escapeHtml(state.query)}" placeholder="课程代码、文件名或关键词"></label><a href="mailto:dsanying@qq.com?subject=课程资料提交">提交资料 / 反馈问题</a></div>
          <div class="course-resource-filters">${categoryButtons}</div>
          ${state.selectedCourse ? renderDetail() : `<p class="course-resource-result-count" aria-live="polite">已找到 ${filteredCourses().length} 门课程</p><div class="course-resource-grid">${renderCards()}</div>`}
          <p class="course-resource-note">资料仅供校内学习参考。若发现失效链接、内容问题或涉及权利，请发送邮件至 <a href="mailto:dsanying@qq.com">dsanying@qq.com</a>。</p>
        </section>`
        bind()
      }

      const bind = () => {
        app.querySelector('#course-resource-search')?.addEventListener('input', (event) => { state.query = event.target.value; state.selectedCourse = null; render() })
        app.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => { state.category = button.dataset.category; state.selectedCourse = null; render() }))
        app.querySelectorAll('[data-course]').forEach((button) => button.addEventListener('click', () => { state.selectedCourse = button.dataset.course; state.fileCategory = 'all'; render(); app.scrollIntoView({ behavior: 'smooth', block: 'start' }) }))
        app.querySelectorAll('[data-file-category]').forEach((button) => button.addEventListener('click', () => { state.fileCategory = button.dataset.fileCategory; render() }))
        app.querySelector('.course-resource-back')?.addEventListener('click', () => { state.selectedCourse = null; render() })
      }
      render()
    })
    .catch(() => { app.innerHTML = '<p class="course-resource-error">课程资料索引暂时无法加载，请稍后重试，或发送邮件至 <a href="mailto:dsanying@qq.com">dsanying@qq.com</a> 反馈。</p>' })
})()
