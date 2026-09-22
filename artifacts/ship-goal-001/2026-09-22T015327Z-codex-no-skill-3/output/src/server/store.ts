import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSeedDatabase, type Database } from "./seed.js";

export class FileStore {
  private database?: Database;

  constructor(private readonly filePath: string) {}

  async read(): Promise<Database> {
    if (this.database) {
      return this.database;
    }

    try {
      const raw = await readFile(this.filePath, "utf8");
      this.database = JSON.parse(raw) as Database;
      return this.database;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      this.database = createSeedDatabase();
      await this.write(this.database);
      return this.database;
    }
  }

  async write(database: Database): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
    this.database = database;
  }

  async update<T>(mutator: (database: Database) => T): Promise<T> {
    const database = await this.read();
    const result = mutator(database);
    await this.write(database);
    return result;
  }
}
