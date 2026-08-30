import type {
  ComplianceAnalysisResult,
  ComplianceCategory,
  ComplianceCheckItem,
  CompliancePanelData,
  ComplianceRequest,
  ComplianceStatus,
} from './types';

export interface ComplianceChunkResult {
  overallStatus: ComplianceStatus;
  summary: string;
  checks: ComplianceCheckItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unwrapJson(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1] : trimmed;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

function isComplianceStatus(value: unknown): value is ComplianceStatus {
  return value === 'passed' || value === 'warning' || value === 'failed';
}

function isComplianceCategory(value: unknown): value is ComplianceCategory {
  return (
    value === 'safety' ||
    value === 'disclosure' ||
    value === 'accessibility' ||
    value === 'metadata'
  );
}

function parseCheckItem(rawItem: unknown, index: number): ComplianceCheckItem {
  if (!isRecord(rawItem)) {
    throw new Error(`checks[${index}] must be an object.`);
  }

  const categoryRaw = requireString(rawItem.category, `checks[${index}].category`).toLowerCase();
  if (!isComplianceCategory(categoryRaw)) {
    throw new Error(
      `checks[${index}].category must be one of safety|disclosure|accessibility|metadata.`
    );
  }

  const statusRaw = requireString(rawItem.status, `checks[${index}].status`).toLowerCase();
  if (!isComplianceStatus(statusRaw)) {
    throw new Error(`checks[${index}].status must be one of passed|warning|failed.`);
  }

  const title = requireString(rawItem.title, `checks[${index}].title`);
  const description = requireString(rawItem.description, `checks[${index}].description`);
  const resolution = requireString(rawItem.resolution, `checks[${index}].resolution`);
  const resolved = Boolean(rawItem.resolved);

  return {
    category: categoryRaw,
    title,
    description,
    status: statusRaw,
    resolution,
    resolved,
  };
}

export function parseComplianceResponse(rawText: string): ComplianceChunkResult {
  const cleaned = unwrapJson(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Invalid JSON response from Gemini for compliance analysis.');
  }

  if (!isRecord(parsed)) {
    throw new Error('Compliance response must be a JSON object.');
  }

  const summary = requireString(parsed.summary, 'summary');
  let overallStatusRaw = typeof parsed.overallStatus === 'string'
    ? parsed.overallStatus.trim().toLowerCase()
    : '';

  if (!Array.isArray(parsed.checks)) {
    throw new Error('checks must be an array.');
  }

  const checks = parsed.checks.map((item, index) => parseCheckItem(item, index));

  if (!isComplianceStatus(overallStatusRaw)) {
    // Derive overall status from checks if missing or invalid
    if (checks.some((c) => c.status === 'failed')) {
      overallStatusRaw = 'failed';
    } else if (checks.some((c) => c.status === 'warning')) {
      overallStatusRaw = 'warning';
    } else {
      overallStatusRaw = 'passed';
    }
  }

  return {
    overallStatus: overallStatusRaw as ComplianceStatus,
    summary,
    checks,
  };
}

export function createFallbackComplianceResult(
  request: ComplianceRequest,
  generatedAt: string
): ComplianceAnalysisResult {
  const hasTranscript = Boolean(request.transcriptResult);
  const hasAsset = Boolean(request.assetResult);

  const checks: ComplianceCheckItem[] = [
    {
      category: 'safety',
      title: 'Safety & Content Guidelines Audit',
      description: hasAsset
        ? 'Visual scenes extracted. Automated AI safety verification unavailable.'
        : 'Automated AI content safety verification unavailable.',
      status: 'warning',
      resolution: 'Manual review required prior to publication.',
      resolved: false,
    },
    {
      category: 'disclosure',
      title: 'Sponsorship & Commercial Disclosure',
      description: hasTranscript
        ? 'Transcript present. Commercial sponsorship disclosure verification unavailable.'
        : 'Automated sponsorship disclosure check unavailable.',
      status: 'warning',
      resolution: 'Verify paid promotion / sponsorship disclosures manually.',
      resolved: false,
    },
    {
      category: 'accessibility',
      title: 'Captions & Accessibility Audit',
      description: hasTranscript
        ? 'Speech transcript generated. Caption accuracy check pending.'
        : 'No speech transcript available for accessibility verification.',
      status: hasTranscript ? 'passed' : 'warning',
      resolution: hasTranscript
        ? 'Review generated transcript segments in Transcript Panel.'
        : 'Generate transcript to verify caption compliance.',
      resolved: hasTranscript,
    },
    {
      category: 'metadata',
      title: 'Publishing Metadata & Tagging',
      description: `Media '${request.media.fileName}' (MIME: ${request.media.mimeType}). Metadata validation pending.`,
      status: 'passed',
      resolution: 'Ensure title, description, and tags are populated before publishing.',
      resolved: true,
    },
  ];

  return {
    projectId: request.projectId,
    mediaId: request.media.id,
    overallStatus: 'warning',
    summary: 'Compliance audit completed in fallback mode. AI compliance verification unavailable.',
    checks,
    source: 'fallback',
    generatedAt,
  };
}

export function toCompliancePanelData(result: ComplianceAnalysisResult): CompliancePanelData {
  return {
    overallStatus: result.overallStatus,
    summary: result.summary,
    checks: result.checks.map((check) => ({
      category: check.category,
      title: check.title,
      description: check.description,
      status: check.status,
      resolution: check.resolution,
      resolved: check.resolved,
    })),
  };
}
