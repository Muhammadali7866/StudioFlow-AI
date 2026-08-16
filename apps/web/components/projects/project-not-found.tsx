import Link from 'next/link';
import { ArrowLeft, FolderX } from 'lucide-react';
import { buttonStyles } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';

export function ProjectNotFound() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-7rem)] max-w-3xl place-items-center px-4 py-10 sm:px-6">
      <Panel className="w-full p-8 text-center sm:p-12">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger/10 text-rose-200">
          <FolderX className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-xl font-bold text-white">Project not found</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          This frontend demo does not have a project matching that URL.
        </p>
        <Link
          href="/projects"
          className={buttonStyles({ variant: 'secondary', className: 'mt-6' })}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>
      </Panel>
    </main>
  );
}
