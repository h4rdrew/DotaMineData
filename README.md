### O projeto

Coletar dados dos preços dos itens do Dota 2 de diferentes markets, de acordo com a cotação atual do dólar. Todos os preços serão convertidos em **REAL** (BRL).

Exibe em uma GUI os dados coletados.

### Tecnologias

- Aplicação de coleta de dados desenvolvido em ASP .NET Core 9 ([Link](https://github.com/h4rdrew/DotaMineData/tree/main/ProcessaDados))
- Aplicação GUI desenvolvido em Electron + Vite + React ([Link](https://github.com/h4rdrew/DotaMineData/tree/main/Frontend/ElectronViteGUI))

### Roadmap

- [x] Coleta IDs dos itens no liquipedia
- [x] Coleta dados no DMarket
- [x] Coleta dados na Steam
- [x] Grava dados da coleta em Banco de Dados (sqlite)
- [x] Pega cotação atual do dólar via API

### Utilizando:

Para a primeira utilização, na raíz da aplicação de coleta, crie um arquivo `config.json`, deixe a estrutura como:
~~~json
{
  "awesomeApiKey": "",
  "dbPath": "",
  "imgPath": "",
  "steamCookies": "",
  "items": [],
  "itemIds": []
}
~~~




é preciso informar quais os itens você deseja coletar os dados. Atualmente o sistema conta com apenas duas formas de coleta:

_(cheque o [Roadmap]() para futuras atualizações)_.
### Nome

### ID

## Utilizando:

1. Crie um arquivo "ConfigJson.json" seguindo a model: [ConfigJson.cs](https://github.com/h4rdrew/dotaitemmine/blob/main/models/ConfigJson.cs)
2. Propriedades obrigatórias para a inicialização: `Items`, `DbPath`, `SteamCookies`

- `Items`: Nomes dos itens para coletar.
- `DbPath`: Localização do banco de dados que será criado/acessado.
- `SteamCookies`: Cookies da sessão atual (leia mais sobre abaixo)

3. Atualize a constante `exchangeRate` com a cotação atual.
4. Para a primeira inicialização, será necessário coletar apenas uma vez todos os IDs dos itens que você informou na propriedade "Items". Com isso, descomente a linha `await capturaIdItens(cnn, config.Items);` e comente todo o código abaixo.
5. Execute a aplicação, os IDs serão gravados no BD.
6. Para coletar os dados dos market, comente de volta a linha `await capturaIdItens(cnn, config.Items);` e descomente o código abaixo dele.
7. Execute a aplicação, os dados serão gravados no BD.

### Steam Cookies

Para poder capturar dados da steam, é necessário informar os cookies para autenticar a requisição (NÃO TENHO CERTEZA, ESTOU ESTUDANDO SOBRE ISSO). Com isso, acesse o site da Steam, entre na loja da comunidade, F12 > Network > .html (página principal), copie os cookies.
