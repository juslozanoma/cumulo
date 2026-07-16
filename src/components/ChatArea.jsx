import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

export default function ChatArea({ messages }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages]);

  return (
    <div className="chat-area show" id="chatArea" ref={ref}>
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
    </div>
  );
}