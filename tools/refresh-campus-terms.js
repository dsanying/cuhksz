#!/usr/bin/env node

const fs = require('node:fs/promises')
const path = require('node:path')

const sourceUrl = 'https://ablu6669.github.io/zzh-campus-guide/'
const outputPath = path.resolve(__dirname, '../source/data/campus-terms.json')

const decode = (value = '') => value
  .replace(/<[^>]*>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ')
  .trim()

const field = (html, className, tagName = '(?:span|div)') => {
  const match = html.match(new RegExp(`<${tagName} class="${className}"[^>]*>([\\s\\S]*?)<\\/${tagName}>`))
  return decode(match?.[1])
}

async function main() {
  const response = await fetch(sourceUrl)
  if (!response.ok) throw new Error(`无法获取术语来源：${response.status}`)

  const html = await response.text()
  const start = html.indexOf('<div class="section-title" data-i18n="abbr_section_abbreviations"')
  const end = html.indexOf('</template>', start)
  if (start < 0 || end < 0) throw new Error('无法识别术语数据区块')

  const section = html.slice(start, end)
  const cards = [...section.matchAll(/<div class="(abbr|phrase)-card"[^>]*>/g)]
  const terms = cards.map((card, index) => {
    const cardHtml = section.slice(card.index, cards[index + 1]?.index)
    if (card[1] === 'abbr') {
      return {
        type: 'abbreviation',
        english: field(cardHtml, 'abbr-key', 'span'),
        fullName: field(cardHtml, 'abbr-full', 'span'),
        chinese: field(cardHtml, 'abbr-zh')
      }
    }
    return {
      type: 'term',
      english: field(cardHtml, 'phrase-key'),
      fullName: '',
      chinese: field(cardHtml, 'phrase-zh')
    }
  }).filter((term) => term.english && term.chinese)

  if (terms.length < 100) throw new Error(`术语数量异常：${terms.length}`)

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify({ source: sourceUrl, updatedAt: new Date().toISOString(), terms }, null, 2)}\n`)
  console.log(`已更新 ${terms.length} 条校园术语：${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
