import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControl,
  InputLabel,
  MenuItem,
  Select
} from '@mui/material'
import React, { useState } from 'react'

interface DialogRegisterItemProps {
  open: boolean
  onClose: () => void
}

type FormData = {
  id: number | ''
  name: string
  url: string
  owned: boolean
  imageB64?: string
  rarity: string
  hero: number
}

interface Hero {
  id: number
  name: string
}

const heroes: Hero[] = [
  { id: 1, name: 'Anti-Mage' },
  { id: 2, name: 'Axe' },
  { id: 3, name: 'Bane' },
  { id: 4, name: 'Bloodseeker' },
  { id: 5, name: 'Crystal Maiden' },
  { id: 6, name: 'Drow Ranger' },
  { id: 7, name: 'Earthshaker' },
  { id: 8, name: 'Juggernaut' },
  { id: 9, name: 'Mirana' },
  { id: 10, name: 'Morphling' },
  { id: 11, name: 'Shadow Fiend' },
  { id: 12, name: 'Phantom Lancer' },
  { id: 13, name: 'Puck' },
  { id: 14, name: 'Pudge' },
  { id: 15, name: 'Razor' },
  { id: 16, name: 'Sand King' },
  { id: 17, name: 'Storm Spirit' },
  { id: 18, name: 'Sven' },
  { id: 19, name: 'Tiny' },
  { id: 20, name: 'Vengeful Spirit' },
  { id: 21, name: 'Windranger' },
  { id: 22, name: 'Zeus' },
  { id: 23, name: 'Kunkka' },
  { id: 25, name: 'Lina' },
  { id: 26, name: 'Lion' },
  { id: 27, name: 'Shadow Shaman' },
  { id: 28, name: 'Slardar' },
  { id: 29, name: 'Tidehunter' },
  { id: 30, name: 'Witch Doctor' },
  { id: 31, name: 'Lich' },
  { id: 32, name: 'Riki' },
  { id: 33, name: 'Enigma' },
  { id: 34, name: 'Tinker' },
  { id: 35, name: 'Sniper' },
  { id: 36, name: 'Necrophos' },
  { id: 37, name: 'Warlock' },
  { id: 38, name: 'Beastmaster' },
  { id: 39, name: 'Queen of Pain' },
  { id: 40, name: 'Venomancer' },
  { id: 41, name: 'Faceless Void' },
  { id: 42, name: 'Wraith King' },
  { id: 43, name: 'Death Prophet' },
  { id: 44, name: 'Phantom Assassin' },
  { id: 45, name: 'Pugna' },
  { id: 46, name: 'Templar Assassin' },
  { id: 47, name: 'Viper' },
  { id: 48, name: 'Luna' },
  { id: 49, name: 'Dragon Knight' },
  { id: 50, name: 'Dazzle' },
  { id: 51, name: 'Clockwerk' },
  { id: 52, name: 'Leshrac' },
  { id: 53, name: "Nature's Prophet" },
  { id: 54, name: 'Lifestealer' },
  { id: 55, name: 'Dark Seer' },
  { id: 56, name: 'Clinkz' },
  { id: 57, name: 'Omniknight' },
  { id: 58, name: 'Enchantress' },
  { id: 59, name: 'Huskar' },
  { id: 60, name: 'Night Stalker' },
  { id: 61, name: 'Broodmother' },
  { id: 62, name: 'Bounty Hunter' },
  { id: 63, name: 'Weaver' },
  { id: 64, name: 'Jakiro' },
  { id: 65, name: 'Batrider' },
  { id: 66, name: 'Chen' },
  { id: 67, name: 'Spectre' },
  { id: 68, name: 'Ancient Apparition' },
  { id: 69, name: 'Doom' },
  { id: 70, name: 'Ursa' },
  { id: 71, name: 'Spirit Breaker' },
  { id: 72, name: 'Gyrocopter' },
  { id: 73, name: 'Alchemist' },
  { id: 74, name: 'Invoker' },
  { id: 75, name: 'Silencer' },
  { id: 76, name: 'Outworld Destroyer' },
  { id: 77, name: 'Lycan' },
  { id: 78, name: 'Brewmaster' },
  { id: 79, name: 'Shadow Demon' },
  { id: 80, name: 'Lone Druid' },
  { id: 81, name: 'Chaos Knight' },
  { id: 82, name: 'Meepo' },
  { id: 83, name: 'Treant Protector' },
  { id: 84, name: 'Ogre Magi' },
  { id: 85, name: 'Undying' },
  { id: 86, name: 'Rubick' },
  { id: 87, name: 'Disruptor' },
  { id: 88, name: 'Nyx Assassin' },
  { id: 89, name: 'Naga Siren' },
  { id: 90, name: 'Keeper of the Light' },
  { id: 91, name: 'Io' },
  { id: 92, name: 'Visage' },
  { id: 93, name: 'Slark' },
  { id: 94, name: 'Medusa' },
  { id: 95, name: 'Troll Warlord' },
  { id: 96, name: 'Centaur Warrunner' },
  { id: 97, name: 'Magnus' },
  { id: 98, name: 'Timbersaw' },
  { id: 99, name: 'Bristleback' },
  { id: 100, name: 'Tusk' },
  { id: 101, name: 'Skywrath Mage' },
  { id: 102, name: 'Abaddon' },
  { id: 103, name: 'Elder Titan' },
  { id: 104, name: 'Legion Commander' },
  { id: 105, name: 'Techies' },
  { id: 106, name: 'Ember Spirit' },
  { id: 107, name: 'Earth Spirit' },
  { id: 108, name: 'Underlord' },
  { id: 109, name: 'Terrorblade' },
  { id: 110, name: 'Phoenix' },
  { id: 111, name: 'Oracle' },
  { id: 112, name: 'Winter Wyvern' },
  { id: 113, name: 'Arc Warden' },
  { id: 114, name: 'Monkey King' },
  { id: 119, name: 'Dark Willow' },
  { id: 120, name: 'Pangolier' },
  { id: 121, name: 'Grimstroke' },
  { id: 123, name: 'Hoodwink' },
  { id: 126, name: 'Void Spirit' },
  { id: 128, name: 'Snapfire' },
  { id: 129, name: 'Mars' },
  { id: 131, name: 'Ringmaster' },
  { id: 135, name: 'Dawnbreaker' },
  { id: 136, name: 'Marci' },
  { id: 137, name: 'Primal Beast' },
  { id: 138, name: 'Muerta' },
  { id: 145, name: 'Kez' },
  { id: 155, name: 'Largo' }
]

