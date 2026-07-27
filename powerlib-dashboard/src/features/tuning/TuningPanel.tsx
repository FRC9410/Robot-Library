import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  IconButton,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import type { NtPrimitive, NtTopicSnapshot, NtTopicType } from "../../networktables/nt4Client";
import { SaveTunedValuesDialog } from "../networktables/SaveTunedValuesDialog";
import { useNetworkTables } from "../networktables/NetworkTablesContext";
import {
  getWritableTopicType,
  isTunableTopic,
  parseDraftValue,
  tuningModeRequestTopicName,
  topicValueToDraft,
  tuningModeTopicName
} from "../networktables/tuningUtils";

type TuningOwnerKind = "subsystem" | "command";

type TuningOwner = {
  kind: TuningOwnerKind;
  ownerName: string;
};

type ParsedTunableTopic = TuningOwner & {
  variableKey: string;
};

type TuningOwnerGroup = TuningOwner & {
  topics: NtTopicSnapshot[];
};

type ExpandedSections = Record<TuningOwnerKind, boolean>;

type TunableVariableRowProps = {
  disabled: boolean;
  draft: string;
  error: string | null;
  topic: NtTopicSnapshot;
  onDraftChange: (topicName: string, draft: string) => void;
  onRemove: (topicName: string) => void;
};

type TuningSidebarProps = {
  commandOwners: TuningOwnerGroup[];
  expandedSections: ExpandedSections;
  getPendingCount: (topics: NtTopicSnapshot[]) => number;
  onToggleSection: (kind: TuningOwnerKind, expanded: boolean) => void;
  onToggleTopicSelection: (topicName: string, selected: boolean) => void;
  pendingTopicNames: Set<string>;
  selectedTopicNames: Set<string>;
  subsystemOwners: TuningOwnerGroup[];
};

const subsystemVariablesPrefix = "/PowerLib/Subsystems/";
const commandVariablesPrefix = "/PowerLib/Commands/";

function getOwnerKey(owner: TuningOwner) {
  return `${owner.kind}:${owner.ownerName}`;
}

function getOwnerLabel(kind: TuningOwnerKind) {
  return kind === "subsystem" ? "Subsystem" : "Command";
}

function toExpandedSections(kind: TuningOwnerKind): ExpandedSections {
  return {
    subsystem: kind === "subsystem",
    command: kind === "command"
  };
}

