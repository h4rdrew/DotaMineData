import { Heroes } from "@renderer/interfaces"

  export function pegaHeroName(hero: Heroes): string {
    if (hero.PersonaName === null) return hero.Name
    return `${hero.Name} (${hero.PersonaName})`
  }
