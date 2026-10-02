
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Loader2,
  Check,
  AlertCircle,
  X,
  Send,
  ChevronRight,
} from 'lucide-react';
import { AnimatePresence, motion, LazyMotion, domAnimation } from 'framer-motion';
import { useToast } from '@/components/ToastProvider';

type State = 'Idle' | 'Listening' | 'Processing' | 'Success' | 'Error';

type Pending = {
  command: any;
  message: string;
  matches?: any[];
};

function message(c: any, result: any) {
  if (c.action === 'CREATE_PARTY') {
    return (
      result.name +
      ' নামে ' +
      (result.partyType === 'SUPPLIER' ? 'সাপ্লায়ার' : 'কাস্টমার') +
      ' যোগ করা হয়েছে।'
    );
  }

  if (c.action === 'CREATE_PRODUCT') {
    return result.name + ' পণ্যটি যোগ করা হয়েছে।';
  }

  if (c.action === 'READ_BALANCE') {
    const name = result?.party?.name || 'গ্রাহক';
    const receivable = Number(result?.receivable || 0);
    const payable = Number(result?.payable || 0);

    if (receivable > 0) {
      return (
        name +
        ' এর কাছে আপনার ' +
        receivable.toLocaleString('bn-BD') +
        ' টাকা পাওনা আছে।'
      );
    }

    if (payable > 0) {
      return (
        name +
        ' আপনাকে ' +
        payable.toLocaleString('bn-BD') +
        ' টাকা পাবে।'
      );
    }

    return name + ' এর সাথে কোনো বাকি নেই।';
  }

  if (c.action === 'CREATE_DUE') {
    return 'বাকির হিসাব যোগ করা হয়েছে।';
  }

  if (c.action === 'RECEIVE_PAYMENT') {
    return 'জমার হিসাব সংরক্ষণ করা হয়েছে।';
  }

  if (c.action === 'CREATE_SALE') {
    return 'বিক্রির হিসাব সংরক্ষণ করা হয়েছে।';
  }

  if (c.action === 'CREATE_PURCHASE') {
    return 'কেনার হিসাব সংরক্ষণ করা হয়েছে।';
  }

  if (c.action === 'CREATE_EXPENSE') {
    return (
      (result?.amount || c.amount) +
      ' টাকার খরচ সংরক্ষণ করা হয়েছে।'
    );
  }

  if (c.action === 'STOCK_IN' || c.action === 'STOCK_OUT') {
    return 'স্টকের হিসাব আপডেট হয়েছে।';
  }

  if (c.action.startsWith('DELETE_')) {
    return 'মুছে ফেলার কাজটি সফল হয়েছে।';
  }

  if (c.action.startsWith('UPDATE_')) {
    return 'তথ্য সফলভাবে আপডেট হয়েছে।';
  }

  if (
    c.action.startsWith('LIST_') ||
    c.action.startsWith('READ_')
  ) {
    return 'তথ্য পাওয়া গেছে।';
  }

  return 'কাজটি সফলভাবে সম্পন্ন হয়েছে।';
}

