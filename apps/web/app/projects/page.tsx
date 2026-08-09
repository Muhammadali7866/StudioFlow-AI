'use client';

import Link from 'next/link';

export default function ProjectsPage() {
  return (
    <main className="min-h-screen p-8 bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">StudioFlow Projects</h1>
          <Link
            href="/projects/new"
            className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all"
          >
            + Create New Project
          </Link>
        </div>

        <div className="glass-panel rounded-2xl p-8 text-center space-y-3">
          <p className="text-slate-400">No active projects loaded yet.</p>
          <Link
            href="/projects/new"
            className="inline-block text-indigo-400 hover:underline text-sm font-medium"
          >
            Create your first project to test the end-to-end pipeline
          </Link>
        </div>

        <div className="pt-4">
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
