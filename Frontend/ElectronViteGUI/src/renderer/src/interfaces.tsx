export interface ItemDB {
  Id: number
  ItemId: number
  Name: string
}

export interface DataDB {
  Id: number
  ItemId: number
  Price: number
  CaptureId: string
}

export interface ItemHistoric {
  ItemId: number
  Price: number
  ServiceType: number
  ExchangeRate: number
  DateTime: string
}

export interface ChartsTesteProps {
  labels: string[]
  data: ItemHistoric[] | null
}