export default function VoiceControl() {
  const [state, setState] = useState<State>('Idle');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const { toast } = useToast();

  const latest = useRef('');
  const finalTranscript = useRef('');
  const recognition = useRef<any>(null);
  const requestId = useRef(0);
  const activeSessionId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizeSpeechCommand = (value: string) =>
    value
      .replace(/(^|\s)জব(?=\s|$|[,.!?।])/gu, '$1যোগ')
      .replace(/(^|\s)জোগ(?=\s|$|[,.!?।])/gu, '$1যোগ')
      .replace(/(^|\s)জুগ(?=\s|$|[,.!?।])/gu, '$1যোগ')
      .replace(/(^|\s)জগ(?=\s|$|[,.!?।])/gu, '$1যোগ')
      .replace(/\bযোগ কর\b/gu, 'যোগ কর')
      .replace(/\s+/g, ' ')
      .trim();

  /*
   * Preserve the existing TaliKhata command event integration.
   * Other components can dispatch:
   *
   * window.dispatchEvent(
   *   new CustomEvent('talikhata:command', {
   *     detail: 'করিমের কাছে কত টাকা পাব?'
   *   })
   * );
   */
  useEffect(() => {
    const onCommand = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;

      if (typeof value === 'string' && value.trim()) {
        setText(value);
      }
    };

    window.addEventListener('talikhata:command', onCommand);

    return () => {
      window.removeEventListener('talikhata:command', onCommand);
    };
  }, []);

  const speak = (s: string) => {
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window
    ) {
      const utterance = new SpeechSynthesisUtterance(s);

      utterance.lang = 'bn-BD';
      utterance.rate = 0.95;

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };

  const process = async (
    transcript: string,
    command?: any,
    confirmed = false,
  ) => {
    const cleanTranscript = normalizeSpeechCommand(transcript);
    if (!cleanTranscript.trim() && !command) {
      return;
    }

    const currentRequestId = ++requestId.current;
    setState('Processing');
    setVoiceModalOpen(true);
    setError('');

    try {
      const response = await fetch('/api/voice-v2', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          transcript: cleanTranscript,
          confirmed,
          command,
        }),
      });

      const data = await response
        .json()
        .catch(() => ({
          error: 'Invalid server response',
        }));

      if (currentRequestId !== requestId.current) return;

      if (!response.ok || !data.ok) {
        if (data.confirmationRequired) {
          setPending({
            command: data.command || command,
            message:
              data.error ||
              'এই কাজটি করার আগে confirmation প্রয়োজন।',
          });

          return;
        }

        if (data.code === 'AMBIGUOUS_ENTITY') {
          setPending({
            command: data.command || command,
            message: data.error,
            matches: data.details?.matches || [],
          });

          return;
        }

        const providerErrors = Array.isArray(data.details?.providers)
          ? data.details.providers
              .map(
                (item: any) =>
                  `${item.provider || 'provider'} / ${item.model || 'unknown model'}: ${item.message || 'unknown error'}`,
              )
              .join('\\n')
          : '';

        const exactError = [
          data.code ? `[${data.code}]` : '',
          data.error || 'Voice command failed',
          providerErrors ? `\\nProvider diagnostics:\\n${providerErrors}` : '',
        ]
          .filter(Boolean)
          .join(' ');

        throw new Error(exactError);
      }

      setPending(null);
      setResult(data);
      setState('Success');
      setVoiceModalOpen(true);

      const spoken = message(
        data.command,
        data.result,
      );

      speak(spoken);

      window.dispatchEvent(
        new Event('talikhata:refresh'),
      );

      setTimeout(() => {
        setState('Idle');
      }, 1800);
    } catch (err: any) {
      if (currentRequestId !== requestId.current) return;
      setState('Error');
      setVoiceModalOpen(true);

      const message = err?.message || 'Voice command failed';
      setError(message);
      toast(message, 'error');
    }
  };

  const start = () => {
    const sessionId = ++activeSessionId.current;
    requestId.current += 1;
    recognition.current?.abort?.();
    setError('');
    setText('');
    setResult(null);
    setPending(null);
    latest.current = '';
    finalTranscript.current = '';
    if (
      !(
        'SpeechRecognition' in window ||
        'webkitSpeechRecognition' in window
      )
    ) {
      const message = 'Voice recognition নেই। নিচের text box ব্যবহার করুন।';
      setError(message);
      toast(message, 'error');

      setState('Error');

      return;
    }

    const SpeechRecognitionConstructor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    const recognitionInstance =
      new SpeechRecognitionConstructor();

    recognition.current = recognitionInstance;

    recognitionInstance.lang = 'bn-BD';
    recognitionInstance.interimResults = true;
    recognitionInstance.continuous = false;
    recognitionInstance.maxAlternatives = 1;

    recognitionInstance.onstart = () => {
      setState('Listening');
      setVoiceModalOpen(true);
    };

    recognitionInstance.onresult = (event: any) => {
      if (sessionId !== activeSessionId.current) return;
      let interimTranscript = '';

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index++
      ) {
        const result = event.results[index];
        const transcript = result[0]?.transcript || '';

        if (result.isFinal) {
          finalTranscript.current += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      const displayTranscript = normalizeSpeechCommand(
        finalTranscript.current + interimTranscript,
      );

      latest.current = displayTranscript;
      setText(displayTranscript);
    };

    recognitionInstance.onerror = (event: any) => {
      if (sessionId !== activeSessionId.current) return;

      const code = String(event?.error || '').toLowerCase();
      const detail =
        code === 'not-allowed' || code === 'service-not-allowed'
          ? 'মাইক্রোফোন permission দেওয়া হয়নি। Browser-এর microphone permission Allow করে আবার চেষ্টা করুন।'
          : code === 'audio-capture'
            ? 'মাইক্রোফোন পাওয়া যাচ্ছে না। Microphone connection ও device permission পরীক্ষা করুন।'
            : code === 'no-speech'
              ? 'কোনো কথা শোনা যায়নি। আবার স্পষ্টভাবে বলুন।'
              : 'Voice input নেওয়া যায়নি। আবার চেষ্টা করুন বা text command ব্যবহার করুন।';

      setState('Error');
      setError(detail);
      toast(detail, 'error');
    };

    recognitionInstance.onend = () => {
      if (sessionId !== activeSessionId.current) return;
      const transcript = normalizeSpeechCommand(
        finalTranscript.current || latest.current,
      );

      if (transcript.trim()) {
        latest.current = transcript;
        setText(transcript);
        process(transcript);
      }
    };

    try {
      // Keep start() inside the original user-gesture call path.
      // Chrome/Android can reject SpeechRecognition when start() is deferred.
      recognitionInstance.start();
    } catch (err: any) {
      if (sessionId !== activeSessionId.current) return;

      const code = String(err?.name || '').toLowerCase();
      const detail =
        code === 'notallowederror' || code === 'securityerror'
          ? 'মাইক্রোফোন permission বা browser security-এর কারণে voice input শুরু হয়নি। Permission Allow করে আবার চেষ্টা করুন।'
          : 'Voice input শুরু করা যায়নি। আবার চেষ্টা করুন।';

      setState('Error');
      setError(detail);
      toast(detail, 'error');
    }
  };

  useEffect(() => {
    const onVoiceOpen = () => {
      if (state === 'Listening' || state === 'Processing') return;

      // Do not defer start with setTimeout: on mobile Chrome this can
      // break the browser's user-activation requirement for microphone input.
      start();
    };
    window.addEventListener('talikhata:voice-open', onVoiceOpen);
    return () => window.removeEventListener('talikhata:voice-open', onVoiceOpen);
  }, [state]);

  const confirm = () => {
    if (!pending) {
      return;
    }

    process(
      pending.command?.entityName ? '' : text,
      pending.command,
      true,
    );
  };

  const choose = (match: any) => {
    if (!pending) {
      return;
    }

    const command = {
      ...pending.command,
      entityName: match.name,
    };

    setPending(null);

    process(
      '',
      command,
      false,
    );
  };

  const submit = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    process(text);
  };

  return (
    <LazyMotion features={domAnimation} strict>
    <>

      {!voiceModalOpen && (
        <div className="fixed bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-2 right-2 z-50 mx-auto max-w-3xl sm:left-3 sm:right-3 md:bottom-5">
          <div className="mb-2.5 flex min-h-8 justify-center px-2">
            <div className="flex min-h-8 items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-3.5 py-1 shadow-[0_6px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl">
              <span className={`h-2 w-2 rounded-full ${state === 'Listening' ? 'bg-red-500 animate-pulse' : state === 'Processing' ? 'bg-blue-500 animate-pulse' : state === 'Error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <span className="text-[11px] font-semibold leading-4 text-white/70">
                {state === 'Listening' ? 'শুনছি... আপনার কমান্ড বলুন' : state === 'Processing' ? 'কমান্ড প্রক্রিয়াভুক্ত হচ্ছে...' : state === 'Success' ? 'কাজ সফল হয়েছে' : state === 'Error' ? 'Voice input সমস্যা' : ''}
              </span>
            </div>
          </div>
          <form onSubmit={submit} className="flex h-[58px] items-center gap-2 rounded-[30px] border border-white/10 bg-slate-950/75 px-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:h-[64px] sm:px-2">
            <button type="button" aria-label="New voice command" onClick={() => { setText(''); setError(''); setResult(null); setPending(null); setState('Idle'); }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[28px] font-light leading-none text-white transition hover:bg-white/10 active:scale-95">+</button>
            <input ref={inputRef} value={text} onChange={(event) => setText(event.target.value)} aria-label="Voice command or text input" placeholder="আপনার হিসাবের কথা লিখুন বা বলুন…" className="min-w-0 flex-1 bg-transparent px-1.5 text-[14px] leading-6 text-white outline-none placeholder:text-white/35 sm:px-2 sm:text-[15px]" />
            <button type="button" onClick={start} disabled={state === 'Listening' || state === 'Processing'} aria-label={state === 'Listening' ? 'Listening' : 'Start voice input'} className={'group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-200 ease-out hover:scale-[1.04] active:scale-[0.92] sm:h-11 sm:w-11 ' + (state === 'Listening' ? 'bg-red-500 text-white shadow-[0_5px_18px_rgba(239,68,68,0.30)]' : state === 'Error' ? 'text-red-400 hover:bg-red-500/10' : state === 'Success' ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-white/75 hover:bg-white/10')}>
              {state === 'Processing' ? <Loader2 size={22} className="animate-spin" /> : state === 'Success' ? <Check size={22} /> : state === 'Error' ? <AlertCircle size={22} /> : <Mic size={22} className="relative z-10 transition-transform duration-200 group-hover:scale-105 group-active:scale-90" />}
            </button>
            <button type="submit" aria-label="Send command" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1b2cc1] text-white shadow-md transition hover:bg-[#2a3ddd] active:scale-95 disabled:opacity-40 sm:h-11 sm:w-11" disabled={!text.trim() || state === 'Processing'}><Send size={18} /></button>
          </form>
        </div>
      )}

      <AnimatePresence>
        {voiceModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-[16px]"
            role="dialog" aria-modal="true" aria-labelledby="voice-ai-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md rounded-[20px] border border-white/10 bg-transparent p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,.35)] backdrop-blur-[18px]"
            >
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-white/50">TaliKhata Voice AI</p><h2 id="voice-ai-title" className="mt-1 text-xl font-semibold">Voice command</h2></div>
                <button type="button" onClick={() => { recognition.current?.stop?.(); setVoiceModalOpen(false); }} aria-label="Close voice result" className="rounded-full p-2 text-white/60 hover:bg-white/10"><X size={18} /></button>
              </div>
              <div className="mt-5 rounded-[14px] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-medium text-white/45">আপনি বলেছেন</p>
                <p className="mt-2 min-h-12 text-base leading-7 text-white">{text || 'শুনছি…'}</p>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.04] p-4">
                {state === 'Listening' && <Mic size={20} className="text-red-400" />}
                {state === 'Processing' && <Loader2 size={20} className="animate-spin text-blue-400" />}
                {state === 'Success' && <Check size={20} className="text-emerald-400" />}
                {state === 'Error' && <AlertCircle size={20} className="text-red-400" />}
                <div><p className="text-xs text-white/45">Status</p><p className="mt-1 text-sm font-semibold">{state === 'Listening' ? 'শুনছি…' : state === 'Processing' ? 'কমান্ড প্রক্রিয়াকরণ হচ্ছে…' : state === 'Success' ? 'কাজ সফল হয়েছে' : state === 'Error' ? 'কাজটি সম্পন্ন হয়নি' : 'প্রস্তুত'}</p></div>
              </div>
              {state === 'Success' && result && (
                <div className="mt-3 space-y-3">
                  <div className="rounded-[14px] border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100">
                    {message(result.command, result.result)}
                  </div>
                  {result.command?.action === 'READ_BALANCE' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-[14px] border border-white/10 bg-white/[0.035] p-3">
                        <p className="text-[11px] text-white/45">আপনি পাবেন</p>
                        <p className="mt-1 text-lg font-bold text-white">৳ {Number(result.result?.receivable || 0).toLocaleString('bn-BD')}</p>
                      </div>
                      <div className="rounded-[14px] border border-white/10 bg-white/[0.035] p-3">
                        <p className="text-[11px] text-white/45">আপনাকে দিতে হবে</p>
                        <p className="mt-1 text-lg font-bold text-white">৳ {Number(result.result?.payable || 0).toLocaleString('bn-BD')}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {state === 'Error' && error && <div className="mt-3 rounded-[14px] border border-red-400/20 bg-red-400/10 p-4 text-sm leading-6 text-red-100">{error}</div>}
            </motion.div>
          </motion.div>
        )}
      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4"
          >
            <motion.div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
              <div className="flex justify-between">
                <h2 className="text-xl font-bold">নিশ্চিত করুন</h2>
                <button type="button" onClick={() => setPending(null)} aria-label="Close confirmation">
                  <X />
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-500">{pending.message}</p>
              {pending.matches?.length ? (
                <div className="mt-4 space-y-2">
                  {pending.matches.map((match: any) => (
                    <button
                      type="button"
                      key={match.id}
                      onClick={() => choose(match)}
                      className="flex w-full items-center justify-between rounded-xl border p-4 text-left"
                    >
                      <span>
                        <b>{match.name}</b>
                        <small className="block text-slate-500">{match.phone || ''}</small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-5 flex gap-3">
                <button type="button" onClick={() => setPending(null)} className="flex-1 rounded-xl border p-3">
                  Cancel
                </button>
                {!pending.matches?.length && (
                  <button type="button" onClick={confirm} className="flex-1 rounded-xl bg-slate-900 p-3 text-white">
                    Confirm
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </AnimatePresence>
    </>
    </LazyMotion>
  );
}
