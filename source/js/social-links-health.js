(() => {
  const link = document.querySelector('.flink-list-item a[href="https://ai.gitfetch.dev/"]')
  if (!link || !window.fetch) return

  const description = link.querySelector('.flink-item-desc')
  if (!description) return

  const indicator = document.createElement('span')
  indicator.className = 'website-health'
  indicator.textContent = '连通性检测中'
  description.append(indicator)

  const controller = window.AbortController ? new AbortController() : null
  const timeout = controller ? window.setTimeout(() => controller.abort(), 5000) : null
  const startedAt = performance.now()

  window.fetch(link.href, { cache: 'no-store', mode: 'no-cors', signal: controller?.signal })
    .then(() => { indicator.textContent = `约 ${Math.round(performance.now() - startedAt)} ms` })
    .catch(() => { indicator.classList.add('is-unavailable'); indicator.textContent = '暂无法检测' })
    .finally(() => { if (timeout) window.clearTimeout(timeout) })
})()