export default function AlertDialog({ open, onClose }: DialogRegisterItemProps): JSX.Element {
  const [form, setForm] = useState<FormData>({
    id: '',
    name: '',
    url: '',
    owned: false,
    imageB64: '',
    rarity: '',
    hero: 0
  })

  const handleChangeForm =
    (campo: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const value = e.target.value

      setForm({
        ...form,
        [campo]: campo === 'owned' ? e.target.checked : value
      })
    }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    try {
      window.api
        .addNewItem(
          Number(form.id),
          String(form.name),
          Boolean(form.owned),
          Number(getRarityId(form.rarity)),
          Number(form.hero)
        )
        .catch((error) => {
          console.error('Erro ao adicionar novo item:', error)
        })

      // Salva a imagem (base64) localmente como PNG (E:\\DotaMine\\img)
      if (form.imageB64) {
        const fileName = `${form.id}.png`

        window.api.saveBase64Image(form.imageB64, fileName).catch((err) => {
          console.error('Erro ao salvar imagem', err)
        })
      }
    } catch (error) {
      console.error('Erro ao processar o formulário:', error)
    }
  }

  function buscaDados(): void {
    if (!form.url) {
      return
    }

    window.api
      .fetchItemData(form.url)
      .then((data) => {
        setForm({
          ...form,
          id: data.id,
          name: data.name,
          imageB64: data.imageB64,
          rarity: data.rarity,
          hero: getHeroByName(data.hero).id
        })
      })
      .catch((error) => {
        console.error('Erro ao buscar dados do item:', error)
      })
  }

  function getRarityId(rarity: string): number {
    const normalizedRarity = rarity.trim().toLowerCase()

    switch (normalizedRarity) {
      case 'common':
        return 1
      case 'uncommon':
        return 2
      case 'rare':
        return 3
      case 'mythical':
        return 4
      case 'legendary':
        return 5
      case 'ancient':
        return 6
      case 'immortal':
        return 7
      case 'arcana':
        return 8
      default:
        return 0
    }
  }

  function getRarityNames(): string[] {
    return ['Common', 'Uncommon', 'Rare', 'Mythical', 'Legendary', 'Ancient', 'Immortal', 'Arcana']
  }

  function getHeroByName(heroName: string): Hero {
    const hero = heroes.find((h) => h.name.toLowerCase() === heroName.trim().toLowerCase())
    return hero ? hero : { id: 0, name: 'Unknown' }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{'Register a new item'}</DialogTitle>
      <DialogContent>
        <form onSubmit={handleSubmit} id="register-item-form">
          {/* ITEM IMAGE 600x400 */}
          <img src={form.imageB64} alt="Item" height="240" />

          {/* URL */}
          <TextField
            autoFocus
            margin="dense"
            label="URL do item no liquipedia"
            type="text"
            fullWidth
            onBlur={() => buscaDados()}
            value={form.url}
            onChange={handleChangeForm('url')}
          ></TextField>

          {/* ITEM ID */}
          <TextField
            autoFocus
            required
            margin="dense"
            label="Item ID"
            type="text"
            inputMode="numeric"
            value={form.id}
            onChange={handleChangeForm('id')}
          ></TextField>

          {/* ITEM NAME */}
          <TextField
            autoFocus
            required
            margin="dense"
            label="Item name"
            type="text"
            fullWidth
            value={form.name}
            onChange={handleChangeForm('name')}
          ></TextField>

          {/* ITEM RARITY */}
          <FormControl fullWidth>
            <InputLabel id="rarity-select-label">Rarity</InputLabel>
            <Select
              labelId="rarity-select-label"
              id="rarity-select"
              value={form.rarity}
              label="Rarity"
              onChange={handleChangeForm('rarity')}
            >
              {getRarityNames().map((rarity) => (
                <MenuItem key={rarity} value={rarity}>
                  {rarity}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* HERO NAME */}
          <FormControl fullWidth>
            <InputLabel id="hero-select-label">Hero</InputLabel>
            <Select
              labelId="hero-select-label"
              id="hero-select"
              value={form.hero}
              label="Hero"
              onChange={handleChangeForm('hero')}
            >
              {/* Lista simplificada de heróis para exemplo */}
              {heroes.map((hero) => (
                <MenuItem key={hero.name} value={hero.id}>
                  {hero.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* OWNED */}
          <div>
            <Checkbox checked={form.owned} onChange={handleChangeForm('owned')} />
            Owned
          </div>
        </form>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button autoFocus type="submit" form="register-item-form">
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
