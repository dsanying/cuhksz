// 首页文章卡片整卡跳转；卡片内的分类等独立链接保持原有行为。
document.addEventListener('click', event => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

  const card = event.target.closest('#recent-posts .recent-post-item:not(.ads-wrap)')
  if (!card) return

  const interactive = event.target.closest('a, button, input, select, textarea, label')
  if (interactive && !interactive.matches('.article-title')) return

  const articleLink = card.querySelector('.article-title[href]')
  if (articleLink) window.location.assign(articleLink.href)
})

// 首页公告与分类筛选：只影响当前页的文章卡片，不改动归档或分类页。
document.addEventListener('DOMContentLoaded', () => {
  const recentPosts = document.querySelector('#recent-posts')
  if (!recentPosts) return

  const cards = [...recentPosts.querySelectorAll('.recent-post-item:not(.ads-wrap)')]
  const categories = new Map()

  cards.forEach(card => {
    card.querySelectorAll('.article-meta__categories').forEach(link => {
      categories.set(link.href, link.textContent.trim())
    })
  })

  if (cards.length) {
    const announcement = document.createElement('div')
    announcement.className = 'index-announcement'
    announcement.textContent = '资料与攻略持续整理；如发现失效链接或内容问题，欢迎通过“关于”页反馈。'
    recentPosts.prepend(announcement)
  }

  if (!categories.size) return

  const filters = document.createElement('div')
  filters.className = 'index-category-filter'
  filters.setAttribute('aria-label', '按分类筛选文章')

  const addFilter = (label, href = '') => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.dataset.categoryHref = href
    filters.append(button)
  }

  addFilter('全部')
  categories.forEach((label, href) => addFilter(label, href))

  filters.addEventListener('click', event => {
    const button = event.target.closest('button[data-category-href]')
    if (!button) return

    const { categoryHref } = button.dataset
    filters.querySelectorAll('button').forEach(item => {
      item.classList.toggle('is-active', item === button)
    })
    cards.forEach(card => {
      const matches = !categoryHref || [...card.querySelectorAll('.article-meta__categories')]
        .some(link => link.href === categoryHref)
      card.hidden = !matches
    })
  })

  filters.querySelector('button').classList.add('is-active')
  recentPosts.insertBefore(filters, recentPosts.querySelector('.recent-post-items'))
})
