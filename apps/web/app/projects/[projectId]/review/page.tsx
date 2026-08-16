'use client';

import Link from 'next/link';
import { ArrowLeft, FileStack } from 'lucide-react';
import { ProjectNotFound } from '@/components/projects/project-not-found';
import { ApprovalPanel } from '@/components/review/approval-panel';
import { PackageSummary } from '@/components/review/package-summary';
import { buttonStyles } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { useStudioFlow } from '@/hooks/use-studioflow';

export default function ReviewPage({ params }: { params: { projectId: string } }) {
  const { findProject, getWorkspace, approveProject } = useStudioFlow();
  const project = findProject(params.projectId);
  const workspace = getWorkspace(params.projectId);

  if (!project || !workspace) return <ProjectNotFound />;

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-7 sm:px-6 lg:py-8">
      <PageHeader
        eyebrow={`${project.code} · Human in the loop`}
        title="Final publishing review"
        description="Verify the generated package, resolve remaining warnings, and explicitly approve the result before StudioFlow considers the workflow complete."
        actions={
          <Link
            href={`/projects/${project.id}/outputs?view=publishing`}
            className={buttonStyles({ variant: 'secondary' })}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to outputs
          </Link>
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
        <PackageSummary
          project={project}
          packageData={workspace.publishingPackage}
          compliance={workspace.compliance}
        />
        <ApprovalPanel
          project={project}
          compliance={workspace.compliance}
          onApprove={() => approveProject(project.id)}
        />
      </div>

      <div className="flex items-center justify-center gap-2 pb-4 text-[10px] uppercase tracking-[0.12em] text-slate-600">
        <FileStack className="h-3.5 w-3.5" />
        Package version UI-DEMO-01
      </div>
    </main>
  );
}
