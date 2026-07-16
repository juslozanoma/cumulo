import { useCallback, useRef, useState } from 'react';
import Logo from './components/Logo';
import ApiAuthRow from './components/ApiAuthRow';
import SearchBox from './components/SearchBox';
import ChatArea from './components/ChatArea';
import LoadingBox from './components/LoadingBox';
import { useKnowledgeBase } from './hooks/useKnowledgeBase';
import { useLiveMode } from './hooks/useLiveMode';
import { verifyApiKey, generateWithFallback } from './utils/gemini';
import { findRelevantChunks, buildContext, buildHistoryBlock, buildRetrievalQuery } from './utils/search';
import { formatMarkdown, truncateToWords } from './utils/markdown';
import { detectDocumentRequest, generateDocDownload, sanitizeFilename } from './utils/docGenerator';

let idCounter = 0;
const nextId = (prefix) => prefix + '-' + Date.now() + '-' + idCounter++;

export default function App() {
  const { kbDocuments, knowledgeBase } = useKnowledgeBase();

  const [apiKey, setApiKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [chatModeActive, setChatModeActive] = useState(false);

  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState([]);

  const qaHistoryRef = useRef([]); // [{question, answer}] para contexto RAG/live

  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const addMessage = useCallback((msg) => {
    const id = msg.id || nextId(msg.role);
    setMessages((prev) => [...prev, { ...msg, id }]);
    return id;
  }, []);

  const updateMessageText = useCallback((id, text) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text } : m)));
  }, []);

  const removeMessage = useCallback((id) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const listeningIdRef = useRef(null);

  const showListeningBubble = useCallback(() => {
    if (listeningIdRef.current) removeMessage(listeningIdRef.current);
    const id = addMessage({ role: 'listening' });
    listeningIdRef.current = id;
  }, [addMessage, removeMessage]);

  const removeListeningBubble = useCallback(() => {
    if (listeningIdRef.current) {
      removeMessage(listeningIdRef.current);
      listeningIdRef.current = null;
    }
  }, [removeMessage]);

  const addSystemMessage = useCallback(
    (text, plain) => {
      setChatModeActive(true);
      addMessage({ role: 'system', text, plain });
    },
    [addMessage]
  );

  const { isLiveMode, toggleLive, sendLiveText } = useLiveMode(kbDocuments, {
    onSystemMessage: addSystemMessage,
    onShowListening: showListeningBubble,
    onRemoveListening: removeListeningBubble,
    onLiveAnswerStart: (qText) => {
      setChatModeActive(true);
      return addMessage({ role: 'user', text: qText, __isLiveAnswerUser: true }) &&
        addMessage({ role: 'assistant', text: '' });
    },
    onLiveAnswerUpdate: (id, text) => updateMessageText(id, text),
    onLiveAnswerComplete: (id, question, answer) => {
      qaHistoryRef.current.push({ question, answer });
    },
  });

  const authenticate = useCallback(async () => {
    if (isTouchDevice && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }

    if (!apiKey) {
      setAuthError(true);
      setAuthSuccess(false);
      return;
    }

    setAuthLoading(true);
    setAuthSuccess(false);
    setAuthError(false);

    const valid = await verifyApiKey(apiKey);
    setAuthLoading(false);

    if (valid) {
      setIsAuthenticated(true);
      setChatModeActive(true);
      setAuthSuccess(true);
      setAuthError(false);
    } else {
      setAuthError(true);
      setAuthSuccess(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const finishInteraction = useCallback(() => {
    setIsProcessing(false);
    setQuery('');
  }, []);

  const search = useCallback(async () => {
    setAuthSuccess(false);

    if (!isAuthenticated) {
      addMessage({ role: 'assistant', text: 'Acceso denegado. Este documento contiene informacion confidencial. Solicita el codigo e intenta nuevamente.' });
      return;
    }

    if (!query.trim()) {
      addMessage({
        role: 'assistant',
        text: 'Este buscador te permite consultar informacion sobre decisiones, actas y procesos del grupo de astronomia Cumulo. Puedes preguntar sobre reuniones, acuerdos, eventos, proyectos y cualquier documento relevante de la organizacion.',
      });
      return;
    }

    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const retrievalQuery = buildRetrievalQuery(qaHistoryRef.current, query);
      const relevantChunks = findRelevantChunks(knowledgeBase, retrievalQuery);

      if (relevantChunks.length === 0) {
        addMessage({ role: 'user', text: query });
        addMessage({ role: 'assistant', text: 'No encontre documentos relevantes. Intenta con otras palabras clave.' });
        finishInteraction();
        return;
      }

      const context = buildContext(relevantChunks);
      const historyBlock = buildHistoryBlock(qaHistoryRef.current, 3);
      const wantsDocument = detectDocumentRequest(query);

      const prompt = wantsDocument
        ? 'Eres un asistente experto en los procesos, decisiones y documentos del grupo de astronomia Cumulo. Con base en los documentos proporcionados, redacta el documento que pide el usuario de forma completa, formal y bien estructurada (encabezado, cuerpo, cierre y firma si corresponde). Usa fechas, nombres, cargos y decisiones reales de los documentos cuando sean relevantes; si falta un dato especifico, deja un marcador claro como "[completar]" en vez de inventarlo.\n\nDOCUMENTOS RELEVANTES:\n' +
          context +
          historyBlock +
          '\n\nSOLICITUD DEL USUARIO: ' +
          query +
          '\n\nEn la PRIMERA linea escribe unicamente "TITULO: " seguido de un titulo breve y descriptivo para este documento especifico (ej. "Acta N.° 12 de Comite de Observacion", "Certificado de Participacion - Felipe Munoz"). Deja una linea en blanco y a continuacion escribe el texto completo del documento, listo para usar.'
        : 'Eres un asistente experto en los procesos, decisiones y documentos del grupo de astronomia Cumulo. Responde de forma breve (menos de 50 palabras) con base en los documentos proporcionados. Prioriza la informacion mas reciente si hay datos repetidos.\n\nDOCUMENTOS RELEVANTES:\n' +
          context +
          historyBlock +
          '\n\nPREGUNTA DEL USUARIO: ' +
          query +
          '\n\nINSTRUCCIONES:\n1. Basa tu respuesta en la informacion de los documentos proporcionados\n2. Si la pregunta hace referencia a algo mencionado antes en la conversacion (ej. "eso", "cuando se creo", "quien lo propuso"), usa el HISTORIAL para saber a que se refiere\n3. Si la pregunta pide un analisis, opinion o inferencia que no esta escrita explicitamente (ej. que podria faltar, riesgos, recomendaciones), razona brevemente a partir de la informacion disponible y aclara que es un analisis\n4. Si la pregunta busca un dato factual puntual que simplemente no aparece en los documentos ni se puede inferir, di "No encontre informacion sobre esto en los documentos"\n5. Prioriza la informacion mas reciente si hay datos repetidos';

      const data = await generateWithFallback(prompt, apiKey);

      let answer =
        (data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text) || 'No pude generar respuesta';

      let downloadUrl = null;
      let downloadName = null;

      if (wantsDocument) {
        let docTitle = query;
        const titleMatch = answer.match(/^\s*T[IÍ]TULO:\s*(.+?)\s*\r?\n+/i);
        if (titleMatch) {
          docTitle = titleMatch[1].trim();
          answer = answer.slice(titleMatch[0].length).trim();
        }
        downloadUrl = generateDocDownload(docTitle, formatMarkdown(answer));
        downloadName = sanitizeFilename(docTitle) + '.doc';
      } else {
        answer = truncateToWords(answer, 50);
      }

      addMessage({ role: 'user', text: query });
      addMessage({ role: 'assistant', text: answer, chunks: relevantChunks, downloadUrl, downloadName });

      qaHistoryRef.current.push({ question: query, answer });
    } catch (error) {
      addMessage({ role: 'user', text: query });
      addMessage({ role: 'assistant', text: 'Error: ' + error.message });
    }

    finishInteraction();
  }, [apiKey, isAuthenticated, isProcessing, knowledgeBase, query, addMessage, finishInteraction]);

  const handleSubmit = useCallback(() => {
    if (isLiveMode) {
      const text = query.trim();
      if (text) {
        sendLiveText(text);
        setQuery('');
      }
    } else {
      search();
    }
  }, [isLiveMode, query, sendLiveText, search]);

  const inputsDisabled = isProcessing;

  return (
    <div className={'container' + (chatModeActive ? ' chat-mode' : '')}>
      {!chatModeActive && <Logo />}

      <ApiAuthRow
        apiKey={apiKey}
        setApiKey={setApiKey}
        onAuthenticate={authenticate}
        authLoading={authLoading}
        authSuccess={authSuccess}
        authError={authError}
        hideRow={chatModeActive}
        disabled={inputsDisabled}
      />

      {chatModeActive && <ChatArea messages={messages} />}

      {chatModeActive && (
        <SearchBox
          query={query}
          setQuery={setQuery}
          onSubmit={handleSubmit}
          isLiveMode={isLiveMode}
          onToggleLive={() => toggleLive(apiKey)}
          disabled={inputsDisabled || !isAuthenticated}
        />
      )}

      <LoadingBox show={isProcessing} />
    </div>
  );
}