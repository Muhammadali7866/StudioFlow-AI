import { ProjectNavigation } from '@/components/shell/project-navigation';

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectId: string };
}) {
  return (
    <>
      <ProjectNavigation projectId={params.projectId} />
      {children}
    </>
  );
}
