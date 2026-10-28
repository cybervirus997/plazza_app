import type { CareRecord } from '../domain/carePlans';
export interface CarePlanRepository {
  load(): Promise<readonly CareRecord[]>;
  save(value: CareRecord, expectedRevision: number): Promise<readonly CareRecord[]>;
  remove(id: string, expectedRevision: number): Promise<readonly CareRecord[]>;
  action(id: string, action: 'pause' | 'resume' | 'skip', expectedRevision: number): Promise<readonly CareRecord[]>;
}
