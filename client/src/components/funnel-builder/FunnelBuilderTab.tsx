import React, { useState, useCallback, useRef, useMemo, useEffect, createContext, useContext, useImperativeHandle, forwardRef } from "react";
import {
  ReactFlow,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeTypes,
  type EdgeTypes,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import {
  Save,
  Plus,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  FolderOpen,
  GitBranch,
  History,
  RotateCcw,
  Link2,
  Palette,
  Check,
  Brain,
  FileText,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { FunnelNode } from "./FunnelNode";
import { FunnelEdge } from "./FunnelEdge";
import { FunnelPalette } from "./FunnelPalette";
import { NodeConfigPanel } from "./NodeConfigPanel";
import { FunnelChat } from "./FunnelChat";
import {
  type FunnelNodeData,
  getNodeTypeDefinition,
  getEntityTypeForNode,
  CATEGORY_COLORS,
} from "./funnel-node-types";
import { type FunnelThemeId, type FunnelTheme, getTheme, THEME_LIST } from "./funnel-themes";

interface FunnelRecord {
  id: string;
  name: string;
  description?: string;
  nodes_data: Node[];
  edges_data: Edge[];
  theme?: string;
  is_active: boolean;
  source?: string;
  lead_name?: string;
  delivery_session_id?: string;
  created_at: string;
  updated_at: string;
}

interface FunnelVersion {
  id: string;
  version_number: number;
  label: string | null;
  source: string;
  funnel_name: string | null;
  created_at: string;
  node_count: number;
  edge_count: number;
}

const nodeTypes: NodeTypes = { funnelNode: FunnelNode } as any;
const edgeTypes: EdgeTypes = { funnelEdge: FunnelEdge } as any;

interface HistorySnapshot {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY = 50;

interface UndoContextType {
  pushHistory: () => void;
}

export const UndoContext = createContext<UndoContextType>({ pushHistory: () => {} });

export const ThemeContext = createContext<FunnelTheme>(getTheme("classico"));

function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 100 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 200, height: 100 });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - 100, y: pos.y - 50 },
    };
  });
}

export interface FunnelBuilderHandle {
  isDirty: boolean;
  save: () => Promise<void>;
}

interface FunnelBuilderInnerProps {
  onDirtyChange?: (dirty: boolean) => void;
  initialFunnelId?: string | null;
}

