export interface PolicyOptions {
  role?: string | string[];

  using?: string;

  check?: string;
}

export function makeClauses({ role, using, check }: PolicyOptions): string[] {
  const roles = (Array.isArray(role) ? role : [role]).join(', ');
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
