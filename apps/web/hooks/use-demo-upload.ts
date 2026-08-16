'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_DEMO_FILE_BYTES = 250 * 1024 * 1024;

export type UploadPhase = 'idle' | 'uploading' | 'ready' | 'error';

export function useDemoUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const selectFile = useCallback(
    (nextFile: File) => {
      clearTimer();
      setError(null);

      const hasVideoMimeType = nextFile.type.startsWith('video/');
      const hasVideoExtension = /\.(mp4|mov|m4v|webm)$/i.test(nextFile.name);
      if (!hasVideoMimeType && !hasVideoExtension) {
        setFile(null);
        setProgress(0);
        setPhase('error');
        setError('Choose a video file such as MP4, MOV, or WebM.');
        return;
      }

      if (nextFile.size > MAX_DEMO_FILE_BYTES) {
        setFile(null);
        setProgress(0);
        setPhase('error');
        setError('For the frontend demo, choose a video smaller than 250 MB.');
        return;
      }

      setFile(nextFile);
      setProgress(6);
      setPhase('uploading');

      intervalRef.current = setInterval(() => {
        setProgress((current) => {
          const next = Math.min(100, current + 11);
          if (next === 100) {
            clearTimer();
            setPhase('ready');
          }
          return next;
        });
      }, 140);
    },
    [clearTimer]
  );

  const reset = useCallback(() => {
    clearTimer();
    setFile(null);
    setProgress(0);
    setPhase('idle');
    setError(null);
  }, [clearTimer]);

  return { file, phase, progress, error, selectFile, reset };
}
