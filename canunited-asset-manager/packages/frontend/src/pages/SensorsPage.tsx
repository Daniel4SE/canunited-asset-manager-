import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio,
  Wifi,
  WifiOff,
  Battery,
  Signal,
  Plus,
  Filter,
  Thermometer,
  Activity,
  Zap,
  X,
  Edit,
  Trash2,
  Save,
  Settings,
  Clock,
  MapPin,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Eye,
  BarChart3,
} from 'lucide-react';
import { getApi, endpoints } from '../lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const vendorColors: Record<string, string> = {
  schneider: '#3dcd58',
  abb: '#ff000f',
  siemens: '#009999',
  bosch: '#ea0016',
  eaton: '#0033a0',
  generic: '#6366f1',
};

const sensorTypeIcons: Record<string, React.ElementType> = {
  temperature: Thermometer,
  humidity: Activity,
  temperature_humidity: Thermometer,
  partial_discharge: Zap,
  vibration: Activity,
  current: Zap,
  voltage: Zap,
  power: Zap,
  gas: Activity,
  heat_tag: Thermometer,
};

const protocolOptions = [
  { value: 'zigbee', label: 'ZigBee' },
  { value: 'lorawan', label: 'LoRaWAN' },
  { value: 'modbus_rtu', label: 'Modbus RTU' },
  { value: 'modbus_tcp', label: 'Modbus TCP' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'bluetooth', label: 'Bluetooth' },
];

const sensorTypeOptions = [
  { value: 'temperature', label: 'Temperature' },
  { value: 'humidity', label: 'Humidity' },
  { value: 'temperature_humidity', label: 'Temperature & Humidity' },
  { value: 'partial_discharge', label: 'Partial Discharge' },
  { value: 'vibration', label: 'Vibration' },
  { value: 'current', label: 'Current' },
  { value: 'voltage', label: 'Voltage' },
  { value: 'power', label: 'Power' },
  { value: 'gas', label: 'Gas Detection' },
  { value: 'heat_tag', label: 'Heat Tag' },
];

// Mock assets for assignment
const mockAssets = [
  { id: 'a1', name: 'SM6-24 MV Switchgear', tag: 'SGP-MVS-0001' },
  { id: 'a2', name: 'Masterpact MTZ1 Breaker', tag: 'SGP-CBR-0001' },
  { id: 'a3', name: 'Trihal Cast Resin Transformer', tag: 'SGP-TRF-0001' },
  { id: 'a4', name: 'NXPLUS C Switchgear', tag: 'SGP-MVS-0002' },
  { id: 'a5', name: 'ABB Resibloc Transformer', tag: 'SGP-TRF-0002' },
  { id: 'a6', name: 'ABB ACS880 VFD', tag: 'MYS-VFD-0001' },
  { id: 'a7', name: 'Eaton Power Distribution', tag: 'MYS-PDU-0001' },
];

interface SensorForm {
  name: string;
  model: string;
  vendor: string;
  sensorType: string;
  protocol: string;
  serialNumber: string;
  firmwareVersion: string;
  assignedAssetId: string;
  location: string;
  calibrationDate: string;
  notes: string;
}

const initialSensorForm: SensorForm = {
  name: '',
  model: '',
  vendor: 'generic',
  sensorType: 'temperature',
  protocol: 'zigbee',
  serialNumber: '',
  firmwareVersion: '',
  assignedAssetId: '',
  location: '',
  calibrationDate: '',
  notes: '',
};