function normalizeSelectedTopicNames(topicNames: string[]) {
  return Array.from(new Set(topicNames.map((topicName) => topicName.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function parseTunableTopic(topic: NtTopicSnapshot): ParsedTunableTopic | null {
  const candidates: Array<{ kind: TuningOwnerKind; prefix: string }> = [
    { kind: "subsystem", prefix: subsystemVariablesPrefix },
    { kind: "command", prefix: commandVariablesPrefix }
  ];

  for (const candidate of candidates) {
    if (!topic.name.startsWith(candidate.prefix)) {
      continue;
    }

    const [ownerName, section, ...variableParts] = topic.name
      .slice(candidate.prefix.length)
      .split("/")
      .filter(Boolean);
    if (!ownerName || section !== "Variables" || variableParts.length === 0) {
      return null;
    }

    return {
      kind: candidate.kind,
      ownerName,
      variableKey: variableParts.join("/")
    };
  }

  return null;
}

function formatVariableSegment(segment: string) {
  if (/^k[A-Z]$/.test(segment)) {
    return segment;
  }

  if (/^[A-Z0-9_]+$/.test(segment)) {
    return segment.replace(/_/g, " ");
  }

  return segment.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function formatVariableKey(variableKey: string) {
  return variableKey.split("/").map(formatVariableSegment).join(" ");
}

function getVariableDisplayName(topic: NtTopicSnapshot) {
  const parsed = parseTunableTopic(topic);
  return parsed ? formatVariableKey(parsed.variableKey) : topic.name;
}

function formatSidebarValue(topic: NtTopicSnapshot) {
  const value = topicValueToDraft(topic.value);
  return value.trim().length === 0 ? "unset" : value;
}

function buildOwnerGroups(tunableTopics: NtTopicSnapshot[]) {
  const groups: Record<TuningOwnerKind, Map<string, TuningOwnerGroup>> = {
    subsystem: new Map(),
    command: new Map()
  };

  tunableTopics.forEach((topic) => {
    const parsed = parseTunableTopic(topic);
    if (!parsed) {
      return;
    }

    const ownerGroups = groups[parsed.kind];
    const group = ownerGroups.get(parsed.ownerName) ?? {
      kind: parsed.kind,
      ownerName: parsed.ownerName,
      topics: []
    };
    group.topics.push(topic);
    ownerGroups.set(parsed.ownerName, group);
  });

  return {
    subsystems: [...groups.subsystem.values()]
      .map((group) => ({
        ...group,
        topics: [...group.topics].sort((left, right) =>
          getVariableDisplayName(left).localeCompare(getVariableDisplayName(right))
        )
      }))
      .sort((left, right) => left.ownerName.localeCompare(right.ownerName)),
    commands: [...groups.command.values()]
      .map((group) => ({
        ...group,
        topics: [...group.topics].sort((left, right) =>
          getVariableDisplayName(left).localeCompare(getVariableDisplayName(right))
        )
      }))
      .sort((left, right) => left.ownerName.localeCompare(right.ownerName))
  };
}

function topicMatchesSearch(topic: NtTopicSnapshot, normalizedSearchTerm: string) {
  const parsed = parseTunableTopic(topic);
  return (
    getVariableDisplayName(topic).toLowerCase().includes(normalizedSearchTerm) ||
    (parsed?.variableKey.toLowerCase().includes(normalizedSearchTerm) ?? false)
  );
}

function filterOwnerGroups(owners: TuningOwnerGroup[], searchTerm: string) {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  if (!normalizedSearchTerm) {
    return owners;
  }

  return owners.flatMap((owner) => {
    if (owner.ownerName.toLowerCase().includes(normalizedSearchTerm)) {
      return [owner];
    }

    const matchingTopics = owner.topics.filter((topic) => topicMatchesSearch(topic, normalizedSearchTerm));
    return matchingTopics.length > 0 ? [{ ...owner, topics: matchingTopics }] : [];
  });
}

function selectedTopicMatchesSearch(topic: NtTopicSnapshot, normalizedSearchTerm: string) {
  if (!normalizedSearchTerm) {
    return true;
  }

  const parsed = parseTunableTopic(topic);
  return (
    getVariableDisplayName(topic).toLowerCase().includes(normalizedSearchTerm) ||
    topic.name.toLowerCase().includes(normalizedSearchTerm) ||
    (parsed?.ownerName.toLowerCase().includes(normalizedSearchTerm) ?? false) ||
    (parsed?.variableKey.toLowerCase().includes(normalizedSearchTerm) ?? false) ||
    (parsed ? getOwnerLabel(parsed.kind).toLowerCase().includes(normalizedSearchTerm) : false)
  );
}

function TunableVariableRow({
  disabled,
  draft,
  error,
  topic,
  onDraftChange,
  onRemove
}: TunableVariableRowProps) {
  const type = getWritableTopicType(topic);
  const parsed = parseTunableTopic(topic);
  const displayName = getVariableDisplayName(topic);

  if (!type) {
    return null;
  }
  const writableType = type;

  return (
    <Box
      sx={{
        alignItems: "center",
        border: "1px solid",
        borderColor: error ? "error.main" : "divider",
        borderRadius: 1.5,
        display: "grid",
        gap: 1,
        gridTemplateAreas: {
          xs: `"label remove" "type remove" "input input"`,
          md: `"label type input remove"`
        },
        gridTemplateColumns: { xs: "1fr auto", md: "minmax(220px, 1fr) auto minmax(160px, 240px) auto" },
        p: 1.25
      }}
    >
      <Stack spacing={0.25} sx={{ gridArea: "label", minWidth: 0 }}>
        <Typography sx={{ fontFamily: "monospace", fontWeight: 800, overflowWrap: "anywhere" }}>
          {displayName}
        </Typography>
        {parsed && (
          <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }} variant="caption">
            {getOwnerLabel(parsed.kind)}: {parsed.ownerName}
          </Typography>
        )}
      </Stack>
      <Box sx={{ gridArea: "type", justifySelf: { xs: "start", md: "center" } }}>
        <Chip label={writableType} size="small" variant="outlined" />
      </Box>
      <TextField
        disabled={disabled}
        error={Boolean(error)}
        helperText={error ?? undefined}
        size="small"
        sx={{ gridArea: "input" }}
        value={draft}
        onChange={(event) => onDraftChange(topic.name, event.target.value)}
      />
      <IconButton
        aria-label={`Remove ${displayName} from selected tunables`}
        size="small"
        sx={{ gridArea: "remove", justifySelf: "end" }}
        onClick={() => onRemove(topic.name)}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

function TuningSidebarTopicRow({
  pending,
  selected,
  topic,
  onToggle
}: {
  pending: boolean;
  selected: boolean;
  topic: NtTopicSnapshot;
  onToggle: (topicName: string, selected: boolean) => void;
}) {
  return (
    <Box
      component="label"
      sx={{
        alignItems: "center",
        border: "1px solid",
        borderColor: selected ? "primary.main" : "divider",
        borderRadius: 1.25,
        cursor: "pointer",
        display: "grid",
        gap: 0.75,
        gridTemplateColumns: "auto minmax(0, 1fr) auto",
        px: 0.75,
        py: 0.5,
        transition: "border-color 120ms ease, background-color 120ms ease",
        ...(selected
          ? {
              bgcolor: "rgba(255, 204, 0, 0.08)"
            }
          : {
              "&:hover": {
                bgcolor: "action.hover"
              }
            })
      }}
    >
      <Checkbox
        checked={selected}
        size="small"
        sx={{ p: 0.25 }}
        onChange={(event) => onToggle(topic.name, event.target.checked)}
      />
      <Stack spacing={0.15} sx={{ minWidth: 0 }}>
        <Typography noWrap variant="body2" sx={{ fontFamily: "monospace", fontWeight: 800 }}>
          {getVariableDisplayName(topic)}
        </Typography>
        <Typography noWrap color="text.secondary" variant="caption" sx={{ fontFamily: "monospace" }}>
          {formatSidebarValue(topic)}
        </Typography>
      </Stack>
      {pending && <Chip color="warning" label="pending" size="small" variant="outlined" />}
    </Box>
  );
}

function TuningSidebar({
  commandOwners,
  expandedSections,
  getPendingCount,
  onToggleSection,
  onToggleTopicSelection,
  pendingTopicNames,
  selectedTopicNames,
  subsystemOwners
}: TuningSidebarProps) {
  const [searchOpen, setSearchOpen] = useState<ExpandedSections>({
    subsystem: false,
    command: false
  });
  const [searchTerms, setSearchTerms] = useState<Record<TuningOwnerKind, string>>({
    subsystem: "",
    command: ""
  });

  function renderOwnerList(kind: TuningOwnerKind, owners: TuningOwnerGroup[], searching: boolean) {
    if (owners.length === 0) {
      return (
        <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
          {searching
            ? `No matching ${kind === "subsystem" ? "subsystem" : "command"} variables.`
            : `No ${kind === "subsystem" ? "subsystem" : "command"} variables yet.`}
        </Typography>
      );
    }

    return (
      <Stack spacing={1.25}>
        {owners.map((group) => {
          const pendingCount = getPendingCount(group.topics);

          return (
            <Box key={getOwnerKey(group)}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.75, minWidth: 0 }}>
                <Typography noWrap sx={{ flexGrow: 1, fontWeight: 900 }}>
                  {group.ownerName}
                </Typography>
                <Chip label={group.topics.length} size="small" variant="outlined" />
                {pendingCount > 0 && <Chip color="warning" label={pendingCount} size="small" variant="outlined" />}
              </Stack>
              <Stack spacing={0.65}>
                {group.topics.map((topic) => (
                  <TuningSidebarTopicRow
                    key={topic.name}
                    pending={pendingTopicNames.has(topic.name)}
                    selected={selectedTopicNames.has(topic.name)}
                    topic={topic}
                    onToggle={onToggleTopicSelection}
                  />
                ))}
              </Stack>
            </Box>
          );
        })}
      </Stack>
    );
  }

  function toggleSearch(kind: TuningOwnerKind) {
    const sectionWasExpanded = expandedSections[kind];
    onToggleSection(kind, true);
    setSearchOpen((current) => {
      const nextOpen = !sectionWasExpanded || !current[kind];
      if (!nextOpen) {
        setSearchTerms((terms) => ({ ...terms, [kind]: "" }));
      }
      return { ...current, [kind]: nextOpen };
    });
  }

  function renderSection(kind: TuningOwnerKind, title: string, itemName: string, owners: TuningOwnerGroup[]) {
    const expanded = expandedSections[kind];
    const searchTerm = searchTerms[kind];
    const visibleOwners = filterOwnerGroups(owners, searchTerm);
    const searching = searchTerm.trim().length > 0;

    return (
      <Box
        sx={{
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1.5,
          display: "flex",
          flex: expanded ? "1 1 0" : "0 0 auto",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden"
        }}
      >
        <Box
          aria-expanded={expanded}
          role="button"
          tabIndex={0}
          onClick={() => onToggleSection(kind, true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggleSection(kind, true);
            }
          }}
          sx={{
            alignItems: "center",
            cursor: "pointer",
            display: "flex",
            flexShrink: 0,
            justifyContent: "space-between",
            minHeight: 56,
            px: 1.5,
            py: 0.75,
            textAlign: "left",
            "&:hover": {
              bgcolor: "action.hover"
            }
          }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
            <Chip label={`${owners.length} ${itemName}${owners.length === 1 ? "" : "s"}`} size="small" />
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <IconButton
              aria-label={`${searchOpen[kind] ? "Close" : "Search"} ${title.toLowerCase()}`}
              color={searchOpen[kind] || searching ? "primary" : "default"}
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                toggleSearch(kind);
              }}
            >
              <SearchIcon fontSize="small" />
            </IconButton>
            <ExpandMoreIcon
              sx={{
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 160ms ease"
              }}
            />
          </Stack>
        </Box>
        {expanded && (
          <Box
            sx={{
              borderTop: "1px solid",
              borderColor: "divider",
              flex: "1 1 auto",
              minHeight: 0,
              overflowY: "auto",
              p: 1.25
            }}
          >
            {searchOpen[kind] && (
              <TextField
                autoFocus
                fullWidth
                placeholder={`Search ${title.toLowerCase()} or variables`}
                size="small"
                sx={{ mb: 1.25 }}
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerms((current) => ({ ...current, [kind]: event.target.value }))
                }
              />
            )}
            {renderOwnerList(kind, visibleOwners, searching)}
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0, overflow: "hidden" }}>
      {renderSection("subsystem", "Subsystems", "subsystem", subsystemOwners)}
      {renderSection("command", "Commands", "command", commandOwners)}
    </Box>
  );
}

export function TuningPanel() {
  const { clientRef, status, topics, upsertTopic } = useNetworkTables();
  const [saveValuesOpen, setSaveValuesOpen] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [selectedTopicNames, setSelectedTopicNames] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({});
  const [applying, setApplying] = useState(false);
  const [selectedSearchOpen, setSelectedSearchOpen] = useState(false);
  const [selectedSearchTerm, setSelectedSearchTerm] = useState("");
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    subsystem: true,
    command: false
  });
  const lastTopicDraftsRef = useRef<Record<string, string>>({});
  const selectionSaveSequenceRef = useRef(0);
  const sidebarSaveSequenceRef = useRef(0);

  const tunableTopics = useMemo(() => {
    return topics.filter(isTunableTopic).sort((left, right) => left.name.localeCompare(right.name));
  }, [topics]);
  const tunableTopicMap = useMemo(() => new Map(tunableTopics.map((topic) => [topic.name, topic])), [tunableTopics]);
  const ownerGroups = useMemo(() => buildOwnerGroups(tunableTopics), [tunableTopics]);
  const selectedTopicNameSet = useMemo(() => new Set(selectedTopicNames), [selectedTopicNames]);
  const selectedTopics = useMemo(() => {
    return selectedTopicNames
      .map((topicName) => tunableTopicMap.get(topicName))
      .filter((topic): topic is NtTopicSnapshot => Boolean(topic));
  }, [selectedTopicNames, tunableTopicMap]);
  const visibleSelectedTopics = useMemo(() => {
    return selectedTopics.filter((topic) => selectedTopicMatchesSearch(topic, selectedSearchTerm.trim().toLowerCase()));
  }, [selectedSearchTerm, selectedTopics]);
  const unavailableSelectionCount = selectedTopicNames.length - selectedTopics.length;
  const tuningModeTopic = topics.find((topic) => topic.name === tuningModeTopicName);
  const tuningModeRequestTopic = topics.find((topic) => topic.name === tuningModeRequestTopicName);
  const tuningModeEnabled = tuningModeTopic?.value === true;
  const tuningModeRequested = tuningModeRequestTopic?.value === true;

  useEffect(() => {
    let active = true;

    async function loadSelection() {
      if (!window.powerlib?.readTuningSelection) {
        return;
      }

      setSelectionLoading(true);
      try {
        const result = await window.powerlib.readTuningSelection();
        if (!active) {
          return;
        }

        setSelectedTopicNames(normalizeSelectedTopicNames(result.selectedTopics));
        setExpandedSections(toExpandedSections(result.sidebarExpandedSection));
        setSelectionError(result.error ?? null);
      } catch (caught) {
        if (!active) {
          return;
        }
        const message = caught instanceof Error ? caught.message : String(caught);
        setSelectionError(`Could not read tuning selection: ${message}`);
      } finally {
        if (active) {
          setSelectionLoading(false);
        }
      }
    }

    void loadSelection();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const nextTopicDrafts = Object.fromEntries(
      tunableTopics.map((topic) => [topic.name, topicValueToDraft(topic.value)])
    );

    setDrafts((current) => {
      const next: Record<string, string> = {};
      tunableTopics.forEach((topic) => {
        const currentDraft = current[topic.name];
        const previousTopicDraft = lastTopicDraftsRef.current[topic.name];
        const hasLocalEdit =
          currentDraft !== undefined &&
          previousTopicDraft !== undefined &&
          currentDraft !== previousTopicDraft;

        next[topic.name] = hasLocalEdit ? currentDraft : nextTopicDrafts[topic.name];
      });
      return next;
    });

    setRowErrors((current) => {
      const next: Record<string, string | null> = {};
      tunableTopics.forEach((topic) => {
        next[topic.name] = current[topic.name] ?? null;
      });
      return next;
    });

    lastTopicDraftsRef.current = nextTopicDrafts;
  }, [tunableTopics]);

  const allPendingTopics = useMemo(() => {
    return tunableTopics.filter((topic) => {
      const baseline = topicValueToDraft(topic.value);
      return (drafts[topic.name] ?? baseline) !== baseline;
    });
  }, [drafts, tunableTopics]);

  const selectedPendingTopics = useMemo(() => {
    return selectedTopics.filter((topic) => {
      const baseline = topicValueToDraft(topic.value);
      return (drafts[topic.name] ?? baseline) !== baseline;
    });
  }, [drafts, selectedTopics]);

  const selectedPendingTopicNames = useMemo(
    () => new Set(selectedPendingTopics.map((topic) => topic.name)),
    [selectedPendingTopics]
  );

  function getPendingCount(ownerTopics: NtTopicSnapshot[]) {
    return ownerTopics.filter((topic) => selectedPendingTopicNames.has(topic.name)).length;
  }

  function updateDraft(topicName: string, draft: string) {
    setDrafts((current) => ({ ...current, [topicName]: draft }));
    setRowErrors((current) => ({ ...current, [topicName]: null }));
  }

  function toggleSelectedSearch() {
    setSelectedSearchOpen((current) => {
      const nextOpen = !current;
      if (!nextOpen) {
        setSelectedSearchTerm("");
      }
      return nextOpen;
    });
  }

  function updateExpandedSection(kind: TuningOwnerKind, expanded: boolean) {
    if (!expanded || expandedSections[kind]) {
      return;
    }

    setExpandedSections(toExpandedSections(kind));
    void persistSidebarExpandedSection(kind);
  }

  async function persistSidebarExpandedSection(kind: TuningOwnerKind) {
    if (!window.powerlib?.saveTuningSidebarExpandedSection) {
      return;
    }

    const saveSequence = sidebarSaveSequenceRef.current + 1;
    sidebarSaveSequenceRef.current = saveSequence;

    try {
      const result = await window.powerlib.saveTuningSidebarExpandedSection(kind);
      if (sidebarSaveSequenceRef.current !== saveSequence) {
        return;
      }

      setExpandedSections(toExpandedSections(result.sidebarExpandedSection));
      setSelectionError(null);
    } catch (caught) {
      if (sidebarSaveSequenceRef.current !== saveSequence) {
        return;
      }

      const message = caught instanceof Error ? caught.message : String(caught);
      setSelectionError(`Could not save tuning sidebar state: ${message}`);
    }
  }

  async function persistSelectedTopicNames(nextTopicNames: string[]) {
    const normalizedTopicNames = normalizeSelectedTopicNames(nextTopicNames);
    setSelectedTopicNames(normalizedTopicNames);

    if (!window.powerlib?.saveTuningSelection) {
      setSelectionError("Tuning selection can only be saved from the Power Tool desktop app.");
      return;
    }

    const saveSequence = selectionSaveSequenceRef.current + 1;
    selectionSaveSequenceRef.current = saveSequence;

    try {
      const result = await window.powerlib.saveTuningSelection(normalizedTopicNames);
      if (selectionSaveSequenceRef.current !== saveSequence) {
        return;
      }

      setSelectedTopicNames(normalizeSelectedTopicNames(result.selectedTopics));
      setSelectionError(null);
    } catch (caught) {
      if (selectionSaveSequenceRef.current !== saveSequence) {
        return;
      }

      const message = caught instanceof Error ? caught.message : String(caught);
      setSelectionError(`Could not save tuning selection: ${message}`);
    }
  }

  function toggleTopicSelection(topicName: string, selected: boolean) {
    const nextTopicNames = new Set(selectedTopicNames);
    if (selected) {
      nextTopicNames.add(topicName);
    } else {
      nextTopicNames.delete(topicName);
    }

    void persistSelectedTopicNames([...nextTopicNames]);
  }

  async function applyPendingChanges() {
    if (status !== "connected" || applying || selectedPendingTopics.length === 0) {
      return;
    }

    const nextErrors: Record<string, string | null> = {};
    const changes: Array<{ topic: NtTopicSnapshot; type: NtTopicType; value: NtPrimitive }> = [];

    selectedPendingTopics.forEach((topic) => {
      const type = getWritableTopicType(topic);
      if (!type) {
        return;
      }

      try {
        changes.push({
          topic,
          type,
          value: parseDraftValue(type, drafts[topic.name] ?? topicValueToDraft(topic.value))
        });
        nextErrors[topic.name] = null;
      } catch (caught) {
        nextErrors[topic.name] = caught instanceof Error ? caught.message : String(caught);
      }
    });

    const invalidCount = Object.values(nextErrors).filter(Boolean).length;
    setRowErrors((current) => ({ ...current, ...nextErrors }));
    if (invalidCount > 0) {
      setPanelError(`Fix ${invalidCount} invalid value${invalidCount === 1 ? "" : "s"} before applying.`);
      return;
    }

    setApplying(true);
    try {
      const results = await Promise.allSettled(
        changes.map(async ({ topic, type, value }) => {
          await clientRef.current.publish(topic.name, type, value);
          upsertTopic({
            ...topic,
            type,
            value,
            lastChangedTime: Date.now()
          });
        })
      );

      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length > 0) {
        const firstFailure = failures[0];
        const reason = firstFailure.status === "rejected" ? firstFailure.reason : null;
        const message = reason instanceof Error ? reason.message : "Could not apply one or more tunables.";
        setPanelError(`Applied ${changes.length - failures.length} of ${changes.length}; ${message}`);
        return;
      }

      setPanelError(null);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "360px 1fr" },
          height: { xs: "auto", md: "calc(100vh - 150px)" },
          minHeight: { md: 520 },
          overflow: { xs: "visible", md: "hidden" }
        }}
      >
        <TuningSidebar
          commandOwners={ownerGroups.commands}
          expandedSections={expandedSections}
          getPendingCount={getPendingCount}
          pendingTopicNames={selectedPendingTopicNames}
          selectedTopicNames={selectedTopicNameSet}
          subsystemOwners={ownerGroups.subsystems}
          onToggleSection={updateExpandedSection}
          onToggleTopicSelection={toggleTopicSelection}
        />

        <Card variant="outlined" sx={{ minHeight: 0, overflow: "hidden" }}>
          <CardContent sx={{ height: "100%", overflowY: "auto" }}>
            <Stack spacing={1.5}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                    <Typography variant="h6">Selected Tunables</Typography>
                    <Chip label={`${selectedTopics.length} shown`} size="small" variant="outlined" />
                    {unavailableSelectionCount > 0 && (
                      <Chip color="warning" label={`${unavailableSelectionCount} offline`} size="small" />
                    )}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Checked variables appear here as one edit list. Checkbox selections are saved automatically.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  {selectionLoading && <Chip label="loading selection" size="small" variant="outlined" />}
                  <Chip label={`${selectedPendingTopics.length} pending`} size="small" variant="outlined" />
                  {allPendingTopics.length > selectedPendingTopics.length && (
                    <Chip
                      color="warning"
                      label={`${allPendingTopics.length - selectedPendingTopics.length} hidden pending`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                  <IconButton
                    aria-label={`${selectedSearchOpen ? "Close" : "Search"} selected tunables`}
                    color={selectedSearchOpen || selectedSearchTerm.trim().length > 0 ? "primary" : "default"}
                    disabled={selectedTopics.length === 0}
                    size="small"
                    onClick={toggleSelectedSearch}
                  >
                    <SearchIcon fontSize="small" />
                  </IconButton>
                  <Button
                    disabled={status !== "connected" || applying || selectedPendingTopics.length === 0}
                    onClick={() => void applyPendingChanges()}
                    size="small"
                    variant="contained"
                  >
                    {applying ? "Applying" : "Apply"}
                  </Button>
                  <Button
                    disabled={
                      tunableTopics.length === 0 || !window.powerlib?.readSubsystems || !window.powerlib?.readBindings
                    }
                    onClick={() => setSaveValuesOpen(true)}
                    size="small"
                    variant="outlined"
                  >
                    Save
                  </Button>
                </Stack>
              </Stack>

              {selectedSearchOpen && (
                <TextField
                  autoFocus
                  fullWidth
                  placeholder="Search selected tunables"
                  size="small"
                  value={selectedSearchTerm}
                  onChange={(event) => setSelectedSearchTerm(event.target.value)}
                />
              )}

              <Alert severity={tuningModeEnabled ? "warning" : "info"} variant="outlined">
                {tuningModeEnabled
                  ? "Tuning mode is on: applied values can change subsystem gains and generated command targets live."
                  : "Tuning mode is off: applied values are staged in NetworkTables, but robot code uses generated constants/defaults."}
                {tuningModeRequestTopic && tuningModeRequested !== tuningModeEnabled
                  ? ` Requested mode is ${tuningModeRequested ? "on" : "off"}; waiting for robot acknowledgement.`
                  : ""}
              </Alert>
              {selectionError && (
                <Alert severity="error" onClose={() => setSelectionError(null)}>
                  {selectionError}
                </Alert>
              )}
              {panelError && (
                <Alert severity="error" onClose={() => setPanelError(null)}>
                  {panelError}
                </Alert>
              )}
              {unavailableSelectionCount > 0 && (
                <Alert severity="info" variant="outlined">
                  {unavailableSelectionCount} saved selection{unavailableSelectionCount === 1 ? " is" : "s are"} not
                  currently published. It will reappear automatically when robot code publishes that variable again.
                </Alert>
              )}

              {selectedTopics.length > 0 ? (
                visibleSelectedTopics.length > 0 ? (
                  <Stack spacing={1}>
                    {visibleSelectedTopics.map((topic) => (
                      <TunableVariableRow
                        key={topic.name}
                        disabled={status !== "connected" || applying}
                        draft={drafts[topic.name] ?? topicValueToDraft(topic.value)}
                        error={rowErrors[topic.name] ?? null}
                        topic={topic}
                        onDraftChange={updateDraft}
                        onRemove={(topicName) => toggleTopicSelection(topicName, false)}
                      />
                    ))}
                  </Stack>
                ) : (
                  <Alert severity="info" variant="outlined">
                    No selected tunables match that search.
                  </Alert>
                )
              ) : (
                <Alert severity="info" variant="outlined">
                  Check variables in the sidebar to build your tuning list. Generated subsystem control values and
                  generated command values will appear there while robot code is running.
                </Alert>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <SaveTunedValuesDialog open={saveValuesOpen} topics={topics} onClose={() => setSaveValuesOpen(false)} />
    </Stack>
  );
}
