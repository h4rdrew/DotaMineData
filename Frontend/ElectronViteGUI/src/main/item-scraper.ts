import { JSDOM } from 'jsdom'
import type { ScrapedItem } from '../shared/contracts'

const LIQUIPEDIA_ORIGIN = 'https://liquipedia.net'
const rarities = new Set([
  'Common',
  'Uncommon',
  'Rare',
  'Mythical',
  'Legendary',
  'Ancient',
  'Immortal',
  'Arcana'
])

export async function fetchItemData(itemUrl: string): Promise<ScrapedItem> {
  const url = new URL(itemUrl)
  if (url.origin !== LIQUIPEDIA_ORIGIN || !url.pathname.startsWith('/dota2/')) {
    throw new Error('Apenas URLs de itens do Liquipedia Dota 2 são permitidas.')
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`Liquipedia respondeu com status ${response.status}.`)
  const document = new JSDOM(await response.text()).window.document
  const name = document.querySelector('.mw-page-title-main')?.textContent?.trim() ?? 'Unknown'
  const idText = document.querySelector('.infobox-image-text')?.textContent ?? ''
  const id = Number(idText.match(/ID:\s*(\d+)/)?.[1] ?? -1)
  const rarityTitle = [...document.querySelectorAll<HTMLAnchorElement>('a[title]')]
    .map((link) => link.title)
    .find((title) => rarities.has(title))
  const slotLabel = [...document.querySelectorAll('b')].find(
    (element) => element.textContent?.trim() === 'Slot:'
  )
  const slot = slotLabel?.nextSibling?.textContent?.trim() || undefined
  const hero =
    document.querySelector('.heroes-panel__hero-card__title a')?.getAttribute('title') ?? 'Unknown'
  // Restrict the lookup to the item's infobox. A page-wide selector also matches
  // Liquipedia's own logo, which now appears before the article content.
  const imagePath = document
    .querySelector<HTMLImageElement>(
      '.infobox-image-wrapper .infobox-image.lightmode img[src^="/commons/images/"], ' +
        '.infobox-image-wrapper .infobox-image img[src^="/commons/images/"]'
    )
    ?.getAttribute('src')
  let imageB64 = ''
  if (imagePath) {
    const imageResponse = await fetch(new URL(imagePath, LIQUIPEDIA_ORIGIN), {
      signal: AbortSignal.timeout(15_000)
    })
    if (!imageResponse.ok) throw new Error(`Falha ao baixar imagem: ${imageResponse.status}.`)
    const contentType = imageResponse.headers.get('content-type') ?? 'image/png'
    imageB64 = `data:${contentType};base64,${Buffer.from(await imageResponse.arrayBuffer()).toString('base64')}`
  }
  return { id, name, imageB64, rarity: rarityTitle ?? 'Unknown', hero, slot }
}
