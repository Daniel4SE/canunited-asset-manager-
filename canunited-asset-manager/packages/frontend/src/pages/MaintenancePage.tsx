import { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Play,
  Plus,
  Filter,
  ChevronRight,
  ChevronDown,
  X,
  User,
  Building2,
  Save,
  Trash2,
  Edit,
  Eye,
  Upload,
  FileText,
  Image,
  File,
  XCircle,
  ClipboardCheck,
} from 'lucide-react';
import { getApi, endpoints } from '../lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const priorityConfig = {
  urgent: { color: '#dc2626', bg: 'bg-red-500/10', text: 'text-red-400' },
  high: { color: '#ea580c', bg: 'bg-orange-500/10', text: 'text-orange-400' },
  medium: { color: '#ca8a04', bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  low: { color: '#22c55e', bg: 'bg-green-500/10', text: 'text-green-400' },
};

const statusConfig = {
  scheduled: { icon: Calendar, color: '#3b82f6', bg: 'bg-blue-500/10', label: 'Scheduled' },
  in_progress: { icon: Play, color: '#f59e0b', bg: 'bg-amber-500/10', label: 'In Progress' },
  completed: { icon: CheckCircle2, color: '#22c55e', bg: 'bg-green-500/10', label: 'Completed' },
  overdue: { icon: AlertTriangle, color: '#ef4444', bg: 'bg-red-500/10', label: 'Overdue' },
  cancelled: { icon: X, color: '#64748b', bg: 'bg-slate-500/10', label: 'Cancelled' },
};

const vendorColors: Record<string, string> = {
  schneider: '#3dcd58',
  abb: '#ff000f',
  siemens: '#009999',
  bosch: '#ea0016',
  eaton: '#0033a0',
  generic: '#6366f1',
};

// Mock team members for assignment
const teamMembers = [
  { id: 'u1', name: 'John Smith', role: 'Field Technician', avatar: 'JS' },
  { id: 'u2', name: 'Jane Doe', role: 'Reliability Engineer', avatar: 'JD' },
  { id: 'u3', name: 'Mike Johnson', role: 'OEM Service Partner', avatar: 'MJ' },
  { id: 'u4', name: 'Sarah Wilson', role: 'Asset Manager', avatar: 'SW' },
  { id: 'u5', name: 'Tom Brown', role: 'Field Technician', avatar: 'TB' },
];

// Mock assets for task creation
const mockAssets = [
  { id: 'a1', name: 'SM6-24 MV Switchgear', tag: 'SGP-MVS-0001', site: 'Singapore Main Plant' },
  { id: 'a2', name: 'Masterpact MTZ1 Breaker', tag: 'SGP-CBR-0001', site: 'Singapore Main Plant' },
  { id: 'a3', name: 'Trihal Cast Resin Transformer', tag: 'SGP-TRF-0001', site: 'Singapore Main Plant' },
  { id: 'a5', name: 'ABB Resibloc Transformer', tag: 'SGP-TRF-0002', site: 'Singapore Main Plant' },
  { id: 'a6', name: 'Siemens 3WL Breaker', tag: 'MYS-CBR-0001', site: 'Malaysia Factory' },
];

interface CreateTaskForm {
  title: string;
  description: string;
  assetId: string;
  taskType: string;
  priority: string;
  dueDate: string;
  assignedTo: string;
  oemServiceRequired: boolean;
}

interface CompletionForm {
  actualDuration: string;
  partsUsed: string;
  laborCost: string;
  partsCost: string;
  completionNotes: string;
  workOrderNumber: string;
  files: FileUpload[];
}

interface FileUpload {
  id: string;
  name: string;
  type: string;
  size: number;
  preview?: string;
}

