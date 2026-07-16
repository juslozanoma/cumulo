import { useCallback, useRef, useState } from 'react';
import { GEMINI_LIVE_MODEL } from '../utils/constants';
import { arrayBufferToBase64, createPcmWorkletUrl } from '../utils/audio';

// callbacks: {
//   onSystemMessage(text, plain),
//   onShowListening(), onRemoveListening(),
//   onLiveAnswerStart(question) -> returns id,
//   onLiveAnswerUpdate(id, text),
//   onLiveAnswerComplete(id, question, answer),
// }
export function useLiveMode(kbDocuments, callbacks) {
  const [isLiveMode, setIsLiveMode] = useState(false);

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioWorkletRef = useRef(null);
  const outputCtxRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef([]);

  const answerIdRef = useRef(null);
  const inputBufferRef = useRef('');
  const outputBufferRef = useRef('');

  const buildLiveSystemInstruction = useCallback(() => {
    const allDocs = [...kbDocuments].sort((a, b) => {
      const da = a.dates?.start ? new Date(a.dates.start).getTime() : 0;
      const db = b.dates?.start ? new Date(b.dates.start).getTime() : 0;
      return db - da;
    });

    let kbContext = '';
    if (allDocs.length > 0) {
      kbContext =
        '\n\nBASE DE CONOCIMIENTO COMPLETA (Cumulo) - ' + allDocs.length + ' documentos:\n' +
        allDocs
          .map((doc) => {
            const parts = [];
            parts.push('[' + doc.document_id + ' | ' + doc.document_type + ' | ' + doc.committee + ']');
            parts.push('Fecha: ' + (doc.dates?.start || 'N/A') + ' | Estado: ' + doc.status);
            parts.push(doc.summary || '');
            return parts.join('\n');
          })
          .join('\n\n---\n\n');
    }

    return (
      'Eres un asistente experto en los procesos, decisiones y documentos del grupo de astronomia Cumulo. Tienes acceso al resumen de TODOS los documentos de la organizacion (no solo los recientes), usalos para responder sobre cualquier archivo que te pregunten. Responde de forma breve, clara y concisa como en una conversacion de voz. Recuerda lo dicho antes en esta misma conversacion para entender referencias como "eso" o "cuando se creo". Si no sabes algo, di "No tengo esa informacion".\n' +
      kbContext +
      '\n\nINSTRUCCIONES:\n1. Responde en maximo 30 palabras\n2. Usa un tono conversacional y amigable\n3. Si preguntan por algo especifico de los documentos, usa la informacion proporcionada\n4. Si piden un analisis breve (ej. que podria faltar), razona en pocas palabras con base en la informacion disponible\n5. Si no estas seguro, di "No tengo esa informacion"'
    );
  }, [kbDocuments]);

  const ensureOutputContext = useCallback(() => {
    if (!outputCtxRef.current) {
      outputCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    }
    return outputCtxRef.current;
  }, []);

  const stopAllLiveAudio = useCallback(() => {
    activeSourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch (e) {
        /* ya pudo haber terminado */
      }
    });
    activeSourcesRef.current = [];
    if (outputCtxRef.current) nextStartTimeRef.current = outputCtxRef.current.currentTime;
  }, []);

  const playAudioChunk = useCallback(
    (base64Data) => {
      try {
        const ctx = ensureOutputContext();
        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);

        const view = new DataView(bytes.buffer);
        const sampleCount = Math.floor(len / 2);
        if (sampleCount === 0) return;

        const audioBuffer = ctx.createBuffer(1, sampleCount, 24000);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < sampleCount; i++) {
          channelData[i] = view.getInt16(i * 2, true) / 32768;
        }

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        const now = ctx.currentTime;
        if (nextStartTimeRef.current < now) nextStartTimeRef.current = now;
        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += audioBuffer.duration;

        activeSourcesRef.current.push(source);
        source.onended = () => {
          const idx = activeSourcesRef.current.indexOf(source);
          if (idx !== -1) activeSourcesRef.current.splice(idx, 1);
        };
      } catch (e) {
        console.error('Error reproduciendo audio:', e);
      }
    },
    [ensureOutputContext]
  );

  const startMicrophoneCapture = useCallback(async () => {
    try {
      console.log('[LIVE] Solicitando micrófono...');
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 16000 },
      });
      console.log('[LIVE] Micrófono obtenido');

      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('[LIVE] AudioContext resumido');
      }

      const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);

      if (audioContextRef.current.audioWorklet) {
        console.log('[LIVE] Usando AudioWorklet');
        const workletUrl = createPcmWorkletUrl();
        await audioContextRef.current.audioWorklet.addModule(workletUrl);

        const workletNode = new AudioWorkletNode(audioContextRef.current, 'pcm-encoder');
        workletNode.port.onmessage = (e) => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
          const base64 = arrayBufferToBase64(e.data);
          wsRef.current.send(
            JSON.stringify({ realtimeInput: { audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } } })
          );
        };

        source.connect(workletNode);
        audioWorkletRef.current = workletNode;
      } else {
        console.log('[LIVE] Fallback a ScriptProcessorNode');
        const bufferSize = 4096;
        const processor = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);

        processor.onaudioprocess = (e) => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff;
          }
          const base64 = arrayBufferToBase64(pcmData.buffer);
          wsRef.current.send(
            JSON.stringify({ realtimeInput: { audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } } })
          );
        };

        source.connect(processor);
        processor.connect(audioContextRef.current.destination);
        audioWorkletRef.current = processor;
      }

      console.log('[LIVE] Captura de audio iniciada');
    } catch (e) {
      console.error('[LIVE] Error accediendo al micrófono:', e);
      callbacks.onSystemMessage('No se pudo acceder al micrófono: ' + e.message, false);
      stopLiveMode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopLiveMode = useCallback(() => {
    const wasLive = isLiveMode;
    setIsLiveMode(false);
    callbacks.onRemoveListening();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioWorkletRef.current) {
      audioWorkletRef.current.disconnect();
      audioWorkletRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    stopAllLiveAudio();
    if (outputCtxRef.current) {
      outputCtxRef.current.close();
      outputCtxRef.current = null;
    }

    answerIdRef.current = null;
    inputBufferRef.current = '';
    outputBufferRef.current = '';

    if (wasLive) {
      callbacks.onSystemMessage('Finalizo Modo Live - Escribe para continuar.', true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLiveMode, stopAllLiveAudio]);

  const startLiveMode = useCallback(
    (apiKey) => {
      setIsLiveMode(true);
      inputBufferRef.current = '';
      outputBufferRef.current = '';
      answerIdRef.current = null;

      callbacks.onSystemMessage('Modo Live activo — Puedes hablar', true);

      const wsUrl =
        'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=' +
        apiKey;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('Live WebSocket connected');
          ws.send(
            JSON.stringify({
              setup: {
                model: 'models/' + GEMINI_LIVE_MODEL,
                generationConfig: {
                  responseModalities: ['AUDIO'],
                  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
                },
                systemInstruction: { parts: [{ text: buildLiveSystemInstruction() }] },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
              },
            })
          );
        };

        ws.onmessage = async (event) => {
          let response;
          if (event.data instanceof Blob) {
            const text = await event.data.text();
            response = JSON.parse(text);
          } else {
            response = JSON.parse(event.data);
          }
          console.log('Live response:', response);

          if (response.setupComplete) {
            console.log('Live setup complete');
            startMicrophoneCapture();
            callbacks.onShowListening();
          }

          if (response.serverContent) {
            const sc = response.serverContent;

            if (sc.interrupted) {
              stopAllLiveAudio();
            }

            if (sc.inputTranscription && typeof sc.inputTranscription.text === 'string') {
              inputBufferRef.current += sc.inputTranscription.text;
            }

            if (sc.outputTranscription && typeof sc.outputTranscription.text === 'string') {
              if (!answerIdRef.current) {
                callbacks.onRemoveListening();
                const qText = inputBufferRef.current.trim() || '(entrada de voz)';
                answerIdRef.current = callbacks.onLiveAnswerStart(qText);
                outputBufferRef.current = '';
              }
              outputBufferRef.current += sc.outputTranscription.text;
              callbacks.onLiveAnswerUpdate(answerIdRef.current, outputBufferRef.current);
            }

            if (sc.turnComplete) {
              if (answerIdRef.current) {
                callbacks.onLiveAnswerComplete(
                  answerIdRef.current,
                  inputBufferRef.current.trim(),
                  outputBufferRef.current.trim()
                );
              }
              answerIdRef.current = null;
              inputBufferRef.current = '';
              outputBufferRef.current = '';
              callbacks.onShowListening();
            }

            if (sc.modelTurn && sc.modelTurn.parts) {
              for (const part of sc.modelTurn.parts) {
                if (part.inlineData && part.inlineData.data) {
                  playAudioChunk(part.inlineData.data);
                }
              }
            }
          }
        };

        ws.onerror = (error) => {
          console.error('Live WebSocket error:', error);
          callbacks.onSystemMessage('Error de conexion en modo Live', false);
          stopLiveMode();
        };

        ws.onclose = () => {
          console.log('Live WebSocket closed');
          stopLiveMode();
        };
      } catch (e) {
        console.error('Error starting live mode:', e);
        stopLiveMode();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [buildLiveSystemInstruction, startMicrophoneCapture, playAudioChunk, stopAllLiveAudio]
  );

  const sendLiveText = useCallback((text) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    callbacks.onRemoveListening();
    inputBufferRef.current = text;
    wsRef.current.send(JSON.stringify({ realtimeInput: { text } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLive = useCallback(
    (apiKey) => {
      if (isLiveMode) {
        stopLiveMode();
      } else {
        startLiveMode(apiKey);
      }
    },
    [isLiveMode, startLiveMode, stopLiveMode]
  );

  return { isLiveMode, toggleLive, sendLiveText, stopLiveMode };
}