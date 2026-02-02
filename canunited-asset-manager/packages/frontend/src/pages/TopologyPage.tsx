import { useCallback, useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  MarkerType,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, Filter, Download, Maximize2, Info, X, Activity, Calendar, Wrench, ExternalLink } from 'lucide-react';
import { getApi, endpoints } from '../lib/api';
import clsx from 'clsx';

const vendorColors: Record<string, string> = {
  schneider: '#3dcd58',
  abb: '#ff000f',
  siemens: '#009999',
  bosch: '#ea0016',
  eaton: '#0033a0',
  generic: '#6366f1',
};

// Custom node component
function AssetNode({ data }: { data: any }) {
  const healthColor = getHealthColor(data.healthScore);

  return (
    <div
      className={clsx(
        'px-4 py-3 rounded-lg border-2 min-w-[160px] bg-slate-900/90 backdrop-blur-sm cursor-pointer relative',
        'hover:bg-slate-800/90 hover:scale-105 transition-all duration-200',
        'hover:shadow-lg hover:shadow-primary-500/20',
        data.selected && 'ring-2 ring-primary-500'
      )}
      style={{ borderColor: vendorColors[data.vendor] || '#6366f1' }}
    >
      {/* Connection handles for edges */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-500 !w-3 !h-3 !border-2 !border-slate-700"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary-500 !w-3 !h-3 !border-2 !border-slate-700"
      />

      <div className="flex items-center justify-between mb-2">
        <span
          className="text-xs font-medium px-2 py-0.5 rounded"
          style={{
            backgroundColor: `${vendorColors[data.vendor]}20`,
            color: vendorColors[data.vendor],
          }}
        >
          {data.vendor}
        </span>
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: healthColor }}
          title={`Health: ${data.healthScore}%`}
        />
      </div>
      <p className="text-sm font-medium text-white truncate">{data.label}</p>
      <p className="text-xs text-slate-400">{formatAssetType(data.type)}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-500">{data.assetTag}</span>
        <span className="text-xs font-mono" style={{ color: healthColor }}>
          {data.healthScore}%
        </span>
      </div>
    </div>
  );
}

const nodeTypes = {
  asset: AssetNode,
};

// Mock asset details for preview
const mockAssetDetails: Record<string, any> = {
  n1: {
    id: 'a1',
    name: 'SM6-24 MV Switchgear',
    type: 'switchgear',
    vendor: 'schneider',
    model: 'SM6-24',
    serialNumber: 'SE-SM6-2023-001',
    healthScore: 92,
    status: 'operational',
    lastMaintenance: '2024-01-15',
    nextMaintenance: '2024-07-15',
    location: 'Building A, Floor 1',
    specs: { voltage: '24kV', current: '630A', frequency: '50Hz' },
  },
  n2: {
    id: 'a3',
    name: 'Trihal Cast Resin Transformer',
    type: 'transformer',
    vendor: 'schneider',
    model: 'Trihal 1000kVA',
    serialNumber: 'SE-TRH-2022-015',
    healthScore: 88,
    status: 'operational',
    lastMaintenance: '2024-02-01',
    nextMaintenance: '2024-08-01',
    location: 'Building A, Basement',
    specs: { power: '1000kVA', primaryVoltage: '11kV', secondaryVoltage: '400V' },
  },
  n3: {
    id: 'a2',
    name: 'Masterpact MTZ1 Breaker',
    type: 'circuit_breaker',
    vendor: 'schneider',
    model: 'MTZ1-10H1',
    serialNumber: 'SE-MTZ-2023-042',
    healthScore: 78,
    status: 'needs_attention',
    lastMaintenance: '2023-11-20',
    nextMaintenance: '2024-05-20',
    location: 'Building A, Floor 1',
    specs: { ratedCurrent: '1000A', breakingCapacity: '65kA' },
  },
  n4: {
    id: 'a4',
    name: 'ABB UniGear ZS1',
    type: 'switchgear',
    vendor: 'abb',
    model: 'UniGear ZS1',
    serialNumber: 'ABB-UG-2023-008',
    healthScore: 95,
    status: 'operational',
    lastMaintenance: '2024-01-10',
    nextMaintenance: '2024-07-10',
    location: 'Building B, Floor 1',
    specs: { voltage: '17.5kV', current: '2500A' },
  },
  n5: {
    id: 'a5',
    name: 'ABB Resibloc Transformer',
    type: 'transformer',
    vendor: 'abb',
    model: 'Resibloc 630kVA',
    serialNumber: 'ABB-RES-2022-023',
    healthScore: 65,
    status: 'needs_attention',
    lastMaintenance: '2023-10-05',
    nextMaintenance: '2024-04-05',
    location: 'Building B, Basement',
    specs: { power: '630kVA', primaryVoltage: '11kV', secondaryVoltage: '400V' },
  },
  n6: {
    id: 'a8',
    name: 'Siemens SIVACON S8',
    type: 'switchgear',
    vendor: 'siemens',
    model: 'SIVACON S8',
    serialNumber: 'SIE-S8-2023-011',
    healthScore: 91,
    status: 'operational',
    lastMaintenance: '2024-02-15',
    nextMaintenance: '2024-08-15',
    location: 'Building C, Floor 1',
    specs: { voltage: '690V', current: '6300A' },
  },
};

