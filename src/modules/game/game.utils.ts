// Utilidades puras del dominio game.
// Aquí pueden ir helpers de puntaje, randomización y formateos.
export const toGameLabel = (value: string): string => value

export const pickRandomItem = <T>(items: T[]): T => {
  const index = Math.floor(Math.random() * items.length)
  return items[index]
}

export const buildRoundCards = (colors: string[], cardsPerRound: number): string[] => {
  if (colors.length === 0 || cardsPerRound <= 0) {
    return []
  }

  const shuffled = [...colors]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = temp
  }

  return shuffled.slice(0, cardsPerRound)
}
