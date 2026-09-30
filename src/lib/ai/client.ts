import { useEffect, useRef, useState, useCallback } from 'react';

export type AiGenerateCallback = (message: any) => void;

export function useTransformersWorker() {
  const worker = useRef<Worker | null>(null);
  const callbacks = useRef<{ [key: string]: AiGenerateCallback }>({});

  useEffect(() => {
    // Create the worker only once on the client side
    if (!worker.current && typeof window !== 'undefined') {
      worker.current = new Worker(new URL('./worker.ts', import.meta.url));

      worker.current.addEventListener('message', (event) => {
        const { id, type, payload } = event.data;
        if (callbacks.current[id]) {
          callbacks.current[id]({ type, payload });
          
          if (type === 'COMPLETE' || type === 'ERROR') {
            delete callbacks.current[id];
          }
        }
      });
    }

    return () => {
      // Don't terminate on unmount to keep model in memory if possible
      // But if you wanted to: worker.current?.terminate();
    };
  }, []);

  const generate = useCallback((prompt: string, onUpdate: AiGenerateCallback) => {
    const id = Math.random().toString(36).substring(7);
    callbacks.current[id] = onUpdate;

    worker.current?.postMessage({
      id,
      type: 'GENERATE',
      payload: { prompt },
    });

    return id;
  }, []);

  return { generate };
}
