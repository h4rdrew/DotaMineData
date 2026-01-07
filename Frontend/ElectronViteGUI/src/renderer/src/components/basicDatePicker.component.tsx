import { DemoContainer } from '@mui/x-date-pickers/internals/demo'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { Dayjs } from 'dayjs'

export default function BasicDatePicker({
  onChange
}: {
  onChange: (newValue: Dayjs | null) => void
}): JSX.Element {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DemoContainer components={['DatePicker']}>
        <DatePicker format="DD/MM/YYYY" label="Buscar por data" onChange={onChange} />
      </DemoContainer>
    </LocalizationProvider>
  )
}
