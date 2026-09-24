# electronvitegui

## Atualização dos preços

No Windows, a opção **Atualizar todos os itens** do menu da engrenagem e o botão **Atualizar este item** executam
o ProcessaDados em segundo plano. O painel mostra o progresso real por item:
Steam em azul e DMarket em verde. 100% significa que todos os itens foram processados;
consultas sem preço são contabilizadas separadamente. O resultado só é confirmado
depois da gravação no SQLite. As tentativas e os intervalos dos coletores continuam ativos.
Quando a Steam retorna preços em dólar, o coletor os converte para reais usando
a cotação registrada na captura; valores que já vêm em reais são preservados.
Essa conversão pode diferir do preço exibido pela Steam para uma carteira em BRL.

Prepare o executável antes de usar esses botões em desenvolvimento:

```sh
npm run prepare:processor
npm run dev
```

Requer o SDK .NET 10 para publicar. A preparação gera `processor/` em Release,
com runtime .NET próprio e Chromium headless do Playwright. `npm run build:win`
faz essa preparação automaticamente e inclui os arquivos no instalador.
O computador de destino não precisa instalar o SDK ou o runtime .NET.

Configuração opcional por variáveis de ambiente:

- `DOTAMINE_DATABASE_PATH`: banco compartilhado; padrão `E:\dotaItemCollectData.db`.
- `DOTAMINE_PROCESSOR_PATH`: caminho absoluto de outro `ProcessaDados.App.exe`
  publicado com suporte à integração. Suas dependências devem acompanhar o executável.
- `DOTAMINE_PROCESSOR_PROJECT`: caminho do `.csproj` para a preparação;
  padrão `../../ProcessaDados/ProcessaDados.App/ProcessaDados.App.csproj`.

O modo integrado recebe `--integrated --database <caminho>` e, opcionalmente,
`--item-id <id>`. Não precisa do `config.json`, não pede ENTER e não abre console.
Eventos JSON com prefixo `@dotamine:` informam progresso e resultado;
códigos de saída: 0 = sucesso, 2 = parcial, 1 = erro, 3 = cancelado.
O comando `cancel` pela entrada padrão solicita o cancelamento cooperativo.
Executar sem argumentos mantém o modo de console original.

Só uma atualização pode ser iniciada por vez. Durante a coleta, o fechamento da
janela aguarda a conclusão para preservar a gravação. Ao terminar, os preços da
lista e o histórico do item selecionado são recarregados; uma data histórica
selecionada continua mostrando aquela data. Sessões privadas da Steam não são
incluídas no instalador.

O progresso é exibido em um diálogo. Fechá-lo mantém a coleta em segundo plano;
o indicador **Atualizando dados…** no canto inferior direito permite reabri-lo com
o progresso atual. O indicador também mostra o resultado após a conclusão.
O botão **Cancelar atualização** fica dentro do diálogo e permanece disponível mesmo com o painel recolhido.
Ele interrompe as consultas e esperas dos dois mercados, fecha o navegador da Steam
e salva os preços obtidos até então. Durante **Cancelando…**, uma nova coleta fica
bloqueada; após o encerramento, o app recarrega os preços e permite atualizar novamente.

Validação da integração:

```sh
npm run test:collector
npm run test:processor
npm run test:steam-price
npm run build
npm run test:collection-ui
```

O teste do ProcessaDados usa um banco temporário e requer `prepare:processor`.
O teste visual executa o Electron oculto com dados simulados, sem acessar os mercados.

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