export default function TopologyPage() {
  const { siteId } = useParams<{ siteId?: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Preview state
  const [previewNode, setPreviewNode] = useState<string | null>(null);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [autoSelected, setAutoSelected] = useState(false);

  // Handle node click - navigate to asset detail
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Map node ID to asset ID (in real app, node.id would be the asset ID)
      const assetIdMap: Record<string, string> = {
        n1: 'a1',
        n2: 'a3',
        n3: 'a2',
        n4: 'a4',
        n5: 'a5',
        n6: 'a8',
      };
      const assetId = assetIdMap[node.id] || node.id;
      navigate(`/assets/${assetId}`);
    },
    [navigate]
  );

  // Handle node mouse enter - show preview
  const onNodeMouseEnter = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setPreviewPosition({
        x: rect.right + 10,
        y: rect.top,
      });
      setPreviewNode(node.id);
    },
    []
  );

  // Handle node mouse leave - hide preview
  const onNodeMouseLeave = useCallback(() => {
    setPreviewNode(null);
  }, []);

  // Get preview asset details
  const previewAsset = previewNode ? mockAssetDetails[previewNode] : null;

  // Fetch sites for selector
  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const response = await getApi().get(endpoints.sites);
      return response.data.data;
    },
  });

  // Auto-select first site if none selected
  useEffect(() => {
    if (!siteId && sites && sites.length > 0 && !autoSelected) {
      setAutoSelected(true);
      // Navigate to the first site's topology
      navigate(`/topology/${sites[0].id}`, { replace: true });
    }
  }, [siteId, sites, autoSelected, navigate]);

  // Fetch topology data
  const { data: topologyData, isLoading } = useQuery({
    queryKey: ['topology', siteId],
    queryFn: async () => {
      if (!siteId) return null;
      const response = await getApi().get(endpoints.topology(siteId));
      return response.data.data;
    },
    enabled: !!siteId,
  });

  // Transform topology data to React Flow format
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!topologyData) {
      return { initialNodes: [], initialEdges: [] };
    }

    // Define hierarchical positions for the single-line diagram
    // Layout: Top = Main Switchgear, Middle = Transformers, Bottom = Breakers
    const nodePositions: Record<string, { x: number; y: number }> = {
      n1: { x: 350, y: 50 },   // SM6-24 MV Switchgear (top center)
      n2: { x: 200, y: 200 },  // Trihal Transformer (middle left)
      n5: { x: 500, y: 200 },  // ABB Resibloc Transformer (middle right)
      n3: { x: 100, y: 380 },  // Masterpact MTZ1 (bottom left)
      n4: { x: 300, y: 380 },  // Emax 2 Breaker (bottom center-left)
      n6: { x: 500, y: 380 },  // Eaton Power Defense (bottom right)
    };

    const nodes: Node[] = topologyData.nodes.map((node: any, index: number) => {
      // Use predefined positions or calculate based on index
      const position = nodePositions[node.id] || {
        x: (index % 3) * 220 + 100,
        y: Math.floor(index / 3) * 180 + 50,
      };

      return {
        id: node.id,
        type: 'asset',
        position,
        data: {
          label: node.label,
          type: node.type,
          vendor: node.vendor,
          healthScore: node.healthScore,
          status: node.status,
          assetTag: node.assetTag,
        },
      };
    });

    const edges: Edge[] = topologyData.edges.map((edge: any) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: edge.isCriticalPath,
      style: {
        stroke: edge.isCriticalPath ? '#f59e0b' : '#475569',
        strokeWidth: edge.isCriticalPath ? 3 : 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.isCriticalPath ? '#f59e0b' : '#475569',
      },
      label: edge.relationship,
      labelStyle: { fill: '#94a3b8', fontSize: 10 },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8 },
    }));

    return { initialNodes: nodes, initialEdges: edges };
  }, [topologyData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when data changes
  useEffect(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
    }
    if (initialEdges.length > 0) {
      setEdges(initialEdges);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <div className="space-y-6 h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
            <Network className="w-8 h-8 text-primary-500" />
            Topology View
          </h1>
          <p className="text-slate-400 mt-1">Electrical single-line diagram</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={siteId || ''}
            onChange={(e) => window.location.href = `/topology/${e.target.value}`}
            className="input"
          >
            <option value="">Select Site</option>
            {(sites || []).map((site: any) => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>
          <button className="btn btn-outline flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button className="btn btn-outline flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Topology Canvas */}
      {!siteId ? (
        <div className="card p-12 text-center h-[600px] flex flex-col items-center justify-center">
          {sites && sites.length > 0 ? (
            <>
              <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-400">Loading topology...</p>
            </>
          ) : (
            <>
              <Network className="w-16 h-16 text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Select a Site</h3>
              <p className="text-slate-400">Choose a site to view its electrical topology</p>
            </>
          )}
        </div>
      ) : isLoading ? (
        <div className="card h-[600px] flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : nodes.length === 0 ? (
        <div className="card p-12 text-center h-[600px] flex flex-col items-center justify-center">
          <Info className="w-16 h-16 text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Assets Found</h3>
          <p className="text-slate-400">This site doesn't have any assets with connections yet</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card h-[600px] overflow-hidden"
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
          >
            <Background color="#334155" gap={20} size={1} />
            <Controls
              style={{
                backgroundColor: '#1e293b',
                borderColor: '#334155',
                borderRadius: '8px',
              }}
            />
            <MiniMap
              nodeColor={(node) => vendorColors[node.data?.vendor] || '#6366f1'}
              maskColor="rgba(15, 23, 42, 0.8)"
              style={{
                backgroundColor: '#1e293b',
                borderColor: '#334155',
                borderRadius: '8px',
              }}
            />
          </ReactFlow>

          {/* Asset Preview Popup */}
          <AnimatePresence>
            {previewAsset && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className="fixed z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-80"
                style={{
                  left: Math.min(previewPosition.x, window.innerWidth - 340),
                  top: Math.min(previewPosition.y, window.innerHeight - 400),
                }}
              >
                {/* Header */}
                <div
                  className="p-4 border-b border-slate-700"
                  style={{ borderLeftWidth: 4, borderLeftColor: vendorColors[previewAsset.vendor] }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: `${vendorColors[previewAsset.vendor]}20`,
                        color: vendorColors[previewAsset.vendor],
                      }}
                    >
                      {previewAsset.vendor.toUpperCase()}
                    </span>
                    <div
                      className={clsx(
                        'px-2 py-0.5 rounded text-xs',
                        previewAsset.status === 'operational' && 'bg-green-500/20 text-green-400',
                        previewAsset.status === 'needs_attention' && 'bg-yellow-500/20 text-yellow-400',
                        previewAsset.status === 'critical' && 'bg-red-500/20 text-red-400'
                      )}
                    >
                      {previewAsset.status === 'operational' ? 'Operational' :
                       previewAsset.status === 'needs_attention' ? 'Needs Attention' : 'Critical'}
                    </div>
                  </div>
                  <h3 className="font-semibold text-white">{previewAsset.name}</h3>
                  <p className="text-sm text-slate-400">{previewAsset.model}</p>
                </div>

                {/* Health Score */}
                <div className="p-4 border-b border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Health Score
                    </span>
                    <span
                      className="text-lg font-bold"
                      style={{ color: getHealthColor(previewAsset.healthScore) }}
                    >
                      {previewAsset.healthScore}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${previewAsset.healthScore}%`,
                        backgroundColor: getHealthColor(previewAsset.healthScore),
                      }}
                    />
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Serial No.</span>
                    <span className="text-white font-mono text-xs">{previewAsset.serialNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Location</span>
                    <span className="text-white">{previewAsset.location}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Last Maintenance
                    </span>
                    <span className="text-white">{previewAsset.lastMaintenance}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Wrench className="w-3 h-3" />
                      Next Maintenance
                    </span>
                    <span className="text-amber-400">{previewAsset.nextMaintenance}</span>
                  </div>

                  {/* Specs */}
                  <div className="pt-2 border-t border-slate-700">
                    <p className="text-xs text-slate-500 mb-2">Specifications</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(previewAsset.specs).map(([key, value]) => (
                        <span
                          key={key}
                          className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300"
                        >
                          {value as string}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-slate-700 bg-slate-800/50">
                  <button
                    onClick={() => navigate(`/assets/${previewAsset.id}`)}
                    className="w-full btn btn-primary btn-sm flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Full Details
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Legend */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white">Legend</h3>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Info className="w-3 h-3" />
              Hover to preview • Click to view details
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          {/* Vendors */}
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400">Vendors:</span>
            {Object.entries(vendorColors).map(([vendor, color]) => (
              <div key={vendor} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                <span className="text-xs text-slate-300 capitalize">{vendor}</span>
              </div>
            ))}
          </div>

          {/* Connection Types */}
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400">Connections:</span>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-slate-500" />
              <span className="text-xs text-slate-300">Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-amber-500 animate-pulse" />
              <span className="text-xs text-slate-300">Critical Path</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getHealthColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}

function formatAssetType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
