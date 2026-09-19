import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { driverService } from '../../services/allServices'
import AdminLayout from '../../components/layout/AdminLayout'
import { FiPlus, FiEdit2, FiTrash2, FiX, FiSave, FiTruck } from 'react-icons/fi'

const EMPTY = { firstName: '', lastName: '', email: '', password: '', mobileNumber: '', licenseNumber: '' }

export default function ManageDrivers() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ defaultValues: EMPTY })
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [sortKey, setSortKey] = useState('status')
  const [sortDir, setSortDir] = useState('asc')

  useEffect(() => { fetchDrivers() }, [])

  const fetchDrivers = async () => {
    setLoading(true)
    try {
      const res = await driverService.getAll()
      setDrivers(res.data.data || [])
    } catch {
      toast.error('Failed to load drivers.')
    } finally {
      setLoading(false)
    }
  }

  const openAdd = () => { setEditing(null); reset(EMPTY); setShowForm(true) }
  const openEdit = (d) => {
    setEditing(d)
    reset({
      firstName: d.firstName, lastName: d.lastName, email: d.email, password: '',
      mobileNumber: d.mobileNumber, licenseNumber: d.licenseNumber || '',
    })
    setShowForm(true)
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      const res = editing
        ? await driverService.update(editing.driverId, data)
        : await driverService.register(data)
      if (res.data.success) {
        toast.success(editing ? 'Driver updated!' : 'Driver added!')
        setShowForm(false)
        fetchDrivers()
      } else {
        toast.error(res.data.message || 'Failed to save.')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save driver.')
    } finally {
      setSaving(false)
    }
  }

  const [statusUpdating, setStatusUpdating] = useState(null)

  const handleToggleStatus = async (driver) => {
    const newStatus = driver.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setStatusUpdating(driver.driverId)
    try {
      await driverService.updateStatus(driver.driverId, newStatus)
      toast.success('Driver marked ' + newStatus.toLowerCase() + '.')
      fetchDrivers()
    } catch {
      toast.error('Failed to update status.')
    } finally {
      setStatusUpdating(null)
    }
  }

  const handleDelete = async (driverId) => {
    if (!window.confirm('Deactivate this driver? They will no longer be able to log in or be assigned new bookings.')) return
    setDeleting(driverId)
    try {
      await driverService.delete(driverId)
      toast.success('Driver deactivated.')
      fetchDrivers()
    } catch {
      toast.error('Failed to deactivate.')
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

  // Sorting — click a column header to sort by it, click again to flip direction. Defaults to
  // ACTIVE drivers first, so the ones actually available for a trip assignment surface before
  // inactive ones.
  const DRIVER_STATUS_PRIORITY = { ACTIVE: 0, INACTIVE: 1 }
  const DRIVER_SORTERS = {
    name:   d => (d.firstName + ' ' + d.lastName).toLowerCase(),
    status: d => DRIVER_STATUS_PRIORITY[d.status] ?? 9,
  }
  const sorted = [...drivers].sort((a, b) => {
    const getter = DRIVER_SORTERS[sortKey] || DRIVER_SORTERS.status
    const av = getter(a), bv = getter(b)
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }
  const SortHeader = ({ sortKeyName, children }) => (
    <th onClick={() => toggleSort(sortKeyName)} className="pb-3 cursor-pointer select-none hover:text-gray-600">
      {children} {sortKey === sortKeyName && (sortDir === 'asc' ? '▲' : '▼')}
    </th>
  )

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <FiTruck className="text-orange-500" /> Drivers
          </h2>
          <p className="text-gray-500 text-sm mt-1">Manage driver accounts. Assign them to bookings from Reservations.</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 px-4 py-2.5">
          <FiPlus size={16} /> New Driver
        </button>
      </div>

      {drivers.length === 0 ? (
        <div className="text-center py-20 card">
          <p className="text-5xl mb-4">🚕</p>
          <p className="text-xl font-bold text-gray-700 mb-2">No drivers yet</p>
          <button onClick={openAdd} className="btn-primary px-6 py-2.5 mt-2">Add your first driver</button>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase border-b border-gray-100">
                <SortHeader sortKeyName="name">Name</SortHeader>
                <th className="pb-3">Email</th>
                <th className="pb-3">Mobile</th>
                <th className="pb-3">License</th>
                <SortHeader sortKeyName="status">Status</SortHeader>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(d => (
                <tr key={d.driverId} className="border-b border-gray-50">
                  <td className="py-3 font-semibold text-gray-800">{d.firstName} {d.lastName}</td>
                  <td className="py-3 text-gray-600">{d.email}</td>
                  <td className="py-3 text-gray-600">{d.mobileNumber}</td>
                  <td className="py-3 text-gray-500">{d.licenseNumber || '—'}</td>
                  <td className="py-3">
                    <button onClick={() => handleToggleStatus(d)} disabled={statusUpdating === d.driverId}
                      title="Click to toggle status"
                      className={(d.status === 'ACTIVE' ? 'badge-success' : 'badge-gray') + ' cursor-pointer disabled:opacity-50'}>
                      {statusUpdating === d.driverId ? '...' : d.status}
                    </button>
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => openEdit(d)} className="text-gray-400 hover:text-orange-500 p-1.5"><FiEdit2 size={14} /></button>
                    <button onClick={() => handleDelete(d.driverId)} disabled={deleting === d.driverId}
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
              <h3 className="text-lg font-bold text-gray-800">{editing ? 'Edit' : 'New'} Driver</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">First Name *</label>
                  <input {...register('firstName', { required: 'Required' })} className="form-input" />
                  {errors.firstName && <p className="form-error">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="form-label">Last Name *</label>
                  <input {...register('lastName', { required: 'Required' })} className="form-input" />
                  {errors.lastName && <p className="form-error">{errors.lastName.message}</p>}
                </div>
              </div>
              <div>
                <label className="form-label">Email *</label>
                {/* Bug fix: this used to be disabled={!!editing}, so the field looked read-only
                    the moment an Admin opened "Edit" on an existing driver — the email could
                    never actually be changed from this form no matter what the backend allowed.
                    It's now editable in both Add and Edit mode; the backend (updateDriver) does
                    its own normalize + uniqueness check before saving a changed email. */}
                <input type="email" {...register('email', { required: 'Required' })}
                  className="form-input" placeholder="driver@rentmyride.com" />
                {errors.email && <p className="form-error">{errors.email.message}</p>}
              </div>
              {!editing && (
                <div>
                  <label className="form-label">Password *</label>
                  <input type="password" {...register('password', { required: 'Required', minLength: { value: 6, message: 'Min 6 characters' } })}
                    className="form-input" />
                  {errors.password && <p className="form-error">{errors.password.message}</p>}
                </div>
              )}
              <div>
                <label className="form-label">Mobile Number *</label>
                <input {...register('mobileNumber', { required: 'Required' })} className="form-input" placeholder="9876543210" />
                {errors.mobileNumber && <p className="form-error">{errors.mobileNumber.message}</p>}
              </div>
              <div>
                <label className="form-label">License Number</label>
                <input {...register('licenseNumber')} className="form-input" placeholder="Optional" />
              </div>

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
