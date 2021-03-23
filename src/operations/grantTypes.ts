type GrantFn = (privilege: string, table: string, roleSpecification: string) => string
export type Grant = GrantFn & { reverse: GrantFn }
export type Revoke = (privilege: string, table: string, roleSpecification: string) => string
