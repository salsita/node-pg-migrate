import { Value, Name, Type, DropOptions } from './generalTypes'

export interface DomainOptions {
  default?: Value
  notNull?: boolean
  check?: string
  constraintName?: string
}

export interface DomainOptionsCreate extends DomainOptions {
  collation?: string
}

export interface DomainOptionsAlter extends DomainOptions {
  allowNull?: boolean
}

type CreateDomainFn = (
  domainName: Name,
  type: Type,
  domainOptions?: DomainOptionsCreate & DropOptions,
) => string | string[]
export type CreateDomain = CreateDomainFn & { reverse: CreateDomainFn }
export type DropDomain = (domainName: Name, dropOptions?: DropOptions) => string | string[]
export type AlterDomain = (domainName: Name, domainOptions: DomainOptionsAlter) => string | string[]
type RenameDomainFn = (oldDomainName: Name, newDomainName: Name) => string | string[]
export type RenameDomain = RenameDomainFn & { reverse: RenameDomainFn }