const FunnelBuilderInner = forwardRef<FunnelBuilderHandle, FunnelBuilderInnerProps>(function FunnelBuilderInner({ onDirtyChange, initialFunnelId }, ref) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [funnels, setFunnels] = useState<FunnelRecord[]>([]);
  const [activeFunnelId, setActiveFunnelId] = useState<string | null>(null);
  const [funnelName, setFunnelName] = useState("Nuovo Funnel");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<FunnelVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [themeId, setThemeId] = useState<FunnelThemeId>("classico");
  const [isDirty, setIsDirty] = useState(false);
  const [funnelDescription, setFunnelDescription] = useState<string>("");
  const [funnelSource, setFunnelSource] = useState<string | null>(null);
  const [showRationale, setShowRationale] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const currentTheme = useMemo(() => getTheme(themeId), [themeId]);
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDirtyRef = useRef(false);

  const markDirty = useCallback(() => {
    if (!isDirtyRef.current) {
      isDirtyRef.current = true;
      setIsDirty(true);
      onDirtyChange?.(true);
    }
  }, [onDirtyChange]);

  const markClean = useCallback(() => {
    if (isDirtyRef.current) {
      isDirtyRef.current = false;
      setIsDirty(false);
      onDirtyChange?.(false);
    }
  }, [onDirtyChange]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const saveFunnelRef = useRef<(immediate?: boolean) => Promise<void>>(async () => {});

  useImperativeHandle(ref, () => ({
    get isDirty() { return isDirtyRef.current; },
    save: () => saveFunnelRef.current(true),
  }), []);

  const historyRef = useRef<HistorySnapshot[]>([]);
  const futureRef = useRef<HistorySnapshot[]>([]);
  const nodesRef = useRef<Node[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);
  const descriptionRef = useRef<string>(funnelDescription);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  descriptionRef.current = funnelDescription;

  const pushHistory = useCallback(() => {
    const snapshot: HistorySnapshot = {
      nodes: JSON.parse(JSON.stringify(nodesRef.current)),
      edges: JSON.parse(JSON.stringify(edgesRef.current)),
    };
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), snapshot];
    futureRef.current = [];
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const current: HistorySnapshot = {
      nodes: JSON.parse(JSON.stringify(nodesRef.current)),
      edges: JSON.parse(JSON.stringify(edgesRef.current)),
    };
    futureRef.current = [...futureRef.current, current];
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setNodes(prev.nodes);
    setEdges(prev.edges);
    toast({ title: "Annullato", description: "Ctrl+Z", duration: 1500 });
  }, [toast]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const current: HistorySnapshot = {
      nodes: JSON.parse(JSON.stringify(nodesRef.current)),
      edges: JSON.parse(JSON.stringify(edgesRef.current)),
    };
    historyRef.current = [...historyRef.current, current];
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    setNodes(next.nodes);
    setEdges(next.edges);
    toast({ title: "Ripristinato", description: "Ctrl+Shift+Z", duration: 1500 });
  }, [toast]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  useEffect(() => {
    loadFunnelList();
  }, []);

  const loadFunnelList = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/funnels", { headers: getAuthHeaders() });
      if (res.ok) {
        const list = await res.json();
        setFunnels(list);
        if (list.length > 0 && !activeFunnelId) {
          if (initialFunnelId && list.some((f: any) => f.id === initialFunnelId)) {
            loadFunnel(initialFunnelId);
          } else {
            const params = new URLSearchParams(window.location.search);
            const urlFunnelId = params.get("funnel");
            if (urlFunnelId && list.some((f: any) => f.id === urlFunnelId)) {
              loadFunnel(urlFunnelId);
            } else {
              loadFunnel(list[0].id);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error loading funnels:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadFunnel = async (id: string) => {
    try {
      const res = await fetch(`/api/funnels/${id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const funnel = await res.json();
        setActiveFunnelId(funnel.id);
        setFunnelName(funnel.name);
        setFunnelDescription(funnel.description || "");
        setFunnelSource(funnel.source || null);
        setShowRationale(false);
        setNodes(funnel.nodes_data || []);
        setEdges(funnel.edges_data || []);
        setThemeId((funnel.theme as FunnelThemeId) || "classico");
        setSelectedNodeId(null);
        markClean();
      }
    } catch (err) {
      console.error("Error loading funnel:", err);
    }
  };

  const themeIdRef = useRef(themeId);
  themeIdRef.current = themeId;

  const saveFunnel = useCallback(async (immediate = false, overrideTheme?: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    const doSave = async () => {
      setSaving(true);
      try {
        const body = {
          name: funnelName,
          description: descriptionRef.current || "",
          nodes_data: nodes,
          edges_data: edges,
          theme: overrideTheme || themeIdRef.current,
        };

        let saveSuccess = false;
        if (activeFunnelId) {
          const res = await fetch(`/api/funnels/${activeFunnelId}`, {
            method: "PUT",
            headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (res.ok) {
            const updated = await res.json();
            setFunnels((prev) =>
              prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f))
            );
            saveSuccess = true;
          }
        } else {
          const res = await fetch("/api/funnels", {
            method: "POST",
            headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (res.ok) {
            const created = await res.json();
            setActiveFunnelId(created.id);
            setFunnels((prev) => [created, ...prev]);
            saveSuccess = true;
          }
        }
        if (saveSuccess) markClean();
      } catch (err) {
        console.error("Error saving funnel:", err);
      } finally {
        setSaving(false);
      }
    };

    if (immediate) {
      await doSave();
    } else {
      saveTimerRef.current = setTimeout(doSave, 2000);
    }
  }, [activeFunnelId, funnelName, nodes, edges, themeId, markClean]);
  saveFunnelRef.current = saveFunnel;

  const createNewFunnel = () => {
    setActiveFunnelId(null);
    setFunnelName("Nuovo Funnel");
    setFunnelDescription("");
    setFunnelSource(null);
    setShowRationale(false);
    setNodes([]);
    setEdges([]);
    setThemeId("classico");
    setSelectedNodeId(null);
    markClean();
  };

  const deleteFunnel = async () => {
    if (!activeFunnelId) return;
    try {
      const res = await fetch(`/api/funnels/${activeFunnelId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        pushHistory();
        setFunnels((prev) => prev.filter((f) => f.id !== activeFunnelId));
        createNewFunnel();
        toast({ title: "Funnel eliminato" });
      }
    } catch (err) {
      console.error("Error deleting funnel:", err);
    }
  };

  const loadVersions = async () => {
    if (!activeFunnelId) return;
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/funnels/${activeFunnelId}/versions`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
      }
    } catch (err) {
      console.error("Error loading versions:", err);
    } finally {
      setLoadingVersions(false);
    }
  };

  const restoreVersion = async (versionId: string, versionNumber: number) => {
    if (!activeFunnelId) return;
    setRestoringVersionId(versionId);
    try {
      const res = await fetch(`/api/funnels/${activeFunnelId}/restore/${versionId}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const funnel = data.funnel;
        pushHistory();
        setNodes(funnel.nodes_data || []);
        setEdges(funnel.edges_data || []);
        setShowHistory(false);
        markClean();
        toast({ title: `Funnel ripristinato alla versione ${versionNumber}` });
      } else {
        const errData = await res.json().catch(() => null);
        toast({ title: errData?.error || "Errore nel ripristino", variant: "destructive" });
      }
    } catch (err) {
      console.error("Error restoring version:", err);
      toast({ title: "Errore nel ripristino", variant: "destructive" });
    } finally {
      setRestoringVersionId(null);
    }
  };

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const hasStructural = changes.some((c) => c.type === "remove" || c.type === "position" || c.type === "dimensions");
      if (changes.some((c) => c.type === "remove")) pushHistory();
      if (hasStructural) markDirty();
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [pushHistory, markDirty]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const hasRemove = changes.some((c) => c.type === "remove");
      if (hasRemove) pushHistory();
      if (hasRemove) markDirty();
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [pushHistory, markDirty]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      pushHistory();
      markDirty();
      setEdges((eds) =>
        addEdge({ ...connection, type: "funnelEdge" }, eds)
      );
    },
    [pushHistory, markDirty]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setChatOpen(false);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const dataStr = event.dataTransfer.getData("application/reactflow");
      if (!dataStr) return;

      const { type, label, category } = JSON.parse(dataStr);
      const typeDef = getNodeTypeDefinition(type);
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: "funnelNode",
        position,
        data: {
          nodeType: type,
          type,
          label: label || typeDef?.label || "Step",
          subtitle: typeDef?.description || "",
          category,
          linkedEntity: null,
          linkedEntities: [],
          notes: "",
          conversionRate: undefined,
        } satisfies FunnelNodeData as any,
      };

      pushHistory();
      markDirty();
      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, pushHistory, markDirty]
  );

  const updateNodeData = useCallback(
    (nodeId: string, updates: Partial<FunnelNodeData>) => {
      markDirty();
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: { ...n.data, ...updates },
            };
          }
          return n;
        })
      );
    },
    [markDirty]
  );

  const handleApplyFunnel = useCallback(async (name: string, generatedNodes: Node[], generatedEdges: Edge[]) => {
    const layoutNodes = autoLayout(generatedNodes, generatedEdges);
    const appliedName = name || "Funnel Generato";

    const nodesWithHints = layoutNodes.filter((n: Node) => (n.data as any)?.linkedEntityName);
    let linkedCount = 0;
    let finalNodes = layoutNodes;

    if (nodesWithHints.length > 0) {
      const entityTypeToNodes: Record<string, Node[]> = {};
      for (const node of nodesWithHints) {
        const nodeType = (node.data as any)?.nodeType || (node.data as any)?.type;
        const entityType = getEntityTypeForNode(nodeType);
        if (!entityType) continue;
        if (!entityTypeToNodes[entityType]) entityTypeToNodes[entityType] = [];
        entityTypeToNodes[entityType].push(node);
      }

      const fetchedEntities: Record<string, Array<{ id: string; name: string; [key: string]: any }>> = {};
      await Promise.all(
        Object.keys(entityTypeToNodes).map(async (entityType) => {
          try {
            const urlPath = entityType.replace(/_/g, "-");
            const res = await fetch(`/api/funnels/entities/${urlPath}`, { headers: getAuthHeaders() });
            if (res.ok) fetchedEntities[entityType] = await res.json();
          } catch {}
        })
      );

      finalNodes = layoutNodes.map((node: Node) => {
        const hint = (node.data as any)?.linkedEntityName;
        if (!hint) return node;
        const nodeType = (node.data as any)?.nodeType || (node.data as any)?.type;
        const entityType = getEntityTypeForNode(nodeType);
        if (!entityType || !fetchedEntities[entityType]) return node;
        const hintLower = hint.toLowerCase();
        const match = fetchedEntities[entityType].find((e: any) =>
          (e.name || "").toLowerCase().includes(hintLower) ||
          hintLower.includes((e.name || "").toLowerCase())
        );
        if (!match) return node;
        linkedCount++;
        const le = {
          entityType,
          entityId: match.id,
          name: match.name || "—",
          status: match.isActive ? "active" : undefined,
          extra: match,
        };
        return {
          ...node,
          data: {
            ...node.data,
            linkedEntity: le,
            linkedEntities: [le],
          },
        };
      });
    }

    pushHistory();
    setNodes(finalNodes);
    setEdges(generatedEdges);
    setFunnelName(appliedName);

    const description = linkedCount > 0
      ? `${finalNodes.length} nodi creati · ${linkedCount} entità collegate automaticamente`
      : `${finalNodes.length} nodi creati`;
    toast({ title: "Funnel applicato", description });

    setSaving(true);
    try {
      const body = { name: appliedName, nodes_data: finalNodes, edges_data: generatedEdges, theme: themeIdRef.current };
      let applySuccess = false;
      if (activeFunnelId) {
        const res = await fetch(`/api/funnels/${activeFunnelId}`, {
          method: "PUT",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const updated = await res.json();
          setFunnels((prev) => prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)));
          applySuccess = true;
        }
      } else {
        const res = await fetch("/api/funnels", {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const created = await res.json();
          setActiveFunnelId(created.id);
          setFunnels((prev) => [created, ...prev]);
          applySuccess = true;
        }
      }
      if (applySuccess) markClean(); else markDirty();
    } catch (err) {
      console.error("Error saving applied funnel:", err);
      markDirty();
    } finally {
      setSaving(false);
    }
  }, [activeFunnelId, toast, markClean, markDirty]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const undoContextValue = useMemo(() => ({ pushHistory }), [pushHistory]);

  if (loading && funnels.length === 0) {
    return (
      <UndoContext.Provider value={undoContextValue}>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </UndoContext.Provider>
    );
  }

  return (
    <UndoContext.Provider value={undoContextValue}>
    <ThemeContext.Provider value={currentTheme}>
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-card/50 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <FolderOpen className="w-3.5 h-3.5" />
              I Miei Funnel
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {funnels.map((f) => (
              <DropdownMenuItem
                key={f.id}
                onClick={() => loadFunnel(f.id)}
                className={cn(
                  "text-xs",
                  f.id === activeFunnelId && "bg-accent"
                )}
              >
                <GitBranch className="w-3.5 h-3.5 mr-2" />
                <span className="truncate flex-1">{f.name}</span>
                {f.source === "delivery_report" && (
                  <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-1 shrink-0 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">AI</Badge>
                )}
              </DropdownMenuItem>
            ))}
            {funnels.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={createNewFunnel} className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-2" />
              Nuovo Funnel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1 flex items-center gap-2">
          <Input
            value={funnelName}
            onChange={(e) => { setFunnelName(e.target.value); markDirty(); }}
            className="h-8 text-sm font-medium max-w-[280px] border-transparent hover:border-border focus:border-border bg-transparent"
          />
          {activeFunnelId && (
            <Badge variant={isDirty ? "outline" : "secondary"} className={cn("text-[10px] shrink-0", isDirty && "border-amber-400 text-amber-600 dark:text-amber-400")}>
              {isDirty ? "Non salvato" : "Salvato"}
            </Badge>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Palette className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{currentTheme.label}</span>
              <div className="flex gap-0.5">
                {currentTheme.preview.slice(0, 4).map((c, i) => (
                  <span key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                ))}
              </div>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {THEME_LIST.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => { setThemeId(t.id); markDirty(); saveFunnel(false, t.id); }}
                className={cn("text-xs gap-2 cursor-pointer", t.id === themeId && "bg-accent")}
              >
                <div className="flex gap-0.5 shrink-0">
                  {t.preview.map((c, i) => (
                    <span key={i} className="w-3 h-3 rounded-sm border border-border/40" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{t.label}</p>
                  <p className="text-[10px] text-muted-foreground">{t.description}</p>
                </div>
                {t.id === themeId && <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 gap-1.5 text-xs", chatOpen && "bg-cyan-50 border-cyan-300 text-cyan-700 dark:bg-cyan-950/30 dark:border-cyan-700 dark:text-cyan-300")}
          onClick={() => {
            setChatOpen(!chatOpen);
            if (!chatOpen) setSelectedNodeId(null);
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {chatOpen ? "Chiudi Chat AI" : "Genera con AI"}
        </Button>

        {activeFunnelId && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => { setShowHistory(true); loadVersions(); }}
          >
            <History className="w-3.5 h-3.5" />
            Cronologia
          </Button>
        )}

        <Button
          variant="default"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={saving}
          onClick={() => saveFunnel(true)}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Salva
        </Button>

        {activeFunnelId && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminare "{funnelName}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  Questa azione è irreversibile. Il funnel con tutti i suoi nodi e connessioni verrà eliminato definitivamente dal database. Vuoi procedere?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteFunnel}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Sì, elimina definitivamente
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-60 h-full border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
          <FunnelPalette className="flex-1 min-h-0 border-r-0" />

          <div className="border-t border-gray-200 dark:border-gray-700">
            {funnelSource === "delivery_report" && funnelDescription && (
              <div className="border-b border-border/60 bg-gradient-to-r from-indigo-50/50 to-violet-50/50 dark:from-indigo-950/20 dark:to-violet-950/20">
                <button
                  onClick={() => setShowRationale(!showRationale)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span>Strategia di Leonardo</span>
                  <Badge variant="secondary" className="text-[8px] px-1 py-0 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">AI</Badge>
                  <span className="flex-1" />
                  {showRationale ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showRationale && (
                  <div className="px-3 pb-2 max-h-[150px] overflow-y-auto">
                    <div className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {funnelDescription}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setShowNotes(!showNotes)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Note & Strategia</span>
              {funnelDescription && funnelDescription.trim().length > 0 && funnelSource !== "delivery_report" && (
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
              <span className="flex-1" />
              {showNotes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showNotes && (
              <div className="px-2 pb-2">
                <textarea
                  value={funnelDescription}
                  onChange={(e) => {
                    setFunnelDescription(e.target.value);
                    markDirty();
                  }}
                  placeholder="Scrivi come e perché è stato pensato questo schema..."
                  className="w-full h-28 text-[11px] leading-relaxed p-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                />
              </div>
            )}
          </div>
        </div>

        <div
          ref={reactFlowWrapper}
          className="flex-1 relative"
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {nodes.length === 0 && !activeFunnelId ? (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="text-center space-y-4 pointer-events-auto">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-cyan-500/10 to-teal-500/10 flex items-center justify-center border border-cyan-500/20">
                  <GitBranch className="w-8 h-8 text-cyan-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Crea il tuo Funnel
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Trascina i componenti dalla palette a sinistra oppure genera un funnel con l'AI
                  </p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setChatOpen(true); setSelectedNodeId(null); }}
                    className="gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    Genera con AI
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            defaultEdgeOptions={{ type: "funnelEdge" }}
            deleteKeyCode={["Backspace", "Delete"]}
            className={currentTheme.canvas.bg}
            proOptions={{ hideAttribution: true }}
          >
            <Controls
              className="!bg-white dark:!bg-gray-900 !border-gray-200 dark:!border-gray-700 !shadow-md"
              showInteractive={false}
            />
            <MiniMap
              className="!bg-white dark:!bg-gray-900 !border-gray-200 dark:!border-gray-700"
              maskColor="rgba(0,0,0,0.08)"
              nodeColor={(node) => {
                const data = node.data as any;
                const cat = data?.category as keyof typeof CATEGORY_COLORS;
                const themeColors = currentTheme.categoryColors[cat];
                return themeColors?.accent || "#6b7280";
              }}
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={currentTheme.canvas.dotGap}
              size={currentTheme.canvas.dotSize}
              color={currentTheme.canvas.dotColor}
            />
          </ReactFlow>
        </div>

        {selectedNode && !chatOpen && (
          <NodeConfigPanel
            nodeId={selectedNode.id}
            data={selectedNode.data as unknown as FunnelNodeData}
            onUpdate={updateNodeData}
            onDelete={(id) => {
              pushHistory();
              markDirty();
              setNodes((nds) => nds.filter((n) => n.id !== id));
              setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
              setSelectedNodeId(null);
            }}
            onClose={() => setSelectedNodeId(null)}
          />
        )}

        <FunnelChat
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          onApplyFunnel={handleApplyFunnel}
          currentFunnelContext={activeFunnelId ? { id: activeFunnelId, name: funnelName, nodes, edges } : null}
        />
      </div>

      <Sheet open={showHistory} onOpenChange={setShowHistory}>
        <SheetContent side="right" className="w-[380px] sm:w-[420px] p-0 flex flex-col">
          <SheetHeader className="px-5 py-4 border-b">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
              <History className="w-4 h-4" />
              Cronologia versioni — {funnelName}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1">
            {loadingVersions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <History className="w-8 h-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Nessuna versione salvata ancora.</p>
                <p className="text-xs text-muted-foreground mt-1">Le versioni vengono create ad ogni salvataggio.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {versions.map((v) => {
                  const date = new Date(v.created_at);
                  const formatted = date.toLocaleString("it-IT", {
                    day: "numeric", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  });
                  const sourceLabel = v.source === "ai" ? "AI" : v.source === "restore" ? "Ripristino" : "Manuale";
                  const sourceBadgeClass =
                    v.source === "ai"
                      ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"
                      : v.source === "restore"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
                  return (
                    <div key={v.id} className="flex items-start gap-3 px-5 py-4 hover:bg-muted/40 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-semibold text-foreground">
                            v{v.version_number}
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${sourceBadgeClass}`}>
                            {sourceLabel}
                          </span>
                          {v.label && (
                            <span className="text-xs text-muted-foreground truncate">{v.label}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{formatted}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {v.node_count} nodi · {v.edge_count} connessioni
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 shrink-0"
                        disabled={restoringVersionId === v.id}
                        onClick={() => restoreVersion(v.id, v.version_number)}
                      >
                        {restoringVersionId === v.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        Ripristina
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
    </ThemeContext.Provider>
    </UndoContext.Provider>
  );
});

export interface FunnelBuilderTabProps {
  onDirtyChange?: (dirty: boolean) => void;
  funnelRef?: React.Ref<FunnelBuilderHandle>;
  initialFunnelId?: string | null;
}

export default function FunnelBuilderTab({ onDirtyChange, funnelRef, initialFunnelId }: FunnelBuilderTabProps = {}) {
  return (
    <ReactFlowProvider>
      <FunnelBuilderInner ref={funnelRef} onDirtyChange={onDirtyChange} initialFunnelId={initialFunnelId} />
    </ReactFlowProvider>
  );
}
