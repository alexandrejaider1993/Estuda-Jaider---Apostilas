# Estuda Jaider · Apostilas Interativas (Vercel)

Site estático das **Apostilas Interativas** com o **Estojo completo** (marca-texto Stabilo Boss Pastel/Neon/Nature com mistura multiplicativa, sublinhado, tachado, caneta, marcador, borracha, notas post-it e adesivos/setas/rótulos), **Trilho de capítulos**, **Navegação avançada**, **Busca dentro da apostila e em todas as apostilas**, **Pastas personalizadas com desenhos e GIFs animados**, **Cálculo de Domínio por Conceito (BKT)** e **Login com Google + Sincronização automática no Google Drive** de cada aluno.

---

## 1. Como publicar no Vercel

1. Crie um repositório no GitHub com o conteúdo desta pasta (`Apostilas-Vercel`) ou use a CLI do Vercel:
   ```bash
   npx vercel
   ```
2. No painel do Vercel:
   - **Framework Preset:** `Other` (Site estático puro, sem etapa de build necessária)
   - **Output Directory:** `.` (raiz do projeto)

---

## 2. Como liberar o Login com Google no domínio do Vercel

Para que você e seus colegas de sala possam clicar em **"Entrar com Google"** e salvar o progresso no Google Drive de cada um:

1. Acesse o [Google Cloud Console — Credenciais](https://console.cloud.google.com/apis/credentials).
2. Clique no seu **ID do cliente OAuth 2.0** (`363099555044-2v1qfhn1an7j46op8foien17mo139qfl.apps.googleusercontent.com`) ou crie um novo do tipo **Aplicativo da Web**.
3. Em **Origens JavaScript autorizadas** (*Authorized JavaScript origins*), adicione a URL do seu site no Vercel, por exemplo:
   - `https://seu-projeto.vercel.app`
   - `http://localhost:8080` (para testes locais)
4. Verifique se a **Google Drive API** está ativada em *APIs e Serviços > Biblioteca* no mesmo projeto do Google Cloud.
5. Pronto! Cada pessoa que entrar com sua conta Google terá seu progresso, posição de leitura, pastas e marcações do Estojo salvos na pasta oculta do aplicativo (`appDataFolder`) dentro do seu próprio Google Drive.

*(Observação: Caso você crie um Client ID novo, pode trocá-lo direto na interface clicando no botão da conta Google no topo > **Configuração avançada (Google Client ID)**, ou alterando a constante `CLIENT_ID_PADRAO` em `storage_drive.js`.)*

---

## 3. Como adicionar novas apostilas ao catálogo

Sempre que você gerar uma nova apostila:

1. Coloque a pasta da nova apostila dentro de `interativos/<nome-da-pasta>/` (contendo `index.html`, `biblioteca.json` e opcionalmente `capa.jpg`).
2. Se quiser organizá-la dentro de uma pasta padrão para toda a turma, edite `organizacao_padrao` em `catalogo.json`.
3. Rode o script na raiz desta pasta:
   ```bash
   python atualizar_catalogo.py
   ```
4. Ele atualizará automaticamente `catalogo.json` e `indice_busca.json` com todos os conceitos, testes (para o cálculo de Domínio BKT) e textos (para a busca global). Depois é só fazer `git push` para o Vercel atualizar o site!

*(Além disso, qualquer usuário também pode clicar em **"Adicionar apostila"** direto no navegador para importar um arquivo `.html` localmente no seu aparelho!)*
