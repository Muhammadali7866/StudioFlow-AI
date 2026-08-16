import { redirect } from 'next/navigation';

export default function ProjectPage({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/workflow`);
}
