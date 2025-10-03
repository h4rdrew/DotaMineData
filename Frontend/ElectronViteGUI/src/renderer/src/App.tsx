import React, { useEffect, useRef, useState } from 'react'
import AirDatepicker from 'air-datepicker'
import 'air-datepicker/air-datepicker.css'
import 'air-datepicker/locale/pt' // Importa o idioma PT
import { ItemDataDateNow, ItemDB, ItemHistoric, ItemMenu } from './interfaces'
import { ChartsTeste } from './components/chartsTeste.component'
import steamLogo from './assets/steam_logo.png'
import dmarketLogo from './assets/dmarket_logo.png'
// Importa o componente ExternalLink
import ExternalLink from './components/ExternalLink'
import svgStar from './assets/star.svg'
import svgVoidStar from './assets/star-void.svg'

function App(): JSX.Element {
  const [selectedItemData, setSelectedItemData] = useState<ItemHistoric[] | null>(null)
  const [itemMenu, setItemMenu] = useState<ItemMenu[]>([])

  const inputRef = useRef<HTMLInputElement | null>(null)
  const datepickerRef = useRef<AirDatepicker | null>(null) // Armazena a instância do Datepicker
  const itemSelected = useRef<string>('')

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

    fetchItems()
  }, [])

  const buscaDadosItem = async (item: ItemDB): Promise<void> => {
    try {
      const data = await window.api.getItemData(item.ItemId)
      setSelectedItemData(data as unknown as ItemHistoric[])
      itemSelected.current = item.Name
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
      default:
        break
    }

    setFiltroSelecionado(filtro) // Atualiza o estado do filtro selecionado
    setItemMenu(itensOrdenados) // Atualiza o estado com o array ordenado
  }

  function createSteamHref(itemName: string): string {
    const baseUrl = 'https://steamcommunity.com/market/search?appid=570&q='
    const encodedHref = encodeURIComponent(itemName)
    return `${baseUrl}${encodedHref}`
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

  function pegaPreco(Data: ItemDataDateNow[], arg1: string): import('react').ReactNode {
    const serviceType = arg1 === 'steam' ? 2 : 1

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

  // Variavel que armazena o estado de exibição dos itens comprados
  const [exibirItensComprados, setExibirItensComprados] = useState<boolean>(true)

  function ocultaItensComprados(): void {
    setExibirItensComprados(!exibirItensComprados)
    if (exibirItensComprados) {
      // Se estiver exibindo, oculta os itens comprados
      const itensFiltrados = itemMenu.filter((item) => !item.Purchased)
      setItemMenu(itensFiltrados)
    } else {
      // Se estiver ocultando, exibe todos os itens
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
  }

  // Variavel que armazena o estado de exibição dos itens comprados: só exibe os itens comprados, só os não comprados ou todos
  const [estadoExibicaoItensComprados, setEstadoExibicaoItensComprados] = useState<number>(2)
  // 0 = só os itens comprados
  // 1 = só os itens não comprados
  // 2 = todos os itens

  function alteraExibicaoItemOwned(): void {
    const novoEstado = (estadoExibicaoItensComprados + 1) % 3 // Cicla entre 0, 1 e 2
    setEstadoExibicaoItensComprados(novoEstado)

    // let itensFiltrados: ItemMenu[] = []

    switch (novoEstado) {
      case 0: {
        // Exibe só os itens comprados
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
              .filter((item: ItemMenu) => item.Purchased) // Filtra só os itens comprados
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
              .filter((item: ItemMenu) => !item.Purchased) // Filtra só os itens não comprados
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

  return (
    <>
      {/*<div className="text">
        Exibir lista de <span className="ts">itens</span>
      </div>
      <input ref={inputRef} type="text" placeholder="Selecione uma data" />

       <select>
        <option selected value="0">
          Nome
        </option>
        <option value="1">Preço menor: DMarket</option>
        <option value="2">Preço menor: Steam</option>
        <option value="3">Preço maior: DMarket</option>
        <option value="3">Preço maior: Steam</option>
      </select>

       <div className="mainFlexBox">
        <ul className="lista-itens">
          {items.map((item) => (
            <li className="li-item" key={item.ItemId} onClick={() => buscaDadosItem(item)}>
              {item.Name}
            </li>
          ))}
        </ul>
        <div className="charts-container">
          <div className="item-selected">{itemSelected.current}</div>
          <ChartsTeste data={selectedItemData} labels={[]} />
        </div>
      </div> */}

      <div className="container">
        {/* ITENS */}
        <div id="searchResults" className="market_page_left">
          <div
            id="searchResultsTable"
            className="market_content_block market_home_listing_table market_home_main_listing_table market_listing_table market_listing_table_active"
          >
            <div id="searchResultsRows">
              <div className="market_listing_table_header">
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
                    onClick={() => filtraDadosItens('p2_price_asc')}
                  >
                    DMARKET
                    <span className="market_sort_arrow" style={{ display: 'none' }}>
                      ▲
                    </span>
                  </div>
                  <div
                    className="market_listing_right_cell market_listing_num_listings market_sortable_column"
                    data-sorttype="price"
                    onClick={() => filtraDadosItens('p1_price_asc')}
                  >
                    STEAM<span className="market_sort_arrow" style={{ display: 'none' }}></span>
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
                  <span className="market_listing_header_namespacer"></span>NOME
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
                        src={`file:///E:/DotaMine/img/${item.ItemId}.png`} // Usa fallback se a imagem não existir
                        style={{ borderColor: '#D2D2D2' }}
                        className="market_listing_item_img"
                        alt=""
                      ></img>
                      <div className="market_listing_price_listings_block">
                        <div className="market_listing_right_cell" style={{ width: '60px' }}>
                          <span className="market_table_value" onClick={favoritaItem(item)}>
                            <img src={item.Purchased ? svgStar : svgVoidStar} alt="" height="16" />
                          </span>
                        </div>

                        <div className="market_listing_right_cell market_listing_their_price">
                          <span className="market_table_value normal_price">
                            <span
                              className="normal_price"
                              // data-price={buscaPreco(item.ItemId, 'steam')}
                              data-currency="7"
                            >
                              {pegaPreco(item.Data, 'steam')}
                            </span>
                          </span>
                          <span className="market_arrow_down" style={{ display: 'none' }}></span>
                          <span className="market_arrow_up" style={{ display: 'none' }}></span>
                        </div>

                        <div className="market_listing_right_cell market_listing_their_price">
                          <span className="market_table_value normal_price">
                            <span
                              className="normal_price"
                              // data-price={buscaPreco(item.ItemId, 'dmarket')}
                              data-currency="7"
                            >
                              {pegaPreco(item.Data, 'dmarket')}
                            </span>
                          </span>
                          <span className="market_arrow_down" style={{ display: 'none' }}></span>
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

        {/* GRÁFICO */}
        <div id="sideBar" className="charts-container coluna-direita">
          <div className="item-selected">
            <ExternalLink href={createSteamHref(itemSelected.current)} className="market-link">
              <img src={steamLogo} alt="Steam" height="20px" />
            </ExternalLink>

            <ExternalLink href={createDmarketHref(itemSelected.current)} className="market-link">
              <img src={dmarketLogo} alt="Dmarket" height="20px" />
            </ExternalLink>

            <span
              className="pointer"
              onClick={(e) => copyItemNameToClipboard(e, itemSelected.current)}
            >
              {itemSelected.current}
            </span>
          </div>

          <ChartsTeste data={selectedItemData} labels={[]} />
        </div>
      </div>
    </>
  )
}

export default App