export default function SensorsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [sensorForm, setSensorForm] = useState<SensorForm>(initialSensorForm);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const sensorsPerPage = 12;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sensors', currentPage, typeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('perPage', sensorsPerPage.toString());
      if (typeFilter) params.append('sensorType', typeFilter);
      if (statusFilter === 'online') params.append('isOnline', 'true');
      if (statusFilter === 'offline') params.append('isOnline', 'false');

      const response = await getApi().get(`${endpoints.sensors}?${params.toString()}`);
      return response.data;
    },
  });

  // Add sensor mutation
  const addSensorMutation = useMutation({
    mutationFn: async (sensor: SensorForm) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { success: true, id: `sensor-${Date.now()}` };
    },
    onSuccess: () => {
      toast.success('Sensor added successfully');
      setShowAddModal(false);
      setSensorForm(initialSensorForm);
      refetch();
    },
    onError: () => {
      toast.error('Failed to add sensor');
    },
  });

  // Update sensor mutation
  const updateSensorMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SensorForm> }) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { success: true };
    },
    onSuccess: () => {
      toast.success('Sensor updated successfully');
      setIsEditing(false);
      refetch();
    },
    onError: () => {
      toast.error('Failed to update sensor');
    },
  });

  // Delete sensor mutation
  const deleteSensorMutation = useMutation({
    mutationFn: async (id: string) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { success: true };
    },
    onSuccess: () => {
      toast.success('Sensor deleted successfully');
      setShowDeleteConfirm(false);
      setShowDetailModal(false);
      setSelectedSensor(null);
      refetch();
    },
    onError: () => {
      toast.error('Failed to delete sensor');
    },
  });

  // Handle both array format and object format with meta
  const sensors = Array.isArray(data) ? data : (data?.data || []);
  const meta = data?.meta || { page: 1, perPage: sensorsPerPage, total: sensors.length, totalPages: 1 };
  const totalPages = meta.totalPages || Math.ceil(meta.total / sensorsPerPage) || 1;

  // Filter sensors (already filtered by API, but keep client-side filter for low_battery)
  const filteredSensors = sensors.filter((s: any) => {
    if (statusFilter === 'low_battery' && (!s.batteryLevel || s.batteryLevel >= 30)) return false;
    return true;
  });

  // Use global stats from API meta (not calculated from current page)
  const onlineCount = meta.onlineCount ?? sensors.filter((s: any) => s.isOnline).length;
  const offlineCount = meta.offlineCount ?? sensors.filter((s: any) => !s.isOnline).length;
  const lowBatteryCount = meta.lowBatteryCount ?? sensors.filter((s: any) => s.batteryLevel && s.batteryLevel < 30).length;
  const totalSensors = meta.totalSensors ?? meta.total ?? sensors.length;

  // Reset to page 1 when filters change
  const handleFilterChange = (filterType: 'type' | 'status', value: string) => {
    setCurrentPage(1);
    if (filterType === 'type') setTypeFilter(value);
    else setStatusFilter(value);
  };

  const handleSensorClick = (sensor: any) => {
    setSelectedSensor(sensor);
    setSensorForm({
      name: sensor.name || '',
      model: sensor.model || '',
      vendor: sensor.vendor || 'generic',
      sensorType: sensor.sensorType || 'temperature',
      protocol: sensor.protocol || 'zigbee',
      serialNumber: sensor.serialNumber || '',
      firmwareVersion: sensor.firmwareVersion || '',
      assignedAssetId: sensor.assignedAssetId || '',
      location: sensor.location || '',
      calibrationDate: sensor.calibrationDate || '',
      notes: sensor.notes || '',
    });
    setShowDetailModal(true);
    setIsEditing(false);
  };

  const handleAddSensor = () => {
    if (!sensorForm.name || !sensorForm.model) {
      toast.error('Please fill in required fields');
      return;
    }
    addSensorMutation.mutate(sensorForm);
  };

  const handleUpdateSensor = () => {
    if (!selectedSensor) return;
    updateSensorMutation.mutate({
      id: selectedSensor.id,
      updates: sensorForm,
    });
  };

  const handleDeleteSensor = () => {
    if (!selectedSensor) return;
    deleteSensorMutation.mutate(selectedSensor.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
            <Radio className="w-8 h-8 text-primary-500" />
            {t('sensors.title')}
          </h1>
          <p className="text-slate-400 mt-1">{totalSensors} sensors deployed</p>
        </div>
        <button
          onClick={() => {
            setSensorForm(initialSensorForm);
            setShowAddModal(true);
          }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('sensors.addSensor')}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => handleFilterChange('status', statusFilter === 'online' ? '' : 'online')}
          className={clsx(
            'card p-4 text-left transition-all',
            statusFilter === 'online' && 'ring-2 ring-green-500'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400 font-mono">{onlineCount}</p>
              <p className="text-xs text-slate-400">{t('sensors.online')}</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => handleFilterChange('status', statusFilter === 'offline' ? '' : 'offline')}
          className={clsx(
            'card p-4 text-left transition-all',
            statusFilter === 'offline' && 'ring-2 ring-red-500'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <WifiOff className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400 font-mono">{offlineCount}</p>
              <p className="text-xs text-slate-400">{t('sensors.offline')}</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => handleFilterChange('status', statusFilter === 'low_battery' ? '' : 'low_battery')}
          className={clsx(
            'card p-4 text-left transition-all',
            statusFilter === 'low_battery' && 'ring-2 ring-amber-500'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Battery className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400 font-mono">{lowBatteryCount}</p>
              <p className="text-xs text-slate-400">Low Battery</p>
            </div>
          </div>
        </button>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Radio className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white font-mono">{totalSensors}</p>
              <p className="text-xs text-slate-400">Total Sensors</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="input"
          >
            <option value="">All Types</option>
            {sensorTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="input"
          >
            <option value="">All Status</option>
            <option value="online">{t('sensors.online')}</option>
            <option value="offline">{t('sensors.offline')}</option>
            <option value="low_battery">Low Battery</option>
          </select>
          {(typeFilter || statusFilter) && (
            <button
              onClick={() => {
                setTypeFilter('');
                setStatusFilter('');
              }}
              className="text-sm text-slate-400 hover:text-white"
            >
              Clear filters
            </button>
          )}
          <button
            onClick={() => refetch()}
            className="ml-auto btn btn-outline btn-sm flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Sensors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredSensors.map((sensor: any, index: number) => {
          const TypeIcon = sensorTypeIcons[sensor.sensorType] || Radio;

          return (
            <motion.div
              key={sensor.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleSensorClick(sensor)}
              className="card p-4 cursor-pointer hover:bg-slate-800/50 transition-all hover:scale-[1.02]"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={clsx(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    sensor.isOnline ? 'bg-green-500/20' : 'bg-red-500/20'
                  )}>
                    <TypeIcon className={clsx(
                      'w-4 h-4',
                      sensor.isOnline ? 'text-green-400' : 'text-red-400'
                    )} />
                  </div>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium capitalize"
                    style={{
                      backgroundColor: `${vendorColors[sensor.vendor]}20`,
                      color: vendorColors[sensor.vendor],
                    }}
                  >
                    {sensor.vendor}
                  </span>
                </div>
                <div className={clsx(
                  'w-2 h-2 rounded-full',
                  sensor.isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                )} />
              </div>

              {/* Info */}
              <h3 className="font-medium text-white truncate">{sensor.name}</h3>
              <p className="text-sm text-slate-400 mb-3">{sensor.model}</p>

              {/* Details */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="text-slate-300 capitalize">
                    {sensor.sensorType.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Protocol</span>
                  <span className="text-slate-300 uppercase text-xs font-mono">
                    {sensor.protocol?.replace('_', ' ')}
                  </span>
                </div>
                {sensor.assignedAssetName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Asset</span>
                    <span className="text-slate-300 truncate max-w-[120px]">
                      {sensor.assignedAssetName}
                    </span>
                  </div>
                )}
              </div>

              {/* Status Bar */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-700">
                {sensor.batteryLevel !== null && (
                  <div className="flex items-center gap-1">
                    <Battery className={clsx(
                      'w-4 h-4',
                      sensor.batteryLevel > 50 ? 'text-green-400' :
                        sensor.batteryLevel > 20 ? 'text-amber-400' : 'text-red-400'
                    )} />
                    <span className="text-xs font-mono text-slate-400">
                      {sensor.batteryLevel}%
                    </span>
                  </div>
                )}
                {sensor.signalStrength !== null && (
                  <div className="flex items-center gap-1">
                    <Signal className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-mono text-slate-400">
                      {sensor.signalStrength}%
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={clsx(
              'p-2 rounded-lg border transition-all',
              currentPage === 1
                ? 'border-slate-700 text-slate-600 cursor-not-allowed'
                : 'border-slate-600 text-slate-300 hover:bg-slate-800 hover:border-slate-500'
            )}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-slate-400 font-mono">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={clsx(
              'p-2 rounded-lg border transition-all',
              currentPage === totalPages
                ? 'border-slate-700 text-slate-600 cursor-not-allowed'
                : 'border-slate-600 text-slate-300 hover:bg-slate-800 hover:border-slate-500'
            )}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Empty State */}
      {filteredSensors.length === 0 && (
        <div className="card p-12 text-center">
          <Radio className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            {totalSensors === 0 ? 'No Sensors' : 'No Matching Sensors'}
          </h3>
          <p className="text-slate-400 mb-4">
            {totalSensors === 0
              ? 'Get started by adding your first sensor'
              : 'Try adjusting your filters'}
          </p>
          {totalSensors === 0 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Sensor
            </button>
          )}
        </div>
      )}

      {/* Add Sensor Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
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
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary-500" />
                    {t('sensors.addSensor')}
                  </h2>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Sensor Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={sensorForm.name}
                      onChange={(e) => setSensorForm({ ...sensorForm, name: e.target.value })}
                      className="input w-full"
                      placeholder="e.g., Temperature Sensor 1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Model <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={sensorForm.model}
                      onChange={(e) => setSensorForm({ ...sensorForm, model: e.target.value })}
                      className="input w-full"
                      placeholder="e.g., CL110"
                    />
                  </div>
                </div>

                {/* Vendor and Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Vendor</label>
                    <select
                      value={sensorForm.vendor}
                      onChange={(e) => setSensorForm({ ...sensorForm, vendor: e.target.value })}
                      className="input w-full"
                    >
                      <option value="schneider">Schneider Electric</option>
                      <option value="abb">ABB</option>
                      <option value="siemens">Siemens</option>
                      <option value="bosch">Bosch</option>
                      <option value="eaton">Eaton</option>
                      <option value="generic">Generic</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">{t('sensors.sensorType')}</label>
                    <select
                      value={sensorForm.sensorType}
                      onChange={(e) => setSensorForm({ ...sensorForm, sensorType: e.target.value })}
                      className="input w-full"
                    >
                      {sensorTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Protocol and Serial */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">{t('sensors.protocol')}</label>
                    <select
                      value={sensorForm.protocol}
                      onChange={(e) => setSensorForm({ ...sensorForm, protocol: e.target.value })}
                      className="input w-full"
                    >
                      {protocolOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Serial Number</label>
                    <input
                      type="text"
                      value={sensorForm.serialNumber}
                      onChange={(e) => setSensorForm({ ...sensorForm, serialNumber: e.target.value })}
                      className="input w-full"
                      placeholder="e.g., SN-12345"
                    />
                  </div>
                </div>

                {/* Asset Assignment */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Assign to Asset</label>
                  <select
                    value={sensorForm.assignedAssetId}
                    onChange={(e) => setSensorForm({ ...sensorForm, assignedAssetId: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">-- Select Asset --</option>
                    {mockAssets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name} ({asset.tag})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Location and Calibration */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Location</label>
                    <input
                      type="text"
                      value={sensorForm.location}
                      onChange={(e) => setSensorForm({ ...sensorForm, location: e.target.value })}
                      className="input w-full"
                      placeholder="e.g., Building A, Panel 1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">{t('sensors.calibrationDate')}</label>
                    <input
                      type="date"
                      value={sensorForm.calibrationDate}
                      onChange={(e) => setSensorForm({ ...sensorForm, calibrationDate: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">{t('common.notes')}</label>
                  <textarea
                    value={sensorForm.notes}
                    onChange={(e) => setSensorForm({ ...sensorForm, notes: e.target.value })}
                    className="input w-full h-20 resize-none"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-outline"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleAddSensor}
                  disabled={addSensorMutation.isPending}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {addSensorMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {t('sensors.addSensor')}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sensor Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedSensor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowDetailModal(false);
              setIsEditing(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      selectedSensor.isOnline ? 'bg-green-500/20' : 'bg-red-500/20'
                    )}>
                      {(() => {
                        const TypeIcon = sensorTypeIcons[selectedSensor.sensorType] || Radio;
                        return <TypeIcon className={clsx(
                          'w-6 h-6',
                          selectedSensor.isOnline ? 'text-green-400' : 'text-red-400'
                        )} />;
                      })()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold text-white">{selectedSensor.name}</h2>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium capitalize"
                          style={{
                            backgroundColor: `${vendorColors[selectedSensor.vendor]}20`,
                            color: vendorColors[selectedSensor.vendor],
                          }}
                        >
                          {selectedSensor.vendor}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">{selectedSensor.model}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing && (
                      <>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="btn btn-outline btn-sm flex items-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="btn btn-outline btn-sm flex items-center gap-2 text-red-400 border-red-400/50 hover:bg-red-400/10"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setShowDetailModal(false);
                        setIsEditing(false);
                      }}
                      className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {isEditing ? (
                  /* Edit Form */
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-400 mb-2">Sensor Name</label>
                        <input
                          type="text"
                          value={sensorForm.name}
                          onChange={(e) => setSensorForm({ ...sensorForm, name: e.target.value })}
                          className="input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-2">Model</label>
                        <input
                          type="text"
                          value={sensorForm.model}
                          onChange={(e) => setSensorForm({ ...sensorForm, model: e.target.value })}
                          className="input w-full"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-400 mb-2">Vendor</label>
                        <select
                          value={sensorForm.vendor}
                          onChange={(e) => setSensorForm({ ...sensorForm, vendor: e.target.value })}
                          className="input w-full"
                        >
                          <option value="schneider">Schneider Electric</option>
                          <option value="abb">ABB</option>
                          <option value="siemens">Siemens</option>
                          <option value="bosch">Bosch</option>
                          <option value="eaton">Eaton</option>
                          <option value="generic">Generic</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-2">Sensor Type</label>
                        <select
                          value={sensorForm.sensorType}
                          onChange={(e) => setSensorForm({ ...sensorForm, sensorType: e.target.value })}
                          className="input w-full"
                        >
                          {sensorTypeOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-400 mb-2">Protocol</label>
                        <select
                          value={sensorForm.protocol}
                          onChange={(e) => setSensorForm({ ...sensorForm, protocol: e.target.value })}
                          className="input w-full"
                        >
                          {protocolOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-2">Assign to Asset</label>
                        <select
                          value={sensorForm.assignedAssetId}
                          onChange={(e) => setSensorForm({ ...sensorForm, assignedAssetId: e.target.value })}
                          className="input w-full"
                        >
                          <option value="">-- Select Asset --</option>
                          {mockAssets.map((asset) => (
                            <option key={asset.id} value={asset.id}>
                              {asset.name} ({asset.tag})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-400 mb-2">Location</label>
                        <input
                          type="text"
                          value={sensorForm.location}
                          onChange={(e) => setSensorForm({ ...sensorForm, location: e.target.value })}
                          className="input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-2">Calibration Date</label>
                        <input
                          type="date"
                          value={sensorForm.calibrationDate}
                          onChange={(e) => setSensorForm({ ...sensorForm, calibrationDate: e.target.value })}
                          className="input w-full"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Notes</label>
                      <textarea
                        value={sensorForm.notes}
                        onChange={(e) => setSensorForm({ ...sensorForm, notes: e.target.value })}
                        className="input w-full h-20 resize-none"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="btn btn-outline"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdateSensor}
                        disabled={updateSensorMutation.isPending}
                        className="btn btn-primary flex items-center gap-2"
                      >
                        {updateSensorMutation.isPending ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Detail View */
                  <div className="space-y-6">
                    {/* Status Cards */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                        <div className={clsx(
                          'w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center',
                          selectedSensor.isOnline ? 'bg-green-500/20' : 'bg-red-500/20'
                        )}>
                          {selectedSensor.isOnline ? (
                            <Wifi className="w-5 h-5 text-green-400" />
                          ) : (
                            <WifiOff className="w-5 h-5 text-red-400" />
                          )}
                        </div>
                        <p className={clsx(
                          'font-medium',
                          selectedSensor.isOnline ? 'text-green-400' : 'text-red-400'
                        )}>
                          {selectedSensor.isOnline ? 'Online' : 'Offline'}
                        </p>
                        <p className="text-xs text-slate-500">Status</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                        <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center bg-blue-500/20">
                          <Battery className={clsx(
                            'w-5 h-5',
                            selectedSensor.batteryLevel > 50 ? 'text-green-400' :
                              selectedSensor.batteryLevel > 20 ? 'text-amber-400' : 'text-red-400'
                          )} />
                        </div>
                        <p className="font-medium text-white font-mono">
                          {selectedSensor.batteryLevel || 'N/A'}%
                        </p>
                        <p className="text-xs text-slate-500">Battery</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                        <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center bg-purple-500/20">
                          <Signal className="w-5 h-5 text-purple-400" />
                        </div>
                        <p className="font-medium text-white font-mono">
                          {selectedSensor.signalStrength || 'N/A'}%
                        </p>
                        <p className="text-xs text-slate-500">Signal</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                        <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center bg-amber-500/20">
                          <BarChart3 className="w-5 h-5 text-amber-400" />
                        </div>
                        <p className="font-medium text-white">
                          {selectedSensor.lastReading?.value || 'N/A'}
                        </p>
                        <p className="text-xs text-slate-500">Last Reading</p>
                      </div>
                    </div>

                    {/* Sensor Details */}
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          Sensor Information
                        </h3>
                        <div className="space-y-3">
                          <DetailRow label="Sensor Type" value={selectedSensor.sensorType?.replace('_', ' ')} />
                          <DetailRow label="Protocol" value={selectedSensor.protocol?.replace('_', ' ').toUpperCase()} />
                          <DetailRow label="Serial Number" value={selectedSensor.serialNumber || 'N/A'} />
                          <DetailRow label="Firmware" value={selectedSensor.firmwareVersion || 'N/A'} />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Assignment & Location
                        </h3>
                        <div className="space-y-3">
                          <DetailRow label="Assigned Asset" value={selectedSensor.assignedAssetName || 'Not assigned'} />
                          <DetailRow label="Location" value={selectedSensor.location || 'Not specified'} />
                          <DetailRow label="Gateway" value={selectedSensor.gateway || 'N/A'} />
                          <DetailRow
                            label="Calibration Date"
                            value={selectedSensor.calibrationDate
                              ? new Date(selectedSensor.calibrationDate).toLocaleDateString()
                              : 'N/A'}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Last Reading Details */}
                    {selectedSensor.lastReading && (
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Last Reading
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-slate-500">Value</p>
                            <p className="text-lg font-mono text-white">
                              {selectedSensor.lastReading.value} {selectedSensor.lastReading.unit}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Timestamp</p>
                            <p className="text-sm text-slate-300">
                              {new Date(selectedSensor.lastReadingAt).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Quality</p>
                            <p className="text-sm text-green-400">Good</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {selectedSensor.notes && (
                      <div>
                        <h3 className="text-sm font-medium text-slate-400 mb-2">Notes</h3>
                        <p className="text-sm text-slate-300 bg-slate-800/50 rounded-lg p-3">
                          {selectedSensor.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && selectedSensor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Delete Sensor?</h3>
                <p className="text-slate-400 mb-6">
                  Are you sure you want to delete "{selectedSensor.name}"? This action cannot be undone.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteSensor}
                    disabled={deleteSensorMutation.isPending}
                    className="btn bg-red-500 hover:bg-red-600 text-white flex items-center gap-2"
                  >
                    {deleteSensorMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete Sensor
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper component
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm text-white capitalize">{value}</span>
    </div>
  );
}
