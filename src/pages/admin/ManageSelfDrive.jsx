import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { selfDriveConfigService } from '../../services/allServices'
import AdminLayout from '../../components/layout/AdminLayout'
import { CAR_CATEGORIES } from '../../utils/constants'
import { formatCurrency } from '../../utils/helpers'
import { FiPlus, FiEdit2, FiTrash2, FiX, FiSave, FiCompass } from 'react-icons/fi'

const EMPTY = {
  carCategory: '', securityDeposit: '', freeKmPerDay: '', overageRatePerKm: '',
  lateReturnPenaltyPerHour: '', refundWindowDays: '', enabled: true,
}

const categoryLabel = (value) => CAR_CATEGORIES.find(c => c.value === value)?.label || value

export default function ManageSelfDrive() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ defaultValues: EMPTY })
  const [configs, setConfigs]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => { fetchConfigs() }, [])

  const fetchConfigs = async () => {
    setLoading(true)
    try {
      const res = await selfDriveConfigService.getAll()
      setConfigs(res.data.data || [])
    } catch {
      toast.error('Failed to load self-drive settings.')
    } finally {
      setLoading(false)
    }
  }

  // Only categories that don't already have a config can be added fresh — one row per
  // category, matches the unique constraint enforced on the backend.
  const configuredCategories = new Set(configs.map(c => c.carCategory))
  const availableCategories  = CAR_CATEGORIES.filter(c => !configuredCategories.has(c.value))

  const openAdd = () => { setEditing(null); reset(EMPTY); setShowForm(true) }
  const openEdit = (config) => {
    setEditing(config)
    reset({
      carCategory: config.carCategory,
      securityDeposit: config.securityDeposit,
      freeKmPerDay: config.freeKmPerDay,
      overageRatePerKm: config.overageRatePerKm ?? '',
      lateReturnPenaltyPerHour: config.lateReturnPenaltyPerHour,
      refundWindowDays: config.refundWindowDays,
      enabled: config.enabled,
    })
    setShowForm(true)
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      const payload = {
        carCategory: data.carCategory,
        securityDeposit: Number(data.securityDeposit),
        freeKmPerDay: Number(data.freeKmPerDay),
        overageRatePerKm: data.overageRatePerKm !== '' ? Number(data.overageRatePerKm) : null,
        lateReturnPenaltyPerHour: Number(data.lateReturnPenaltyPerHour),
        refundWindowDays: Number(data.refundWindowDays),
        enabled: data.enabled === true || data.enabled === 'true',
      }
      const res = editing
        ? await selfDriveConfigService.update(editing.configId, payload)
        : await selfDriveConfigService.create(payload)
      if (res.data.success) {
        toast.success(editing ? 'Self-drive settings updated!' : 'Self-drive settings created!')
        setShowForm(false)
        fetchConfigs()
      } else {
        toast.error(res.data.message || 'Failed to save.')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save self-drive settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (configId) => {
    if (!window.confirm('Delete self-drive settings for this category? Customers will no longer be able to book it self-drive.')) return
    setDeleting(configId)
    try {
      await selfDriveConfigService.delete(configId)
      toast.success('Self-drive settings deleted.')
      fetchConfigs()
    } catch {
      toast.error('Failed to delete.')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded-2xl" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <FiCompass className="text-orange-500" /> Self-Drive Settings
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Security deposit, free km/day, overage rate, late-return penalty and refund window —
            per car category. Nothing here is hardcoded; the booking flow reads these values live.
          </p>
        </div>
        {availableCategories.length > 0 && (
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 px-4 py-2.5">
            <FiPlus size={16} /> Add Category Config
          </button>
        )}
      </div>

      {configs.length === 0 ? (
        <div className="text-center py-20 card">
          <p className="text-5xl mb-4">🚗</p>
          <p className="text-xl font-bold text-gray-700 mb-2">Self-drive isn't configured yet</p>
          <p className="text-gray-500 text-sm mb-4">Set a deposit and km limit for at least one category to enable self-drive bookings.</p>
          <button onClick={openAdd} className="btn-primary px-6 py-2.5 mt-2">Configure your first category</button>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase border-b border-gray-100">
                <th className="pb-3">Category</th>
                <th className="pb-3">Security Deposit</th>
                <th className="pb-3">Free KM/Day</th>
                <th className="pb-3">Overage Rate</th>
                <th className="pb-3">Late Penalty/hr</th>
                <th className="pb-3">Refund Window</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.map(c => (
                <tr key={c.configId} className="border-b border-gray-50">
                  <td className="py-3 font-bold text-gray-800">{categoryLabel(c.carCategory)}</td>
                  <td className="py-3 text-gray-600">{formatCurrency(c.securityDeposit)}</td>
                  <td className="py-3 text-gray-600">{c.freeKmPerDay} km</td>
                  <td className="py-3 text-gray-600">
                    {c.overageRatePerKm != null ? formatCurrency(c.overageRatePerKm) + '/km' : <span className="text-gray-400">Uses car's ₹/km</span>}
                  </td>
                  <td className="py-3 text-gray-600">{formatCurrency(c.lateReturnPenaltyPerHour)}</td>
                  <td className="py-3 text-gray-600">{c.refundWindowDays} day{c.refundWindowDays === 1 ? '' : 's'}</td>
                  <td className="py-3">
                    <span className={c.enabled ? 'badge-success' : 'badge-gray'}>{c.enabled ? 'Enabled' : 'Disabled'}</span>
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-orange-500 p-1.5"><FiEdit2 size={14} /></button>
                    <button onClick={() => handleDelete(c.configId)} disabled={deleting === c.configId}
                      className="text-gray-400 hover:text-red-500 p-1.5"><FiTrash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">{editing ? 'Edit' : 'New'} Self-Drive Config</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="form-label">Car Category *</label>
                <select {...register('carCategory', { required: 'Required' })} disabled={!!editing}
                  className="form-select disabled:bg-gray-100">
                  <option value="">Select category</option>
                  {(editing ? CAR_CATEGORIES : availableCategories).map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                {errors.carCategory && <p className="form-error">{errors.carCategory.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Security Deposit (₹) *</label>
                  <input type="number" step="0.01" {...register('securityDeposit', { required: 'Required', min: 0 })}
                    className="form-input" placeholder="3000" />
                  {errors.securityDeposit && <p className="form-error">{errors.securityDeposit.message}</p>}
                </div>
                <div>
                  <label className="form-label">Free KM / Day *</label>
                  <input type="number" step="0.1" {...register('freeKmPerDay', { required: 'Required', min: 0 })}
                    className="form-input" placeholder="150" />
                  {errors.freeKmPerDay && <p className="form-error">{errors.freeKmPerDay.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Overage Rate (₹/km)</label>
                  <input type="number" step="0.01" {...register('overageRatePerKm')} className="form-input"
                    placeholder="Leave blank to use car's own ₹/km" />
                </div>
                <div>
                  <label className="form-label">Late Return Penalty (₹/hr) *</label>
                  <input type="number" step="0.01" {...register('lateReturnPenaltyPerHour', { required: 'Required', min: 0 })}
                    className="form-input" placeholder="100" />
                  {errors.lateReturnPenaltyPerHour && <p className="form-error">{errors.lateReturnPenaltyPerHour.message}</p>}
                </div>
              </div>
              <div>
                <label className="form-label">Deposit Refund Window (days) *</label>
                <input type="number" {...register('refundWindowDays', { required: 'Required', min: 1 })}
                  className="form-input" placeholder="5" />
                {errors.refundWindowDays && <p className="form-error">{errors.refundWindowDays.message}</p>}
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" {...register('enabled')} className="w-4 h-4" defaultChecked /> Enabled for booking
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-60">
                  <FiSave size={14} /> {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
