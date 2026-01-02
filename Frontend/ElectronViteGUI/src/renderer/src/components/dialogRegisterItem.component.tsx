import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox
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
}

export default function AlertDialog({ open, onClose }: DialogRegisterItemProps): JSX.Element {
  const [form, setForm] = useState<FormData>({
    id: '',
    name: '',
    url: '',
    owned: false,
    imageB64: ''
  })

  const handleChange =
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
        .addNewItem(Number(form.id), String(form.name), Boolean(form.owned))
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
    } finally {
      onClose()
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
          imageB64: data.imageB64
        })
      })
      .catch((error) => {
        console.error('Erro ao buscar dados do item:', error)
      })
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
          {/* IMAGE 600x400 */}
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
            onChange={handleChange('url')}
          ></TextField>

          {/* ID */}
          <TextField
            autoFocus
            required
            margin="dense"
            label="Item ID"
            type="text"
            inputMode="numeric"
            value={form.id}
            onChange={handleChange('id')}
          ></TextField>

          {/* NAME */}
          <TextField
            autoFocus
            required
            margin="dense"
            label="Item name"
            type="text"
            fullWidth
            value={form.name}
            onChange={handleChange('name')}
          ></TextField>

          {/* OWNED */}
          <div>
            <Checkbox checked={form.owned} onChange={handleChange('owned')} />
            Owned
          </div>
        </form>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={onClose} autoFocus type="submit" form="register-item-form">
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
