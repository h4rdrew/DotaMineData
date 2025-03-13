// import ChartsTeste from './components/chartsTeste.component'
import electronLogo from './assets/electron.svg'
import { useEffect, useRef, useState } from 'react'
import AirDatepicker from 'air-datepicker'
import 'air-datepicker/air-datepicker.css'
import 'air-datepicker/locale/pt' // Importa o idioma PT

function App(): JSX.Element {
  const [items, setItems] = useState<{ Id: number; ItemId: number; Name: string }[]>([])
  // const readDB = (): void => window.electron.ipcRenderer.send('dbLoad')

  const inputRef = useRef<HTMLInputElement | null>(null)
  const datepickerRef = useRef<AirDatepicker | null>(null) // Armazena a instância do Datepicker

  useEffect(() => {
    window.getitems.then(setItems)

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

  return (
    <>
      <div className="text">
        Exibir lista de <span className="ts">itens</span>
      </div>

      <input ref={inputRef} type="text" placeholder="Selecione uma data" />

      {/* <div className="actions">
        <div className="action">
          <a target="_blank" rel="noreferrer" onClick={readDB}>
            Read DB
          </a>
        </div>
      </div> */}
      {/* <ChartsTeste></ChartsTeste> */}

      <ul>
        {items.map((item) => (
          <li key={item.Id}>{item.Name}</li>
        ))}
      </ul>
    </>
  )
}

export default App
