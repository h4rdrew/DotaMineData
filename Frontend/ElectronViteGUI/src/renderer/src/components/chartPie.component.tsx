// Gera um gráfico de pizza (pie chart) usando os dados fornecidos.

import { ChartsPieProps } from '@renderer/interfaces'
import { Chart, ChartData } from 'chart.js'
import { useRef, useEffect } from 'react'

// Porcentagem relação Steam x DMarket
export function ChartPie({ data }: ChartsPieProps): JSX.Element {
  const chartRef = useRef<HTMLCanvasElement | null>(null)
  const chartInstanceRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (data == null) return
    if (!chartRef.current) return

    const existingChart = Chart.getChart(chartRef.current)
    if (existingChart) {
      existingChart.destroy()
    }

    const dmarketPrice = data
      .filter((item) => item.ServiceType === 2)
      .reduce((acc, item) => acc + item.Price, 0)
    const steamPrice = data
      .filter((item) => item.ServiceType === 1)
      .reduce((acc, item) => acc + item.Price, 0)

    const dmarketMaisCaro: boolean = ((dmarketPrice - steamPrice) / steamPrice) * 100 > 0
    const dmarketData = Math.round(Math.abs(((dmarketPrice - steamPrice) / steamPrice) * 100))
    const steamData = Math.round(100 - dmarketData)

    const chartData: ChartData<'doughnut'> = {
      labels: ['Steam', 'DMarket'],
      datasets: [
        {
          data: [steamData, dmarketData],
          backgroundColor: ['#36a2ebff', '#63ff68ff']
        }
      ]
    }

    chartInstanceRef.current = new Chart(chartRef.current, {
      type: 'doughnut',
      data: chartData,
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top'
          },
          title: {
            display: true,
            text: 'Últimos valores'
          },
          tooltip: {
            callbacks: {
              label: (tooltipItem): string =>
                `${tooltipItem.label}: ${tooltipItem.raw}% ${tooltipItem.label === 'DMarket' ? (dmarketMaisCaro ? '(mais caro)' : '(mais barato)') : ''}`
            }
          }
        }
      }
    })
  }, [data])

  return <canvas ref={chartRef} />
}
