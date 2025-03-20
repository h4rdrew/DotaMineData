import { useEffect, useRef } from 'react'
import Chart, { ChartData, ChartOptions } from 'chart.js/auto'
import { ChartsTesteProps, ItemHistoric } from '@renderer/interfaces'

function formatPrice(price: number): string {
  return `R$ ${price.toFixed(2).replace('.', ',')}`
}

function formatDate(date: string): string {
  const d = new Date(date)
  return d.toLocaleDateString('pt-BR') // Formato dd/MM/yyyy
}

function preprocessData(data: ItemHistoric[]): {
  labels: string[]
  datasets: ChartData<'line'>['datasets']
} {
  const steamData: { [key: string]: ItemHistoric } = {}
  const dmarketData: { [key: string]: ItemHistoric } = {}

  data.forEach((item) => {
    const formattedDate = formatDate(item.DateTime)
    if (item.ServiceType === 1) {
      steamData[formattedDate] = item
    } else if (item.ServiceType === 2) {
      dmarketData[formattedDate] = item
    }
  })

  const labels = Object.keys({ ...steamData, ...dmarketData }).sort()
  const steamPrices = labels.map((date) => (steamData[date] ? steamData[date].Price : null))
  const dmarketPrices = labels.map((date) => (dmarketData[date] ? dmarketData[date].Price : null))

  return {
    labels,
    datasets: [
      {
        label: 'Steam',
        data: steamPrices,
        borderColor: 'blue',
        backgroundColor: 'rgba(0, 0, 255, 0.5)',
        tension: 0.1
      },
      {
        label: 'DMarket',
        data: dmarketPrices,
        borderColor: 'green',
        backgroundColor: 'rgba(0, 255, 0, 0.5)',
        tension: 0.1
      }
    ]
  }
}

export function ChartsTeste({ data }: ChartsTesteProps): JSX.Element {
  const chartRef = useRef<HTMLCanvasElement | null>(null)
  const chartInstanceRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (data == null) return
    if (!chartRef.current) return

    const existingChart = Chart.getChart(chartRef.current)
    if (existingChart) {
      existingChart.destroy()
    }

    const { labels, datasets } = preprocessData(data)

    const chartData: ChartData<'line'> = {
      labels,
      datasets
    }

    const options: ChartOptions<'line'> = {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: (tooltipItem) =>
              `${tooltipItem.dataset.label}: ${formatPrice(tooltipItem.raw as number)}`
          }
        }
      }
    }

    chartInstanceRef.current = new Chart(chartRef.current, {
      type: 'line',
      data: chartData,
      options
    })
  }, [data])

  return <canvas ref={chartRef} />
}
