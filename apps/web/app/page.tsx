'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface HealthStatus {
  connected: boolean;
  api: boolean;
  firestore: boolean;
  storage: boolean;
}

export default function HomePage() {
  const [status, setStatus] = useState<HealthStatus>({
    connected: false,
    api: false,
    firestore: false,
    storage: false,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [testPrompt, setTestPrompt] = useState<string>('Hello StudioFlow');
  const [agentResponse, setAgentResponse] = useState<string | null>(null);
  const [agentLoading, setAgentLoading] = useState<boolean>(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const healthRes = await fetch(`${API_BASE_URL}/health`).catch(() => null);
      const isHealthOk = healthRes ? healthRes.ok : false;

      if (isHealthOk) {
        const statusRes = await fetch(`${API_BASE_URL}/api/status`).catch(() => null);
        if (statusRes && statusRes.ok) {
          const data = await statusRes.json();
          setStatus({
            connected: true,
            api: data.api,
            firestore: data.firestore,
            storage: data.storage,
          });
        } else {
          setStatus({ connected: true, api: true, firestore: false, storage: false });
        }
      } else {
        setStatus({ connected: false, api: false, firestore: false, storage: false });
      }
    } catch {
      setStatus({ connected: false, api: false, firestore: false, storage: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleTestAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAgentLoading(true);
    setAgentResponse(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/agent/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testPrompt }),
      });
      const data = await res.json();
      setAgentResponse(data.message || JSON.stringify(data));
    } catch (err: any) {
      setAgentResponse(`Error connecting to agent: ${err.message}`);
    } finally {
      setAgentLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950/40 text-slate-100">
      <div className="max-w-4xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold tracking-wide uppercase">
            Milestone 1 — Architecture Slice
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
            StudioFlow AI
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Next.js Frontend &rarr; Express Backend &rarr; Google Cloud &rarr; Gemini ADK Agent
          </p>
        </div>

        {/* Backend Connection Status */}
        <div className="glass-panel rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-lg font-semibold text-slate-200">System Connection Status</h2>
            <button
              onClick={checkStatus}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Refresh Status
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col items-center">
              <span className="text-xs text-slate-400 uppercase font-medium">Backend Server</span>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`h-3 w-3 rounded-full ${
                    status.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span className="font-semibold text-sm">
                  {loading ? 'Checking...' : status.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col items-center">
              <span className="text-xs text-slate-400 uppercase font-medium">Express API</span>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`h-3 w-3 rounded-full ${
                    status.api ? 'bg-emerald-500' : 'bg-slate-600'
                  }`}
                />
                <span className="font-semibold text-sm">
                  {status.api ? 'Active (v1)' : 'Offline'}
                </span>
              </div>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col items-center">
              <span className="text-xs text-slate-400 uppercase font-medium">Firestore DB</span>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`h-3 w-3 rounded-full ${
                    status.firestore ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span className="font-semibold text-sm">
                  {status.firestore ? 'Ready' : 'Fallback Mode'}
                </span>
              </div>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col items-center">
              <span className="text-xs text-slate-400 uppercase font-medium">Cloud Storage</span>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`h-3 w-3 rounded-full ${
                    status.storage ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span className="font-semibold text-sm">
                  {status.storage ? 'Ready' : 'Fallback Mode'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls & Gemini Test */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Project Navigation */}
          <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xl font-bold text-slate-100">Project Management</h3>
              <p className="text-sm text-slate-400 mt-1">
                Create new studio workflows, store metadata in Firestore, and upload source media to Cloud Storage.
              </p>
            </div>
            <div className="flex gap-3 pt-4">
              <Link
                href="/projects/new"
                className="w-full text-center py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold shadow-lg shadow-indigo-500/25 transition-all"
              >
                Create Project & Upload Video
              </Link>
            </div>
          </div>

          {/* Google ADK Gemini Test */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-xl font-bold text-slate-100">Google ADK & Gemini Agent</h3>
            <form onSubmit={handleTestAgent} className="space-y-3">
              <input
                type="text"
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="Enter message for ADK Agent..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 focus:border-indigo-500 focus:outline-none text-slate-100 text-sm"
              />
              <button
                type="submit"
                disabled={agentLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold border border-indigo-500/30 transition-all text-sm disabled:opacity-50"
              >
                {agentLoading ? 'Executing Root Agent...' : 'Send to Root Agent'}
              </button>
            </form>

            {agentResponse && (
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-indigo-200 font-mono overflow-auto max-h-32">
                <span className="text-slate-500 font-bold block mb-1">Response:</span>
                {agentResponse}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
