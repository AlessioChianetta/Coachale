import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
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
  Trash2,
  FolderOpen,
  GitBranch,
  History,
  RotateCcw,
  Link2,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

interface FunnelRecord {
  id: string;
  name: string;
  description?: string;
  nodes_data: Node[];
  edges_data: Edge[];
  is_active: boolean;
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

function FunnelBuilderInner() {
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
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

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
          loadFunnel(list[0].id);
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
        setNodes(funnel.nodes_data || []);
        setEdges(funnel.edges_data || []);
        setSelectedNodeId(null);
      }
    } catch (err) {
      console.error("Error loading funnel:", err);
    }
  };

  const saveFunnel = useCallback(async (immediate = false) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    const doSave = async () => {
      setSaving(true);
      try {
        const body = {
          name: funnelName,
          nodes_data: nodes,
          edges_data: edges,
        };

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
          }
        }
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
  }, [activeFunnelId, funnelName, nodes, edges]);

  const createNewFunnel = () => {
    setActiveFunnelId(null);
    setFunnelName("Nuovo Funnel");
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
  };

  const deleteFunnel = async () => {
    if (!activeFunnelId) return;
    try {
      const res = await fetch(`/api/funnels/${activeFunnelId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
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
        setNodes(funnel.nodes_data || []);
        setEdges(funnel.edges_data || []);
        setShowHistory(false);
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
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    []
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge({ ...connection, type: "funnelEdge" }, eds)
      );
    },
    []
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
          notes: "",
          conversionRate: undefined,
        } satisfies FunnelNodeData as any,
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition]
  );

  const updateNodeData = useCallback(
    (nodeId: string, updates: Partial<FunnelNodeData>) => {
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
    []
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
        return {
          ...node,
          data: {
            ...node.data,
            linkedEntity: {
              entityType,
              entityId: match.id,
              name: match.name || "—",
              status: match.isActive ? "active" : undefined,
              extra: match,
            },
          },
        };
      });
    }

    setNodes(finalNodes);
    setEdges(generatedEdges);
    setFunnelName(appliedName);

    const description = linkedCount > 0
      ? `${finalNodes.length} nodi creati · ${linkedCount} entità collegate automaticamente`
      : `${finalNodes.length} nodi creati`;
    toast({ title: "Funnel applicato", description });

    setSaving(true);
    try {
      const body = { name: appliedName, nodes_data: finalNodes, edges_data: generatedEdges };
      if (activeFunnelId) {
        const res = await fetch(`/api/funnels/${activeFunnelId}`, {
          method: "PUT",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const updated = await res.json();
          setFunnels((prev) => prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)));
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
        }
      }
    } catch (err) {
      console.error("Error saving applied funnel:", err);
    } finally {
      setSaving(false);
    }
  }, [activeFunnelId, toast]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  if (loading && funnels.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
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
                {f.name}
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
            onChange={(e) => setFunnelName(e.target.value)}
            className="h-8 text-sm font-medium max-w-[280px] border-transparent hover:border-border focus:border-border bg-transparent"
          />
          {activeFunnelId && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              Salvato
            </Badge>
          )}
        </div>

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
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
            onClick={deleteFunnel}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <FunnelPalette />

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
            className="bg-gray-50 dark:bg-gray-950"
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
                const colors = CATEGORY_COLORS[data?.category as keyof typeof CATEGORY_COLORS];
                return colors?.accent || "#6b7280";
              }}
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#d1d5db"
              className="dark:!opacity-20"
            />
          </ReactFlow>
        </div>

        {selectedNode && !chatOpen && (
          <NodeConfigPanel
            nodeId={selectedNode.id}
            data={selectedNode.data as unknown as FunnelNodeData}
            onUpdate={updateNodeData}
            onDelete={(id) => {
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
  );
}

export default function FunnelBuilderTab() {
  return (
    <ReactFlowProvider>
      <FunnelBuilderInner />
    </ReactFlowProvider>
  );
}
