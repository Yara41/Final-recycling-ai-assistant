import React, { useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined;

// Free voice input using the browser's own speech recognition. Renders nothing
// when the browser does not support it (e.g. Firefox).
export default function VoiceButton({ lang, label, listeningLabel, onText, disabled }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  if (!Recognition) return null;

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Recognition();
    rec.lang = lang === 'en' ? 'en-US' : 'ar-JO';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript;
      if (text) onText(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <button
      type="button"
      className={`chat-camera-btn voice-btn ${listening ? 'is-listening' : ''}`}
      onClick={toggle}
      disabled={disabled}
      aria-label={listening ? listeningLabel : label}
      title={listening ? listeningLabel : label}
    >
      {listening ? <MicOff size={19} /> : <Mic size={19} />}
    </button>
  );
}
