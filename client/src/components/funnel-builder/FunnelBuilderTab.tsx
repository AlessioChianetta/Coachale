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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Wand2,
  GitBranch,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FunnelNode } from "./FunnelNode";
import { FunnelEdge } from "./FunnelEdge";
import { FunnelPalette } from "./FunnelPalette";
import { NodeConfigPanel } from "./NodeConfigPanel";
import {
  type FunnelNodeData,
  getNodeTypeDefinition,
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

const nodeTypes: NodeTypes = { funnelNode: FunnelNode } as any;
const edgeTypes: EdgeTypes = { funnelEdge: FunnelEdge } as any;

const AI_PROMPT_EXAMPLES = [
  "Funnel per vendita di consulenza: Facebook Ads → Landing Page → Form → WhatsApp Setter AI → Prima Call → Chiusura → Onboarding",
  "Campagna lead generation con Google Ads e Instagram Ads che convergono su un form, poi nurturing via email e WhatsApp",
  "Funnel per corso online: Ads → Lead Magnet → Email Sequence → Webinar → Pagamento → Onboarding",
  "Referral offline → CRM Hunter → Setter AI WhatsApp → Appuntamento → Seconda Call → Chiusura → Servizio",
];

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
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
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

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    try {
      const res = await fetch("/api/funnels/generate", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Errore nella generazione");
      }

      const result = await res.json();
      const layoutNodes = autoLayout(result.nodes || [], result.edges || []);

      setNodes(layoutNodes);
      setEdges(result.edges || []);
      setFunnelName(result.name || "Funnel Generato");
      setAiDialogOpen(false);
      setAiPrompt("");
      toast({ title: "Funnel generato con AI", description: `${layoutNodes.length} nodi creati` });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

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
          className="h-8 gap-1.5 text-xs"
          onClick={() => setAiDialogOpen(true)}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Genera con AI
        </Button>

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
                    onClick={() => setAiDialogOpen(true)}
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

        {selectedNode && (
          <NodeConfigPanel
            nodeId={selectedNode.id}
            data={selectedNode.data as unknown as FunnelNodeData}
            onUpdate={updateNodeData}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-cyan-500" />
              Genera Funnel con AI
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Descrivi il tuo funnel
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Descrivi il flusso del tuo funnel in linguaggio naturale..."
                className="w-full h-28 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Esempi:
              </p>
              <div className="space-y-1.5">
                {AI_PROMPT_EXAMPLES.map((example, i) => (
                  <button
                    key={i}
                    onClick={() => setAiPrompt(example)}
                    className="w-full text-left px-3 py-2 text-xs rounded-md border border-border hover:bg-accent hover:border-accent transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setAiDialogOpen(false)}
                disabled={aiGenerating}
              >
                Annulla
              </Button>
              <Button
                onClick={handleAiGenerate}
                disabled={aiGenerating || !aiPrompt.trim()}
                className="bg-gradient-to-r from-cyan-500 to-teal-600 text-white hover:from-cyan-600 hover:to-teal-700"
              >
                {aiGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generazione...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Genera Funnel
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
