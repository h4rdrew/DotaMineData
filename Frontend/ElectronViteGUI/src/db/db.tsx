// import Sqlite3 from 'sqlite3'

// async function loadDB(): Promise<unknown> {
//   return new Promise((resolve, reject) => {
//     const db = new Sqlite3.Database('E:\\dotaItemCollectData.db', Sqlite3.OPEN_READONLY)

//     db.all('SELECT * FROM Item', [], (err, rows) => {
//       if (err) {
//         console.error('Erro ao ler o DB.')
//         reject(err)
//       } else {
//         console.log('Sucesso em ler o DB.')
//         resolve(rows)
//       }
//     })
//     db.close()
//   })
// }

// export default loadDB
