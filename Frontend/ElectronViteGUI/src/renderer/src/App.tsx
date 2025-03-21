import { useEffect, useRef, useState } from 'react'
import AirDatepicker from 'air-datepicker'
import 'air-datepicker/air-datepicker.css'
import 'air-datepicker/locale/pt' // Importa o idioma PT
import { ItemDB, ItemHistoric } from './interfaces'
import { ChartsTeste } from './components/chartsTeste.component'

function App(): JSX.Element {
  const [items, setItems] = useState<ItemDB[]>([])
  const [selectedItemData, setSelectedItemData] = useState<ItemHistoric[] | null>(null)
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

    fetchItems()

    if (inputRef.current && !datepickerRef.current) {
      datepickerRef.current = new AirDatepicker(inputRef.current, {
        autoClose: true, // Fecha automaticamente após seleção
        dateFormat: 'dd/MM/yyyy', // Define o formato da data
        position: 'bottom left', // Posição do calendário
        inline: false,
        selectedDates: [new Date()],
        locale: {
          days: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
          daysShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
          daysMin: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
          months: [
            'Janeiro',
            'Fevereiro',
            'Março',
            'Abril',
            'Maio',
            'Junho',
            'Julho',
            'Agosto',
            'Setembro',
            'Outubro',
            'Novembro',
            'Dezembro'
          ],
          monthsShort: [
            'Jan',
            'Fev',
            'Mar',
            'Abr',
            'Mai',
            'Jun',
            'Jul',
            'Ago',
            'Set',
            'Out',
            'Nov',
            'Dez'
          ],
          today: 'Hoje',
          clear: 'Limpar',
          dateFormat: 'dd/MM/yyyy',
          firstDay: 0
        }
      })
    }
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
      <div className="text">
        Exibir lista de <span className="ts">itens</span>
      </div>
      <input ref={inputRef} type="text" placeholder="Selecione uma data" />

      <div className="mainFlexBox">
        <ul className="lista-itens">
          {items.map((item) => (
            <li className="li-item" key={item.Id} onClick={() => buscaDadosItem(item)}>
              {item.Name}
            </li>
          ))}
        </ul>

        <div className="charts-container">
          <div className="item-selected">{itemSelected.current}</div>
          <ChartsTeste data={selectedItemData} labels={[]} />
        </div>
      </div>
    </>
  )
}

export default App
