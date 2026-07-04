import type { MigrationOptions } from "../../migrationOptions";
import type { AlterIndexAction, IfExistsOption } from "../generalTypes";

export interface AlterIndexOptions extends IfExistsOption {
  clause?: AlterIndexAction;
  no?: boolean;
  ownedBy?: string | string[];
  noWait?: boolean;
  // integer?: number; -- breaking change, not supported yet
  // columNumber?: number; -- breaking change, not supported yet
  // colum?: boolean; -- breaking change, not supported yet
}

export type AlterIndex = (
  name: string,
  newName: string,
  options?: AlterIndexOptions,
  // newName: string | AlterIndexOptions, -- breaking change, not supported yet
) => string;
