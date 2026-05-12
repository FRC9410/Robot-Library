export type BindingController = "driver" | "operator";
export type BindingEvent = "onTrue" | "onFalse" | "whileTrue" | "toggleOnTrue";

export type BindingCommandKind = "function" | "sequence" | "parallelRace" | "wait";

export type BindingCommand = {
  kind?: BindingCommandKind;
  subsystemId: string;
  method: string;
  constantSource?: "new" | "existing";
  constantName?: string;
  value?: number | string;
  children?: BindingCommand[];
};

export type BindingConstantOption = {
  subsystemId: string;
  subsystemName: string;
  name: string;
  value: string;
  type: string;
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
