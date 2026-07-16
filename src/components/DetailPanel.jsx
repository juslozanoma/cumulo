import { COLORS } from '../utils/constants';

export default function DetailPanel({ chunks }) {
  if (!chunks || chunks.length === 0) return null;

  const seen = new Set();
  const docs = [];
  chunks.forEach((chunk) => {
    const doc = chunk._doc;
    const key = doc.document_id || (doc.file?.name || '') + '|' + (doc.dates?.start || '');
    if (!seen.has(key)) {
      seen.add(key);
      docs.push(doc);
    }
  });

  return (
    <div className="detail-panel show">
      <h4>Fuentes</h4>
      <ul className="source-list">
        {docs.map((doc, i) => (
          <li key={i} className="source-item" style={{ borderLeftColor: COLORS[i % COLORS.length] }}>
            <span className="source-file">{doc.file?.name || 'Documento sin nombre'}</span>
            <span className="source-folder">{doc.file?.folder || doc.folder || doc.committee || 'Sin carpeta'}</span>
            <span className="source-date">{doc.dates?.start || 'Sin fecha'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}