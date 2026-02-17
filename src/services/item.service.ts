import { redis } from '../config/redis'

const ITEM_KEY_PREFIX = 'item-'
const ITEM_TTL_SECONDS = 60

const getItemNumber = (itemKey: string): number | null => {
  const match = itemKey.match(/^item-(\d+)$/)

  if (!match) {
    return null
  }

  return Number.parseInt(match[1], 10)
}

export const createNextItem = async () => {
  const itemKeys = await redis.keys(`${ITEM_KEY_PREFIX}*`)

  const numberedItems = itemKeys
    .map((itemKey) => ({
      key: itemKey,
      number: getItemNumber(itemKey),
    }))
    .filter(
      (item): item is { key: string; number: number } => item.number !== null,
    )
    .sort((a, b) => b.number - a.number)

  const lastCreatedItem = numberedItems.length > 0 ? numberedItems[0].key : null
  const nextItemNumber = numberedItems.length > 0 ? numberedItems[0].number + 1 : 1
  const newItem = `item-${nextItemNumber}`

  await redis.set(newItem, newItem, { ex: ITEM_TTL_SECONDS })

  return {
    createdItem: newItem,
    lastCreatedItem,
    ttlSeconds: ITEM_TTL_SECONDS,
    existingItemsCount: numberedItems.length,
  }
}
