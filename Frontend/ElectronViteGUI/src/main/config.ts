import path from 'path'

export const appPaths = {
  database: process.env.DOTAMINE_DATABASE_PATH ?? 'E:\\dotaItemCollectData.db',
  images: process.env.DOTAMINE_IMAGES_PATH ?? path.join('E:\\DotaMine', 'img')
} as const
