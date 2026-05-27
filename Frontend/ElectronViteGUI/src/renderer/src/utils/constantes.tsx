// Tuple of rarity names and colors
export const rarity: [string, string][] = [
  ['Common', '#B0C3D9'],
  ['Uncommon', '#5E98D9'],
  ['Rare', '#4B69FF'],
  ['Mythical', '#8847FF'],
  ['Legendary', '#D32CE6'],
  ['Ancient', '#EB4B4B'],
  ['Immortal', '#FCD116'],
  ['Arcana', '#ADE55C']
]

export function getRarityNames(): string[] {
  return rarity.map(([name]) => name)
}

export function getRarityColor(rarityName: string): string {
  const rarityEntry = rarity.find(
    ([name]) => name.toLowerCase() === rarityName.trim().toLowerCase()
  )
  return rarityEntry ? rarityEntry[1] : '#FFFFFF' // Default to white if not found
}
