'use client';

import Link from 'next/link';
import { CheckSquare2 } from 'lucide-react';
import { OutputsWorkspace, type OutputView } from '@/components/outputs/outputs-workspace';
import { ProjectNotFound } from '@/components/projects/project-not-found';
import { buttonStyles } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { useStudioFlow } from '@/hooks/use-studioflow';

const validViews: OutputView[] = ['transcript', 'scenes', 'compliance', 'publishing'];

export default function OutputsPage({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams: { view?: string };
}) {
  const {
    findProject,
    getWorkspace,
    resolveComplianceCheck,
    selectTitle,
    updateDescription,
    addTag,
    removeTag,
  } = useStudioFlow();
  const project = findProject(params.projectId);
  const workspace = getWorkspace(params.projectId);

  if (!project || !workspace) return <ProjectNotFound />;

  const initialView = validViews.includes(searchParams.view as OutputView)
    ? (searchParams.view as OutputView)
    : 'transcript';

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-7 sm:px-6 lg:py-8">
      <PageHeader
        eyebrow={`${project.code} · Generated package`}
        title="Review agent outputs"
        description="Inspect the specialist evidence, resolve readiness warnings, and refine publishing metadata before final approval."
        actions={
          <Link href={`/projects/${project.id}/review`} className={buttonStyles()}>
            <CheckSquare2 className="h-4 w-4" />
            Final review
          </Link>
        }
      />

      <OutputsWorkspace
        projectId={project.id}
        initialView={initialView}
        transcript={workspace.transcript}
        chapters={workspace.chapters}
        scenes={workspace.scenes}
        compliance={workspace.compliance}
        packageData={workspace.publishingPackage}
        onResolveCompliance={(checkId) => resolveComplianceCheck(project.id, checkId)}
        onSelectTitle={(titleId) => selectTitle(project.id, titleId)}
        onUpdateDescription={(description) => updateDescription(project.id, description)}
        onAddTag={(tag) => addTag(project.id, tag)}
        onRemoveTag={(tag) => removeTag(project.id, tag)}
      />
    </main>
  );
}
