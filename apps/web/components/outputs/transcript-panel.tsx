'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Captions, Download, FileText, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { downloadTextFile } from '@/lib/download';
import type { Chapter, TranscriptSegment } from '@/types/studioflow';

function captionTimestamp(timestamp: string, offsetSeconds: number, separator: ',' | '.'): string {
  const [minutes = 0, seconds = 0] = timestamp.split(':').map(Number);
  const totalSeconds = minutes * 60 + seconds + offsetSeconds;
  const hoursPart = Math.floor(totalSeconds / 3600);
  const minutesPart = Math.floor((totalSeconds % 3600) / 60);
  const secondsPart = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, '0');

  return `${pad(hoursPart)}:${pad(minutesPart)}:${pad(secondsPart)}${separator}000`;
}

function buildSrt(segments: TranscriptSegment[]): string {
  return segments
    .map(
      (segment, index) =>
        `${index + 1}\n${captionTimestamp(segment.timestamp, 0, ',')} --> ${captionTimestamp(segment.timestamp, 5, ',')}\n${segment.text}`
    )
    .join('\n\n');
}

function buildVtt(segments: TranscriptSegment[]): string {
  return `WEBVTT\n\n${segments
    .map(
      (segment) =>
        `${captionTimestamp(segment.timestamp, 0, '.')} --> ${captionTimestamp(segment.timestamp, 5, '.')}\n${segment.text}`
    )
    .join('\n\n')}`;
}

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  chapters: Chapter[];
}

export function TranscriptPanel({ segments, chapters }: TranscriptPanelProps) {
  const [query, setQuery] = useState('');
  const visibleSegments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return segments;
    return segments.filter(
      (segment) =>
        segment.text.toLowerCase().includes(normalized) ||
        segment.speaker.toLowerCase().includes(normalized) ||
        segment.timestamp.includes(normalized)
    );
  }, [query, segments]);

  const averageConfidence = Math.round(
    segments.reduce((total, segment) => total + segment.confidence, 0) / segments.length
  );

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
      <Panel className="overflow-hidden">
        <header className="flex flex-col gap-4 border-b border-line/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-soft" />
              <h2 className="text-sm font-bold text-white">Timestamped transcript</h2>
            </div>
            <p className="mt-1 text-xs text-muted">
              {segments.length} representative segments · {averageConfidence}% average confidence
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadTextFile('studioflow-captions.srt', buildSrt(segments))}
            >
              <Download className="h-3.5 w-3.5" />
              SRT
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                downloadTextFile('studioflow-captions.vtt', buildVtt(segments), 'text/vtt')
              }
            >
              <Download className="h-3.5 w-3.5" />
              VTT
            </Button>
          </div>
        </header>

        <div className="border-b border-line/60 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search transcript, speaker, or timestamp"
              className="h-10 w-full rounded-xl border border-line bg-canvas/55 pl-9 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-brand"
            />
          </div>
        </div>

        <div className="divide-y divide-line/60">
          {visibleSegments.map((segment) => (
            <article
              key={segment.id}
              className="grid gap-3 p-4 transition hover:bg-raised/35 sm:grid-cols-[5rem_7rem_1fr] sm:p-5"
            >
              <button
                type="button"
                className="w-fit font-mono text-xs font-semibold text-brand-soft hover:text-white"
              >
                {segment.timestamp}
              </button>
              <span className="text-xs font-semibold text-slate-400">{segment.speaker}</span>
              <div>
                <p className="text-sm leading-6 text-slate-200">{segment.text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={segment.flagged ? 'warning' : 'neutral'}>
                    {segment.confidence}% confidence
                  </Badge>
                  {segment.flagged && (
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-200">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Human confirmation required
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
          {visibleSegments.length === 0 && (
            <div className="p-10 text-center text-sm text-muted">
              No transcript segment matches that search.
            </div>
          )}
        </div>
      </Panel>

      <Panel className="overflow-hidden xl:sticky xl:top-32">
        <header className="border-b border-line/70 p-5">
          <div className="flex items-center gap-2">
            <Captions className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold text-white">Generated chapters</h2>
          </div>
          <p className="mt-1 text-xs text-muted">
            Editable chapter boundaries arrive from the transcript specialist.
          </p>
        </header>
        <ol className="divide-y divide-line/60">
          {chapters.map((chapter, index) => (
            <li key={chapter.id} className="flex gap-3 p-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand/10 text-[10px] font-bold text-brand-soft">
                {index + 1}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] text-cyan-200">{chapter.timestamp}</span>
                  <h3 className="text-xs font-bold text-slate-200">{chapter.title}</h3>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-muted">{chapter.summary}</p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
