(() => {
  const app = document.querySelector('#course-resource-app')
  if (!app) return

  document.body.classList.add('course-resources-page')
  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])

  fetch(app.dataset.manifest, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error('课程目录加载失败')
      return response.json()
    })
    .then((manifest) => {
      const state = { query: '' }
      const sharedCount = manifest.courses.filter((course) => course.url).length

      const filteredCourses = () => {
        const query = state.query.trim().toLowerCase()
        return manifest.courses.filter((course) => !query || course.code.toLowerCase().includes(query) || (course.aliases || []).some((alias) => alias.toLowerCase().includes(query)))
      }

      const renderCards = () => filteredCourses().map((course) => {
        const name = escapeHtml(course.code)
        const description = course.url ? '打开阿里云盘课程文件夹' : '分享链接待补齐'
        const content = `<strong>${name}</strong><span>${description}</span>`
        return course.url
          ? `<a class="course-resource-card" href="${escapeHtml(course.url)}" target="_blank" rel="noopener">${content}<b>打开 →</b></a>`
          : `<div class="course-resource-card is-pending" aria-label="${name} 分享链接待补齐">${content}<b>待补齐</b></div>`
      }).join('') || '<p class="course-resource-empty">没有匹配的课程。请输入课程代码，例如 CSC3001。</p>'

      const render = () => {
        const courses = filteredCourses()
        app.innerHTML = `<section class="course-resource-portal">
          <header class="course-resource-hero">
            <p>课程资源库</p>
            <h2>按课程代码查找资料</h2>
            <span>每门课程对应一个阿里云盘共享文件夹；点击课程卡片即可打开。</span>
          </header>
          <div class="course-resource-stats">
            <span><b>${manifest.courses.length}</b> 门课程</span>
            <span><b>${sharedCount}</b> 门已开通分享</span>
            <span><b>阿里云盘</b> 资料托管</span>
          </div>
          <div class="course-resource-toolbar">
            <label><span>搜索</span><input id="course-resource-search" value="${escapeHtml(state.query)}" placeholder="输入课程代码，如 CSC3001" autocomplete="off"></label>
            <a href="mailto:dsanying@qq.com?subject=课程资料提交">提交资料 / 反馈问题</a>
          </div>
          <p class="course-resource-result-count">${state.query.trim() ? `已找到 ${courses.length} 门课程` : '全部课程'}</p>
          <div class="course-resource-grid">${renderCards()}</div>
          <p class="course-resource-note">资料仅供校内学习参考。若发现失效链接、内容问题或涉及权利，请发送邮件至 <a href="mailto:dsanying@qq.com">dsanying@qq.com</a>。</p>
        </section>`
        app.querySelector('#course-resource-search').addEventListener('input', (event) => {
          state.query = event.target.value
          render()
        })
      }
      render()
    })
    .catch(() => {
      app.innerHTML = '<p class="course-resource-error">课程目录暂时无法加载，请稍后重试，或发送邮件至 <a href="mailto:dsanying@qq.com">dsanying@qq.com</a> 反馈。</p>'
    })
})()
