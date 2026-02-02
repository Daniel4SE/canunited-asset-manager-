import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Settings,
  User,
  Building2,
  Bell,
  Shield,
  Palette,
  Globe,
  Key,
  Save,
  Link2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { getApi, endpoints } from '../lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'organization', label: 'Organization', icon: Building2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary-500" />
          Settings
        </h1>
        <p className="text-slate-400 mt-1">Manage your account and preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
                    activeTab === tab.id
                      ? 'bg-primary-500/10 text-primary-400 border-l-2 border-primary-500'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="card p-6"
          >
            {activeTab === 'profile' && <ProfileTab user={user} />}
            {activeTab === 'organization' && <OrganizationTab />}
            {activeTab === 'notifications' && <NotificationsTab />}
            {activeTab === 'integrations' && <IntegrationsTab />}
            {activeTab === 'security' && <SecurityTab />}
            {activeTab === 'appearance' && <AppearanceTab />}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ user }: { user: any }) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  const handleSave = () => {
    toast.success('Profile updated');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Profile Information</h2>
        <p className="text-sm text-slate-400">Update your personal details</p>
      </div>

      <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg">
        <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-emerald-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
          {user?.name?.charAt(0) || 'U'}
        </div>
        <div>
          <p className="font-medium text-white">{user?.name}</p>
          <p className="text-sm text-slate-400">{user?.role}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-400 mb-2">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input w-full"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} className="btn btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>
    </div>
  );
}

function OrganizationTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Organization Settings</h2>
        <p className="text-sm text-slate-400">Manage organization details and preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-400 mb-2">Organization Name</label>
          <input
            type="text"
            defaultValue="CANUnited Demo Corp"
            className="input w-full"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-2">Subscription</label>
          <input
            type="text"
            value="Enterprise"
            disabled
            className="input w-full opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-2">Timezone</label>
          <select className="input w-full">
            <option>Asia/Singapore</option>
            <option>UTC</option>
            <option>America/New_York</option>
            <option>Europe/London</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-2">Language</label>
          <select className="input w-full">
            <option>English</option>
            <option>中文</option>
            <option>日本語</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [criticalOnly, setCriticalOnly] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Notification Preferences</h2>
        <p className="text-sm text-slate-400">Configure how you receive alerts</p>
      </div>

      <div className="space-y-4">
        <ToggleOption
          label="Email Notifications"
          description="Receive alerts via email"
          enabled={emailEnabled}
          onChange={setEmailEnabled}
        />
        <ToggleOption
          label="Push Notifications"
          description="Receive push notifications in browser"
          enabled={pushEnabled}
          onChange={setPushEnabled}
        />
        <ToggleOption
          label="Critical Alerts Only"
          description="Only receive critical severity alerts"
          enabled={criticalOnly}
          onChange={setCriticalOnly}
        />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-2">Alert Severities</label>
        <div className="flex flex-wrap gap-2">
          {['Critical', 'High', 'Medium', 'Low', 'Info'].map((level) => (
            <label
              key={level}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors"
            >
              <input type="checkbox" defaultChecked className="rounded" />
              <span className="text-sm text-slate-300">{level}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>
    </div>
  );
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  lastUsed: string;
  created: string;
  permissions: string[];
}

function SecurityTab() {
  const { t } = useTranslation();
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [showSsoConfig, setShowSsoConfig] = useState(false);
  const [showLdapConfig, setShowLdapConfig] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [mfaSecret, setMfaSecret] = useState<{ qrCodeUrl: string; secret: string; backupCodes: string[] } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    { id: '1', name: 'Production API Key', key: 'sk_live_canunited_prod_a1b2c3d4e5f6', lastUsed: '2 hours ago', created: 'Jan 15, 2026', permissions: ['read:assets', 'read:sensors'] },
    { id: '2', name: 'Development Key', key: 'sk_live_canunited_dev_x9y8z7w6v5u4', lastUsed: '5 days ago', created: 'Dec 10, 2025', permissions: ['read:assets', 'write:assets'] },
  ]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyExpiry, setNewKeyExpiry] = useState('90');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['read:assets', 'read:sensors']);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  // Mock MFA setup
  const handleSetupMfa = async () => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    setMfaSecret({
      qrCodeUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAFl0lEQVR4nO3dQW7jMBAAwfz/0+sNvCzFISkq3dUAchDLHo3s9eft7e3tDSD05e8HAH5PACBMACAMACAsABAWAAgLAIQFAMICAGEBgLAAQFgAICwAEBYACAsAhAUAwgIAYQGAsABAWAAgLAAQFgAICwCEBQDCAgBhAYCwAEBYACAsABAWAAgLAIQFAMICAGEBgLAAQFgAICwAEBYACAsAhAUAwgIAYQGAsABAWAAgLAAQ/vrtJ8DNfL5fP36K/yAOAh9/y9/j37AAQFgAICwAEBYACH+K6m38+9wE/l0cAD7+ln/HAgBhAYCwAEBYACA=',
      secret: 'JBSWY3DPEHPK3PXP',
      backupCodes: ['1234-5678', 'ABCD-EFGH', '9876-5432', 'WXYZ-1234', 'QWER-TYUI', 'ASDF-GHJK', 'ZXCV-BNML', '2468-1357', '1357-2468', 'POIU-YTREW'],
    });
    setShowMfaSetup(true);
  };

  const handleVerifyMfa = async () => {
    if (verificationCode.length === 6) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setMfaEnabled(true);
      setShowMfaSetup(false);
      toast.success(t('security.mfaEnabled'));
    } else {
      toast.error(t('security.invalidCode'));
    }
  };

  const handleDisableMfa = () => {
    setMfaEnabled(false);
    setMfaSecret(null);
    toast.success(t('security.mfaDisabled'));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">{t('security.title')}</h2>
        <p className="text-sm text-slate-400">{t('security.subtitle')}</p>
      </div>

      {/* Change Password */}
      <div className="p-4 bg-slate-800/50 rounded-lg">
        <div className="flex items-center gap-3 mb-4">
          <Key className="w-5 h-5 text-slate-400" />
          <h3 className="font-medium text-white">{t('security.changePassword')}</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">{t('security.currentPassword')}</label>
            <input type="password" className="input w-full" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">{t('security.newPassword')}</label>
            <input type="password" className="input w-full" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">{t('security.confirmPassword')}</label>
            <input type="password" className="input w-full" />
          </div>
          <button className="btn btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            {t('security.updatePassword')}
          </button>
        </div>
      </div>

      {/* MFA Section */}
      <div className="p-4 bg-slate-800/50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary-400" />
            <div>
              <h3 className="font-medium text-white">{t('security.mfa')}</h3>
              <p className="text-sm text-slate-400">{t('security.mfaDescription')}</p>
            </div>
          </div>
          {mfaEnabled ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                <CheckCircle className="w-3 h-3" />
                {t('security.enabled')}
              </span>
              <button onClick={handleDisableMfa} className="btn btn-outline text-red-400 hover:bg-red-500/10">
                {t('security.disable')}
              </button>
            </div>
          ) : (
            <button onClick={handleSetupMfa} className="btn btn-primary">
              {t('security.enable')}
            </button>
          )}
        </div>
      </div>

      {/* SSO Configuration */}
      <div className="p-4 bg-slate-800/50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-medium text-white">{t('security.sso')}</h3>
              <p className="text-sm text-slate-400">{t('security.ssoDescription')}</p>
            </div>
          </div>
          <button onClick={() => setShowSsoConfig(true)} className="btn btn-outline">
            {t('common.configure')}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <SsoProviderCard provider="google" name="Google" connected={false} />
          <SsoProviderCard provider="microsoft" name="Microsoft Azure AD" connected={false} />
          <SsoProviderCard provider="okta" name="Okta" connected={false} />
          <SsoProviderCard provider="saml" name="SAML 2.0" connected={false} />
        </div>
      </div>

      {/* LDAP Configuration */}
      <div className="p-4 bg-slate-800/50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="font-medium text-white">{t('security.ldap')}</h3>
              <p className="text-sm text-slate-400">{t('security.ldapDescription')}</p>
            </div>
          </div>
          <button onClick={() => setShowLdapConfig(true)} className="btn btn-outline">
            {t('common.configure')}
          </button>
        </div>
      </div>

      {/* API Keys */}
      <div className="p-4 bg-slate-800/50 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-medium text-white">{t('security.apiKeys')}</h3>
              <p className="text-sm text-slate-400">{t('security.apiKeysDescription')}</p>
            </div>
          </div>
          <button onClick={() => setShowApiKeyModal(true)} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t('security.createApiKey')}
          </button>
        </div>
        <div className="space-y-2">
          {apiKeys.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">{t('security.noApiKeys') || 'No API keys yet'}</p>
          ) : (
            apiKeys.map((apiKey) => (
              <ApiKeyRow
                key={apiKey.id}
                name={apiKey.name}
                keyValue={apiKey.key}
                lastUsed={apiKey.lastUsed}
                created={apiKey.created}
                onDelete={() => {
                  setApiKeys(apiKeys.filter((k) => k.id !== apiKey.id));
                  toast.success(t('security.apiKeyDeleted') || 'API key deleted');
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* MFA Setup Modal */}
      {showMfaSetup && mfaSecret && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">{t('security.setupMfa')}</h2>

            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-slate-400 mb-4">{t('security.scanQrCode')}</p>
                <div className="bg-white p-4 rounded-lg inline-block">
                  <img src={mfaSecret.qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-400 mb-2">{t('security.manualEntry')}</p>
                <code className="block p-2 bg-slate-800 rounded text-center text-sm font-mono text-primary-400">
                  {mfaSecret.secret}
                </code>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('security.verificationCode')}</label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="input w-full text-center text-2xl tracking-widest font-mono"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-400 mb-2">{t('security.backupCodesWarning')}</p>
                <div className="grid grid-cols-2 gap-1 text-xs font-mono text-slate-300">
                  {mfaSecret.backupCodes.map((code, i) => (
                    <span key={i}>{code}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowMfaSetup(false)} className="btn btn-outline">
                {t('common.cancel')}
              </button>
              <button onClick={handleVerifyMfa} className="btn btn-primary">
                {t('security.verifyAndEnable')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SSO Configuration Modal */}
      {showSsoConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-white mb-4">{t('security.configureSso')}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('security.ssoProvider')}</label>
                <select className="input w-full">
                  <option value="oidc">OpenID Connect (OIDC)</option>
                  <option value="saml">SAML 2.0</option>
                  <option value="google">Google Workspace</option>
                  <option value="azure">Microsoft Azure AD</option>
                  <option value="okta">Okta</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('security.clientId')}</label>
                <input type="text" className="input w-full" placeholder="your-client-id" />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('security.clientSecret')}</label>
                <input type="password" className="input w-full" placeholder="••••••••••••" />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('security.issuerUrl')}</label>
                <input type="url" className="input w-full" placeholder="https://accounts.google.com" />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('security.redirectUri')}</label>
                <input
                  type="url"
                  className="input w-full bg-slate-800/50"
                  value="https://app.canunited.com/api/v1/auth/sso/callback"
                  disabled
                />
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-xs text-blue-400">
                  {t('security.ssoHelp')}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowSsoConfig(false)} className="btn btn-outline">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  toast.success(t('security.ssoSaved'));
                  setShowSsoConfig(false);
                }}
                className="btn btn-primary"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LDAP Configuration Modal */}
      {showLdapConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-white mb-4">{t('security.configureLdap')}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('security.ldapUrl')}</label>
                <input type="url" className="input w-full" placeholder="ldaps://ldap.example.com:636" />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('security.baseDn')}</label>
                <input type="text" className="input w-full" placeholder="dc=example,dc=com" />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('security.bindDn')}</label>
                <input type="text" className="input w-full" placeholder="cn=admin,dc=example,dc=com" />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('security.bindPassword')}</label>
                <input type="password" className="input w-full" />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('security.userSearchFilter')}</label>
                <input type="text" className="input w-full" placeholder="(sAMAccountName={{username}})" />
              </div>

              <ToggleOption
                label={t('security.useTls')}
                description={t('security.useTlsDescription')}
                enabled={true}
                onChange={() => {}}
              />
            </div>

            <div className="flex justify-between mt-6">
              <button className="btn btn-outline">{t('security.testConnection')}</button>
              <div className="flex gap-3">
                <button onClick={() => setShowLdapConfig(false)} className="btn btn-outline">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => {
                    toast.success(t('security.ldapSaved'));
                    setShowLdapConfig(false);
                  }}
                  className="btn btn-primary"
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">{t('security.createApiKey')}</h2>

            {newlyCreatedKey ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <p className="text-sm text-emerald-400 mb-2">{t('security.keyCreatedSuccess') || 'Your API key has been created. Copy it now - you won\'t be able to see it again!'}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-slate-800 rounded text-sm font-mono text-primary-400 break-all">
                      {newlyCreatedKey}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newlyCreatedKey);
                        toast.success(t('security.keyCopied') || 'Key copied to clipboard');
                      }}
                      className="btn btn-outline text-xs px-2 py-1"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setShowApiKeyModal(false);
                      setNewlyCreatedKey(null);
                      setNewKeyName('');
                    }}
                    className="btn btn-primary"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">{t('security.keyName')}</label>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="My API Key"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">{t('security.keyExpiry')}</label>
                    <select
                      className="input w-full"
                      value={newKeyExpiry}
                      onChange={(e) => setNewKeyExpiry(e.target.value)}
                    >
                      <option value="30">{t('security.days30')}</option>
                      <option value="90">{t('security.days90')}</option>
                      <option value="365">{t('security.days365')}</option>
                      <option value="never">{t('security.neverExpires')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">{t('security.permissions')}</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={newKeyPermissions.includes('read:assets')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewKeyPermissions([...newKeyPermissions, 'read:assets']);
                            } else {
                              setNewKeyPermissions(newKeyPermissions.filter((p) => p !== 'read:assets'));
                            }
                          }}
                          className="rounded"
                        />
                        {t('security.readAssets')}
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={newKeyPermissions.includes('write:assets')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewKeyPermissions([...newKeyPermissions, 'write:assets']);
                            } else {
                              setNewKeyPermissions(newKeyPermissions.filter((p) => p !== 'write:assets'));
                            }
                          }}
                          className="rounded"
                        />
                        {t('security.writeAssets')}
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={newKeyPermissions.includes('read:sensors')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewKeyPermissions([...newKeyPermissions, 'read:sensors']);
                            } else {
                              setNewKeyPermissions(newKeyPermissions.filter((p) => p !== 'read:sensors'));
                            }
                          }}
                          className="rounded"
                        />
                        {t('security.readSensors')}
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={newKeyPermissions.includes('write:maintenance')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewKeyPermissions([...newKeyPermissions, 'write:maintenance']);
                            } else {
                              setNewKeyPermissions(newKeyPermissions.filter((p) => p !== 'write:maintenance'));
                            }
                          }}
                          className="rounded"
                        />
                        {t('security.writeMaintenance')}
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowApiKeyModal(false);
                      setNewKeyName('');
                      setNewKeyPermissions(['read:assets', 'read:sensors']);
                    }}
                    className="btn btn-outline"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={() => {
                      if (!newKeyName.trim()) {
                        toast.error(t('security.keyNameRequired') || 'Please enter a key name');
                        return;
                      }
                      // Generate a random key
                      const randomPart = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                      const generatedKey = `sk_live_canunited_${randomPart}`;

                      // Add to list
                      const newKey: ApiKey = {
                        id: Date.now().toString(),
                        name: newKeyName,
                        key: generatedKey,
                        lastUsed: 'Never',
                        created: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        permissions: newKeyPermissions,
                      };
                      setApiKeys([...apiKeys, newKey]);
                      setNewlyCreatedKey(generatedKey);
                      toast.success(t('security.apiKeyCreated'));
                    }}
                    className="btn btn-primary"
                  >
                    {t('security.generate')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SsoProviderCard({ provider, name, connected }: { provider: string; name: string; connected: boolean }) {
  const icons: Record<string, string> = {
    google: '🔵',
    microsoft: '🟦',
    okta: '🟠',
    saml: '🔐',
  };

  return (
    <div
      className={clsx(
        'p-3 rounded-lg border transition-colors cursor-pointer',
        connected
          ? 'bg-emerald-500/10 border-emerald-500/50'
          : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600'
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{icons[provider]}</span>
        <span className="text-sm text-white">{name}</span>
      </div>
      {connected && (
        <span className="text-xs text-emerald-400 mt-1 block">Connected</span>
      )}
    </div>
  );
}

function ApiKeyRow({ name, keyValue, lastUsed, created, onDelete }: { name: string; keyValue: string; lastUsed: string; created: string; onDelete: () => void }) {
  const [showKey, setShowKey] = useState(false);
  const maskedKey = keyValue.substring(0, 12) + '••••••••••••••••••••';

  return (
    <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{name}</p>
        <p className="text-xs text-slate-500 font-mono">{showKey ? keyValue : maskedKey}</p>
        <p className="text-xs text-slate-500 mt-1">
          Last used: {lastUsed} • Created: {created}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowKey(!showKey)}
          className="btn btn-outline text-xs px-2 py-1"
        >
          {showKey ? 'Hide' : 'Show'}
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function IntegrationsTab() {
  const { t } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { data: integrations, refetch } = useQuery({
    queryKey: ['cmmsIntegrations'],
    queryFn: async () => {
      const response = await getApi().get(endpoints.cmmsIntegrations);
      return response.data.data;
    },
  });

  const handleSync = async (integrationId: string) => {
    setSyncingId(integrationId);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast.success(t('integrations.syncNow') + ' - Success');
      refetch();
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const handleTestConnection = async (integrationId: string) => {
    toast.loading('Testing connection...', { id: 'test-connection' });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    toast.success('Connection successful', { id: 'test-connection' });
  };

  const cmmsTypes = [
    { type: 'sap_pm', name: 'SAP Plant Maintenance', logo: '/sap.png' },
    { type: 'maximo', name: 'IBM Maximo', logo: '/maximo.png' },
    { type: 'servicenow', name: 'ServiceNow', logo: '/servicenow.png' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">{t('integrations.cmms')}</h2>
          <p className="text-sm text-slate-400">Connect to your CMMS for work order synchronization</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('integrations.addIntegration')}
        </button>
      </div>

      {/* Existing Integrations */}
      <div className="space-y-4">
        {(integrations || []).map((integration: any) => (
          <div
            key={integration.id}
            className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center">
                  <Link2 className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">{integration.name}</h3>
                  <p className="text-sm text-slate-400">
                    {cmmsTypes.find((c) => c.type === integration.type)?.name || integration.type}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {integration.isActive ? (
                  <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                    <CheckCircle className="w-3 h-3" />
                    {t('integrations.connected')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-1 bg-slate-500/20 text-slate-400 rounded text-xs">
                    <XCircle className="w-3 h-3" />
                    {t('integrations.disconnected')}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-700 pt-4">
              <div className="text-sm text-slate-400">
                {integration.lastSyncAt ? (
                  <span>
                    {t('integrations.lastSync')}: {new Date(integration.lastSyncAt).toLocaleString()}
                  </span>
                ) : (
                  <span>Never synced</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTestConnection(integration.id)}
                  className="btn btn-outline text-sm"
                >
                  {t('integrations.testConnection')}
                </button>
                <button
                  onClick={() => handleSync(integration.id)}
                  disabled={syncingId === integration.id}
                  className="btn btn-secondary text-sm flex items-center gap-2"
                >
                  <RefreshCw
                    className={clsx('w-4 h-4', syncingId === integration.id && 'animate-spin')}
                  />
                  {t('integrations.syncNow')}
                </button>
                <button className="btn btn-outline text-sm text-red-400 hover:bg-red-500/10">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Available CMMS Types */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 mb-3">Available Integrations</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cmmsTypes.map((cmms) => (
            <div
              key={cmms.type}
              className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:border-primary-500/50 transition-colors cursor-pointer"
              onClick={() => setShowAddModal(true)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="font-medium text-white">{cmms.name}</p>
                  <p className="text-xs text-slate-500">{cmms.type}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Integration Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">{t('integrations.addIntegration')}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('integrations.type')}</label>
                <select className="input w-full">
                  <option value="sap_pm">{t('integrations.sapPm')}</option>
                  <option value="maximo">{t('integrations.maximo')}</option>
                  <option value="servicenow">{t('integrations.servicenow')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('common.name')}</label>
                <input type="text" className="input w-full" placeholder="My SAP PM Integration" />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('integrations.apiUrl')}</label>
                <input type="url" className="input w-full" placeholder="https://sap-server.example.com/api" />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('integrations.username')}</label>
                <input type="text" className="input w-full" />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('integrations.password')}</label>
                <input type="password" className="input w-full" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="btn btn-outline">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  toast.success('Integration added');
                  setShowAddModal(false);
                  refetch();
                }}
                className="btn btn-primary"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AppearanceTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Appearance</h2>
        <p className="text-sm text-slate-400">Customize the look and feel</p>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-3">Theme</label>
        <div className="grid grid-cols-3 gap-4">
          <button className="p-4 bg-slate-800 rounded-lg border-2 border-primary-500 text-center">
            <div className="w-full h-12 bg-slate-950 rounded mb-2" />
            <span className="text-sm text-white">Dark</span>
          </button>
          <button className="p-4 bg-slate-800 rounded-lg border-2 border-transparent hover:border-slate-600 text-center">
            <div className="w-full h-12 bg-white rounded mb-2" />
            <span className="text-sm text-slate-400">Light</span>
          </button>
          <button className="p-4 bg-slate-800 rounded-lg border-2 border-transparent hover:border-slate-600 text-center">
            <div className="w-full h-12 bg-gradient-to-r from-slate-950 to-white rounded mb-2" />
            <span className="text-sm text-slate-400">System</span>
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-3">Accent Color</label>
        <div className="flex gap-3">
          {['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444'].map((color) => (
            <button
              key={color}
              className={clsx(
                'w-10 h-10 rounded-lg transition-transform hover:scale-110',
                color === '#22c55e' && 'ring-2 ring-white ring-offset-2 ring-offset-slate-900'
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ToggleOption({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
      <div>
        <h3 className="font-medium text-white">{label}</h3>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={clsx(
          'w-12 h-6 rounded-full transition-colors relative',
          enabled ? 'bg-primary-500' : 'bg-slate-600'
        )}
      >
        <span
          className={clsx(
            'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
            enabled ? 'translate-x-7' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}
