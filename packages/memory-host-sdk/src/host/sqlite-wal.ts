// Public SQLite WAL maintenance facade for memory database callers.

export {
  DEFAULT_SQLITE_WAL_AUTOCHECKPOINT_PAGES,
  DEFAULT_SQLITE_WAL_TRUNCATE_INTERVAL_MS,
  configureSqliteWalMaintenance,
} from "./actagent-runtime-io.js";
export type { SqliteWalMaintenance, SqliteWalMaintenanceOptions } from "./actagent-runtime-io.js";
