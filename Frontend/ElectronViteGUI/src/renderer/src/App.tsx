import React, { useEffect, useRef, useState } from 'react'
import 'air-datepicker/air-datepicker.css'
import 'air-datepicker/locale/pt' // Importa o idioma PT
import { Heroes, ItemDataDateNow, ItemDB, ItemHistoric, ItemMenu } from './interfaces'
import { ItemStatistics } from './components/ItemStatistics'
import { GeneralStatistics } from './components/GeneralStatistics'
import liquipediaLogo from './assets/liquipedia_logo.png'
import ExternalLink from './components/ExternalLink'
import svgStar from './assets/star.svg'
import svgVoidStar from './assets/star-void.svg'
import DialogRegisterItem from './components/dialogRegisterItem.component'
import { CollectionProgress } from './components/CollectionProgress'
import { DmarketPriceChange } from './components/DmarketPriceChange'
import { dmarketPriceChange } from './utils/dmarket'
import { PriceOverview } from './components/PriceOverview'
import { useCollection } from './hooks/useCollection'
import {
  Alert,
  Button,
  Box,
  createTheme,
  CssBaseline,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Select,
  SelectChangeEvent,
  styled,
  ThemeProvider,
  Toolbar,
  useTheme
} from '@mui/material'
import BasicDatePicker from './components/basicDatePicker.component'
import dayjs from 'dayjs'
import MenuIcon from '@mui/icons-material/Menu'
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SettingsIcon from '@mui/icons-material/Settings'
import SyncIcon from '@mui/icons-material/Sync'
import { pegaHeroName } from './utils/heroi'

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976d2'
    }
  }
})

const drawerWidth = 740

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{
  open?: boolean
}>(({ theme }) => ({
  flexGrow: 1,
  minWidth: 0,
  height: '100dvh',
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: theme.spacing(3),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen
  }),
  marginLeft: `-${drawerWidth}px`,
  variants: [
    {
      props: ({ open }): boolean | undefined => open,
      style: {
        transition: theme.transitions.create('margin', {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.enteringScreen
        }),
        marginLeft: 0
      }
    }
  ]
}))

interface AppBarProps extends MuiAppBarProps {
  open?: boolean
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open'
})<AppBarProps>(({ theme }) => ({
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen
  }),
  variants: [
    {
      props: ({ open }): boolean | undefined => open,
      style: {
        width: `calc(100% - ${drawerWidth}px)`,
        marginLeft: `${drawerWidth}px`,
        transition: theme.transitions.create(['margin', 'width'], {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.enteringScreen
        })
      }
    }
  ]
}))

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end'
}))

//--------------------------------

