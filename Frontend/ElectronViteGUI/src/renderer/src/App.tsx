import { useEffect, useRef, useState } from 'react'
import AirDatepicker from 'air-datepicker'
import 'air-datepicker/air-datepicker.css'
import 'air-datepicker/locale/pt' // Importa o idioma PT
import { ItemDataDateNow, ItemDB, ItemHistoric } from './interfaces'
import { ChartsTeste } from './components/chartsTeste.component'

function App(): JSX.Element {
  const [items, setItems] = useState<ItemDB[]>([])
  const [selectedItemData, setSelectedItemData] = useState<ItemHistoric[] | null>(null)
  const [itemDateNow, setItemDateNow] = useState<ItemDataDateNow[]>([])

  const inputRef = useRef<HTMLInputElement | null>(null)
  const datepickerRef = useRef<AirDatepicker | null>(null) // Armazena a instância do Datepicker
  const itemSelected = useRef<string>('')

  useEffect(() => {
    const fetchItems = async (): Promise<void> => {
      try {
        const data = await window.api.getItems()
        setItems(data as ItemDB[])
      } catch (error) {
        console.error('Erro ao buscar itens:', error)
      }
    }

    const fetchItemDateNow = async (): Promise<void> => {
      try {
        const data = await window.api.getItemDataDateNow()
        setItemDateNow(data as ItemDataDateNow[])
      } catch (error) {
        console.error('Erro ao buscar itens:', error)
      }
    }

    fetchItemDateNow()
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
                <div className="market_listing_price_listings_block">
                  <div
                    className="market_listing_right_cell market_listing_their_price market_sortable_column"
                    data-sorttype="price"
                  >
                    DMARKET<span className="market_sort_arrow" style={{ display: 'none' }}></span>
                  </div>
                  <div
                    className="market_listing_right_cell market_listing_num_listings market_sortable_column"
                    data-sorttype="price"
                  >
                    STEAM<span className="market_sort_arrow" style={{ display: 'none' }}></span>
                  </div>
                  <div
                    className="market_listing_right_cell market_listing_price_listings_combined market_sortable_column"
                    data-sorttype="price"
                  >
                    PREÇO<span className="market_sort_arrow" style={{ display: 'none' }}></span>
                  </div>
                </div>
                <div className="market_sortable_column" data-sorttype="name">
                  <span className="market_listing_header_namespacer"></span>NOME
                  <span className="market_sort_arrow" style={{ display: 'none' }}></span>
                </div>
              </div>

              <div className="coluna-esquerda">
                {items.map((item) => (
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
                        <div className="market_listing_right_cell market_listing_their_price">
                          <span className="market_table_value normal_price">
                            <span className="normal_price" data-price="273" data-currency="7">
                              R$ 6,66
                            </span>
                          </span>
                          <span className="market_arrow_down" style={{ display: 'none' }}></span>
                          <span className="market_arrow_up" style={{ display: 'none' }}></span>
                        </div>

                        <div className="market_listing_right_cell market_listing_their_price">
                          <span className="market_table_value normal_price">
                            <span className="normal_price" data-price="273" data-currency="7">
                              R$ 69,69
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
                        <span className="market_listing_game_name">Dota 2</span>
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
          <div className="item-selected">{itemSelected.current}</div>
          <ChartsTeste data={selectedItemData} labels={[]} />
        </div>
      </div>
    </>
  )
}

export default App
