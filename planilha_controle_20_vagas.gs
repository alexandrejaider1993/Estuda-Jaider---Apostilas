/**
 * ============================================================================
 * ESTUDA JAIDER — CONTROLE DE 50 VAGAS E LISTA DE E-MAILS (GOOGLE SHEETS)
 * ============================================================================
 *
 * COMO ATIVAR NA SUA CONTA GOOGLE (leva 2 minutos):
 *
 * 1. Abra https://sheets.new para criar uma nova Planilha no seu Google Drive
 *    e dê o nome de "Estuda Jaider - Alunos e Vagas".
 * 2. No menu superior da planilha, clique em: Extensões > Apps Script.
 * 3. Apague o código que estiver lá, cole TODO este arquivo e clique no ícone
 *    de Disquete (Salvar).
 * 4. No canto superior direito, clique em "Implantar" (Deploy) > "Nova implantação":
 *    - Clique na engrenagem ao lado de "Selecione o tipo" e escolha "App da Web".
 *    - Em "Executar como": deixe "Eu (seu e-mail)".
 *    - Em "Quem pode acessar": escolha "Qualquer pessoa" (Anyone).
 *    - Clique em "Implantar" (autorize o acesso à sua planilha se o Google pedir).
 * 5. Copie a "URL do app da Web" gerada (termina com /exec) e me envie aqui no
 *    chat (ou cole na constante URL_CONTROLE_VAGAS_PADRAO em storage_drive.js).
 *
 * COMO FUNCIONA A PLANILHA:
 * - Coluna A: Vaga # (1, 2, 3...)
 * - Coluna B: E-mail do aluno
 * - Coluna C: Nome do aluno
 * - Coluna D: Status ("ATIVO" ou "BLOQUEADO")
 * - Coluna E: Primeiro acesso (Data/Hora)
 * - Coluna F: Último acesso (Data/Hora)
 * - Coluna G: Total de logins
 *
 * DICAS DE CONTROLE DIRETO NA PLANILHA:
 * - Os primeiros 50 e-mails que fizerem login entram automaticamente como "ATIVO".
 * - Do 51º em diante, o sistema bloqueia a entrada ("As 50 vagas já foram preenchidas")
 *   e registra a tentativa na planilha com status "FILA_ESPERA" para você ver quem tentou!
 * - Se quiser liberar uma vaga para alguém da fila, basta mudar a coluna D (Status)
 *   de um aluno antigo para "BLOQUEADO" (ou apagar a linha dele) e mudar o novo para "ATIVO"!
 */

const LIMITE_PADRAO = 50;

function garantirCabecalho(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Vaga #",
      "E-mail",
      "Nome",
      "Status",
      "Primeiro Acesso",
      "Último Acesso",
      "Acessos",
      "",
      "LIMITE DE VAGAS:",
      LIMITE_PADRAO
    ]);
    sheet.getRange("A1:J1").setFontWeight("bold");
    sheet.getRange("J1").setBackground("#fff2cc");
    sheet.setFrozenRows(1);
  } else if (!sheet.getRange("I1").getValue()) {
    sheet.getRange("I1").setValue("LIMITE DE VAGAS:").setFontWeight("bold");
    sheet.getRange("J1").setValue(LIMITE_PADRAO).setFontWeight("bold").setBackground("#fff2cc");
  }
}

function obterLimiteDaPlanilha(sheet, limiteFallback) {
  const valCelula = Number(sheet.getRange("J1").getValue());
  if (valCelula > 0) return valCelula;
  return Number(limiteFallback) > 0 ? Number(limiteFallback) : LIMITE_PADRAO;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const dados = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const email = String(dados.email || "").trim().toLowerCase();
    const nome = String(dados.nome || "Estudante").trim();
    if (!email) {
      return respostaJSON({ autorizado: false, mensagem: "E-mail não informado." });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0];
    garantirCabecalho(sheet);
    const limite = obterLimiteDaPlanilha(sheet, dados.limite);

    const agora = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
    const ultimaLinha = sheet.getLastRow();
    const valores = ultimaLinha > 1 ? sheet.getRange(2, 1, ultimaLinha - 1, 7).getValues() : [];

    let linhaUsuario = -1;
    let statusUsuario = "";
    let acessosUsuario = 0;
    let totalAtivos = 0;

    for (let i = 0; i < valores.length; i++) {
      const emailLinha = String(valores[i][1] || "").trim().toLowerCase();
      const statusLinha = String(valores[i][3] || "ATIVO").trim().toUpperCase();

      if (statusLinha === "ATIVO") {
        totalAtivos++;
      }
      if (emailLinha === email) {
        linhaUsuario = i + 2; // +2 por causa do índice 0 e do cabeçalho
        statusUsuario = statusLinha;
        acessosUsuario = Number(valores[i][6] || 0);
      }
    }

    // Caso 1: Usuário já está na planilha
    if (linhaUsuario !== -1) {
      if (statusUsuario === "ATIVO") {
        sheet.getRange(linhaUsuario, 3).setValue(nome);
        sheet.getRange(linhaUsuario, 6).setValue(agora);
        sheet.getRange(linhaUsuario, 7).setValue(acessosUsuario + 1);
        return respostaJSON({
          autorizado: true,
          vaga: linhaUsuario - 1,
          total: totalAtivos
        });
      }

      // Se ele estava em FILA_ESPERA mas agora abriu uma vaga entre os ativos:
      if (statusUsuario === "FILA_ESPERA" && totalAtivos < limite) {
        totalAtivos++;
        sheet.getRange(linhaUsuario, 1).setValue(totalAtivos);
        sheet.getRange(linhaUsuario, 3).setValue(nome);
        sheet.getRange(linhaUsuario, 4).setValue("ATIVO");
        sheet.getRange(linhaUsuario, 6).setValue(agora);
        sheet.getRange(linhaUsuario, 7).setValue(acessosUsuario + 1);
        return respostaJSON({
          autorizado: true,
          vaga: totalAtivos,
          total: totalAtivos
        });
      }

      return respostaJSON({
        autorizado: false,
        mensagem: statusUsuario === "BLOQUEADO"
          ? "Seu acesso foi desativado pelo administrador."
          : "As " + limite + " vagas do Estuda Jaider já estão preenchidas no momento."
      });
    }

    // Caso 2: Usuário novo e ainda há vagas disponíveis (< limite)
    if (totalAtivos < limite) {
      const novaVaga = totalAtivos + 1;
      sheet.appendRow([
        novaVaga,
        email,
        nome,
        "ATIVO",
        agora,
        agora,
        1
      ]);
      return respostaJSON({
        autorizado: true,
        vaga: novaVaga,
        total: novaVaga
      });
    }

    // Caso 3: Usuário novo mas as vagas já acabaram -> registra na fila de espera
    sheet.appendRow([
      "-",
      email,
      nome,
      "FILA_ESPERA",
      agora,
      agora,
      1
    ]);

    return respostaJSON({
      autorizado: false,
      mensagem: "As " + limite + " vagas do Estuda Jaider já foram preenchidas."
    });

  } catch (err) {
    return respostaJSON({
      autorizado: true,
      erro_interno: String(err)
    });
  } finally {
    lock.releaseLock();
  }
}

function respostaJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