function App(): JSX.Element {
  const theme = useTheme()
  const [open, setOpen] = React.useState(false)
  const [screen, setScreen] = useState<'item' | 'general'>('item')

  const handleDrawerOpen = (): void => {
    setOpen(true)
  }

  const handleDrawerClose = (): void => {
    setOpen(false)
  }

  //------------------------
  const [selectedItemData, setSelectedItemData] = useState<ItemHistoric[] | null>(null)
  const [itemMenu, setItemMenu] = useState<ItemMenu[]>([])

  // const inputRef = useRef<HTMLInputElement | null>(null)
  // const datepickerRef = useRef<AirDatepicker | null>(null) // Armazena a instância do Datepicker
  const itemSelected = useRef<string>('')
  const itemSelectedId = useRef<number>(0)
  const [heroes, setHeroes] = useState<Heroes[]>([])

  const [openDialog, setOpenDialog] = useState(false)
  const {
    collection,
    starting,
    error: collectionError,
    startCollection,
    cancelCollection
  } = useCollection()
  const collecting =
    starting || collection.status === 'running' || collection.status === 'cancelling'
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false)
  const beginCollection = (itemId?: number): void => {
    setCollectionDialogOpen(true)
    void startCollection(itemId)
  }
  const collectionLabel = collectionError
    ? 'Erro na atualização'
    : collecting
      ? collection.status === 'cancelling'
        ? 'Cancelando dados…'
        : 'Atualizando dados…'
      : collection.status === 'completed'
        ? 'Dados atualizados'
        : collection.status === 'cancelled'
          ? 'Atualização cancelada'
          : collection.status === 'partial'
            ? 'Atualização parcial'
            : 'Erro na atualização'
  const displayedDate = useRef<string | null>(null)
  const refreshedRun = useRef<string | null>(null)

  useEffect(() => {
    if (
      !collection.runId ||
      collection.status === 'running' ||
      collection.status === 'cancelling' ||
      collection.status === 'idle' ||
      refreshedRun.current === collection.runId
    )
      return
    refreshedRun.current = collection.runId
    const refresh = async (): Promise<void> => {
      const date = displayedDate.current ?? dayjs().format('YYYY-MM-DD')
      const prices = await window.api.getItemDataByDate(date)
      if (date === (displayedDate.current ?? dayjs().format('YYYY-MM-DD'))) {
        setItemMenu((items) =>
          items.map((item) => ({
            ...item,
            Data: prices.filter((price) => price.ItemId === item.ItemId)
          }))
        )
      }
      const selectedId = itemSelectedId.current
      if (selectedId) {
        const history = await window.api.getItemData(selectedId)
        if (selectedId === itemSelectedId.current)
          setSelectedItemData(history as unknown as ItemHistoric[])
      }
    }
    void refresh().catch((error) => console.error('Erro ao recarregar preços:', error))
  }, [collection.runId, collection.status])

  useEffect(() => {
    const fetchItems = async (): Promise<void> => {
      try {
        const items = await window.api.getItems()
        const datas = await window.api.getItemDataDateNow()
        const itemsMenu = items.map((item: ItemDB) => {
          const itemData = datas.filter((data: ItemDataDateNow) => data.ItemId === item.ItemId)
          return {
            ...item,
            Data: itemData
          }
        }) as ItemMenu[]
        setItemMenu(itemsMenu)
      } catch (error) {
        console.error('Erro ao buscar itens:', error)
      }
    }

    const fetchHeroes = async (): Promise<void> => {
      try {
        const heroes = await window.api.getHeroes()
        setHeroes(heroes)
      } catch (error) {
        setHeroes([])
        console.error('Erro ao buscar heróis:', error)
      }
    }

    fetchItems()
    fetchHeroes()
  }, [])

  const buscaDadosItem = async (item: ItemDB): Promise<void> => {
    try {
      const data = await window.api.getItemData(item.ItemId)
      setSelectedItemData(data as unknown as ItemHistoric[])
      setScreen('item')
      itemSelected.current = item.Name
      itemSelectedId.current = item.ItemId
      console.log(data)
    } catch (error) {
      console.error(`Erro ao buscar dados do item ${item.ItemId} | ${item.Name}:`, error)
    }
  }

  // Função que orderna "itemMenu" pelo filtro selecionado
  // nome crescente = p1_name_asc
  // nome decrecente = p1_name_desc
  // preço crescente = p1_price_asc
  // preço decrecente = p1_price_desc

  // Variável que armazenda o estado do filtro selecionado
  const [filtroSelecionado, setFiltroSelecionado] = useState<string>('')

  function filtraDadosItens(filtro: string): void {
    if (filtro === filtroSelecionado) {
      // Se for igual, inverte a ordem
      if (filtro.endsWith('_asc')) {
        filtro = filtro.replace('_asc', '_desc')
      } else if (filtro.endsWith('_desc')) {
        filtro = filtro.replace('_desc', '_asc')
      }
    }
    atualizaOrdemDados(filtro)
  }

  function atualizaOrdemDados(filtro: string): void {
    const itensOrdenados = [...itemMenu] // Cria uma cópia do array original

    switch (filtro) {
      case 'p1_name_asc':
        itensOrdenados.sort((a, b) => a.Name.localeCompare(b.Name))
        break
      case 'p1_name_desc':
        itensOrdenados.sort((a, b) => b.Name.localeCompare(a.Name))
        break
      case 'p1_price_asc':
        itensOrdenados.sort((a, b) => {
          const precoA = a.Data.find((data) => data.ServiceType === 1)?.Price || 0
          const precoB = b.Data.find((data) => data.ServiceType === 1)?.Price || 0
          return precoA - precoB
        })
        break
      case 'p1_price_desc':
        itensOrdenados.sort((a, b) => {
          const precoA = a.Data.find((data) => data.ServiceType === 1)?.Price || 0
          const precoB = b.Data.find((data) => data.ServiceType === 1)?.Price || 0
          return precoB - precoA
        })
        break
      case 'p2_price_asc':
        itensOrdenados.sort((a, b) => {
          const precoA = a.Data.find((data) => data.ServiceType === 2)?.Price || 0
          const precoB = b.Data.find((data) => data.ServiceType === 2)?.Price || 0
          return precoA - precoB
        })
        break
      case 'p2_price_desc':
        itensOrdenados.sort((a, b) => {
          const precoA = a.Data.find((data) => data.ServiceType === 2)?.Price || 0
          const precoB = b.Data.find((data) => data.ServiceType === 2)?.Price || 0
          return precoB - precoA
        })
        break
      case 'dmarket_change_desc':
      case 'dmarket_change_asc':
        itensOrdenados.sort((a, b) => {
          const changeA = dmarketPriceChange(a.Data)
          const changeB = dmarketPriceChange(b.Data)
          if (changeA === null) return changeB === null ? 0 : 1
          if (changeB === null) return -1
          return filtro === 'dmarket_change_desc' ? changeB - changeA : changeA - changeB
        })
        break
      default:
        break
    }

    setFiltroSelecionado(filtro) // Atualiza o estado do filtro selecionado
    setItemMenu(itensOrdenados) // Atualiza o estado com o array ordenado
  }

  function createSteamHref(itemName: string): string {
    // const baseUrl = 'https://steamcommunity.com/market/search/?q=appid:570+prop_def_index:' + itemId
    const baseUrl = `https://steamcommunity.com/market/search/?q=${encodeURIComponent(itemName)}`
    return baseUrl
  }

  function createDmarketHref(href: string): string {
    const baseUrl = 'https://dmarket.com/pt/ingame-items/item-list/dota2-skins?title='
    const encodedHref = encodeURIComponent(href)
    return `${baseUrl}${encodedHref}`
  }

  function trocaEstiloSelecionado(element: HTMLDivElement): void {
    const selectedElements = document.querySelectorAll('.selecionado')
    selectedElements.forEach((el) => {
      el.classList.remove('selecionado')
    })
    element.classList.add('selecionado')
  }

  function pegaPreco(Data: ItemDataDateNow[], serviceStr: string): string {
    const serviceType = serviceStr === 'steam' ? 1 : 2

    const price = Data.find((data) => data.ServiceType === serviceType)?.Price || 0

    if (price === 0) return '-'

    // Converte o valor numerico para monetário BRL
    return price.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  function favoritaItem(
    item: ItemMenu
  ): import('react').MouseEventHandler<HTMLSpanElement> | undefined {
    return async (e) => {
      e.stopPropagation() // Impede que o clique no ícone afete o clique no item

      const novoEstado = !item.Purchased // Inverte o estado atual

      try {
        await window.api.updateItemPurchased(item.ItemId, novoEstado) // Atualiza o banco de dados
        // Atualiza o estado local para refletir a mudança
        setItemMenu((prevItems) =>
          prevItems.map((it) => (it.ItemId === item.ItemId ? { ...it, Purchased: novoEstado } : it))
        )
      } catch (error) {
        console.error('Erro ao atualizar o estado de favorito:', error)
      }
    }
  }

  // Variavel que armazena o estado de exibição dos itens comprados: só exibe os itens comprados, só os não comprados ou todos
  const [estadoExibicaoItensComprados, setEstadoExibicaoItensComprados] = useState<number>(2)
  // 0 = só os itens comprados
  // 1 = só os itens não comprados
  // 2 = todos os itens
  function alteraExibicaoItemOwned(): void {
    displayedDate.current = null
    const novoEstado = (estadoExibicaoItensComprados + 1) % 3 // Cicla entre 0, 1 e 2
    setEstadoExibicaoItensComprados(novoEstado)

    // let itensFiltrados: ItemMenu[] = []

    switch (novoEstado) {
      case 0: {
        // Exibe só os itens comprados
        const heroSelected = hero !== '' ? Number(hero) : null

        const fetchItems = async (): Promise<void> => {
          try {
            const items = await window.api.getItems()
            const datas = await window.api.getItemDataDateNow()

            const itemsMenu = items
              .map((item: ItemDB) => {
                const itemData = datas.filter(
                  (data: ItemDataDateNow) => data.ItemId === item.ItemId
                )
                return {
                  ...item,
                  Data: itemData
                }
              })
              .filter((item: ItemMenu) => {
                if (!item.Purchased) return false
                if (heroSelected) return item.Hero === heroSelected
                return true
              })

            setItemMenu(itemsMenu as ItemMenu[])
          } catch (error) {
            console.error('Erro ao buscar itens:', error)
          }
        }

        fetchItems()
        break
      }
      case 1: {
        // Exibe só os itens não comprados
        const heroSelected = hero !== '' ? Number(hero) : null

        const fetchItems = async (): Promise<void> => {
          try {
            const items = await window.api.getItems()
            const datas = await window.api.getItemDataDateNow()
            const itemsMenu = items
              .map((item: ItemDB) => {
                const itemData = datas.filter(
                  (data: ItemDataDateNow) => data.ItemId === item.ItemId
                )
                return {
                  ...item,
                  Data: itemData
                }
              })
              .filter((item: ItemMenu) => {
                if (item.Purchased) return false
                if (heroSelected) return item.Hero === heroSelected
                return true
              })
            setItemMenu(itemsMenu as ItemMenu[])
          } catch (error) {
            console.error('Erro ao buscar itens:', error)
          }
        }

        fetchItems()
        break
      }
      case 2: {
        // Exibe todos os itens
        const heroSelected = hero !== '' ? Number(hero) : null
        const fetchItems = async (): Promise<void> => {
          try {
            const items = await window.api.getItems()
            const datas = await window.api.getItemDataDateNow()
            const itemsMenu = items
              .map((item: ItemDB) => {
                const itemData = datas.filter(
                  (data: ItemDataDateNow) => data.ItemId === item.ItemId
                )
                return {
                  ...item,
                  Data: itemData
                }
              })
              .filter((item: ItemMenu) => {
                if (heroSelected) return item.Hero === heroSelected
                return true
              })
            setItemMenu(itemsMenu as ItemMenu[])
          } catch (error) {
            console.error('Erro ao buscar itens:', error)
          }
        }

        fetchItems()
        break
      }
    }
  }

  function copyItemNameToClipboard(e: React.MouseEvent<HTMLSpanElement>, Name: string): void {
    e.stopPropagation() // Impede que o clique no nome afete o clique no item
    navigator.clipboard.writeText(Name).then(
      () => {
        console.log('Texto copiado para a área de transferência:', Name)
      },
      (err) => {
        console.error('Erro ao copiar texto: ', err)
      }
    )
  }

  function pegaPorcentualDMarket(item: ItemMenu): JSX.Element {
    const dmarketPrice = item.Data.filter((item) => item.ServiceType === 2).reduce(
      (acc, item) => acc + item.Price,
      0
    )
    const steamPrice = item.Data.filter((item) => item.ServiceType === 1).reduce(
      (acc, item) => acc + item.Price,
      0
    )

    const dmarketData = Math.round(((dmarketPrice - steamPrice) / steamPrice) * 100)

    const valid = Number.isFinite(dmarketData)
    return (
      <Box
        component="span"
        sx={{
          color:
            !valid || dmarketData === 0
              ? 'text.secondary'
              : dmarketData > 0
                ? 'success.light'
                : 'error.light'
        }}
      >
        {valid ? `${dmarketData > 0 ? '+' : ''}${dmarketData}%` : '-'}
      </Box>
    )
  }

  const porcentMenor = useRef<boolean>(false)
  function alteraExibicaoItemPorcent(): void {
    const novoEstado = !porcentMenor.current
    porcentMenor.current = novoEstado

    const itensOrdenados = [...itemMenu] // Cria uma cópia do array original

    if (novoEstado) {
      // crescente
      itensOrdenados.sort((a, b) => calculaPorcentagem(a) - calculaPorcentagem(b))
    } else {
      // decrescente
      itensOrdenados.sort((a, b) => calculaPorcentagem(b) - calculaPorcentagem(a))
    }

    setItemMenu(itensOrdenados) // Atualiza o estado com o array ordenado
  }

  function calculaPorcentagem(item: ItemMenu): number {
    const steam = item.Data.find((d) => d.ServiceType === 1)?.Price ?? 0

    const dmarket = item.Data.find((d) => d.ServiceType === 2)?.Price ?? 0

    if (steam === 0) return 1 // 100%

    return (steam - dmarket) / steam
  }

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const openMenu = Boolean(anchorEl)
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    setAnchorEl(event.currentTarget)
  }
  const handleClose = (): void => {
    setAnchorEl(null)
  }

  function buscaDadosPorData(newValue: dayjs.Dayjs | null): void {
    if (!newValue) {
      return
    }

    const dataSelecionada = newValue.format('YYYY-MM-DD')
    displayedDate.current = dataSelecionada

    const fetchItemsByDate = async (): Promise<void> => {
      try {
        const items = await window.api.getItems()
        const datas = await window.api.getItemDataByDate(dataSelecionada)
        const itemsMenu = items.map((item: ItemDB) => {
          const itemData = datas.filter((data: ItemDataDateNow) => data.ItemId === item.ItemId)
          return {
            ...item,
            Data: itemData
          }
        }) as ItemMenu[]
        setItemMenu(itemsMenu)
      } catch (error) {
        console.error('Erro ao buscar itens pela data:', error)
      }
    }

    fetchItemsByDate()
  }

  function buscaDadosAtualizados(): void {
    displayedDate.current = null
    const fetchItems = async (): Promise<void> => {
      try {
        const items = await window.api.getItems()
        const datas = await window.api.getItemDataDateNow()
        const itemsMenu = items.map((item: ItemDB) => {
          const itemData = datas.filter((data: ItemDataDateNow) => data.ItemId === item.ItemId)
          return {
            ...item,
            Data: itemData
          }
        }) as ItemMenu[]
        setItemMenu(itemsMenu)
      } catch (error) {
        console.error('Erro ao buscar itens:', error)
      }
    }

    fetchItems()
  }

  const [hero, setHero] = React.useState('')

  const handleChange = (event: SelectChangeEvent): void => {
    displayedDate.current = null
    setHero(event.target.value)

    if (event.target.value === '') {
      // Se nenhum herói for selecionado, busca todos os itens
      buscaDadosAtualizados()
      return
    }

    const fetchItemsByHero = async (): Promise<void> => {
      try {
        const items = await window.api.getItemsByHero(Number(event.target.value))
        const datas = await window.api.getItemDataDateNow()
        const itemsMenu = items.map((item: ItemDB) => {
          const itemData = datas.filter((data: ItemDataDateNow) => data.ItemId === item.ItemId)
          return {
            ...item,
            Data: itemData
          }
        }) as ItemMenu[]
        setItemMenu(itemsMenu)
      } catch (error) {
        console.error('Erro ao buscar itens pelo herói:', error)
      }
    }

    fetchItemsByHero()
  }

  return (
    <>
      <ThemeProvider theme={darkTheme}>
        <Box sx={{ display: 'flex' }}>
          <CssBaseline />

          <AppBar position="fixed" open={open}>
            <Toolbar>
              <IconButton
                color="inherit"
                aria-label="open drawer"
                onClick={handleDrawerOpen}
                edge="start"
                sx={[
                  {
                    mr: 2
                  },
                  open && { display: 'none' }
                ]}
              >
                <MenuIcon />
              </IconButton>
              {/* HERO NAME */}
              <FormControl sx={{ m: 1, minWidth: 120 }} size="small">
                <InputLabel id="hero-select-label">Hero</InputLabel>
                <Select
                  labelId="hero-select-label"
                  id="hero-select"
                  value={hero}
                  label="Hero"
                  onChange={handleChange}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  <Divider></Divider>
                  {heroes
                    .sort((a, b) => a.Name.localeCompare(b.Name))
                    .map((hero) => (
                      <MenuItem key={hero.HeroId} value={hero.HeroId}>
                        {pegaHeroName(hero)}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              {/* ESPAÇO */}
              <Box sx={{ flexGrow: 1 }}></Box>

              {/* DATE PICKER */}
              {(collection.runId || starting || collectionError) && (
                <Button
                  color="inherit"
                  onClick={() => setCollectionDialogOpen(true)}
                  aria-label="Ver progresso da atualização"
                  startIcon={
                    <SyncIcon
                      sx={
                        collecting
                          ? {
                              animation: 'collection-spin 1.5s linear infinite',
                              '@keyframes collection-spin': { to: { transform: 'rotate(360deg)' } }
                            }
                          : undefined
                      }
                    />
                  }
                  sx={{
                    position: 'fixed',
                    bottom: 16,
                    right: 24,
                    zIndex: 1201,
                    px: 2,
                    py: 1,
                    textTransform: 'none',
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    boxShadow: 4,
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.selected' }
                  }}
                >
                  {collectionLabel}
                </Button>
              )}
              <BasicDatePicker
                onChange={(newValue) => buscaDadosPorData(newValue)}
              ></BasicDatePicker>
            </Toolbar>
          </AppBar>
          <Drawer
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: drawerWidth,
                boxSizing: 'border-box'
              }
            }}
            variant="persistent"
            anchor="left"
            open={open}
          >
            <DrawerHeader>
              {/* MENU BUTTON */}
              <IconButton
                id="basic-button"
                size="small"
                edge="start"
                color="inherit"
                aria-label="menu"
                aria-controls={openMenu ? 'basic-menu' : undefined}
                aria-expanded={openMenu ? 'true' : undefined}
                sx={{ mr: 2 }}
                onClick={handleClick}
              >
                <SettingsIcon />
              </IconButton>
              {/* MENU */}
              <Menu
                id="basic-menu"
                anchorEl={anchorEl}
                open={openMenu}
                onClose={handleClose}
                slotProps={{
                  list: {
                    'aria-labelledby': 'basic-button'
                  }
                }}
              >
                <MenuItem
                  disabled={collecting}
                  onClick={() => {
                    handleClose()
                    beginCollection()
                  }}
                >
                  Atualizar todos os itens
                </MenuItem>
                {collection.runId && (
                  <MenuItem
                    onClick={() => {
                      handleClose()
                      setCollectionDialogOpen(true)
                    }}
                  >
                    Ver progresso da atualização
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    setOpenDialog(true)
                    handleClose()
                  }}
                >
                  New item
                </MenuItem>
              </Menu>

              {/* ESPAÇO */}
              <Box sx={{ flexGrow: 1 }}></Box>

              <IconButton onClick={handleDrawerClose}>
                {theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
              </IconButton>
            </DrawerHeader>
            <Divider />

            {/* ITENS */}
            <div id="searchResults" className="market_page_left">
              <div
                id="searchResultsTable"
                className="market_content_block market_home_listing_table market_home_main_listing_table market_listing_table market_listing_table_active"
              >
                <div id="searchResultsRows">
                  <div className="market_listing_table_header">
                    <div
                      className="market_listing_right_cell market_sortable_column"
                      style={{ width: '100px' }}
                      title="Variação DMarket: última captura da data selecionada em relação à última captura do dia anterior disponível"
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        filtraDadosItens(
                          filtroSelecionado.startsWith('dmarket_change_')
                            ? filtroSelecionado
                            : 'dmarket_change_desc'
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          event.currentTarget.click()
                        }
                      }}
                    >
                      DxD
                    </div>
                    <div
                      className="market_listing_right_cell pointer"
                      style={{ width: '70px' }}
                      onClick={() => alteraExibicaoItemPorcent()}
                    >
                      SxD
                    </div>

                    <div
                      className="market_listing_right_cell pointer"
                      style={{ width: '70px' }}
                      onClick={() => alteraExibicaoItemOwned()}
                    >
                      OWNED
                    </div>

                    <div className="market_listing_price_listings_block">
                      <div
                        className="market_listing_right_cell market_listing_their_price market_sortable_column"
                        data-sorttype="price"
                        onClick={() => filtraDadosItens('p1_price_asc')}
                      >
                        STEAM
                      </div>
                      <div
                        className="market_listing_right_cell market_listing_num_listings market_sortable_column"
                        data-sorttype="price"
                        onClick={() => filtraDadosItens('p2_price_asc')}
                      >
                        DMARKET
                      </div>
                      {/* <div
                    className="market_listing_right_cell market_listing_price_listings_combined market_sortable_column"
                    data-sorttype="price"
                  >
                    PREÇO<span className="market_sort_arrow" style={{ display: 'none' }}></span>
                  </div> */}
                    </div>
                    <div
                      className="market_sortable_column"
                      data-sorttype="name"
                      onClick={() => filtraDadosItens('p1_name_asc')}
                    >
                      <span className="market_listing_header_namespacer"></span>NAME
                      <span className="market_sort_arrow" style={{ display: 'none' }}></span>
                    </div>
                  </div>

                  <div className="coluna-esquerda">
                    {itemMenu.map((item) => (
                      <div
                        className="market_listing_row_link"
                        id="resultlink_0"
                        key={item.ItemId}
                        onClick={() => buscaDadosItem(item)}
                      >
                        <div
                          className="market_listing_row market_recent_listing_row market_listing_searchresult"
                          id="result_0"
                          data-appid="570"
                          data-hash-name="Autographed Stuntwood Sanctuary"
                          onClick={(e) => trocaEstiloSelecionado(e.currentTarget as HTMLDivElement)}
                        >
                          <img
                            id="result_0_image"
                            key={item.ItemId}
                            src={`dotamine-image://item/${item.ItemId}.png`}
                            style={{ borderColor: '#D2D2D2' }}
                            className="market_listing_item_img"
                            alt=""
                          ></img>
                          <div className="market_listing_price_listings_block">
                            <div className="market_listing_right_cell" style={{ width: '100px' }}>
                              <span className="market_table_value">
                                <DmarketPriceChange data={item.Data} />
                              </span>
                            </div>
                            <div className="market_listing_right_cell" style={{ width: '60px' }}>
                              <span className="market_table_value">
                                {pegaPorcentualDMarket(item)}
                              </span>
                            </div>

                            <div className="market_listing_right_cell" style={{ width: '60px' }}>
                              <span className="market_table_value" onClick={favoritaItem(item)}>
                                <img
                                  src={item.Purchased ? svgStar : svgVoidStar}
                                  alt=""
                                  height="16"
                                />
                              </span>
                            </div>

                            <div className="market_listing_right_cell market_listing_their_price">
                              <span className="market_table_value normal_price">
                                <span
                                  className="normal_price"
                                  // data-price={buscaPreco(item.ItemId, 'steam')}
                                  // data-currency="7"
                                >
                                  {pegaPreco(item.Data, 'steam')}
                                </span>
                              </span>
                              <span
                                className="market_arrow_down"
                                style={{ display: 'none' }}
                              ></span>
                              <span className="market_arrow_up" style={{ display: 'none' }}></span>
                            </div>

                            <div className="market_listing_right_cell market_listing_their_price">
                              <span className="market_table_value normal_price">
                                <span
                                  className="normal_price"
                                  // data-price={buscaPreco(item.ItemId, 'dmarket')}
                                  // data-currency="7"
                                >
                                  {pegaPreco(item.Data, 'dmarket')}
                                </span>
                              </span>
                              <span
                                className="market_arrow_down"
                                style={{ display: 'none' }}
                              ></span>
                              <span className="market_arrow_up" style={{ display: 'none' }}></span>
                            </div>
                          </div>

                          <div className="market_listing_item_name_block">
                            <span
                              id="result_0_name"
                              className="market_listing_item_name"
                              style={{ color: '#D2D2D2' }}
                            >
                              {item.Name}
                            </span>
                            <br />
                            <span className="market_listing_game_name">Description</span>
                          </div>
                          <div style={{ clear: 'both' }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Drawer>
          <Main open={open}>
            <DrawerHeader />
            <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
              <Button
                variant={screen === 'item' ? 'contained' : 'outlined'}
                onClick={() => setScreen('item')}
              >
                Estatísticas do item
              </Button>
              <Button
                variant={screen === 'general' ? 'contained' : 'outlined'}
                onClick={() => {
                  setScreen('general')
                  setOpen(false)
                }}
              >
                Estatísticas gerais
              </Button>
            </Box>
            {screen === 'general' ? (
              <GeneralStatistics
                refreshKey={`${collection.runId}:${collection.status}`}
                onSelect={(item) => {
                  void buscaDadosItem(item)
                }}
              />
            ) : (
              <>
                <div className="info-item-container">
                  <div className="item-selected">
                    <IconButton
                      size="small"
                      color="primary"
                      aria-label="Atualizar este item"
                      title="Atualizar este item"
                      disabled={collecting || !itemSelectedId.current}
                      onClick={() => beginCollection(itemSelectedId.current)}
                    >
                      <SyncIcon fontSize="small" />
                    </IconButton>
                    <ExternalLink
                      href={`https://liquipedia.net/dota2/${itemSelected.current.replace(/ /g, '_')}`}
                      className="market-link"
                    >
                      <img src={liquipediaLogo} alt="Liquipedia" height="20px" />
                    </ExternalLink>

                    <span
                      className="pointer"
                      onClick={(e) => copyItemNameToClipboard(e, itemSelected.current)}
                    >
                      {itemSelected.current}
                    </span>

                    <small>({itemSelectedId.current})</small>
                  </div>

                  <PriceOverview
                    key={itemSelectedId.current}
                    history={selectedItemData}
                    prices={
                      itemMenu.find((item) => item.ItemId === itemSelectedId.current)?.Data ?? []
                    }
                    steamHref={createSteamHref(itemSelected.current)}
                    dmarketHref={createDmarketHref(itemSelected.current)}
                  />
                </div>

                <ItemStatistics key={itemSelectedId.current} history={selectedItemData} />
              </>
            )}
          </Main>
        </Box>
        <Dialog
          open={collectionDialogOpen}
          onClose={() => setCollectionDialogOpen(false)}
          fullWidth
          maxWidth="sm"
          aria-labelledby="collection-dialog-title"
        >
          <DialogTitle id="collection-dialog-title">Atualização de dados</DialogTitle>
          <DialogContent>
            {collectionError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {collectionError}
              </Alert>
            )}
            {starting && collection.status === 'idle' && (
              <Box sx={{ py: 2 }}>Preparando atualização…</Box>
            )}
            <CollectionProgress
              key={collection.runId}
              state={collection}
              onCancel={() => void cancelCollection()}
            />
            {collecting && (
              <Box sx={{ color: 'text.secondary', fontSize: 14 }}>
                Você pode fechar esta janela. A atualização continuará em segundo plano.
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCollectionDialogOpen(false)}>Fechar</Button>
          </DialogActions>
        </Dialog>
        <DialogRegisterItem open={openDialog} onClose={() => setOpenDialog(false)} />
      </ThemeProvider>
    </>
  )
}

export default App
