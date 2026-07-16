import { escapeHtml } from './markdown';

export function detectDocumentRequest(query) {
  const q = query.toLowerCase();
  const actionWords = /(genera|generame|redacta|redactame|escribe|escribeme|crea|creame|elabora|elaborame|hazme|haz|prepara|preparame)/;
  const docWords = /(carta|certificado|constancia|oficio|memorando|comunicado|documento|informe|acta|solicitud)/;
  return actionWords.test(q) && docWords.test(q);
}

// Genera un archivo .doc (compatible con Word) descargable a partir de HTML
export function generateDocDownload(title, htmlBodyContent) {
  const htmlDoc =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="utf-8"><title>' + escapeHtml(title) + '</title>' +
    '<style>body{font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.6;color:#000;} h1,h2,h3{color:#000;}</style>' +
    '</head><body>' + htmlBodyContent + '</body></html>';
  const blob = new Blob(['\ufeff' + htmlDoc], { type: 'application/msword' });
  return URL.createObjectURL(blob);
}

export function sanitizeFilename(text) {
  return (
    (text || 'Documento')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'Documento'
  );
}