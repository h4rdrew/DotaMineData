export interface ItemDB {
  Id: number
  ItemId: number
  Name: string
  Purchased: boolean
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

export interface ItemDataDateNow {
  ItemId: number
  Price: number
  ServiceType: number
}

export interface ItemMenu {
  Id: number
  ItemId: number,
  Purchased: boolean,
  Name: string
  Data: ItemDataDateNow[]
}
