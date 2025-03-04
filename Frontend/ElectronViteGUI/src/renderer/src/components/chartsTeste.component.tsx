import { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'

function ChartsTeste(): JSX.Element {
  const chartRef = useRef<HTMLCanvasElement | null>(null)
  const chartInstanceRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    // Verifica se já existe um gráfico para esse canvas e o destrói se necessário
    const existingChart = Chart.getChart(chartRef.current)
    if (existingChart) {
      existingChart.destroy()
    }

    // Cria uma nova instância do gráfico
    chartInstanceRef.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels: ['Janeiro', 'Fevereiro', 'Março', 'Abril'],
        datasets: [
          {
            label: 'Vendas',
            data: [12, 19, 3, 5],
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    })

    // Destrói o gráfico ao desmontar o componente
    return (): void => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy()
      }
    }
  }, [])

  return <canvas ref={chartRef} id="myChart" />
}

export default ChartsTeste
