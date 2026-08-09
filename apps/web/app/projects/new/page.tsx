'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Project, MediaAsset } from '@studioflow/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function NewProjectPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState<string>('');
  const [projectDescription, setProjectDescription] = useState<string>('');
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<MediaAsset | null>(null);

  const [loadingProject, setLoadingProject] = useState<boolean>(false);
  const [loadingMedia, setLoadingMedia] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setLoadingProject(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName, description: projectDescription }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to create project.');
      }

      setCreatedProject(data);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoadingProject(false);
    }
  };

  const handleUploadVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdProject || !file) return;

    setLoadingMedia(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/${createdProject.id}/media`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to upload video media.');
      }

      setUploadedMedia(data);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoadingMedia(false);
    }
  };

  return (
    <main className="min-h-screen p-6 bg-slate-950 text-slate-100 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold text-indigo-400">Create New Project</h1>
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
            &larr; Back to Home
          </Link>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            <strong>Error:</strong> {errorMsg}
          </div>
        )}

        {/* Step 1: Create Project */}
        {!createdProject ? (
          <form onSubmit={handleCreateProject} className="glass-panel rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-3">
              Step 1: Basic Information
            </h2>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                Project Name
              </label>
              <input
                type="text"
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. My Product Promo Video"
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:outline-none text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                Description (Optional)
              </label>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Brief summary of video campaign goal..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:outline-none text-sm text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={loadingProject}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold shadow-lg shadow-indigo-500/20 transition-all text-sm disabled:opacity-50"
            >
              {loadingProject ? 'Saving to Firestore...' : 'Create Project'}
            </button>
          </form>
        ) : (
          /* Step 2: Upload Video File */
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-6 border-emerald-500/30 bg-emerald-950/10 space-y-2">
              <span className="text-xs font-semibold text-emerald-400 uppercase">Project Saved</span>
              <h3 className="text-xl font-bold text-white">{createdProject.name}</h3>
              <p className="text-xs font-mono text-slate-400">ID: {createdProject.id}</p>
            </div>

            <form onSubmit={handleUploadVideo} className="glass-panel rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-3">
                Step 2: Upload Media Video File
              </h2>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                  Select Video Asset
                </label>
                <input
                  type="file"
                  accept="video/*,audio/*"
                  onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                  className="block w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-indigo-300 hover:file:bg-slate-700"
                />
              </div>

              <button
                type="submit"
                disabled={loadingMedia || !file}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all text-sm disabled:opacity-50"
              >
                {loadingMedia ? 'Uploading to Cloud Storage...' : 'Upload Video File'}
              </button>
            </form>

            {uploadedMedia && (
              <div className="glass-panel rounded-2xl p-6 border-indigo-500/30 bg-indigo-950/20 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  ✓ Media Asset Uploaded & Metadata Persisted!
                </div>
                <div className="bg-slate-900 p-4 rounded-xl text-xs font-mono text-slate-300 space-y-1">
                  <p><strong>Asset ID:</strong> {uploadedMedia.id}</p>
                  <p><strong>File Name:</strong> {uploadedMedia.fileName}</p>
                  <p><strong>Size:</strong> {(uploadedMedia.size / 1024 / 1024).toFixed(2)} MB</p>
                  <p><strong>Storage Path:</strong> {uploadedMedia.storagePath}</p>
                  <p><strong>Status:</strong> {uploadedMedia.status}</p>
                </div>
                <button
                  onClick={() => router.push('/')}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
