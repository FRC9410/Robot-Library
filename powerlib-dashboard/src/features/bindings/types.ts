export type BindingController = "driver" | "operator";
export type BindingEvent = "onTrue" | "onFalse" | "whileTrue" | "toggleOnTrue";
export type BindingChain = "single" | "andThen" | "alongWith";

export type BindingCommand = {
  subsystemId: string;
  method: string;
  constantName?: string;
  value?: number | string;
};

export type GeneratedBinding = {
  id?: string;
  name?: string;
  controller?: BindingController;
  input?: string;
  event?: BindingEvent;
  chain?: BindingChain;
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
  chain: BindingChain;
  commands: BindingCommand[];
};
