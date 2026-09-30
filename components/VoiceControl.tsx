
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
import { AnimatePresence, motion } from 'framer-motion';
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
  const { toast } = useToast();

  const latest = useRef('');
  const recognition = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (!transcript.trim() && !command) {
      return;
    }

    setState('Processing');
    setError('');

    try {
      const response = await fetch('/api/voice-v2', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          transcript: transcript || text,
          confirmed,
          command,
        }),
      });

      const data = await response
        .json()
        .catch(() => ({
          error: 'Invalid server response',
        }));

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
      setState('Error');

      const message = err?.message || 'Voice command failed';
      setError(message);
      toast(message, 'error');
    }
  };

  const start = () => {
    setError('');
    setText('');
    latest.current = '';
    window.setTimeout(() => inputRef.current?.focus(), 0);

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

    recognitionInstance.onstart = () => {
      setState('Listening');
    };

    recognitionInstance.onresult = (event: any) => {
      let output = '';

      for (
        let index = 0;
        index < event.results.length;
        index++
      ) {
        output += event.results[index][0].transcript;
      }

      latest.current = output;
      setText(output);
    };

    recognitionInstance.onerror = () => {
      setState('Error');

      const message = 'Voice input নেওয়া যায়নি। Text command চেষ্টা করুন।';
      setError(message);
      toast(message, 'error');
    };

    recognitionInstance.onend = () => {
      if (latest.current.trim()) {
        process(latest.current.trim());
      }
    };

    recognitionInstance.start();
  };

  const confirm = () => {
    if (!pending) {
      return;
    }

    process(
      text || latest.current,
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
      text || latest.current,
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
    <>
      {result?.command?.action === 'READ_BALANCE' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-[calc(7.25rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-black/[0.07] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.16)] md:bottom-[90px]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">বর্তমান হিসাব</p>
              <h3 className="text-lg font-bold">{result.result?.party?.name}</h3>
            </div>
            <button type="button" onClick={() => setResult(null)} aria-label="Close balance result">
              <X size={18} />
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">আপনি পাবেন</p>
              <p className="text-3xl font-bold">৳ {Number(result.result?.receivable || 0).toLocaleString('bn-BD')}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">আপনাকে দিতে হবে</p>
              <p className="text-3xl font-bold">৳ {Number(result.result?.payable || 0).toLocaleString('bn-BD')}</p>
            </div>
          </div>
        </motion.div>
      )}



      <div className="fixed bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-2 right-2 z-50 mx-auto max-w-3xl sm:left-3 sm:right-3 md:bottom-5">
        <div className="mb-2.5 flex min-h-8 justify-center px-2">
          <div className="flex min-h-8 items-center gap-2 rounded-full border border-white/90 bg-white/85 px-3.5 py-1 shadow-[0_6px_24px_rgba(15,23,42,0.10)] backdrop-blur-xl">
            <span className={`h-2 w-2 rounded-full ${state === 'Listening' ? 'bg-red-500 animate-pulse' : state === 'Processing' ? 'bg-blue-500 animate-pulse' : state === 'Error' ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
            <span className="text-[11px] font-semibold leading-4 text-slate-700">
              {state === 'Listening' ? 'শুনছি... আপনার কমান্ড বলুন' : state === 'Processing' ? 'কমান্ড প্রক্রিয়াভুক্ত হচ্ছে...' : state === 'Success' ? 'কাজ সফল হয়েছে' : state === 'Error' ? 'Voice input সমস্যা' : 'Voice ready • মাইক্রোফোন টিপুন'}
            </span>
          </div>
        </div>
        <form onSubmit={submit} className="flex h-[58px] items-center gap-2 rounded-[30px] border border-black/[0.06] bg-white/90 px-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl sm:h-[64px] sm:px-2">
          <button
            type="button"
            aria-label="New voice command"
            onClick={() => {
              setText('');
              setError('');
              setResult(null);
              setPending(null);
              setState('Idle');
              window.setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[28px] font-light leading-none text-slate-900 transition hover:bg-black/5 active:scale-95"
          >
            +
          </button>

          <input
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-label="Voice command or text input"
            placeholder="আপনার হিসাবের কথা লিখুন বা বলুন…"
            className="min-w-0 flex-1 bg-transparent px-1.5 text-[14px] leading-6 text-slate-800 outline-none placeholder:text-slate-400 sm:px-2 sm:text-[15px]"
          />

          <button
            type="button"
            onClick={start}
            disabled={state === 'Listening' || state === 'Processing'}
            aria-label={state === 'Listening' ? 'Listening' : 'Start voice input'}
            className={
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95 sm:h-11 sm:w-11 ' +
              (state === 'Listening'
                ? 'bg-red-500 text-white shadow-[0_5px_18px_rgba(239,68,68,0.30)] animate-pulse'
                : state === 'Error'
                  ? 'text-red-600 hover:bg-red-50'
                  : state === 'Success'
                    ? 'text-emerald-600 hover:bg-emerald-50'
                    : 'text-slate-700 hover:bg-slate-100')
            }
          >
            {state === 'Processing' ? (
              <Loader2 size={22} className="animate-spin" />
            ) : state === 'Success' ? (
              <Check size={22} />
            ) : state === 'Error' ? (
              <AlertCircle size={22} />
            ) : (
              <Mic size={22} />
            )}
          </button>

          <button
            type="submit"
            aria-label="Send command"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-md transition hover:bg-black active:scale-95 disabled:opacity-40 sm:h-11 sm:w-11"
            disabled={!text.trim() || state === 'Processing'}
          >
            <Send size={18} />
          </button>
        </form>
      </div>

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
    </>
  )
}
