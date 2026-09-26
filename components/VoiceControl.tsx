
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

  const latest = useRef('');
  const recognition = useRef<any>(null);

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

        throw new Error(
          data.error || 'Voice command failed',
        );
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

      setError(
        err?.message || 'Voice command failed',
      );
    }
  };

  const start = () => {
    setError('');
    setText('');
    latest.current = '';

    if (
      !(
        'SpeechRecognition' in window ||
        'webkitSpeechRecognition' in window
      )
    ) {
      setError(
        'Voice recognition নেই। নিচের text box ব্যবহার করুন।',
      );

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

      setError(
        'Voice input নেওয়া যায়নি। Text command চেষ্টা করুন।',
      );
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
          className="fixed bottom-44 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border bg-white p-5 shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">
                বর্তমান হিসাব
              </p>

              <h3 className="text-lg font-bold">
                {result.result?.party?.name}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setResult(null)}
              aria-label="Close balance result"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                আপনি পাবেন
              </p>

              <p className="text-3xl font-bold">
                ৳{' '}
                {Number(
                  result.result?.receivable || 0,
                ).toLocaleString('bn-BD')}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                আপনাকে দিতে হবে
              </p>

              <p className="text-3xl font-bold">
                ৳{' '}
                {Number(
                  result.result?.payable || 0,
                ).toLocaleString('bn-BD')}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        {text && (
          <div className="w-72 rounded-xl border bg-white p-4 shadow-lg">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Live transcript</span>

              <button
                type="button"
                onClick={() => setText('')}
                aria-label="Clear transcript"
              >
                <X size={15} />
              </button>
            </div>

            <p className="mt-2 text-sm">
              {text}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={start}
          disabled={
            state === 'Listening' ||
            state === 'Processing'
          }
          className={
            'flex h-16 w-16 items-center justify-center rounded-full text-white shadow-2xl ' +
            (state === 'Error'
              ? 'bg-red-600'
              : state === 'Success'
                ? 'bg-emerald-500'
                : 'bg-emerald-600')
          }
          aria-label="Voice command"
        >
          {state === 'Listening' ? (
            <Mic />
          ) : state === 'Processing' ? (
            <Loader2 className="animate-spin" />
          ) : state === 'Success' ? (
            <Check />
          ) : state === 'Error' ? (
            <AlertCircle />
          ) : (
            <Mic />
          )}
        </button>

        <span className="rounded-full bg-white px-3 py-1 text-xs shadow">
          {state}
        </span>

        {error && (
          <div className="max-w-xs rounded-xl border border-red-100 bg-white p-3 text-xs text-red-600 shadow">
            {error}
          </div>
        )}
      </div>

      <div className="fixed bottom-24 left-4 right-4 z-40 md:bottom-5 md:left-1/2 md:right-auto md:w-[min(520px,calc(100%-140px))] md:-translate-x-1/2">
        <form
          onSubmit={submit}
          className="flex gap-2 rounded-xl border bg-white p-2 shadow-lg"
        >
          <input
            value={text}
            onChange={(event) =>
              setText(event.target.value)
            }
            aria-label="Voice command text fallback"
            placeholder="যেমন: করিমের কাছে কত টাকা পাব?"
            className="min-w-0 flex-1 border-0 px-3 outline-none"
          />

          <button
            type="submit"
            className="rounded-xl bg-slate-900 p-3 text-white"
            aria-label="Submit voice command"
          >
            <Send size={17} />
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
                <h2 className="text-xl font-bold">
                  নিশ্চিত করুন
                </h2>

                <button
                  type="button"
                  onClick={() => setPending(null)}
                  aria-label="Close confirmation"
                >
                  <X />
                </button>
              </div>

              <p className="mt-2 text-sm text-slate-500">
                {pending.message}
              </p>

              {pending.matches?.length ? (
                <div className="mt-4 space-y-2">
                  {pending.matches.map(
                    (match: any) => (
                      <button
                        type="button"
                        key={match.id}
                        onClick={() => choose(match)}
                        className="flex w-full items-center justify-between rounded-xl border p-4 text-left"
                      >
                        <span>
                          <b>{match.name}</b>

                          <small className="block text-slate-500">
                            {match.phone || ''}
                          </small>
                        </span>

                        <ChevronRight size={18} />
                      </button>
                    ),
                  )}
                </div>
              ) : null}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  className="flex-1 rounded-xl border p-3"
                >
                  Cancel
                </button>

                {!pending.matches?.length && (
                  <button
                    type="button"
                    onClick={confirm}
                    className="flex-1 rounded-xl bg-slate-900 p-3 text-white"
                  >
                    Confirm
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
