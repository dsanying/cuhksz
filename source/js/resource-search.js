(() => {
  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
  const normalise = (value) => String(value || '').toLocaleLowerCase().trim()

  window.resourceSearch = {
    escapeHtml,
    normalise,
    toolbar: ({ id, value = '', placeholder, label = '搜索', action = '' }) => `<div class="resource-search"><label class="resource-search__field" for="${id}"><span>${label}</span><input id="${id}" type="search" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" autocomplete="off"></label>${action}</div>`,
    bind: ({ root, input, onQuery }) => {
      const field = root.querySelector(input)
      field?.addEventListener('input', () => onQuery(field.value))
    }
  }
})()
