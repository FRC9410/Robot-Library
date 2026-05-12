export type BindingController = "driver" | "operator";
export type BindingEvent = "onTrue" | "onFalse" | "whileTrue" | "toggleOnTrue";

export type BindingCommandKind = "function" | "sequence" | "parallelRace";

export type BindingCommand = {
  kind?: BindingCommandKind;
  subsystemId: string;
  method: string;
  constantName?: string;
  value?: number | string;
  children?: BindingCommand[];
};

export type GeneratedBinding = {
  id?: string;
  name?: string;
  controller?: BindingController;
  input?: string;
  event?: BindingEvent;
  commands?: BindingCommand[];
};

export type BindingDocumentState = {
  loading: boolean;
  exists: boolean;
  path: string;
  bindings: GeneratedBinding[];
  error: string | null;
};

export type BindingFormState = {
  mode: "create" | "edit";
  index: number | null;
  id: string;
  name: string;
  controller: BindingController;
  input: string;
  event: BindingEvent;
  commands: BindingCommand[];
};
