import { toArray } from '../../utils';

export interface PolicyOptions {
  role?: string | string[];

  using?: string;

  check?: string;

  comment?: string | null;
}

export function makeClauses({ role, using, check }: PolicyOptions): string[] {
  const roles = toArray(role).join(', ');
  const clauses: string[] = [];

  if (roles) {
    clauses.push(`TO ${roles}`);
  }

  if (using) {
    clauses.push(`USING (${using})`);
  }

  if (check) {
    clauses.push(`WITH CHECK (${check})`);
  }

  return clauses;
}