export default function MaintenancePage() {
  const { t } = useTranslation();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completingTask, setCompletingTask] = useState<any | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local tasks state to track newly created tasks
  const [localTasks, setLocalTasks] = useState<any[]>([]);

  // Completion form state
  const [completionForm, setCompletionForm] = useState<CompletionForm>({
    actualDuration: '',
    partsUsed: '',
    laborCost: '',
    partsCost: '',
    completionNotes: '',
    workOrderNumber: `WO-${Date.now().toString().slice(-6)}`,
    files: [],
  });

  // Check if navigated from alerts or asset page with create task intent
  useEffect(() => {
    const state = location.state as {
      createTask?: boolean;
      fromAlert?: any;
      fromAsset?: any;
    } | null;

    if (state?.createTask) {
      setShowCreateModal(true);

      if (state.fromAlert) {
        // Pre-fill form data from alert
        setCreateForm((prev) => ({
          ...prev,
          title: `Maintenance for: ${state.fromAlert.title}`,
          description: state.fromAlert.description || '',
          priority: state.fromAlert.severity === 'critical' ? 'urgent' : state.fromAlert.severity || 'medium',
        }));
      } else if (state.fromAsset) {
        // Pre-fill form data from asset detail page
        const asset = state.fromAsset;
        const matchingAsset = mockAssets.find(a => a.id === asset.id || a.name === asset.name);

        setCreateForm((prev) => ({
          ...prev,
          title: `Scheduled Maintenance - ${asset.name}`,
          description: `Preventive maintenance for ${asset.name} (${asset.assetTag}).\nCurrent Health Score: ${asset.healthScore || 'N/A'}%\nLocation: ${asset.location || 'N/A'}`,
          assetId: matchingAsset?.id || asset.id || '',
          taskType: 'preventive',
          priority: asset.healthScore && asset.healthScore < 70 ? 'high' : 'medium',
          dueDate: asset.recommendedDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        }));
      }

      // Clear location state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Create task form state
  const [createForm, setCreateForm] = useState<CreateTaskForm>({
    title: '',
    description: '',
    assetId: '',
    taskType: 'preventive',
    priority: 'medium',
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    assignedTo: '',
    oemServiceRequired: false,
  });

  // Fetch upcoming summary
  const { data: upcomingSummary, refetch: refetchSummary } = useQuery({
    queryKey: ['maintenanceUpcoming'],
    queryFn: async () => {
      const response = await getApi().get(endpoints.maintenanceUpcoming);
      return response.data.data;
    },
  });

  // Fetch maintenance tasks
  const { data, isLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['maintenance', statusFilter, priorityFilter, taskTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (taskTypeFilter) params.append('taskType', taskTypeFilter);
      const response = await getApi().get(`${endpoints.maintenance}?${params}`);
      return response.data;
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: CreateTaskForm) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const newTaskId = `task-${Date.now()}`;

      // Find asset details
      const asset = mockAssets.find(a => a.id === taskData.assetId);
      const assignee = teamMembers.find(m => m.id === taskData.assignedTo);

      // Create a new task object
      const newTask = {
        id: newTaskId,
        title: taskData.title,
        description: taskData.description,
        assetId: taskData.assetId,
        assetName: asset?.name || 'Unknown Asset',
        assetTag: asset?.tag || '',
        assetVendor: 'schneider', // Default
        siteName: asset?.site || 'Singapore Main Plant',
        taskType: taskData.taskType,
        priority: taskData.priority,
        status: 'scheduled',
        dueDate: taskData.dueDate,
        assignedTo: taskData.assignedTo,
        assignedToName: assignee?.name || '',
        oemServiceRequired: taskData.oemServiceRequired,
        createdAt: new Date().toISOString(),
      };

      return { success: true, id: newTaskId, task: newTask };
    },
    onSuccess: (data) => {
      // Add new task to local state
      setLocalTasks(prev => [data.task, ...prev]);

      toast.success(t('common.success') + ' - Task created');
      setShowCreateModal(false);
      resetCreateForm();
      refetchSummary();
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<any> }) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { success: true, taskId, updates };
    },
    onSuccess: (_data, variables) => {
      // Update local tasks if the task is a locally created one
      setLocalTasks(prev => prev.map(task =>
        task.id === variables.taskId
          ? { ...task, ...variables.updates }
          : task
      ));

      if (variables.updates.status === 'completed') {
        toast.success('Task completed! Related alerts will be updated.');
        // In real app, this would also resolve related alerts
        queryClient.invalidateQueries({ queryKey: ['alerts'] });
        queryClient.invalidateQueries({ queryKey: ['alertsSummary'] });
      } else {
        toast.success('Task updated');
      }
      setEditingTask(null);
      refetchTasks();
      refetchSummary();
    },
  });

  // Complete task with work order mutation
  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, workOrder }: { taskId: string; workOrder: CompletionForm }) => {
      // Simulate API call to submit work order
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return {
        success: true,
        workOrderId: workOrder.workOrderNumber,
        taskId,
        message: 'Work order submitted successfully'
      };
    },
    onSuccess: (data, variables) => {
      // Update local tasks to mark as completed
      setLocalTasks(prev => prev.map(task =>
        task.id === variables.taskId
          ? { ...task, status: 'completed', workOrder: variables.workOrder }
          : task
      ));

      toast.success(`Work order ${variables.workOrder.workOrderNumber} submitted! Task completed.`);
      // Update related queries
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alertsSummary'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      // Reset form and close modal
      setShowCompletionModal(false);
      setCompletingTask(null);
      resetCompletionForm();
      refetchTasks();
      refetchSummary();
    },
    onError: () => {
      toast.error('Failed to submit work order. Please try again.');
    },
  });

  const resetCreateForm = () => {
    setCreateForm({
      title: '',
      description: '',
      assetId: '',
      taskType: 'preventive',
      priority: 'medium',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      assignedTo: '',
      oemServiceRequired: false,
    });
  };

  const resetCompletionForm = () => {
    setCompletionForm({
      actualDuration: '',
      partsUsed: '',
      laborCost: '',
      partsCost: '',
      completionNotes: '',
      workOrderNumber: `WO-${Date.now().toString().slice(-6)}`,
      files: [],
    });
  };

  const handleOpenCompletionModal = (task: any) => {
    setCompletingTask(task);
    setCompletionForm({
      ...completionForm,
      workOrderNumber: `WO-${Date.now().toString().slice(-6)}`,
    });
    setShowCompletionModal(true);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: FileUpload[] = [];
    Array.from(files).forEach((file) => {
      const fileUpload: FileUpload = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        type: file.type,
        size: file.size,
      };

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setCompletionForm((prev) => ({
            ...prev,
            files: prev.files.map((f) =>
              f.id === fileUpload.id ? { ...f, preview: reader.result as string } : f
            ),
          }));
        };
        reader.readAsDataURL(file);
      }

      newFiles.push(fileUpload);
    });

    setCompletionForm((prev) => ({
      ...prev,
      files: [...prev.files, ...newFiles],
    }));

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setCompletionForm((prev) => ({
      ...prev,
      files: prev.files.filter((f) => f.id !== fileId),
    }));
  };

  const handleSubmitCompletion = () => {
    if (!completingTask) return;

    if (!completionForm.actualDuration) {
      toast.error('Please enter the actual duration');
      return;
    }

    completeTaskMutation.mutate({
      taskId: completingTask.id,
      workOrder: completionForm,
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return Image;
    if (type.includes('pdf')) return FileText;
    return File;
  };

  const handleCreateTask = () => {
    if (!createForm.title || !createForm.assetId) {
      toast.error('Please fill in required fields');
      return;
    }
    createTaskMutation.mutate(createForm);
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    updateTaskMutation.mutate({ taskId, updates: { status: newStatus } });
  };

  const handleAssigneeChange = (taskId: string, assigneeId: string) => {
    const assignee = teamMembers.find((m) => m.id === assigneeId);
    updateTaskMutation.mutate({
      taskId,
      updates: { assignedTo: assigneeId, assignedToName: assignee?.name },
    });
  };

  // Merge API tasks with locally created tasks
  const apiTasks = data?.data || [];
  const allTasks = [...localTasks, ...apiTasks];

  // Apply filters
  const tasks = allTasks.filter((task: any) => {
    if (statusFilter && task.status !== statusFilter) return false;
    if (priorityFilter && task.priority !== priorityFilter) return false;
    if (taskTypeFilter && task.taskType !== taskTypeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
            <Wrench className="w-8 h-8 text-primary-500" />
            {t('maintenance.title')}
          </h1>
          <p className="text-slate-400 mt-1">Manage and track maintenance tasks</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Task
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={Calendar}
          label={t('maintenance.scheduled')}
          value={upcomingSummary?.scheduled || 0}
          color="#3b82f6"
          onClick={() => setStatusFilter('scheduled')}
          active={statusFilter === 'scheduled'}
        />
        <SummaryCard
          icon={Play}
          label={t('maintenance.inProgress')}
          value={upcomingSummary?.inProgress || 0}
          color="#f59e0b"
          onClick={() => setStatusFilter('in_progress')}
          active={statusFilter === 'in_progress'}
        />
        <SummaryCard
          icon={AlertTriangle}
          label={t('maintenance.overdue')}
          value={upcomingSummary?.overdue || 0}
          color="#ef4444"
          alert={upcomingSummary?.overdue > 0}
          onClick={() => setStatusFilter('overdue')}
          active={statusFilter === 'overdue'}
        />
        <SummaryCard
          icon={Wrench}
          label="OEM Required"
          value={upcomingSummary?.oemRequired || 0}
          color="#a855f7"
        />
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            <option value="">All Status</option>
            <option value="scheduled">{t('maintenance.scheduled')}</option>
            <option value="in_progress">{t('maintenance.inProgress')}</option>
            <option value="completed">{t('maintenance.completed')}</option>
            <option value="overdue">{t('maintenance.overdue')}</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="input"
          >
            <option value="">All Priorities</option>
            <option value="urgent">{t('maintenance.urgent')}</option>
            <option value="high">{t('maintenance.high')}</option>
            <option value="medium">{t('maintenance.medium')}</option>
            <option value="low">{t('maintenance.low')}</option>
          </select>
          <select
            value={taskTypeFilter}
            onChange={(e) => setTaskTypeFilter(e.target.value)}
            className="input"
          >
            <option value="">All Types</option>
            <option value="preventive">{t('maintenance.preventive')}</option>
            <option value="corrective">{t('maintenance.corrective')}</option>
            <option value="predictive">{t('maintenance.predictive')}</option>
            <option value="inspection">{t('maintenance.inspection')}</option>
          </select>
          {(statusFilter || priorityFilter || taskTypeFilter) && (
            <button
              onClick={() => {
                setStatusFilter('');
                setPriorityFilter('');
                setTaskTypeFilter('');
              }}
              className="text-sm text-slate-400 hover:text-white"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">All Caught Up!</h3>
          <p className="text-slate-400">{t('maintenance.noTasks')}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {tasks.map((task: any, index: number) => {
              const priority = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.medium;
              const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.scheduled;
              const StatusIcon = status.icon;
              const isExpanded = expandedTask === task.id;

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                  className="card overflow-hidden"
                >
                  <div
                    className="p-5 cursor-pointer hover:bg-slate-800/30 transition-colors"
                    onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Status Icon */}
                      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', status.bg)}>
                        <StatusIcon className="w-6 h-6" style={{ color: status.color }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <h3 className="font-medium text-white">{task.title}</h3>
                            <p className="text-sm text-slate-400 mt-1">{task.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={clsx('px-3 py-1 rounded-full text-xs font-medium capitalize', priority.bg, priority.text)}>
                              {task.priority}
                            </span>
                            <ChevronDown
                              className={clsx(
                                'w-5 h-5 text-slate-400 transition-transform',
                                isExpanded && 'rotate-180'
                              )}
                            />
                          </div>
                        </div>

                        {/* Meta info */}
                        <div className="flex flex-wrap items-center gap-4 mt-3">
                          <Link
                            to={`/assets/${task.assetId || 'a1'}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 text-sm hover:text-primary-400 transition-colors"
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: vendorColors[task.assetVendor] || '#6366f1' }}
                            />
                            <span className="text-slate-300">{task.assetName}</span>
                            <span className="text-slate-500 font-mono text-xs">{task.assetTag}</span>
                          </Link>
                          <span className="text-slate-500">•</span>
                          <span className="text-sm text-slate-400">{task.siteName}</span>
                        </div>

                        {/* Quick info row */}
                        <div className="flex items-center gap-4 mt-3 text-sm">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Calendar className="w-4 h-4" />
                            <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                          </div>
                          {task.assignedToName && (
                            <div className="flex items-center gap-2 text-slate-400">
                              <User className="w-4 h-4" />
                              <span>{task.assignedToName}</span>
                            </div>
                          )}
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-xs capitalize',
                            task.taskType === 'preventive' && 'bg-blue-500/20 text-blue-400',
                            task.taskType === 'corrective' && 'bg-red-500/20 text-red-400',
                            task.taskType === 'predictive' && 'bg-purple-500/20 text-purple-400',
                            task.taskType === 'inspection' && 'bg-green-500/20 text-green-400'
                          )}>
                            {task.taskType}
                          </span>
                          {task.oemServiceRequired && (
                            <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400">
                              OEM Service
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Task Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-700"
                      >
                        <div className="p-5 bg-slate-800/30">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column - Task Details */}
                            <div className="space-y-4">
                              <h4 className="text-sm font-medium text-slate-400">Task Details</h4>

                              {/* Status Update */}
                              <div>
                                <label className="block text-xs text-slate-500 mb-2">
                                  {t('maintenance.status')}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(statusConfig).map(([key, config]) => (
                                    <button
                                      key={key}
                                      onClick={() => handleStatusChange(task.id, key)}
                                      className={clsx(
                                        'px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-all',
                                        task.status === key
                                          ? `${config.bg} ring-2 ring-offset-2 ring-offset-slate-900`
                                          : 'bg-slate-700/50 hover:bg-slate-700'
                                      )}
                                      style={{
                                        color: task.status === key ? config.color : '#94a3b8',
                                        ringColor: task.status === key ? config.color : undefined,
                                      }}
                                    >
                                      <config.icon className="w-4 h-4" />
                                      {config.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Assignee */}
                              <div>
                                <label className="block text-xs text-slate-500 mb-2">
                                  {t('maintenance.assignedTo')}
                                </label>
                                <select
                                  value={task.assignedTo || ''}
                                  onChange={(e) => handleAssigneeChange(task.id, e.target.value)}
                                  className="input w-full"
                                >
                                  <option value="">-- Select Assignee --</option>
                                  {teamMembers.map((member) => (
                                    <option key={member.id} value={member.id}>
                                      {member.name} ({member.role})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Due Date */}
                              <div>
                                <label className="block text-xs text-slate-500 mb-2">
                                  {t('maintenance.dueDate')}
                                </label>
                                <input
                                  type="date"
                                  defaultValue={task.dueDate?.split('T')[0]}
                                  className="input w-full"
                                />
                              </div>
                            </div>

                            {/* Right Column - Actions & Notes */}
                            <div className="space-y-4">
                              <h4 className="text-sm font-medium text-slate-400">Actions</h4>

                              <div className="space-y-3">
                                <Link
                                  to={`/assets/${task.assetId || 'a1'}`}
                                  className="btn btn-outline w-full flex items-center justify-center gap-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  {t('common.view')} Asset
                                </Link>

                                {task.status !== 'completed' && (
                                  <button
                                    onClick={() => handleOpenCompletionModal(task)}
                                    className="btn btn-primary w-full flex items-center justify-center gap-2"
                                  >
                                    <ClipboardCheck className="w-4 h-4" />
                                    Complete & Submit Work Order
                                  </button>
                                )}

                                {task.status === 'scheduled' && (
                                  <button
                                    onClick={() => handleStatusChange(task.id, 'in_progress')}
                                    className="btn btn-secondary w-full flex items-center justify-center gap-2"
                                  >
                                    <Play className="w-4 h-4" />
                                    Start Task
                                  </button>
                                )}
                              </div>

                              {/* Notes */}
                              <div>
                                <label className="block text-xs text-slate-500 mb-2">
                                  {t('common.notes')}
                                </label>
                                <textarea
                                  className="input w-full h-24 resize-none"
                                  placeholder="Add notes about this task..."
                                  defaultValue={task.notes}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Team Assignment Quick View */}
                          {task.assignedTo && (
                            <div className="mt-6 pt-4 border-t border-slate-700">
                              <h4 className="text-sm font-medium text-slate-400 mb-3">Assigned Team Member</h4>
                              <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                                <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center text-primary-400 font-medium">
                                  {teamMembers.find((m) => m.id === task.assignedTo)?.avatar || 'NA'}
                                </div>
                                <div>
                                  <p className="text-white font-medium">
                                    {teamMembers.find((m) => m.id === task.assignedTo)?.name || task.assignedToName}
                                  </p>
                                  <p className="text-sm text-slate-400">
                                    {teamMembers.find((m) => m.id === task.assignedTo)?.role}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">
                    {t('maintenance.scheduleMaintenance')}
                  </h2>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Task Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="input w-full"
                    placeholder="Enter task title"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    {t('common.description')}
                  </label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="input w-full h-24 resize-none"
                    placeholder="Describe the maintenance task..."
                  />
                </div>

                {/* Asset Selection */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Asset <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={createForm.assetId}
                    onChange={(e) => setCreateForm({ ...createForm, assetId: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">-- Select Asset --</option>
                    {mockAssets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name} ({asset.tag}) - {asset.site}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Type and Priority */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      {t('maintenance.taskType')}
                    </label>
                    <select
                      value={createForm.taskType}
                      onChange={(e) => setCreateForm({ ...createForm, taskType: e.target.value })}
                      className="input w-full"
                    >
                      <option value="preventive">{t('maintenance.preventive')}</option>
                      <option value="corrective">{t('maintenance.corrective')}</option>
                      <option value="predictive">{t('maintenance.predictive')}</option>
                      <option value="inspection">{t('maintenance.inspection')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      {t('maintenance.priority')}
                    </label>
                    <select
                      value={createForm.priority}
                      onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                      className="input w-full"
                    >
                      <option value="low">{t('maintenance.low')}</option>
                      <option value="medium">{t('maintenance.medium')}</option>
                      <option value="high">{t('maintenance.high')}</option>
                      <option value="urgent">{t('maintenance.urgent')}</option>
                    </select>
                  </div>
                </div>

                {/* Due Date and Assignee */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      {t('maintenance.dueDate')}
                    </label>
                    <input
                      type="date"
                      value={createForm.dueDate}
                      onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      {t('maintenance.assignedTo')}
                    </label>
                    <select
                      value={createForm.assignedTo}
                      onChange={(e) => setCreateForm({ ...createForm, assignedTo: e.target.value })}
                      className="input w-full"
                    >
                      <option value="">-- Select Assignee --</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({member.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* OEM Service Required */}
                <label className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createForm.oemServiceRequired}
                    onChange={(e) => setCreateForm({ ...createForm, oemServiceRequired: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <p className="text-white font-medium">OEM Service Required</p>
                    <p className="text-sm text-slate-400">This task requires vendor/OEM support</p>
                  </div>
                </label>
              </div>

              <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="btn btn-outline"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleCreateTask}
                  disabled={createTaskMutation.isPending}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {createTaskMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {t('common.create')} Task
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Work Order Completion Modal */}
      <AnimatePresence>
        {showCompletionModal && completingTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCompletionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                      <ClipboardCheck className="w-5 h-5 text-green-500" />
                      Complete Task & Submit Work Order
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                      Task: {completingTask.title}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCompletionModal(false)}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Work Order Number */}
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Work Order Number</p>
                      <p className="text-lg font-mono text-primary-400">{completionForm.workOrderNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">Completion Date</p>
                      <p className="text-sm text-white">{new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Time & Cost Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Actual Duration (hours) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={completionForm.actualDuration}
                      onChange={(e) => setCompletionForm({ ...completionForm, actualDuration: e.target.value })}
                      className="input w-full"
                      placeholder="e.g., 2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Labor Cost ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={completionForm.laborCost}
                      onChange={(e) => setCompletionForm({ ...completionForm, laborCost: e.target.value })}
                      className="input w-full"
                      placeholder="e.g., 150.00"
                    />
                  </div>
                </div>

                {/* Parts Used */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Parts Used
                  </label>
                  <textarea
                    value={completionForm.partsUsed}
                    onChange={(e) => setCompletionForm({ ...completionForm, partsUsed: e.target.value })}
                    className="input w-full h-20 resize-none"
                    placeholder="List parts used (e.g., 2x Breaker contacts, 1x Capacitor 100uF...)"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Parts Cost ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={completionForm.partsCost}
                    onChange={(e) => setCompletionForm({ ...completionForm, partsCost: e.target.value })}
                    className="input w-full"
                    placeholder="e.g., 250.00"
                  />
                </div>

                {/* Completion Notes */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Completion Notes / Summary
                  </label>
                  <textarea
                    value={completionForm.completionNotes}
                    onChange={(e) => setCompletionForm({ ...completionForm, completionNotes: e.target.value })}
                    className="input w-full h-24 resize-none"
                    placeholder="Describe the work performed, findings, and any recommendations..."
                  />
                </div>

                {/* File Upload Section */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Upload Evidence (Photos, Documents)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 hover:bg-slate-800/30 transition-all"
                  >
                    <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Images, PDFs, Word documents (max 10MB each)
                    </p>
                  </div>

                  {/* Uploaded Files List */}
                  {completionForm.files.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {completionForm.files.map((file) => {
                        const FileIcon = getFileIcon(file.type);
                        return (
                          <div
                            key={file.id}
                            className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg"
                          >
                            {file.preview ? (
                              <img
                                src={file.preview}
                                alt={file.name}
                                className="w-12 h-12 object-cover rounded"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-slate-700 rounded flex items-center justify-center">
                                <FileIcon className="w-6 h-6 text-slate-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{file.name}</p>
                              <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveFile(file.id)}
                              className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                            >
                              <XCircle className="w-5 h-5 text-slate-400 hover:text-red-400" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Total Cost Summary */}
                {(completionForm.laborCost || completionForm.partsCost) && (
                  <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Total Cost</span>
                      <span className="text-lg font-semibold text-white">
                        ${(
                          parseFloat(completionForm.laborCost || '0') +
                          parseFloat(completionForm.partsCost || '0')
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCompletionModal(false);
                    setCompletingTask(null);
                    resetCompletionForm();
                  }}
                  className="btn btn-outline"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSubmitCompletion}
                  disabled={completeTaskMutation.isPending}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {completeTaskMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Submit Work Order & Complete
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
  alert,
  onClick,
  active,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  alert?: boolean;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'card p-4 transition-all',
        onClick && 'cursor-pointer hover:bg-slate-800/50',
        alert && 'border-red-500/50',
        active && 'ring-2 ring-primary-500'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-bold text-white font-mono">{value}</p>
          <p className="text-xs text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}
