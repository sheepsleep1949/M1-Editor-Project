import type {
  Story,
  RuntimeState,
  ApplyResult,
  ChoiceView,
  Issue,
  ValidationReport,
  PublishedSnapshot,
  PlayEvent,
  ExecuteChoiceRequest,
  ExecuteChoiceResponse,
  Session,
  Save,
} from "./index";
// Contracts only. These signatures do not claim the corresponding services are implemented.
export interface RulePort {
  initialState(story: Story): RuntimeState;
  getChoices(story: Story, state: RuntimeState): ChoiceView[];
  applyChoice(story: Story, state: RuntimeState, choiceId: string): ApplyResult;
}
export type ValidationBudget = { maxStates: number; maxTimeMs: number };
export type CoreValidation = Pick<
  ValidationReport,
  "complete" | "publishable" | "visitedStates" | "truncationReason" | "issues"
>;
export interface ValidationPort {
  validateStructure(story: unknown): Issue[];
  validateStory(story: Story, budget: ValidationBudget): CoreValidation;
}
export interface ExecutionPort {
  executeChoice(
    actorId: string,
    sessionId: string,
    input: ExecuteChoiceRequest,
  ): Promise<ExecuteChoiceResponse>;
}
export interface EventPort<Tx> {
  // M2 opens the transaction. M5 must not create a new client or swallow errors here.
  appendEvent(
    tx: Tx,
    event: PlayEvent,
    requestHash: string,
    response: ExecuteChoiceResponse,
  ): Promise<void>;
}
export interface VersionPort<Tx> {
  loadVersion(tx: Tx, versionId: string): Promise<PublishedSnapshot>;
}
export interface SavePort {
  createSave(
    actorId: string,
    sessionId: string,
    input: { expectedSeq: number; requestId: string; label: string },
  ): Promise<Save>;
  restoreSave(
    actorId: string,
    saveId: string,
    input: { requestId: string; shareWithCreator: boolean },
  ): Promise<Session>;
}
