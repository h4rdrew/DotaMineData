import ChartsTeste from './components/chartsTeste.component'
import electronLogo from './assets/electron.svg'
import { useEffect, useState } from 'react'

function App(): JSX.Element {
  const [items, setItems] = useState<{ id: number; itemId: number; nome: string }[]>([])
  // const readDB = (): void => window.electron.ipcRenderer.send('dbLoad')

  useEffect(() => {
    window.getitems.then(setItems)
  }, [])

  return (
    <>
      <img alt="logo" className="logo" src={electronLogo} />
      <div className="creator">Powered by electron-vite</div>
      <div className="text">
        Exibir lista de <span className="ts">itens</span>
      </div>
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
          <li key={item.id}>{item.nome}</li>
        ))}
      </ul>
    </>
  )
}

export default App
