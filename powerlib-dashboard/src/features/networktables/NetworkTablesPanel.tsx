import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { NtTopicSnapshot } from "../../networktables/nt4Client";
import { stringifyValue } from "../subsystems/subsystemUtils";
import { useNetworkTables } from "./NetworkTablesContext";

type TopicTreeNode = {
  name: string;
  path: string;
  children: TopicTreeNode[];
  topic?: NtTopicSnapshot;
};

function createTree(topics: NtTopicSnapshot[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  const root: TopicTreeNode = { name: "/", path: "/", children: [] };

  [...topics]
    .filter((topic) => !normalizedSearch || topic.name.toLowerCase().includes(normalizedSearch))
    .sort((left, right) => left.name.localeCompare(right.name))
    .forEach((topic) => {
      const segments = topic.name.split("/").filter(Boolean);
      let current = root;

      segments.forEach((segment, index) => {
        const path = `/${segments.slice(0, index + 1).join("/")}`;
        let child = current.children.find((item) => item.name === segment);
        if (!child) {
          child = { name: segment, path, children: [] };
          current.children.push(child);
        }

        current = child;
      });

      current.topic = topic;
    });

  return root;
}

function collectDefaultExpanded(node: TopicTreeNode, expanded: Set<string>) {
  if (node.children.length > 0) {
    expanded.add(node.path);
  }

  node.children.forEach((child) => collectDefaultExpanded(child, expanded));
}

type TopicTreeProps = {
  node: TopicTreeNode;
  depth?: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
};

function TopicTree({ node, depth = 0, expandedPaths, onToggle }: TopicTreeProps) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedPaths.has(node.path);

  return (
    <Box>
      {node.path !== "/" && (
        <Box
          sx={{
            alignItems: "center",
            borderBottom: "1px solid",
            borderColor: "divider",
            display: "grid",
            gap: 1,
            gridTemplateColumns: "32px minmax(180px, 1fr) 120px minmax(180px, 0.8fr)",
            minHeight: 42,
            pl: `${depth * 18}px`,
            pr: 1
          }}
        >
          <Box>
            {hasChildren && (
              <IconButton size="small" onClick={() => onToggle(node.path)} aria-label={expanded ? "Collapse" : "Expand"}>
                {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
              </IconButton>
            )}
          </Box>
          <Typography sx={{ fontFamily: node.topic ? "monospace" : "inherit", fontWeight: hasChildren ? 700 : 500 }}>
            {node.name}
          </Typography>
          <Box>{node.topic && <Chip label={node.topic.type} size="small" variant="outlined" />}</Box>
          <Typography sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>
            {node.topic ? stringifyValue(node.topic.value) : ""}
          </Typography>
        </Box>
      )}

      {hasChildren && (
        <Collapse in={node.path === "/" || expanded} timeout="auto" unmountOnExit>
          {node.children.map((child) => (
            <TopicTree key={child.path} node={child} depth={depth + 1} expandedPaths={expandedPaths} onToggle={onToggle} />
          ))}
        </Collapse>
      )}
    </Box>
  );
}

export function NetworkTablesPanel() {
  const { connectionSettings, topics } = useNetworkTables();
  const [search, setSearch] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(["/"]));

  const topicTree = useMemo(() => {
    return createTree(topics, search);
  }, [topics, search]);

  useEffect(() => {
    if (!search.trim()) {
      return;
    }

    const expanded = new Set<string>();
    collectDefaultExpanded(topicTree, expanded);
    setExpandedPaths(expanded);
  }, [search, topicTree]);

  const visibleTopicCount = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return topics.filter((topic) => !normalizedSearch || topic.name.toLowerCase().includes(normalizedSearch)).length;
  }, [topics, search]);

  function togglePath(path: string) {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  return (
    <Box>
      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack spacing={0}>
            <Box sx={{ p: 2 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6">NetworkTables Tree</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {connectionSettings.host}:{connectionSettings.port} · watched prefixes have {visibleTopicCount} visible topic
                    {visibleTopicCount === 1 ? "" : "s"}.
                  </Typography>
                </Box>
                <TextField label="Filter topics" size="small" value={search} onChange={(event) => setSearch(event.target.value)} />
              </Stack>
            </Box>

            <Divider />

            <Box sx={{ maxHeight: "calc(100vh - 250px)", overflow: "auto" }}>
              <Box
                sx={{
                  alignItems: "center",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  color: "text.secondary",
                  display: "grid",
                  fontSize: 12,
                  fontWeight: 700,
                  gap: 1,
                  gridTemplateColumns: "32px minmax(180px, 1fr) 120px minmax(180px, 0.8fr)",
                  minHeight: 36,
                  px: 1,
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  bgcolor: "background.paper"
                }}
              >
                <Box />
                <Box>Topic</Box>
                <Box>Type</Box>
                <Box>Value</Box>
              </Box>

              {visibleTopicCount > 0 ? (
                <TopicTree node={topicTree} expandedPaths={expandedPaths} onToggle={togglePath} />
              ) : (
                <Stack spacing={2} sx={{ alignItems: "center", py: 4 }}>
                  <Alert severity="info" variant="outlined">
                    Power Tool subscribes to `/` and renders discovered NetworkTables topics as a tree.
                  </Alert>
                  <Typography color="text.secondary">Connect to discover NetworkTables data.</Typography>
                </Stack>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
