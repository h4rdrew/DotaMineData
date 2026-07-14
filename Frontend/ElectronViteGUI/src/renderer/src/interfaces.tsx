import type { Hero, Item, ItemHistory, ItemPrice } from '../../shared/contracts'

export interface ItemDB extends Item {
  Id: number
  ItemId: number
  Name: string
  Purchased: boolean
  Hero: number
}

export interface DataDB {
  Id: number
  ItemId: number
  Price: number
  CaptureId: string
}

export type ItemHistoric = ItemHistory

export interface ChartsLineProps {
  labels: string[]
  data: ItemHistoric[] | null
}

export interface ChartsPieProps {
  data: ItemDataDateNow[] | null
}

export type ItemDataDateNow = ItemPrice

export interface ItemMenu {
  Id: number
  ItemId: number
  Purchased: boolean
  Name: string
  Data: ItemDataDateNow[]
  Hero: number
}

export type Heroes = Hero
