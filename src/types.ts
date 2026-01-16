export interface MigrationFile {
  filename: string;
  upSql: string[];
  downSql?: string[];
  hash: string;
}
