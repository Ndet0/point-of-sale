import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import toast from 'react-hot-toast';
import {
  Settings,
  Clock,
  Percent,
  DollarSign,
  Shield,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Store,
  Copy,
  Check,
} from 'lucide-react';

interface BusinessSettings {
  id: string;
  saleTimeoutMode: 'fixed' | 'pickup_window';
  saleTimeoutMinutes: number;
  pickupWindowStart: string;
  pickupWindowEnd: string;
  allowManualPaymentOverride: boolean;
  taxRate: number;
  currency: string;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data.data as BusinessSettings;
    },
  });

  // Form state
  const [formData, setFormData] = useState<Partial<BusinessSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Update form when settings load
  useState(() => {
    if (settings) {
      setFormData(settings);
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<BusinessSettings>) => {
      const response = await api.put('/settings', data);
      return response.data.data;
    },
    onSuccess: () => {
      toast.success('Settings saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setHasChanges(false);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to save settings';
      toast.error(message);
    },
  });

  const handleChange = (field: keyof BusinessSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const currentSettings = settings || {
    saleTimeoutMode: 'fixed',
    saleTimeoutMinutes: 30,
    pickupWindowStart: '08:00',
    pickupWindowEnd: '20:00',
    allowManualPaymentOverride: true,
    taxRate: 0.16,
    currency: 'KES',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Business Settings</h1>
              <p className="text-sm text-gray-500">Configure your point of sale system</p>
            </div>
          </div>
          {hasChanges && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Unsaved changes</span>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business Information */}
          <BusinessInfoSection />

          {/* Sales & Timeout Settings */}
          <section className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Sales Timeout Configuration</h2>
            </div>

            <div className="space-y-6">
              {/* Timeout Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Timeout Mode
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleChange('saleTimeoutMode', 'fixed')}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      (formData.saleTimeoutMode ?? currentSettings.saleTimeoutMode) === 'fixed'
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900">Fixed Timeout</div>
                    <div className="text-sm text-gray-500 mt-1">
                      Sales expire after a set number of minutes
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('saleTimeoutMode', 'pickup_window')}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      (formData.saleTimeoutMode ?? currentSettings.saleTimeoutMode) === 'pickup_window'
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900">Pickup Window</div>
                    <div className="text-sm text-gray-500 mt-1">
                      Sales expire at the end of the pickup window
                    </div>
                  </button>
                </div>
              </div>

              {/* Timeout Minutes (only for fixed mode) */}
              {(formData.saleTimeoutMode ?? currentSettings.saleTimeoutMode) === 'fixed' && (
                <div>
                  <label htmlFor="timeoutMinutes" className="block text-sm font-medium text-gray-700 mb-2">
                    Timeout Duration (minutes)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      id="timeoutMinutes"
                      min="1"
                      max="120"
                      value={formData.saleTimeoutMinutes ?? currentSettings.saleTimeoutMinutes}
                      onChange={(e) => handleChange('saleTimeoutMinutes', parseInt(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="w-16 text-center font-medium text-gray-900">
                      {formData.saleTimeoutMinutes ?? currentSettings.saleTimeoutMinutes}m
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Sales will automatically expire after this duration if not paid
                  </p>
                </div>
              )}

              {/* Pickup Window Times (only for pickup_window mode) */}
              {(formData.saleTimeoutMode ?? currentSettings.saleTimeoutMode) === 'pickup_window' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="pickupStart" className="block text-sm font-medium text-gray-700 mb-2">
                      Pickup Window Start
                    </label>
                    <input
                      type="time"
                      id="pickupStart"
                      value={formData.pickupWindowStart ?? currentSettings.pickupWindowStart}
                      onChange={(e) => handleChange('pickupWindowStart', e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="pickupEnd" className="block text-sm font-medium text-gray-700 mb-2">
                      Pickup Window End
                    </label>
                    <input
                      type="time"
                      id="pickupEnd"
                      value={formData.pickupWindowEnd ?? currentSettings.pickupWindowEnd}
                      onChange={(e) => handleChange('pickupWindowEnd', e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Tax & Currency Settings */}
          <section className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Percent className="w-4 h-4 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Tax & Currency</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tax Rate */}
              <div>
                <label htmlFor="taxRate" className="block text-sm font-medium text-gray-700 mb-2">
                  Tax Rate (%)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    id="taxRate"
                    min="0"
                    max="30"
                    step="0.5"
                    value={((formData.taxRate ?? currentSettings.taxRate) * 100)}
                    onChange={(e) => handleChange('taxRate', parseFloat(e.target.value) / 100)}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                  />
                  <span className="w-16 text-center font-medium text-gray-900">
                    {((formData.taxRate ?? currentSettings.taxRate) * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Applied to all sales automatically
                </p>
              </div>

              {/* Currency */}
              <div>
                <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-2">
                  Currency Code
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    id="currency"
                    value={formData.currency ?? currentSettings.currency}
                    onChange={(e) => handleChange('currency', e.target.value.toUpperCase())}
                    maxLength={3}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono uppercase"
                    placeholder="KES"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  3-letter currency code (e.g., KES, USD)
                </p>
              </div>
            </div>
          </section>

          {/* Payment Override Settings */}
          <section className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-purple-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Payment Override Policy</h2>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">Allow Manual Payment Override</div>
                <p className="text-sm text-gray-500 mt-1">
                  Allow cashiers to manually confirm M-PESA payments when the system is unavailable
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleChange('allowManualPaymentOverride', !(formData.allowManualPaymentOverride ?? currentSettings.allowManualPaymentOverride))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  (formData.allowManualPaymentOverride ?? currentSettings.allowManualPaymentOverride)
                    ? 'bg-purple-600'
                    : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    (formData.allowManualPaymentOverride ?? currentSettings.allowManualPaymentOverride)
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-gray-500">
              {hasChanges ? (
                <span className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="w-4 h-4" />
                  You have unsaved changes
                </span>
              ) : (
                <span className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  All settings saved
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!hasChanges || updateMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-semibold py-3 px-6 rounded-lg flex items-center gap-2 transition-colors"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

// Business Info Section Component
function BusinessInfoSection() {
  const user = useAuthStore((state) => state.user);
  const [copied, setCopied] = useState(false);

  // Fetch user info from API if not in store
  const { data: userData } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const response = await api.get('/auth/me');
      return response.data.data;
    },
    enabled: !user?.businessId, // only fetch if businessId is missing
  });

  const currentUser = user || userData;

  const copyToClipboard = () => {
    if (currentUser?.businessId) {
      navigator.clipboard.writeText(currentUser.businessId);
      setCopied(true);
      toast.success('Business ID copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!currentUser) {
    return (
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
          <Store className="w-4 h-4 text-indigo-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Business Information</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Business ID
          </label>
          <div className="flex items-center gap-3">
            <div className="flex-1 px-4 py-3 bg-gray-50 border rounded-lg font-mono text-sm text-gray-700">
              {currentUser.businessId || 'Not available'}
            </div>
            <button
              type="button"
              onClick={copyToClipboard}
              disabled={!currentUser.businessId}
              className="px-4 py-3 bg-indigo-100 hover:bg-indigo-200 disabled:bg-gray-100 text-indigo-700 disabled:text-gray-400 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Share this Business ID with your cashiers so they can log in. They will also need their email and password.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Role
            </label>
            <div className="px-3 py-2 bg-gray-50 border rounded-lg text-sm text-gray-700">
              {currentUser.role}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User ID
            </label>
            <div className="px-3 py-2 bg-gray-50 border rounded-lg font-mono text-xs text-gray-700 truncate">
              {currentUser.id}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
