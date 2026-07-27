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
