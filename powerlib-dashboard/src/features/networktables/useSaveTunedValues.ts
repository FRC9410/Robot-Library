import { useEffect, useMemo, useState } from "react";
import type { NtTopicSnapshot } from "../../networktables/nt4Client";
import type { GeneratedSubsystem, GeneratedSwerveConstants } from "../subsystems/types";
import { buildChanges, cloneValues, setNestedValue, type SaveValueChange, type LoadedDocuments } from "./saveTunedValuesModel";
import { formatNumericConstantValue } from "../constants/types";
export function useSaveTunedValues(open: boolean, topics: NtTopicSnapshot[]) {
  const [documents, setDocuments] = useState<LoadedDocuments>({
    subsystems: [],
    swerve: {},
    localization: null,
    constants: []
  });
  const [changes, setChanges] = useState<SaveValueChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedCount = useMemo(() => changes.filter((change) => change.selected).length, [changes]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadChanges();
    // Snapshot the current topic values when the dialog opens; users can close/reopen to refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadChanges() {
    setLoading(true);
    setSaving(false);
    setError(null);
    setMessage(null);

    try {
      if (!window.powerlib?.readSubsystems || !window.powerlib?.readConstants || !window.powerlib?.readLocalizationConfig) {
        throw new Error("PowerLib file bridge is not available.");
      }

      let localizationError = "";
      const [subsystemsResult, constants, localization] = await Promise.all([
        window.powerlib.readSubsystems(), window.powerlib.readConstants(), window.powerlib.readLocalizationConfig().catch(caught => { localizationError = String(caught); return { config: null }; })
      ]);
      if (subsystemsResult.error) {
        throw new Error(subsystemsResult.error);
      }

      const loaded = {
        subsystems: subsystemsResult.subsystems as GeneratedSubsystem[],
        swerve: (subsystemsResult.swerve ?? {}) as GeneratedSwerveConstants,
        localization: localization.config,
        constants
      };
      setDocuments(loaded);
      if (localizationError || subsystemsResult.swerveError) setError([localizationError, subsystemsResult.swerveError].filter(Boolean).join(" "));
      setChanges(buildChanges(topics, loaded));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not compare tuned values.");
      setChanges([]);
    } finally {
      setLoading(false);
    }
  }

  function setAllSelected(selected: boolean) {
    setChanges((current) => current.map((change) => ({ ...change, selected })));
  }

  function toggleChange(id: string) {
    setChanges((current) =>
      current.map((change) => (change.id === id ? { ...change, selected: !change.selected } : change))
    );
  }

  async function saveSelectedChanges() {
    const selectedChanges = changes.filter((change) => change.selected);
    if (selectedChanges.length === 0) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (!window.powerlib?.saveTunedSourceValues) {
        throw new Error("PowerLib file bridge is not available.");
      }

      const nextSubsystems = cloneValues(documents.subsystems);
      const nextSwerve = cloneValues(documents.swerve);
      const nextLocalization = cloneValues(documents.localization);
      const nextConstants = cloneValues(documents.constants);
      const changedFiles = new Set<string>();
      const unselectedIds = new Set(changes.filter((change) => !change.selected).map((change) => change.id));
      let subsystemChanged = false;
      let swerveChanged = false;
      let localizationChanged = false;

      selectedChanges.forEach((change) => {
        if (change.target === "subsystem" && change.subsystemIndex !== undefined && change.subsystemPath) {
          setNestedValue(nextSubsystems[change.subsystemIndex], change.subsystemPath, change.newValue);
          subsystemChanged = true;
        }

        if (change.target === "swerve" && change.swervePath) {
          setNestedValue(nextSwerve, change.swervePath, change.newValue);
          swerveChanged = true;
        }
        if (change.target === "localization" && change.localizationPath) {
          setNestedValue(nextLocalization, change.localizationPath, change.newValue);
          localizationChanged = true;
        }
        if (change.target === "constant" && change.constantsFileId && change.constantName && typeof change.newValue === "number") {
          const file = nextConstants.find((candidate) => candidate.id === change.constantsFileId);
          const row = file?.constants.find((candidate) => candidate.name === change.constantName);
          if (!file || !row) throw new Error("Could not find the custom constant to save. Refresh the values.");
          row.value = formatNumericConstantValue(change.newValue, row.type);
          changedFiles.add(file.id);
        }
      });

      const savedDocuments = {
        subsystems: nextSubsystems,
        swerve: nextSwerve,
        localization: nextLocalization,
        constants: nextConstants
      };

      const result = await window.powerlib.saveTunedSourceValues({
        ...(subsystemChanged ? { subsystems: nextSubsystems } : {}),
        ...(swerveChanged ? { swerve: nextSwerve } : {}),
        ...(localizationChanged && nextLocalization ? { localization: nextLocalization } : {}),
        constants: [...changedFiles].map(id => { const file = nextConstants.find(file => file.id === id)!; return { id: file.id, source: file.source, constants: file.constants }; })
      });
      savedDocuments.subsystems = result.subsystems as GeneratedSubsystem[];
      savedDocuments.swerve = result.swerve as GeneratedSwerveConstants;
      savedDocuments.localization = result.localization;
      savedDocuments.constants = result.constants;

      setDocuments(savedDocuments);
      setChanges(
        buildChanges(topics, savedDocuments).map((change) => ({
          ...change,
          selected: !unselectedIds.has(change.id)
        }))
      );
      setMessage(
        `Saved ${selectedChanges.length} tuned value${selectedChanges.length === 1 ? "" : "s"} to Java. Build and deploy to use the saved defaults.`
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save tuned values.");
    } finally {
      setSaving(false);
    }
  }

  return { loading, saving, error, message, changes, selectedCount, setAllSelected, toggleChange, saveSelectedChanges, loadChanges };
}
