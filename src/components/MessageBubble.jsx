import { useState } from 'react';
import { formatMarkdown } from '../utils/markdown';
import DetailPanel from './DetailPanel';

// message: { id, role: 'user'|'assistant'|'system'|'listening', text, chunks, downloadUrl, downloadName, plain }
export default function MessageBubble({ message }) {
  const [showDetail, setShowDetail] = useState(false);

  if (message.role === 'system') {
    return (
      <div className={'msg-row system' + (message.plain ? ' modo-live-status' : '')}>
        <div className="msg-bubble">{message.text}</div>
      </div>
    );
  }

  if (message.role === 'listening') {
    return (
      <div className="msg-row user">
        <div className="msg-bubble">Escuchando...</div>
      </div>
    );
  }

  if (message.role === 'user') {
    return (
      <div className="msg-row user">
        <div className="msg-bubble">{message.text}</div>
      </div>
    );
  }

  // assistant
  const hasChunks = message.chunks && message.chunks.length > 0;
  return (
    <div className="msg-row assistant">
      <div className="msg-bubble">
        <span dangerouslySetInnerHTML={{ __html: formatMarkdown(message.text || '') }} />

        {message.downloadUrl && (
          <div className="doc-download">
            <a href={message.downloadUrl} download={message.downloadName || 'documento.doc'} className="btn-download">
              📄 Descargar documento
            </a>
          </div>
        )}

        {hasChunks && (
          <div className="msg-meta">
            <button className="btn-info" title="Ver fuentes" onClick={() => setShowDetail((v) => !v)}>
              i
            </button>
          </div>
        )}

        {hasChunks && showDetail && <DetailPanel chunks={message.chunks} />}
      </div>
    </div>
  );
}