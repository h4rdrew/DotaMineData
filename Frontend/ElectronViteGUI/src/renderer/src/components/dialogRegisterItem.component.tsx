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
import { Hero, heroes } from '@renderer/utils/constantes'
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

  const handleSelectChange =
    (campo: keyof FormData) =>
    (e: { target: { value: unknown } }): void => {
      setForm({
        ...form,
        [campo]: e.target.value
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
              onChange={handleSelectChange('rarity')}
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
              onChange={handleSelectChange('hero')}
            >
              {heroes
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((hero) => (
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
