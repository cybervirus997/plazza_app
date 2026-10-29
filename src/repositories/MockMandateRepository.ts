import type { MockMandate, MockMandateAction } from '../domain/mockMandates';
export interface MockMandateRepository {
  load(): Promise<readonly MockMandate[]>;
  save(value: MockMandate, expectedRevision: number): Promise<readonly MockMandate[]>;
  action(id: string, action: MockMandateAction, optIn: boolean, expectedRevision: number): Promise<readonly MockMandate[]>;
}
